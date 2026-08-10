/**
 * Integrationstester för CLEARANCE API v1.
 *
 * Mot en RIKTIG Postgres med hela schemat, genom hela HTTP-lagret. Inga
 * attrapper: poängen med det här API:t är att radskyddet ska bära
 * behörigheten, och ett test mot en attrappdatabas bevisar ingenting om
 * det.
 *
 * Två av kontrollerna nedan är de viktigaste i hela projektet, eftersom
 * de fel de fångar INTE syns som fel:
 *
 *  * "en användare ser inte ett annat bolags ärende" - ett trasigt
 *    radskydd returnerar fortfarande rader, bara fel rader.
 *  * "identiteten läcker inte mellan requests på samma anslutning" -
 *    sessionslokal `set_config` på en poolad anslutning gör att request
 *    B ärver request A:s identitet. Det händer bara under samtidighet,
 *    aldrig i utvecklarens webbläsare, och det är därför det måste
 *    testas här.
 *
 * Körs av api/tests/run.sh, som reser databasen först.
 */

import { createApiServer, handle } from "../server/index";
import { closePool, provaDatabasroll, withAnon, withUser } from "../server/db";
import { hashPassword, sha256, verifyPassword } from "../server/auth";
import { nollstallGranser, provaGrans } from "../server/rateLimit";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

/**
 * Svaret som testet ser det. `body` är avsiktligt löst typad: sviten
 * prövar vad API:t FAKTISKT svarar, inte vad typerna lovar - ett test som
 * bara kan uttrycka det typade lyckliga fallet fångar inte fel svarsform.
 */
type Json = Record<string, unknown> & { [key: string]: never | unknown };
type Res = { status: number; body: Json };

const call = (
  method: string,
  path: string,
  opts: { token?: string; apiKey?: string; body?: unknown } = {},
): Promise<Res> => {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  // Kontraktet deklarerar EN mekanism: Authorization: Bearer.
  if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;
  return handle(method, path, headers, opts.body, new URLSearchParams()) as Promise<Res>;
};

/* --- Fixturer -------------------------------------------------------------- */

const AGNES = "11111111-1111-1111-1111-111111111111";
const BERTIL = "22222222-2222-2222-2222-222222222222";
const CASE_A = "aaaaaaaa-0000-0000-0000-00000000000a";
const CASE_B = "bbbbbbbb-0000-0000-0000-00000000000b";

const seed = async () => {
  const agnesHash = await hashPassword("hemligt-losen-agnes");
  const bertilHash = await hashPassword("hemligt-losen-bertil");
  // Seedas som ägaren, alltså förbi radskyddet: fixturerna ska inte bero
  // på de policyer som är under test.
  await withAnon(async (tx) => {
    await tx.query(
      `insert into auth.users (id, email, password_hash) values ($1, $2, $3), ($4, $5, $6)
       on conflict (id) do nothing`,
      [AGNES, "agnes@bolag-a.se", agnesHash, BERTIL, "bertil@bolag-b.se", bertilHash],
    );
    await tx.query(
      `insert into public.user_profiles (user_id, display_name) values ($1, 'Agnes'), ($2, 'Bertil')
       on conflict (user_id) do nothing`,
      [AGNES, BERTIL],
    );
    await tx.query(
      `insert into public.cases (id, user_id, org_number, company_name)
       values ($1, $2, '556000-0001', 'Bolag A AB'), ($3, $4, '556000-0002', 'Bolag B AB')
       on conflict (id) do nothing`,
      [CASE_A, AGNES, CASE_B, BERTIL],
    );
  });
};

await seed();

/* --- 1. Hälsa och okända resurser ----------------------------------------- */

check("hälsokontrollen svarar", (await call("GET", "/v1/health")).status === 200);

const unknown = await call("GET", "/v1/finns-inte");
check("okänd resurs ger 404", unknown.status === 404);
check("felet har kontraktets form", typeof unknown.body?.error?.code === "string" && typeof unknown.body?.error?.message === "string", unknown.body);

const wrongMethod = await call("GET", "/v1/auth/login");
check("känd sökväg med fel metod ger 405, inte 404", wrongMethod.status === 405, wrongMethod);

/* --- 2. Inloggning --------------------------------------------------------- */

const noAuth = await call("GET", "/v1/cases");
check("utan token nekas åtkomst", noAuth.status === 401);

const badPassword = await call("POST", "/v1/auth/login", {
  body: { email: "agnes@bolag-a.se", password: "fel" },
});
check("fel lösenord ger 401", badPassword.status === 401);

const unknownUser = await call("POST", "/v1/auth/login", {
  body: { email: "finns.inte@example.se", password: "fel" },
});
check("okänd adress ger 401", unknownUser.status === 401);
// Samma ord, annars är felmeddelandet en kontolista.
check(
  "okänd adress och fel lösenord ger samma besked",
  unknownUser.body.error.message === badPassword.body.error.message,
  [unknownUser.body.error.message, badPassword.body.error.message],
);

const login = await call("POST", "/v1/auth/login", {
  body: { email: "agnes@bolag-a.se", password: "hemligt-losen-agnes" },
});
check("rätt uppgifter ger en session", login.status === 200 && typeof login.body.token === "string", login.body);
const agnesToken: string = login.body.token;

// Token får aldrig ligga i klartext i databasen.
const storedTokens = await withAnon(async (tx) => {
  const { rows } = await tx.query("select token_hash from auth.sessions");
  return rows.map((r) => r.token_hash as string);
});
check("token lagras aldrig i klartext", !storedTokens.includes(agnesToken));
check("token lagras som hash", storedTokens.length > 0 && storedTokens.every((h) => /^[0-9a-f]{64}$/.test(h)));

const me = await call("GET", "/v1/auth/me", { token: agnesToken });
check("me svarar med rätt användare", me.status === 200 && me.body.userId === AGNES, me.body);
check("me hämtar profilen genom radskyddet", me.body.displayName === "Agnes");

const bogus = await call("GET", "/v1/auth/me", { token: "det-har-ar-ingen-token" });
check("påhittad token nekas", bogus.status === 401);

/* --- 3. Radskyddet bär behörigheten --------------------------------------- */

const bertilLogin = await call("POST", "/v1/auth/login", {
  body: { email: "bertil@bolag-b.se", password: "hemligt-losen-bertil" },
});
const bertilToken: string = bertilLogin.body.token;

const agnesCases = await call("GET", "/v1/cases", { token: agnesToken });
check("ärendelistan svarar", agnesCases.status === 200, agnesCases.body);
check("Agnes ser sitt eget ärende", (agnesCases.body.cases ?? []).some((c: Json) => c.id === CASE_A), agnesCases.body);
check(
  "Agnes ser INTE Bertils ärende",
  !(agnesCases.body.cases ?? []).some((c: Json) => c.id === CASE_B),
  (agnesCases.body.cases ?? []).map((c: Json) => c.companyName),
);

const crossRead = await call("GET", `/v1/cases/${CASE_B}`, { token: agnesToken });
check("direktuppslag på annans ärende nekas", crossRead.status === 404, crossRead.body);
check(
  "svaret avslöjar inte att ärendet finns",
  !JSON.stringify(crossRead.body).includes("Bolag B"),
  crossRead.body,
);

const bertilOwn = await call("GET", `/v1/cases/${CASE_B}`, { token: bertilToken });
check("Bertil ser sitt eget ärende", bertilOwn.status === 200 && bertilOwn.body.companyName === "Bolag B AB");

/* --- 4. Identiteten läcker inte mellan requests --------------------------- */
//
// Den farligaste buggen i systemet: sessionslokal set_config på en poolad
// anslutning läcker föregående requests identitet till nästa. Den syns
// bara under samtidighet. Här körs många växlade requests genom SAMMA
// pool - hade identiteten varit sessionslokal hade minst en av Bertils
// läsningar sett Agnes ärende, eller tvärtom.

const interleaved = await Promise.all(
  Array.from({ length: 24 }, (_, i) =>
    i % 2 === 0
      ? call("GET", "/v1/cases", { token: agnesToken }).then((r) => ({ who: "agnes", r }))
      : call("GET", "/v1/cases", { token: bertilToken }).then((r) => ({ who: "bertil", r })),
  ),
);
const leaked = interleaved.filter(({ who, r }) => {
  const ids = (r.body.cases ?? []).map((c: Json) => c.id);
  return who === "agnes" ? ids.includes(CASE_B) : ids.includes(CASE_A);
});
check("identiteten läcker inte mellan samtidiga requests", leaked.length === 0, leaked.length);
check(
  "alla samtidiga requests fick ETT ärende var",
  interleaved.every(({ r }) => (r.body.cases ?? []).length === 1),
  interleaved.map(({ r }) => (r.body.cases ?? []).length),
);

/* --- 5. Beslutsminnet och omprövningsbevakningen -------------------------- */

const created = await call("POST", `/v1/cases/${CASE_A}/decisions`, {
  token: agnesToken,
  body: {
    title: "Avvakta med rekonstruktionsansökan",
    rationale: "Beslut efter samtal med rådgivaren.",
    premise: "Beslutet vilar på att tillgångarna täcker minst 45 % av skulderna.",
    watch: { signal: "skuldtackning", comparator: "minst", threshold: 45 },
  },
});
check("beslutet protokollförs", created.status === 201, created.body);
check("villkoret kommer tillbaka i svaret", created.body.watch?.threshold === 45, created.body.watch);
const decisionId: string = created.body.id;

const halfWatch = await call("POST", `/v1/cases/${CASE_A}/decisions`, {
  token: agnesToken,
  body: { title: "Halvt villkor", rationale: "Skäl.", watch: { signal: "skuldtackning", comparator: "minst" } },
});
check("ett numeriskt villkor utan tröskel avvisas", halfWatch.status === 400, halfWatch.body);

const boolWithThreshold = await call("POST", `/v1/cases/${CASE_A}/decisions`, {
  token: agnesToken,
  body: { title: "Fel form", rationale: "Skäl.", watch: { signal: "loner", comparator: "sant", threshold: 3 } },
});
check("ett ja/nej-villkor med tröskel avvisas", boolWithThreshold.status === 400);

const unknownSignal = await call("POST", `/v1/cases/${CASE_A}/decisions`, {
  token: agnesToken,
  body: { title: "Okänd storhet", rationale: "Skäl.", watch: { signal: "vaderleken", comparator: "minst", threshold: 1 } },
});
check("okänd storhet avvisas", unknownSignal.status === 400);

const foreignWrite = await call("POST", `/v1/cases/${CASE_B}/decisions`, {
  token: agnesToken,
  body: { title: "Beslut i annans ärende", rationale: "Skäl." },
});
check("man kan inte protokollföra i någon annans ärende", foreignWrite.status >= 400, foreignWrite);

const ack = await call("POST", `/v1/decisions/${decisionId}/acknowledge-premise`, {
  token: agnesToken,
  body: { observation: "Skuldtäckningen är 30 %" },
});
check("kvitteringen går igenom", ack.status === 200, ack.body);

const afterAck = await call("GET", `/v1/cases/${CASE_A}/decisions`, { token: agnesToken });
const theDecision = afterAck.body.decisions.find((d: Json) => d.id === decisionId);
check("kvitteringen syns i beslutet", theDecision?.watchAckObservation === "Skuldtäckningen är 30 %");
check("kvitteringen är tidsstämplad av servern", typeof theDecision?.watchAckAt === "string");

const foreignAck = await call("POST", `/v1/decisions/${decisionId}/acknowledge-premise`, {
  token: bertilToken,
  body: { observation: "Står fast" },
});
check("en utomstående kan inte kvittera beslutet", foreignAck.status >= 400, foreignAck);

const journal = await call("GET", `/v1/cases/${CASE_A}/journal`, { token: agnesToken });
check("kvitteringen journalförs", journal.body.events.some((e: Json) => e.action === "premise_acknowledged"), journal.body.events?.slice(0, 3));

const foreignJournal = await call("GET", `/v1/cases/${CASE_B}/journal`, { token: agnesToken });
check("journalen för annans ärende är tom", (foreignJournal.body.events ?? []).length === 0);

const reconsider = await call("POST", `/v1/decisions/${decisionId}/reconsider`, {
  token: agnesToken,
  body: { note: "Täckningen föll." },
});
check("omprövningen registreras", reconsider.status === 200 && reconsider.body.status === "reconsidered");
check("originalet står kvar", reconsider.body.title === "Avvakta med rekonstruktionsansökan");
check("villkoret står kvar efter omprövning", reconsider.body.watch?.threshold === 45);

const ackAfter = await call("POST", `/v1/decisions/${decisionId}/acknowledge-premise`, {
  token: agnesToken,
  body: { observation: "Något annat" },
});
check("ett omprövat beslut kan inte kvitteras", ackAfter.status === 409, ackAfter);

/* --- 5b. Journalen med API-nyckel: vägen som aldrig var testad ------------ */
//
// Den här vägen låg i koden från början men ingen kontroll gick genom
// den, och den var fel: `select * from api_journal(...)` behandlade en
// JSONB-retur som en radmängd, så svaret hade formen
// [{ api_journal: {...} }]. En integration byggd på kontraktet hade
// aldrig kunnat läsa det.

// Nyckeln ägs av den som skapar den: create_api_key läser auth.uid(),
// så den måste köras som Agnes och inte anonymt.
const apiKey = await withUser(AGNES, async (tx) => {
  const { rows } = await tx.query<{ secret: string }>(
    "select secret from public.create_api_key($1)",
    ["Revisionens nyckel"],
  );
  return rows[0]?.secret ?? null;
});
check("en API-nyckel går att skapa", typeof apiKey === "string" && apiKey.startsWith("clr_"), apiKey);

if (apiKey) {
  const byKey = await call("GET", `/v1/cases/${CASE_A}/journal`, { apiKey });
  check("journalen svarar på nyckeln i Authorization-huvudet", byKey.status === 200, byKey.body);
  check("svaret har kontraktets form", Array.isArray(byKey.body.events), byKey.body);
  check("svaret säger vilket ärende det gäller", byKey.body.case_id === CASE_A, byKey.body);
  check(
    "händelserna bär sina fält",
    (byKey.body.events as Json[]).every((e) => typeof e.action === "string" && typeof e.occurred_at === "string"),
    (byKey.body.events as Json[])[0],
  );

  // Samma tystnad för okänd nyckel som för ärende utan åtkomst.
  const okand = await call("GET", `/v1/cases/${CASE_A}/journal`, { apiKey: "clr_" + "0".repeat(48) });
  const utanAtkomst = await call("GET", `/v1/cases/${CASE_B}/journal`, { apiKey });
  check("okänd nyckel nekas", okand.status === 404, okand.body);
  check("nyckel utan åtkomst till ärendet nekas", utanAtkomst.status === 404, utanAtkomst.body);
  check(
    "okänd nyckel och saknad åtkomst ger SAMMA svar",
    JSON.stringify(okand.body) === JSON.stringify(utanAtkomst.body),
    [okand.body, utanAtkomst.body],
  );
}

/* --- 5c. Översiktens data ------------------------------------------------- */
//
// Milstolpen: allt startsidan behöver ska gå att hämta ur EGET API. Varje
// resurs prövas två gånger - att den egna kretsen ser sitt, och att en
// utomstående ser TOMT och inte ett fel. Tystnaden är samma överallt.

await withAnon(async (tx) => {
  await tx.query(
    `insert into public.case_tasks (case_id, label, source) values ($1, 'Betala skatten', 'recommendation')
     on conflict do nothing`,
    [CASE_A],
  );
  await tx.query(
    `insert into public.payments (case_id, user_id, label, amount, category, status, due_date)
     values ($1, $2, 'Moms', 165000, 'tax', 'pending', now() + interval '8 days')`,
    [CASE_A, AGNES],
  );
  await tx.query(
    `insert into public.kbr_assessments
       (case_id, user_id, share_capital, total_assets, total_liabilities, status)
     values ($1, $2, 100000, 950000, 3200000, 'critical')`,
    [CASE_A, AGNES],
  );
  await tx.query(
    `insert into public.case_documents (case_id, user_id, kind, file_name, file_size, mime_type, storage_path, source)
     values ($1, $2, 'other', 'kontoutdrag.csv', 2048, 'text/csv', $3, 'manual')`,
    [CASE_A, AGNES, `${CASE_A}/kontoutdrag.csv`],
  );
});

const uppgifter = await call("GET", `/v1/cases/${CASE_A}/tasks`, { token: agnesToken });
check("uppgifterna hämtas", uppgifter.status === 200 && (uppgifter.body.tasks as Json[]).length >= 1, uppgifter.body);
check(
  "uppgiften bär kontraktets fältnamn",
  (uppgifter.body.tasks as Json[])[0]?.label === "Betala skatten" &&
    "doneAt" in ((uppgifter.body.tasks as Json[])[0] ?? {}),
  (uppgifter.body.tasks as Json[])[0],
);
check(
  "en utomstående ser inga uppgifter",
  ((await call("GET", `/v1/cases/${CASE_A}/tasks`, { token: bertilToken })).body.tasks as Json[]).length === 0,
);

const betalningar = await call("GET", `/v1/cases/${CASE_A}/payments`, { token: agnesToken });
check("betalningarna hämtas", betalningar.status === 200 && (betalningar.body.payments as Json[]).length >= 1, betalningar.body);
check("beloppet är ett tal, inte en sträng", typeof (betalningar.body.payments as Json[])[0]?.amount === "number");
check(
  "en utomstående ser inga betalningar",
  ((await call("GET", `/v1/cases/${CASE_A}/payments`, { token: bertilToken })).body.payments as Json[]).length === 0,
);

const handlingar = await call("GET", `/v1/cases/${CASE_A}/documents`, { token: agnesToken });
check("dokumenten hämtas", handlingar.status === 200 && (handlingar.body.documents as Json[]).length >= 1, handlingar.body);
// storage_path är nyckeln till hinken. Den får aldrig ut till klienten:
// vägen till innehållet går genom en signerad URL efter behörighetsprövning.
check(
  "dokumentets lagringssökväg läcker inte ut",
  !JSON.stringify(handlingar.body).includes("storage") && !JSON.stringify(handlingar.body).includes(CASE_A + "/"),
  handlingar.body,
);
check(
  "en utomstående ser inga dokument",
  ((await call("GET", `/v1/cases/${CASE_A}/documents`, { token: bertilToken })).body.documents as Json[]).length === 0,
);

const kbr = await call("GET", `/v1/cases/${CASE_A}/kbr`, { token: agnesToken });
check("kontrollbalansbedömningen hämtas", kbr.status === 200 && kbr.body.status === "critical", kbr.body);
const kbrUtan = await call("GET", `/v1/cases/${CASE_B}/kbr`, { token: bertilToken });
check("ingen bedömning ger null, inte 404", kbrUtan.status === 200 && kbrUtan.body === null, kbrUtan.body);

const meddelanden = await call("GET", `/v1/cases/${CASE_A}/messages`, { token: agnesToken });
check("meddelandena hämtas", meddelanden.status === 200 && Array.isArray(meddelanden.body.messages), meddelanden.body);

/* --- 5d. Skrivvägarna ------------------------------------------------------ */
//
// Radskyddets skrivpolicyer avgör om något får ske. En nekad skrivning
// träffar NOLL rader i stället för att kasta fel, så kontrollerna mäter
// utfallet - ändrades något? - och inte vilket lager som sa nej.

const nyUppgift = await call("POST", `/v1/cases/${CASE_A}/tasks`, {
  token: agnesToken,
  body: { label: "Ring revisorn", dueDate: null },
});
check("uppgiften läggs till", nyUppgift.status === 201 && nyUppgift.body.label === "Ring revisorn", nyUppgift.body);
check("den nya uppgiften är inte avbockad", nyUppgift.body.doneAt === null);
const taskId = nyUppgift.body.id as string;

const frammandeUppgift = await call("POST", `/v1/cases/${CASE_B}/tasks`, {
  token: agnesToken,
  body: { label: "Uppgift i annans ärende" },
});
check("man kan inte lägga uppgifter i någon annans ärende", frammandeUppgift.status >= 400, frammandeUppgift);

const bockad = await call("POST", `/v1/tasks/${taskId}/done`, { token: agnesToken, body: { done: true } });
check("uppgiften bockas av", bockad.status === 200 && typeof bockad.body.doneAt === "string", bockad.body);
// Vem OCH när, tillsammans: ett halvt svar på "vem gjorde vad när" är
// inget svar, och tidsstämpeln sätts av servern - inte av klienten.
check("avbockningen bär vem som gjorde det", bockad.body.doneBy === AGNES, bockad.body);
check(
  "tidpunkten kommer från servern, inte från klienten",
  new Date(bockad.body.doneAt as string).getTime() > Date.now() - 60_000,
  bockad.body.doneAt,
);

const angrad = await call("POST", `/v1/tasks/${taskId}/done`, { token: agnesToken, body: { done: false } });
check("avbockningen går att ångra", angrad.body.doneAt === null && angrad.body.doneBy === null, angrad.body);
check(
  "done måste vara ett ja eller nej",
  (await call("POST", `/v1/tasks/${taskId}/done`, { token: agnesToken, body: { done: "kanske" } })).status === 400,
);
check(
  "en utomstående kan inte bocka av uppgiften",
  (await call("POST", `/v1/tasks/${taskId}/done`, { token: bertilToken, body: { done: true } })).status === 404,
);

const tilldelad = await call("POST", `/v1/tasks/${taskId}/assign`, { token: agnesToken, body: { userId: AGNES } });
check("uppgiften går att delegera", tilldelad.status === 200 && tilldelad.body.assignedTo === AGNES, tilldelad.body);
check(
  "tilldelningen går att ta bort",
  ((await call("POST", `/v1/tasks/${taskId}/assign`, { token: agnesToken, body: { userId: null } })).body).assignedTo === null,
);

const skickat = await call("POST", `/v1/cases/${CASE_A}/messages`, {
  token: agnesToken,
  body: { body: "Har vi fått svar från banken?" },
});
check("meddelandet skickas", skickat.status === 201 && skickat.body.body === "Har vi fått svar från banken?", skickat.body);
check("avsändaren sätts av servern", skickat.body.authorUserId === AGNES, skickat.body);
check(
  "en utomstående kan inte skriva i ärendet",
  (await call("POST", `/v1/cases/${CASE_A}/messages`, { token: bertilToken, body: { body: "Hej" } })).status >= 400,
);
check(
  "meddelandet syns i tråden efteråt",
  ((await call("GET", `/v1/cases/${CASE_A}/messages`, { token: agnesToken })).body.messages as Json[])
    .some((m) => m.body === "Har vi fått svar från banken?"),
);

// Granskningsstämpeln: godkännande kräver rådgivarroll, och den regeln
// bor i databasfunktionen - API:t gör ingen egen bedömning vid sidan om.
const doc = await call("GET", `/v1/cases/${CASE_A}/documents`, { token: agnesToken });
const docId = (doc.body.documents as Json[])[0]?.id as string;
const begard = await call("POST", `/v1/documents/${docId}/review`, {
  token: agnesToken,
  body: { action: "request" },
});
check("granskning går att begära", begard.status === 200, begard.body);
check(
  "okänd åtgärd avvisas",
  (await call("POST", `/v1/documents/${docId}/review`, { token: agnesToken, body: { action: "radera" } })).status === 400,
);
check(
  "företagaren kan inte godkänna sitt eget underlag",
  (await call("POST", `/v1/documents/${docId}/review`, { token: agnesToken, body: { action: "approve" } })).status >= 400,
);

/* --- 6. Indata som inte duger --------------------------------------------- */

const badUuid = await call("GET", "/v1/cases/inte-ett-id", { token: agnesToken });
check("trasigt id ger 400 med begripligt besked", badUuid.status === 400 && /giltigt id/.test(badUuid.body.error.message));

const missingField = await call("POST", `/v1/cases/${CASE_A}/decisions`, {
  token: agnesToken,
  body: { rationale: "Utan titel." },
});
check("saknat fält ger 400 och namnger fältet", missingField.status === 400 && /title/.test(missingField.body.error.message));

/* --- 7. Utloggning -------------------------------------------------------- */

check("utloggning svarar", (await call("POST", "/v1/auth/logout", { token: agnesToken })).status === 200);
check("den återkallade sessionen är död", (await call("GET", "/v1/auth/me", { token: agnesToken })).status === 401);

/* --- 8. Lösenordshashningen ----------------------------------------------- */

const hash = await hashPassword("ett-losenord");
check("hashen bär sina egna parametrar", /^scrypt\$\d+\$\d+\$\d+\$/.test(hash), hash.slice(0, 24));
check("rätt lösenord verifieras", await verifyPassword("ett-losenord", hash));
check("fel lösenord underkänns", !(await verifyPassword("fel-losenord", hash)));
check("två hashningar av samma lösenord skiljer sig (salt)", hash !== (await hashPassword("ett-losenord")));
check("skräp i hashfältet underkänns tyst", !(await verifyPassword("ett-losenord", "inte-en-hash")));

/* --- 8b. Profilen ---------------------------------------------------------- */

const agnesProfil = await call("GET", "/v1/profile", { token: bertilToken });
check("profilen går att hämta", agnesProfil.status === 200, agnesProfil.body);

// Uppdateringen får inte kunna ändra rollen. En företagare som blir
// rådgivare ska gå genom ansökan.
const rollForsok = await call("PATCH", "/v1/profile", {
  token: bertilToken,
  body: { displayName: "Bertil B", phone: "0700000000", role: "admin" },
});
check("profilen går att uppdatera", rollForsok.status === 200, rollForsok.body);
const efterPatch = await call("GET", "/v1/profile", { token: bertilToken });
const profil = efterPatch.body.profile as { role?: string; displayName?: string } | null;
check("namnet ändrades", profil?.displayName === "Bertil B", profil);
check("men rollen gick inte att ändra via uppdateringen", profil?.role !== "admin", profil);

/* --- 8c. Delningslänkarna -------------------------------------------------- */

const skapad = await call("POST", `/v1/cases/${CASE_B}/share-links`, {
  token: bertilToken,
  body: { scope: "overview", label: "Till banken", validDays: 7 },
});
check("en delningslänk går att skapa", skapad.status === 201, skapad.body);
const linkId = (skapad.body as { id?: string }).id ?? "";

// Giltighetstiden KLÄMS, den avvisas inte - och taket ska gälla, annars
// är en länk utan bortre gräns bara en siffra bort.
const orimlig = await call("POST", `/v1/cases/${CASE_B}/share-links`, {
  token: bertilToken,
  body: { scope: "full", validDays: 99999 },
});
check("orimlig giltighetstid kläms i stället för att avvisas", orimlig.status === 201, orimlig.body);
const utgang = new Date(String((orimlig.body as { expiresAt?: string }).expiresAt));
const dagar = (utgang.getTime() - Date.now()) / 86_400_000;
check("och taket är ett år", dagar > 364 && dagar < 366, dagar);

const listade = await call("GET", `/v1/cases/${CASE_B}/share-links`, { token: bertilToken });
check("länkarna listas för ärendet", (listade.body.shareLinks as unknown[]).length === 2, listade.body);

/*
 * DEN VIKTIGASTE KONTROLLEN I AVSNITTET: en annan användares ärende ska
 * inte gå att dela. Radskyddet gör urvalet, och ett insert som inte
 * träffar någon policy ger noll rader - vilket handlern ska översätta
 * till ett nej, inte till en länk som pekar på ingenting.
 */
/*
 * NY INLOGGNING FÖR AGNES. Avsnitt 7 loggade ut henne, och en återkallad
 * session ger 401 - vilket hade sett ut som ett bevis på att radskyddet
 * höll, fast det bara var en död token. Ett test som får rätt svar av fel
 * skäl är värre än ett rött test.
 */
const agnesIgen = await call("POST", "/v1/auth/login", {
  body: { email: "agnes@bolag-a.se", password: "hemligt-losen-agnes" },
});
const annanToken: string = agnesIgen.body.token;
check("den utloggade kan logga in igen", agnesIgen.status === 200 && !!annanToken);

const stulen = await call("POST", `/v1/cases/${CASE_B}/share-links`, {
  token: annanToken,
  body: { scope: "full", validDays: 30 },
});
check("en annan användare kan inte dela ärendet", stulen.status >= 400, stulen);
const agnesSer = await call("GET", `/v1/cases/${CASE_B}/share-links`, { token: annanToken });
check("och ser inte heller länkarna", (agnesSer.body.shareLinks as unknown[]).length === 0, agnesSer.body);

// Läsningen är ANONYM - det är hela poängen med en delningslänk.
const oppnad = await call("GET", `/v1/shared/${linkId}`);
check("länken går att läsa utan inloggning", oppnad.status === 200, oppnad.body);
check("och bär ärendets nuläge", oppnad.body.orgNumber === "556000-0002", oppnad.body);
// Scope styr vad som följer med. "overview" ska inte bära dokumentlistan.
check("overview bär inga dokument", oppnad.body.documents === null, oppnad.body.documents);

// Varje öppning loggas. Utan det går det inte att svara på vem som läst.
const efterLasning = await call("GET", `/v1/cases/${CASE_B}/share-links`, { token: bertilToken });
const denLanken = (efterLasning.body.shareLinks as { id: string; accessCount: number }[])
  .find((l) => l.id === linkId);
check("öppningen räknades", denLanken?.accessCount === 1, denLanken);

check("länken går att återkalla",
  (await call("DELETE", `/v1/share-links/${linkId}`, { token: bertilToken })).status === 200);
const efterAterkallelse = await call("GET", `/v1/shared/${linkId}`);
check("en återkallad länk går inte att läsa", efterAterkallelse.status === 404, efterAterkallelse.body);
// Ogiltig, utgången och återkallad ska se likadana ut för den som gissar.
const paHitt = await call("GET", "/v1/shared/00000000-0000-0000-0000-0000000000ff");
check("en påhittad token ger samma svar som en återkallad",
  paHitt.status === 404 && paHitt.body.error.message === efterAterkallelse.body.error.message,
  { paHitt: paHitt.body, aterkallad: efterAterkallelse.body });

// Att trycka två gånger ska inte bli ett fel: den som återkallar igen har
// redan fått det den ville ha.
const igen = await call("DELETE", `/v1/share-links/${linkId}`, { token: bertilToken });
check("dubbel återkallelse är inget fel", igen.status === 200 && igen.body.alreadyRevoked === true, igen.body);

/* --- 8d. Avslut och återöppning -------------------------------------------- */

const dåligtSkäl = await call("POST", `/v1/cases/${CASE_B}/close`, {
  token: bertilToken,
  body: { reason: "tröttnade" },
});
check("okänd exitorsak avvisas med besked",
  dåligtSkäl.status === 400 && /reason/.test(dåligtSkäl.body.error.message), dåligtSkäl.body);

check("ärendet går att avsluta med orsak",
  (await call("POST", `/v1/cases/${CASE_B}/close`, {
    token: bertilToken,
    body: { reason: "stabilized", note: "Klarade sig.", enterHealth: true },
  })).status === 200);

const avslutat = await call("GET", `/v1/cases/${CASE_B}`, { token: bertilToken });
check("avslutet syns på ärendet", avslutat.body.closedAt !== null, avslutat.body.closedAt);
check("exitorsaken sparades", avslutat.body.exitReason === "stabilized", avslutat.body.exitReason);
check("hälsoläget sattes", avslutat.body.healthMode === true, avslutat.body.healthMode);

check("ärendet går att återöppna",
  (await call("POST", `/v1/cases/${CASE_B}/reopen`, { token: bertilToken })).status === 200);
const ateroppnat = await call("GET", `/v1/cases/${CASE_B}`, { token: bertilToken });
check("och avslutet är borta", ateroppnat.body.closedAt === null, ateroppnat.body.closedAt);
// Ingenting raderas - akten består. Journalen ska bära båda händelserna.
const bJournal = await call("GET", `/v1/cases/${CASE_B}/journal`, { token: bertilToken });
type JournalPost = { action: string; objectType: string; detail: string | null; caseId: string | null };
const bPoster = bJournal.body.events as JournalPost[];
/*
 * Loggen skiljer INTE avslut från återöppning i sitt action-fält - båda
 * är "update" på cases. Det är vad datamodellen faktiskt registrerar, och
 * testet påstår därför inte något annat. Vad som prövas är att båda
 * ändringarna lämnade spår: ingenting raderas, akten består.
 */
check("både avslutet och återöppningen lämnade spår i journalen",
  bPoster.filter((e) => e.objectType === "cases" && e.action === "update").length >= 2,
  bPoster.map((e) => `${e.objectType}:${e.action}`).slice(0, 12));

/*
 * OCH ATT POSTERNA ÄR HELA. `audit.listByCase` är en migrerad port som
 * castar svaret rakt till AuditEventRecord. Servern returnerade sex av
 * tio fält, så caseId, actorUserId och `detail` föll bort - och utan
 * detail blir hela händelseloggen "update, update, insert" för den som
 * kör mot eget API, medan samma logg via den gamla adaptern är läsbar.
 * Ett fält som saknas i ett castat svar blir inte ett tomt fält, det blir
 * ett löfte som inte hålls.
 */
check("journalposterna bär ärendet de gäller", bPoster.every((e) => e.caseId === CASE_B), bPoster[0]);
check("och fältet detail finns på varje post",
  bPoster.every((e) => Object.hasOwn(e, "detail")), bPoster[0]);
check("bolagsnamnet står läsbart i posten om ärendet",
  bPoster.some((e) => e.objectType === "cases" && /Bolag B AB/.test(e.detail ?? "")),
  bPoster.filter((e) => e.objectType === "cases").map((e) => e.detail));

/* --- 8e. Kontaktinkorgen: öppen insert, admin-läsning via radskyddet ------ */

/*
 * Kontaktformuläret är sajtens enda skrivbara yta för oinloggade, och
 * inkorgen bakom det får bara administratörer läsa. Två invarianter prövas
 * mot en riktig databas: (1) servern, inte klienten, bestämmer user_id,
 * status och handläggare; (2) en icke-administratör ser en TOM inkorg och
 * kan inte handlägga - och får samma 404 som för ett okänt id, så att
 * inkorgens existens inte går att avläsa.
 */

// Agnes görs till driftadministratör; Bertil förblir vanlig användare.
// Seedas som ägaren, förbi radskyddet - fixturen ska inte bero på policyn.
await withAnon(async (tx) => {
  await tx.query(
    "insert into public.platform_admins (user_id, note) values ($1, 'test') on conflict (user_id) do nothing",
    [AGNES],
  );
});

// Agnes loggades ut i avsnitt 7; hämta en ny session för administratören.
const adminToken: string = (
  await call("POST", "/v1/auth/login", {
    body: { email: "agnes@bolag-a.se", password: "hemligt-losen-agnes" },
  })
).body.token as string;

const laesRad = (email: string) =>
  withAnon(async (tx) => {
    const { rows } = await tx.query(
      "select id, user_id, status, handled_by, handled_at, internal_note from public.contact_messages where email = $1 order by created_at desc limit 1",
      [email],
    );
    return rows[0];
  });

const anonSubmit = await call("POST", "/v1/contact", {
  body: {
    name: "Nöd AB",
    email: "nod@example.se",
    topic: "company",
    message: "Vi kan inte betala löner nästa vecka och vet inte vad vi ska göra.",
  },
});
check("kontaktformuläret tar emot utan inloggning", anonSubmit.status === 201, anonSubmit);
const anonRad = await laesRad("nod@example.se");
check("ett oinloggat meddelande får user_id null - servern, inte klienten, bestämmer", anonRad.user_id === null, anonRad);
check("och landar med status new", anonRad.status === "new");

const authedSubmit = await call("POST", "/v1/contact", {
  token: bertilToken,
  body: {
    name: "Bertil",
    email: "bertil-kontakt@bolag-b.se",
    topic: "question",
    message: "En helt vanlig fråga om hur tjänsten fungerar i praktiken.",
  },
});
check("en inloggad avsändare tas också emot", authedSubmit.status === 201, authedSubmit);
const authedRad = await laesRad("bertil-kontakt@bolag-b.se");
check("och fästs vid kontot av servern (kolumnens default), inte av klientens data", authedRad.user_id === BERTIL, authedRad);

const utanMeddelande = await call("POST", "/v1/contact", {
  body: { name: "X", email: "x@example.se", topic: "other" },
});
check("meddelande som saknas ger 400", utanMeddelande.status === 400);
const koruMeddelande = await call("POST", "/v1/contact", {
  body: { name: "X", email: "x@example.se", topic: "other", message: "kort" },
});
check("för kort meddelande nekas av databasregeln, inte tyst", koruMeddelande.status === 400, koruMeddelande);
const felAmne = await call("POST", "/v1/contact", {
  body: { name: "X", email: "x@example.se", topic: "sabotage", message: "Ett giltigt och tillräckligt långt meddelande." },
});
check("okänt ämne ger 400", felAmne.status === 400, felAmne);

const agnesAdmin = await call("GET", "/v1/contact/admin-status", { token: adminToken });
check("administratören känns igen", agnesAdmin.status === 200 && agnesAdmin.body.isAdmin === true, agnesAdmin.body);
const bertilAdmin = await call("GET", "/v1/contact/admin-status", { token: bertilToken });
check("en vanlig användare är inte administratör", bertilAdmin.body.isAdmin === false, bertilAdmin.body);
const anonAdmin = await call("GET", "/v1/contact/admin-status");
check("utan token nekas admin-statusfrågan", anonAdmin.status === 401);

const agnesInkorg = await call("GET", "/v1/contact", { token: adminToken });
check(
  "administratören ser inkorgen",
  agnesInkorg.status === 200 && Array.isArray(agnesInkorg.body.messages) && agnesInkorg.body.messages.length >= 2,
  agnesInkorg.body,
);
check(
  "posterna bär kontraktets fält, hela",
  (agnesInkorg.body.messages as Array<Record<string, unknown>>).every(
    (m) => Object.hasOwn(m, "internalNote") && Object.hasOwn(m, "handledAt") && Object.hasOwn(m, "userId"),
  ),
  (agnesInkorg.body.messages as unknown[])[0],
);
const bertilInkorg = await call("GET", "/v1/contact", { token: bertilToken });
check(
  "en icke-administratör ser en TOM inkorg - radskyddet, inte en dold knapp",
  bertilInkorg.status === 200 && Array.isArray(bertilInkorg.body.messages) && bertilInkorg.body.messages.length === 0,
  bertilInkorg.body,
);
const anonInkorg = await call("GET", "/v1/contact");
check("utan token nekas inkorgen", anonInkorg.status === 401);

const malId = anonRad.id as string;
const svarat = await call("POST", `/v1/contact/${malId}/status`, {
  token: adminToken,
  body: { status: "answered", internalNote: "Ringde upp och bokade möte." },
});
check("administratören kan handlägga", svarat.status === 200, svarat.body);
const handlagd = await laesRad("nod@example.se");
check("handläggaren sätts av servern till den inloggade, aldrig av klienten", handlagd.handled_by === AGNES, handlagd);
check("och handled_at sätts samtidigt (CHECK-paret håller)", handlagd.handled_at !== null);
check("den interna anteckningen sparades", handlagd.internal_note === "Ringde upp och bokade möte.");
check("statusen uppdaterades", handlagd.status === "answered");

const aterlast = await call("POST", `/v1/contact/${malId}/status`, {
  token: adminToken,
  body: { status: "new" },
});
check("åter till new tas emot", aterlast.status === 200);
const nollstalld = await laesRad("nod@example.se");
check("handläggarparet nollställs tillsammans", nollstalld.handled_by === null && nollstalld.handled_at === null, nollstalld);
check("och anteckningen lämnas orörd när fältet inte skickas", nollstalld.internal_note === "Ringde upp och bokade möte.");

const bertilForsok = await call("POST", `/v1/contact/${malId}/status`, {
  token: bertilToken,
  body: { status: "closed" },
});
check("en icke-administratör kan inte handlägga - samma 404 som ett okänt id", bertilForsok.status === 404, bertilForsok);
const oforandrad = await laesRad("nod@example.se");
check("och meddelandet är oförändrat efter försöket", oforandrad.status === "new");

const spoke = await call("POST", "/v1/contact/00000000-0000-0000-0000-000000000000/status", {
  token: adminToken,
  body: { status: "closed" },
});
check("okänt id ger 404 även för administratören", spoke.status === 404);
const felStatus = await call("POST", `/v1/contact/${malId}/status`, {
  token: adminToken,
  body: { status: "sabotage" },
});
check("ogiltig status ger 400", felStatus.status === 400, felStatus);

/* --- 8f. Deltagare och inbjudningar: adressen är nyckeln, inte länken ----- */

/*
 * Ärendets deltagare och inbjudningsflödet. Säkerhetsmodellen är att
 * ADRESSEN avgör, inte en gissbar länk: peek och accept lyckas bara när
 * den inloggades adress matchar inbjudan, och för alla andra finns den
 * inte (null / 409, samma neutrala tystnad). Behörigheten att bjuda in och
 * återkalla hålls i databasens has_case_role.
 */

const CECILIA = "33333333-3333-3333-3333-333333333333";
await withAnon(async (tx) => {
  // Agnes blir owner-medlem i CASE_A (seedade cases får ingen medlemsrad
  // automatiskt), och Cecilia får ett konto att bli inbjuden till.
  await tx.query(
    "insert into public.case_members (case_id, user_id, role) values ($1, $2, 'owner') on conflict do nothing",
    [CASE_A, AGNES],
  );
  const ceciliaHash = await hashPassword("hemligt-losen-cecilia");
  await tx.query(
    "insert into auth.users (id, email, password_hash) values ($1, $2, $3) on conflict (id) do nothing",
    [CECILIA, "cecilia@radgivare.se", ceciliaHash],
  );
  await tx.query(
    "insert into public.user_profiles (user_id, display_name) values ($1, 'Cecilia') on conflict (user_id) do nothing",
    [CECILIA],
  );
});
const ceciliaToken: string = (
  await call("POST", "/v1/auth/login", {
    body: { email: "cecilia@radgivare.se", password: "hemligt-losen-cecilia" },
  })
).body.token as string;

const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);

const medlemmar0 = await call("GET", `/v1/cases/${CASE_A}/members`, { token: adminToken });
check(
  "ägaren ser deltagarlistan",
  medlemmar0.status === 200 && arr(medlemmar0.body.members).some((m) => m.userId === AGNES),
  medlemmar0.body,
);
const medlemmarUtanfor = await call("GET", `/v1/cases/${CASE_A}/members`, { token: bertilToken });
check(
  "en utomstående får en TOM deltagarlista (list_case_members prövar access)",
  medlemmarUtanfor.status === 200 && arr(medlemmarUtanfor.body.members).length === 0,
  medlemmarUtanfor.body,
);

const bjudIn = await call("POST", `/v1/cases/${CASE_A}/invitations`, {
  token: adminToken,
  body: { email: "cecilia@radgivare.se", role: "legal_advisor" },
});
check("ägaren kan bjuda in", bjudIn.status === 201 && typeof bjudIn.body.invitationId === "string", bjudIn.body);
const invId = bjudIn.body.invitationId as string;

const bjudInNekad = await call("POST", `/v1/cases/${CASE_A}/invitations`, {
  token: bertilToken,
  body: { email: "x@example.se", role: "observer" },
});
check("en utomstående kan inte bjuda in (has_case_role nekar → 409)", bjudInNekad.status === 409, bjudInNekad);
const bjudInAgare = await call("POST", `/v1/cases/${CASE_A}/invitations`, {
  token: adminToken,
  body: { email: "y@example.se", role: "owner" },
});
check("'owner' går inte att bjuda in per mejl (databasens constraint → 400)", bjudInAgare.status === 400, bjudInAgare);
const bjudInSkrap = await call("POST", `/v1/cases/${CASE_A}/invitations`, {
  token: adminToken,
  body: { email: "y@example.se", role: "sabotage" },
});
check("ogiltig roll ger 400", bjudInSkrap.status === 400, bjudInSkrap);

const inbjudningar = await call("GET", `/v1/cases/${CASE_A}/invitations`, { token: adminToken });
check(
  "inbjudningarna listas",
  inbjudningar.status === 200 && arr(inbjudningar.body.invitations).some((i) => i.id === invId),
  inbjudningar.body,
);

const peekRatt = await call("GET", `/v1/invitations/${invId}`, { token: ceciliaToken });
check(
  "den inbjudna får se förhandsvisningen (bolagsnamnet)",
  peekRatt.status === 200 &&
    (peekRatt.body.invitation as Json | null)?.companyName === "Bolag A AB",
  peekRatt.body,
);
const peekFel = await call("GET", `/v1/invitations/${invId}`, { token: bertilToken });
check(
  "fel adress ser ingen förhandsvisning - null, samma neutrala tystnad",
  peekFel.status === 200 && peekFel.body.invitation === null,
  peekFel.body,
);

const acceptFel = await call("POST", `/v1/invitations/${invId}/accept`, { token: bertilToken });
check("fel adress kan inte acceptera (409)", acceptFel.status === 409, acceptFel);
const acceptRatt = await call("POST", `/v1/invitations/${invId}/accept`, { token: ceciliaToken });
check(
  "rätt adress accepterar och får ärendets id",
  acceptRatt.status === 200 && acceptRatt.body.caseId === CASE_A,
  acceptRatt.body,
);
const medlemmarEfter = await call("GET", `/v1/cases/${CASE_A}/members`, { token: adminToken });
check(
  "den accepterade syns nu i deltagarlistan med sin roll",
  arr(medlemmarEfter.body.members).some((m) => m.userId === CECILIA && m.role === "legal_advisor"),
  medlemmarEfter.body,
);
const acceptIgen = await call("POST", `/v1/invitations/${invId}/accept`, { token: ceciliaToken });
check("en redan använd inbjudan kan inte återanvändas (409)", acceptIgen.status === 409, acceptIgen);

const bjudIn2 = await call("POST", `/v1/cases/${CASE_A}/invitations`, {
  token: adminToken,
  body: { email: "cecilia@radgivare.se", role: "auditor" },
});
const invId2 = bjudIn2.body.invitationId as string;
const aterkalla = await call("POST", `/v1/invitations/${invId2}/revoke`, { token: adminToken });
check("ägaren kan återkalla en inbjudan", aterkalla.status === 200, aterkalla);
const inbjudningar2 = await call("GET", `/v1/cases/${CASE_A}/invitations`, { token: adminToken });
const aterkallad = arr(inbjudningar2.body.invitations).find((i) => i.id === invId2);
check("den återkallade inbjudan bär revokedAt", aterkallad?.revokedAt != null, aterkallad);
const acceptAterkallad = await call("POST", `/v1/invitations/${invId2}/accept`, { token: ceciliaToken });
check("en återkallad inbjudan kan inte accepteras (409)", acceptAterkallad.status === 409, acceptAterkallad);

const peekOkant = await call("GET", "/v1/invitations/00000000-0000-0000-0000-000000000000", {
  token: ceciliaToken,
});
check("ett okänt inbjudnings-id ger null, inte ett fel", peekOkant.status === 200 && peekOkant.body.invitation === null, peekOkant.body);

/* --- 8g. Rådgivarens klientverktyg: författarens ensak ------------------- */

/*
 * Anteckningar och tidsposter är byråns EGNA arbetsmaterial. Cecilia
 * (legal_advisor) och Agnes (owner) är båda deltagare i CASE_A med
 * skrivrätt - och ändå ser ingen den andras anteckningar eller tid. Det är
 * hela poängen, och den bor i radskyddet (author_user_id = auth.uid()).
 */

const ceciliaNote = await call("POST", `/v1/cases/${CASE_A}/notes`, {
  token: ceciliaToken,
  body: { body: "Cecilias interna minnesanteckning om ärendet." },
});
check("en deltagare kan lägga en intern anteckning", ceciliaNote.status === 201, ceciliaNote.body);
const ceciliaNoteId = ceciliaNote.body.noteId as string;
const agnesNote = await call("POST", `/v1/cases/${CASE_A}/notes`, {
  token: adminToken,
  body: { body: "Agnes egen anteckning i samma ärende." },
});
const agnesNoteId = agnesNote.body.noteId as string;
check("en annan deltagare lägger sin egen", agnesNote.status === 201, agnesNote.body);

const ceciliaNotes = await call("GET", `/v1/cases/${CASE_A}/notes`, { token: ceciliaToken });
check("författaren ser sin anteckning", arr(ceciliaNotes.body.notes).some((n) => n.id === ceciliaNoteId), ceciliaNotes.body);
check(
  "men INTE en annan deltagares - även i samma ärende (radskyddet)",
  !arr(ceciliaNotes.body.notes).some((n) => n.id === agnesNoteId),
  ceciliaNotes.body,
);

const bertilNote = await call("POST", `/v1/cases/${CASE_A}/notes`, {
  token: bertilToken,
  body: { body: "Bertil är inte deltagare i CASE_A och ska nekas." },
});
check("en utomstående kan inte lägga anteckning i ärendet (403)", bertilNote.status === 403, bertilNote);

const raderaEgen = await call("DELETE", `/v1/notes/${ceciliaNoteId}`, { token: ceciliaToken });
check("författaren kan ta bort sin anteckning", raderaEgen.status === 200, raderaEgen);
const raderaAnnans = await call("DELETE", `/v1/notes/${agnesNoteId}`, { token: ceciliaToken });
check("att 'ta bort' en annans anteckning är en tyst no-op (idempotent 200)", raderaAnnans.status === 200, raderaAnnans);
const agnesKvar = await call("GET", `/v1/cases/${CASE_A}/notes`, { token: adminToken });
check("och den andras anteckning finns kvar", arr(agnesKvar.body.notes).some((n) => n.id === agnesNoteId), agnesKvar.body);

const ceciliaTid = await call("POST", `/v1/cases/${CASE_A}/time-entries`, {
  token: ceciliaToken,
  body: { minutes: 90, note: "Genomgång av likviditetsplanen", occurredOn: "2026-01-15" },
});
check("en deltagare kan registrera tid", ceciliaTid.status === 201, ceciliaTid.body);
const ceciliaTidId = ceciliaTid.body.entryId as string;
const nollMin = await call("POST", `/v1/cases/${CASE_A}/time-entries`, { token: ceciliaToken, body: { minutes: 0 } });
check("noll minuter nekas (400)", nollMin.status === 400, nollMin);
const forMycket = await call("POST", `/v1/cases/${CASE_A}/time-entries`, { token: ceciliaToken, body: { minutes: 5000 } });
check("orimligt många minuter nekas (400)", forMycket.status === 400, forMycket);

const ceciliaTider = await call("GET", `/v1/cases/${CASE_A}/time-entries`, { token: ceciliaToken });
const posten = arr(ceciliaTider.body.entries).find((e) => e.id === ceciliaTidId);
check("tidsposten listas för sin ägare", !!posten, ceciliaTider.body);
check("datumet läses som ÅÅÅÅ-MM-DD, inte en tidsstämpel", (posten as Json | undefined)?.occurredOn === "2026-01-15", posten);
const agnesTider = await call("GET", `/v1/cases/${CASE_A}/time-entries`, { token: adminToken });
check("en annan deltagare ser INTE den posten", !arr(agnesTider.body.entries).some((e) => e.id === ceciliaTidId), agnesTider.body);
const raderaTid = await call("DELETE", `/v1/time-entries/${ceciliaTidId}`, { token: ceciliaToken });
check("ägaren kan ta bort sin tidspost", raderaTid.status === 200, raderaTid);

/* --- 8h. API-nycklar: hemligheten lagras aldrig -------------------------- */

/*
 * Nyckelvalvets löfte: hemligheten LAGRAS ALDRIG - bara en sha256-hash och
 * ett prefix - och den visas EN gång. Nycklar återkallas, raderas inte. Och
 * radskyddet gör dem till ägarens ensak.
 */

const skapaNyckel = await call("POST", "/v1/api-keys", {
  token: adminToken,
  body: { label: "Integrationsnyckel" },
});
check("en nyckel skapas", skapaNyckel.status === 201, skapaNyckel.body);
const nyckelSecret = skapaNyckel.body.secret as string;
const nyckelRecord = skapaNyckel.body.record as Json;
const nyckelId = nyckelRecord.id as string;
const nyckelPrefix = nyckelRecord.keyPrefix as string;
check("hemligheten har rätt form (clr_...)", nyckelSecret.startsWith("clr_"), nyckelSecret.slice(0, 4));
check("prefixet är nyckelns synliga början", nyckelSecret.startsWith(nyckelPrefix) && nyckelPrefix.length === 12, nyckelPrefix);

const lagrad = await withAnon(async (tx) => {
  const { rows } = await tx.query("select key_hash, key_prefix from public.api_keys where id = $1", [nyckelId]);
  return rows[0];
});
check("hemligheten lagras BARA som sha256-hash", lagrad.key_hash === sha256(nyckelSecret), {
  stored: lagrad.key_hash?.slice(0, 12),
});
check("klartexthemligheten finns ingenstans i raden", lagrad.key_hash !== nyckelSecret && lagrad.key_prefix === nyckelPrefix);

const nycklar = await call("GET", "/v1/api-keys", { token: adminToken });
const min = arr(nycklar.body.keys).find((k) => k.id === nyckelId);
check("nyckeln listas med prefix", !!min && (min as Json).keyPrefix === nyckelPrefix, nycklar.body);
check("listan bär ALDRIG hemligheten", !JSON.stringify(nycklar.body).includes(nyckelSecret));

const bertilNycklar = await call("GET", "/v1/api-keys", { token: bertilToken });
check(
  "en annan användare ser inte nyckeln (radskyddet)",
  !arr(bertilNycklar.body.keys).some((k) => k.id === nyckelId),
  bertilNycklar.body,
);

const kortEtikett = await call("POST", "/v1/api-keys", { token: adminToken, body: { label: "ab" } });
check("för kort etikett ger 400", kortEtikett.status === 400, kortEtikett);

const aterkalla2 = await call("POST", `/v1/api-keys/${nyckelId}/revoke`, { token: adminToken });
check("nyckeln kan återkallas", aterkalla2.status === 200, aterkalla2);
const efterAterkall = await call("GET", "/v1/api-keys", { token: adminToken });
const aterkalladNyckel = arr(efterAterkall.body.keys).find((k) => k.id === nyckelId);
check("den återkallade nyckeln bär revokedAt", (aterkalladNyckel as Json | undefined)?.revokedAt != null, aterkalladNyckel);
const aterkallaIgen = await call("POST", `/v1/api-keys/${nyckelId}/revoke`, { token: adminToken });
check("dubbel återkallelse är ofarlig (idempotent 200)", aterkallaIgen.status === 200, aterkallaIgen);

/* --- 8i. Rådgivarsamtalen: läses av deltagare, skrivs av skrivare -------- */

/*
 * Samtalen är ärendets berättelse. Alla med ärendeåtkomst läser dem
 * (has_case_access); bara de som får arbeta i ärendet skriver
 * (can_write_case). Samma samtal sparas flera gånger medan det pågår -
 * en upsert på samtalets id, inte en ny rad varje gång.
 */

const sessId = "cccccccc-0000-0000-0000-0000000000c1";
const sparaSamtal = await call("POST", `/v1/cases/${CASE_A}/sessions`, {
  token: adminToken,
  body: {
    id: sessId,
    flowId: "likviditet",
    flowTitle: "Likviditetsgenomgång",
    startedAt: "2026-02-01T09:00:00.000Z",
    closedAt: null,
    entries: [{ at: "2026-02-01T09:00:00.000Z", who: "radgivare", text: "Hur ser kassan ut?" }],
  },
});
check("en skrivare kan spara ett samtal", sparaSamtal.status === 200 && sparaSamtal.body.saved === true, sparaSamtal.body);

const listaSamtal = await call("GET", `/v1/cases/${CASE_A}/sessions`, { token: adminToken });
const samtalet = arr(listaSamtal.body.sessions).find((s) => s.id === sessId) as Json | undefined;
check(
  "samtalet listas med sina rader (jsonb bevaras)",
  !!samtalet && Array.isArray(samtalet.entries) && (samtalet.entries as unknown[]).length === 1,
  listaSamtal.body,
);

const sparaIgen = await call("POST", `/v1/cases/${CASE_A}/sessions`, {
  token: adminToken,
  body: {
    id: sessId,
    flowId: "likviditet",
    flowTitle: "Likviditetsgenomgång",
    startedAt: "2026-02-01T09:00:00.000Z",
    closedAt: "2026-02-01T09:30:00.000Z",
    entries: [
      { at: "2026-02-01T09:00:00.000Z", who: "radgivare", text: "Hur ser kassan ut?" },
      { at: "2026-02-01T09:05:00.000Z", who: "user", text: "Tunn den här månaden." },
    ],
  },
});
check("samma samtal kan sparas igen (upsert)", sparaIgen.status === 200, sparaIgen);
const listaSamtal2 = await call("GET", `/v1/cases/${CASE_A}/sessions`, { token: adminToken });
const uppdaterat = arr(listaSamtal2.body.sessions).find((s) => s.id === sessId) as Json | undefined;
check(
  "upserten uppdaterade raderna, skapade ingen dubblett",
  arr(listaSamtal2.body.sessions).filter((s) => s.id === sessId).length === 1 &&
    (uppdaterat?.entries as unknown[]).length === 2,
  listaSamtal2.body,
);
check("och stängningstiden sattes", uppdaterat?.closedAt !== null, uppdaterat);

const bertilSpara = await call("POST", `/v1/cases/${CASE_A}/sessions`, {
  token: bertilToken,
  body: {
    id: "cccccccc-0000-0000-0000-0000000000c2",
    flowId: "x",
    flowTitle: "Y",
    startedAt: "2026-02-01T09:00:00.000Z",
    closedAt: null,
    entries: [],
  },
});
check("en utomstående kan inte spara ett samtal (can_write_case → 403)", bertilSpara.status === 403, bertilSpara);
const bertilLista = await call("GET", `/v1/cases/${CASE_A}/sessions`, { token: bertilToken });
check("och ser inga samtal i ärendet (has_case_access)", arr(bertilLista.body.sessions).length === 0, bertilLista.body);

const utanEntries = await call("POST", `/v1/cases/${CASE_A}/sessions`, {
  token: adminToken,
  body: { id: sessId, flowId: "x", flowTitle: "Y", startedAt: "2026-02-01T09:00:00.000Z" },
});
check("saknad entries-lista ger 400", utanEntries.status === 400, utanEntries);

/* --- 8j. Driften (/ops): allt admin-gatat i databasen -------------------- */

/*
 * Driftpanelens skrivvägar. Agnes är driftadministratör (avsnitt 8e),
 * Bertil är det inte. Gränsen bor i databasen: RPC:erna kastar "Kräver
 * driftbehörighet" (409) och app_settings har admin-only skrivpolicyer
 * (403). Nyckelvalvets regel är hårdast: en sparad hemlighet kan aldrig
 * läsas tillbaka - bara de fyra sista tecknen.
 */

const sparaHemlighet = await call("POST", "/v1/ops/secrets", {
  token: adminToken,
  body: { provider: "creditsafe", secret: "hemlig-nyckel-1234" },
});
check("drift kan spara en hemlighet i valvet", sparaHemlighet.status === 200, sparaHemlighet.body);
const valvet = await call("GET", "/v1/ops/secrets", { token: adminToken });
const csHemlighet = arr(valvet.body.secrets).find((s) => s.provider === "creditsafe") as Json | undefined;
check("hemligheten listas med bara de fyra sista tecknen", csHemlighet?.last4 === "1234", valvet.body);
check("valvet lämnar ALDRIG ut själva hemligheten", !JSON.stringify(valvet.body).includes("hemlig-nyckel-1234"));
const bertilValv = await call("GET", "/v1/ops/secrets", { token: bertilToken });
check("en icke-admin kan inte läsa valvet (409)", bertilValv.status === 409, bertilValv);
const bertilValvSpara = await call("POST", "/v1/ops/secrets", { token: bertilToken, body: { provider: "x", secret: "y" } });
check("en icke-admin kan inte skriva i valvet (409)", bertilValvSpara.status === 409, bertilValvSpara);
const taBortHemlighet = await call("DELETE", "/v1/ops/secrets/creditsafe", { token: adminToken });
check("drift kan ta bort en hemlighet", taBortHemlighet.status === 200, taBortHemlighet);

const foretagsplan = await call("POST", "/v1/ops/company-plan", {
  token: adminToken,
  body: { monthlyExVatSek: 985, businessExVatSek: 2400, enterpriseExVatSek: null },
});
check("drift kan sätta företagsplanens pris (driftparameter)", foretagsplan.status === 200, foretagsplan.body);
const daligtPris = await call("POST", "/v1/ops/company-plan", { token: adminToken, body: { monthlyExVatSek: 0 } });
check("ogiltigt pris ger 400", daligtPris.status === 400, daligtPris);
const bertilPris = await call("POST", "/v1/ops/company-plan", { token: bertilToken, body: { monthlyExVatSek: 1 } });
check("en icke-admin kan inte skriva driftparametern (403 via RLS)", bertilPris.status === 403, bertilPris);
const lagratPris = await withAnon(async (tx) => {
  const { rows } = await tx.query("select value from public.app_settings where key = 'company_plan'");
  return rows[0]?.value as { monthly_ex_vat_sek?: number } | undefined;
});
check("priset lagrades som driftparameter, inte hårdkodat", lagratPris?.monthly_ex_vat_sek === 985, lagratPris);

const policy0 = await call("GET", "/v1/ops/retention-policy", { token: adminToken });
check("gallringspolicyn läses (standard + override)", policy0.status === 200 && arr(policy0.body.policy).length > 0, policy0.body);
const forstaKat = (arr(policy0.body.policy)[0] as Json).id as string;
const sattPolicy = await call("POST", "/v1/ops/retention-policy", {
  token: adminToken,
  body: { overrides: [{ id: forstaKat, months: 99, aktiv: true }] },
});
check("drift kan sätta gallringens override", sattPolicy.status === 200, sattPolicy.body);
const policy1 = await call("GET", "/v1/ops/retention-policy", { token: adminToken });
const ovKat = arr(policy1.body.policy).find((c) => c.id === forstaKat) as Json | undefined;
check("overriden lades ovanpå standarden", ovKat?.months === 99 && ovKat?.aktiv === true, ovKat);
const bertilPolicy = await call("POST", "/v1/ops/retention-policy", { token: bertilToken, body: { overrides: [] } });
check("en icke-admin kan inte skriva gallringspolicyn (403)", bertilPolicy.status === 403, bertilPolicy);

const northStar = await call("GET", "/v1/ops/north-star", { token: adminToken });
check(
  "North Star-måtten svarar med de fyra talen",
  northStar.status === 200 &&
    ["recovered", "inHealth", "badChurn", "openCases"].every((k) => typeof northStar.body[k] === "number"),
  northStar.body,
);

const proffsVillkor = await call("GET", "/v1/ops/professional-terms", { token: adminToken });
check("rådgivarnas villkor kan listas av drift", proffsVillkor.status === 200 && Array.isArray(proffsVillkor.body.terms), proffsVillkor.body);
const bertilVillkor = await call("GET", "/v1/ops/professional-terms", { token: bertilToken });
check("en icke-admin kan inte lista rådgivarvillkoren (409)", bertilVillkor.status === 409, bertilVillkor);
const bertilPlan = await call("POST", "/v1/ops/billing-plans", {
  token: bertilToken,
  body: { professionalId: "00000000-0000-0000-0000-000000000000", planKind: "per_case", unlockFeeSek: 1000, monthlyFeeSek: null },
});
check("en icke-admin kan inte sätta prisplan (409 innan någon rad rörs)", bertilPlan.status === 409, bertilPlan);
const daligPlanKind = await call("POST", "/v1/ops/billing-plans", {
  token: adminToken,
  body: { professionalId: "00000000-0000-0000-0000-000000000000", planKind: "gratis", unlockFeeSek: 0, monthlyFeeSek: null },
});
check("ogiltig planKind ger 400", daligPlanKind.status === 400, daligPlanKind);
const bertilFee = await call("POST", "/v1/ops/professionals/00000000-0000-0000-0000-000000000000/referral-fee", {
  token: bertilToken,
  body: { feeSek: 500 },
});
check("en icke-admin kan inte sätta förmedlingsavgift (409)", bertilFee.status === 409, bertilFee);
const planer = await call("GET", "/v1/ops/billing-plans", { token: adminToken });
check("prisplanerna kan listas av drift", planer.status === 200 && Array.isArray(planer.body.plans), planer.body);

/* --- 8k. Fakturering: kunden ser sitt, drift ser allt -------------------- */

/*
 * Kontostatus, fakturor, kundöversikt och utkorg. Radskyddet bär gränsen:
 * en kund ser BARA sina egna rader (user_id = auth.uid()), administratören
 * ser alla (is_platform_admin). Priset är en driftparameter, inte en kodrad.
 * (issueInvoice/registerPayment ligger kvar hos gamla adaptern - de köar
 * mejl och kräver att mallarna flyttas till servern; nästa steg.)
 */

const OUTBOX_ID = "dddddddd-0000-0000-0000-0000000000d1";

const bertilKonto = await call("GET", "/v1/billing/mine", { token: bertilToken });
check(
  "kontostatus skapas lat vid första anropet",
  bertilKonto.status === 200 && (bertilKonto.body.billing as Json).userId === BERTIL,
  bertilKonto.body,
);
const bertilKonto2 = await call("GET", "/v1/billing/mine", { token: bertilToken });
check("andra anropet ger samma konto", (bertilKonto2.body.billing as Json).userId === BERTIL, bertilKonto2.body);
const antalKonton = await withAnon(async (tx) => {
  const { rows } = await tx.query("select count(*)::int as n from public.account_billing where user_id = $1", [BERTIL]);
  return rows[0].n as number;
});
check("bara EN kontorad skapades (ingen dubblett)", antalKonton === 1, antalKonton);

const plan = await call("GET", "/v1/billing/company-plan", { token: bertilToken });
check(
  "företagsplanens pris läses ur driftparametern (satt i 8j)",
  plan.status === 200 && plan.body.monthlyExVatSek === 985 && plan.body.businessExVatSek === 2400,
  plan.body,
);

const bertilFakturor = await call("GET", "/v1/billing/invoices", { token: bertilToken });
check("kunden kan lista sina fakturor", bertilFakturor.status === 200 && Array.isArray(bertilFakturor.body.invoices), bertilFakturor.body);

const driftKunder = await call("GET", "/v1/billing/customers", { token: adminToken });
check(
  "drift ser hela kundöversikten",
  driftKunder.status === 200 &&
    arr(driftKunder.body.customers).some((c) => c.userId === AGNES) &&
    arr(driftKunder.body.customers).some((c) => c.userId === BERTIL),
  driftKunder.body,
);
check("och e-post läcker aldrig ut i översikten", arr(driftKunder.body.customers).every((c) => c.email === null));
const bertilKunder = await call("GET", "/v1/billing/customers", { token: bertilToken });
check(
  "en icke-admin ser BARA sin egen rad (radskyddet)",
  arr(bertilKunder.body.customers).length > 0 && arr(bertilKunder.body.customers).every((c) => c.userId === BERTIL),
  bertilKunder.body,
);

await withAnon(async (tx) => {
  await tx.query(
    `insert into public.outbound_emails (id, recipient, subject, body_text, body_html, kind, status, attempts, last_error)
     values ($1, 'kund@example.se', 'Faktura', 'text', '<p>text</p>', 'invoice', 'failed', 5, 'studsade')
     on conflict (id) do nothing`,
    [OUTBOX_ID],
  );
});
const utkorg = await call("GET", "/v1/billing/outbox", { token: adminToken });
check("utkorgen kan läsas av drift", utkorg.status === 200 && arr(utkorg.body.emails).some((e) => e.id === OUTBOX_ID), utkorg.body);
const bertilRetry = await call("POST", `/v1/billing/outbox/${OUTBOX_ID}/retry`, { token: bertilToken });
check("en icke-admin kan inte köa om ett utskick (409)", bertilRetry.status === 409, bertilRetry);
const driftRetry = await call("POST", `/v1/billing/outbox/${OUTBOX_ID}/retry`, { token: adminToken });
check("drift kan köa om ett misslyckat utskick", driftRetry.status === 200, driftRetry);
const utskickStatus = await withAnon(async (tx) => {
  const { rows } = await tx.query("select status, attempts from public.outbound_emails where id = $1", [OUTBOX_ID]);
  return rows[0];
});
check("omköandet satte raden till pending och nollställde räknaren", utskickStatus.status === "pending" && Number(utskickStatus.attempts) === 0, utskickStatus);

const stang = await call("POST", `/v1/billing/accounts/${BERTIL}/close`, { token: adminToken });
check("drift kan stänga ett konto", stang.status === 200, stang);
const bertilStangt = await withAnon(async (tx) => {
  const { rows } = await tx.query("select closed_at from public.account_billing where user_id = $1", [BERTIL]);
  return rows[0];
});
check("kontot fick closed_at - ingenting raderades", bertilStangt.closed_at !== null, bertilStangt);

/* --- 8l. tasks.seed: idempotent sådd av rekommendationer ----------------- */

/*
 * Rekommendationernas uppgifter sås med on conflict do nothing mot det
 * unika indexet (case_id, label): två flikar som sår samtidigt ger EN
 * lista, inte två dubbletter. Agnes äger CASE_A (owner-medlem sedan 8f).
 */

const saStart = await call("POST", `/v1/cases/${CASE_A}/tasks/seed`, {
  token: adminToken,
  body: { labels: ["Ring revisorn", "Sammanställ likviditetsplan", "Kalla till styrelsemöte"] },
});
check("rekommendationerna kan sås", saStart.status === 200 && saStart.body.seeded === 3, saStart.body);
const saIgen = await call("POST", `/v1/cases/${CASE_A}/tasks/seed`, {
  token: adminToken,
  body: { labels: ["Ring revisorn", "Sammanställ likviditetsplan", "Kalla till styrelsemöte"] },
});
check("att så samma etiketter igen är ofarligt (idempotent)", saIgen.status === 200, saIgen);
const antalUppgifter = await withAnon(async (tx) => {
  const { rows } = await tx.query(
    "select count(*)::int as n from public.case_tasks where case_id = $1 and label = 'Ring revisorn'",
    [CASE_A],
  );
  return rows[0].n as number;
});
check("etiketten finns i EXAKT en kopia trots dubbel sådd", antalUppgifter === 1, antalUppgifter);
const tomSadd = await call("POST", `/v1/cases/${CASE_A}/tasks/seed`, { token: adminToken, body: { labels: [] } });
check("tom lista är ett giltigt no-op", tomSadd.status === 200 && tomSadd.body.seeded === 0, tomSadd.body);

/* --- 8m. Adversariell svep: angriparen med ett giltigt konto ------------- */

/*
 * Slutgiltiga frågan ur säkerhetsgenomgången: "en angripare har ett vanligt
 * konto, känner hela frontendens implementation och kan gissa vilket id som
 * helst - vad kommer den åt?"
 *
 * Bertil ÄR en sådan angripare i förhållande till CASE_A: giltig session,
 * noll behörighet, och han känner id:t. Svepet nedan går igenom VARJE
 * ärendebunden resurs och kräver att svaret antingen nekas eller är tomt -
 * aldrig någon av Agnes data. Ett id är inte en hemlighet, och sviten ska
 * inte låtsas att det är det.
 */

const lackerData = (kropp: Json): boolean => {
  const text = JSON.stringify(kropp ?? {});
  // Något av Agnes ärende som aldrig får dyka upp hos Bertil.
  return /Bolag A AB|556000-0001|Ring revisorn|Cecilias interna|Likviditetsgenomgång/.test(text);
};

const svepta: { rutt: string; status: number }[] = [];
for (const rutt of [
  `/v1/cases/${CASE_A}`,
  `/v1/cases/${CASE_A}/journal`,
  `/v1/cases/${CASE_A}/decisions`,
  `/v1/cases/${CASE_A}/tasks`,
  `/v1/cases/${CASE_A}/messages`,
  `/v1/cases/${CASE_A}/documents`,
  `/v1/cases/${CASE_A}/payments`,
  `/v1/cases/${CASE_A}/kbr`,
  `/v1/cases/${CASE_A}/members`,
  `/v1/cases/${CASE_A}/invitations`,
  `/v1/cases/${CASE_A}/notes`,
  `/v1/cases/${CASE_A}/time-entries`,
  `/v1/cases/${CASE_A}/sessions`,
  `/v1/cases/${CASE_A}/share-links`,
]) {
  const svar = await call("GET", rutt, { token: bertilToken });
  svepta.push({ rutt, status: svar.status });
  check(
    `SVEP: ${rutt} läcker inget till en utomstående med giltigt konto`,
    !lackerData(svar.body),
    { rutt, status: svar.status, body: svar.body },
  );
}
check("svepet täckte alla ärendebundna läsvägar", svepta.length === 14, svepta.length);

// Skrivvägarna: samma angripare, samma ärende.
for (const [metod, rutt, kropp] of [
  ["POST", `/v1/cases/${CASE_A}/tasks`, { label: "Angriparens uppgift" }],
  ["POST", `/v1/cases/${CASE_A}/notes`, { body: "Angriparens anteckning i annans ärende" }],
  ["POST", `/v1/cases/${CASE_A}/time-entries`, { minutes: 60 }],
  ["POST", `/v1/cases/${CASE_A}/messages`, { body: "Hej" }],
  ["POST", `/v1/cases/${CASE_A}/invitations`, { email: "angripare@example.se", role: "observer" }],
  ["POST", `/v1/cases/${CASE_A}/close`, { reason: "annat" }],
  ["POST", `/v1/cases/${CASE_A}/plan-approval`, { approved: true }],
  ["POST", `/v1/cases/${CASE_A}/share-links`, { scope: "full", validDays: 7 }],
] as const) {
  const svar = await call(metod, rutt, { token: bertilToken, body: kropp });
  check(`SVEP: ${metod} ${rutt} nekas för en utomstående`, svar.status >= 400, {
    status: svar.status,
    body: svar.body,
  });
}

// Ärendet ska vara ORÖRT efter hela svepet.
const efterSvep = await withAnon(async (tx) => {
  const { rows } = await tx.query(
    `select (select count(*)::int from public.case_tasks where case_id = $1 and label = 'Angriparens uppgift') as uppgifter,
            (select count(*)::int from public.case_notes where case_id = $1) as anteckningar,
            (select closed_at from public.cases where id = $1) as stangt`,
    [CASE_A],
  );
  return rows[0];
});
check("angriparen lade ingen uppgift i ärendet", efterSvep.uppgifter === 0, efterSvep);
check("ärendet stängdes inte av angriparen", efterSvep.stangt === null, efterSvep);

/* --- IDOR mot den signerade dokument-URL:en ------------------------------ */

/*
 * Den farligaste enskilda rutten i hela API:t: en signerad URL kringgår ALL
 * databasbehörighet - det är hela poängen med den. Går den att få ut för ett
 * dokument man inte äger är radskyddet omkörbart med en HTTP-förfrågan.
 *
 * Sviten körs med DOCUMENTS_BUCKET satt (se api/tests/run.sh), annars hade
 * rutten kortslutit på "lagringen är inte ansluten" och prövningen aldrig
 * skett - grön av fel skäl.
 */
const DOK_A = "eeeeeeee-0000-0000-0000-0000000000e1";
await withAnon(async (tx) => {
  await tx.query(
    `insert into public.case_documents (id, case_id, user_id, kind, file_name, file_size, mime_type, storage_path, source)
     values ($1::uuid, $2::uuid, $3::uuid, 'other', 'hemlig-plan.pdf', 1024, 'application/pdf',
             $2::text || '/hemlig-plan.pdf', 'manual')
     on conflict (id) do nothing`,
    [DOK_A, CASE_A, AGNES],
  );
});

const health = await call("GET", "/v1/health");
check("lagringen ÄR ansluten i sviten (annars prövas inget)", health.body.storage === true, health.body);

const bertilDok = await call("GET", `/v1/documents/${DOK_A}/url`, { token: bertilToken });
check("IDOR: en utomstående får INGEN signerad URL", bertilDok.status === 404, bertilDok.body);
check(
  "och svaret bär varken URL eller storage_path",
  !/storage_path|hemlig-plan|http/i.test(JSON.stringify(bertilDok.body ?? {})),
  bertilDok.body,
);
const anonDok = await call("GET", `/v1/documents/${DOK_A}/url`);
check("utan token nekas dokument-URL:en", anonDok.status === 401, anonDok.body);

/* --- Masstilldelning: fält servern äger får inte sättas av klienten ------ */

const massProfil = await call("PATCH", "/v1/profile", {
  token: bertilToken,
  body: { displayName: "Bertil", phone: null, role: "admin", userId: AGNES },
});
check("masstilldelning: role/userId i kroppen ignoreras", massProfil.status === 200, massProfil.body);
const efterMass = await withAnon(async (tx) => {
  const { rows } = await tx.query("select role from public.user_profiles where user_id = $1", [BERTIL]);
  return rows[0];
});
check("rollen gick inte att höja via profiluppdateringen", efterMass.role !== "admin", efterMass);

// Kontaktformuläret: status/handläggare/konto sätts av servern, aldrig av kroppen.
await call("POST", "/v1/contact", {
  body: {
    name: "Angripare",
    email: "angripare@example.se",
    topic: "other",
    message: "Ett meddelande som försöker sätta egna serverfält.",
    status: "closed",
    userId: AGNES,
    handledBy: AGNES,
    internalNote: "injicerad",
  },
});
const massKontakt = await withAnon(async (tx) => {
  const { rows } = await tx.query(
    "select status, user_id, handled_by, internal_note from public.contact_messages where email = $1",
    ["angripare@example.se"],
  );
  return rows[0];
});
check("masstilldelning: status sattes av servern, inte av kroppen", massKontakt.status === "new", massKontakt);
check("masstilldelning: kontot kunde inte tillskrivas någon annan", massKontakt.user_id === null, massKontakt);
check("masstilldelning: handläggare och intern anteckning ignorerades", massKontakt.handled_by === null && massKontakt.internal_note === null, massKontakt);

/* --- 8m2. Driftens revisionsspår ---------------------------------------- */

/*
 * De mest privilegierade åtgärderna i produkten hade inget spår alls: en
 * bytt Creditsafe-nyckel, en ändrad prisplan eller en påslagen kreditspärr
 * var osynlig efteråt. "Vem gjorde det, och när?" gick inte att svara på.
 *
 * Spåret skrivs i SAMMA transaktion som åtgärden - en åtgärd utan spår, och
 * ett spår utan åtgärd, är båda omöjliga. Och det bär ALDRIG hemligheten:
 * att logga att nyckeln byttes är spårbarhet, att logga nyckeln är att
 * flytta valvet till loggen.
 */

const HEMLIG_NYCKEL = "supersecret-creditsafe-9876";
await call("POST", "/v1/ops/secrets", {
  token: adminToken,
  body: { provider: "creditsafe", secret: HEMLIG_NYCKEL },
});
await call("POST", "/v1/ops/company-plan", { token: adminToken, body: { monthlyExVatSek: 1195 } });

const spar = await call("GET", "/v1/ops/audit", { token: adminToken });
check("driftens revisionsspår kan läsas av drift", spar.status === 200, spar.body);
const sparat = arr(spar.body.events);
check(
  "att en hemlighet sattes finns i spåret",
  sparat.some((e) => e.action === "drift.secret.set" && e.objectId === "creditsafe"),
  sparat.slice(0, 3),
);
check(
  "SJÄLVA HEMLIGHETEN finns INTE i spåret",
  !JSON.stringify(spar.body).includes(HEMLIG_NYCKEL),
  "hemligheten läckte till revisionsspåret",
);
check(
  "prisändringen finns i spåret",
  sparat.some((e) => e.action === "drift.company_plan.set"),
  sparat.slice(0, 3),
);
check(
  "spåret säger VEM som gjorde det",
  sparat.length > 0 && sparat.every((e) => e.actorUserId === AGNES),
  sparat.slice(0, 3).map((e) => e.actorUserId),
);
check(
  "och spåret bär BARA driftåtgärder, inte trigger-händelser utan ärende",
  sparat.every((e) => String(e.action).startsWith("drift.")),
  sparat.map((e) => e.action).slice(0, 6),
);
check("och NÄR", sparat.every((e) => typeof e.occurredAt === "string" && e.occurredAt.length > 0));

const bertilSpar = await call("GET", "/v1/ops/audit", { token: bertilToken });
check(
  "en icke-administratör ser ett TOMT spår (radskyddet)",
  bertilSpar.status === 200 && arr(bertilSpar.body.events).length === 0,
  bertilSpar.body,
);

// Spåret får inte gå att förfalska: klienten har ingen väg att skriva rader,
// och funktionen kräver driftbehörighet.
const bertilForfalska = await withUser(BERTIL, async (tx) => {
  try {
    await tx.query("select app.logga_driftatgard($1, $2, $3, null)", ["fusk", "x", "y"]);
    return "gick igenom";
  } catch (e) {
    return (e as { code?: string }).code ?? "nekad";
  }
});
check("en icke-administratör kan inte skriva i spåret", bertilForfalska !== "gick igenom", bertilForfalska);

// En skriven rad går inte att ändra eller ta bort - inte ens av drift.
const oforanderligt = await withUser(AGNES, async (tx) => {
  const ut: string[] = [];
  for (const sql of [
    "update public.audit_events set action = 'ändrat' where case_id is null",
    "delete from public.audit_events where case_id is null",
  ]) {
    try {
      await tx.query(sql);
      ut.push("gick igenom");
    } catch {
      ut.push("nekad");
    }
  }
  return ut;
});
check("revisionsspåret går inte att skriva om", oforanderligt[0] === "nekad", oforanderligt);
check("och inte att radera", oforanderligt[1] === "nekad", oforanderligt);

/* --- 8n. Databasrollen prövas mot den RIKTIGA katalogen ----------------- */

/*
 * Kontrollen som vägrar starta servern. Att den finns i källkoden bevisar
 * ingenting - den ska ge rätt svar mot pg_roles och pg_class. Båda utfallen
 * prövas här: sviten själv ansluter som superanvändaren (med flit, så
 * fixturerna inte beror på policyerna under test), och en roll byggd som
 * driftens ska godkännas.
 *
 * `set local role` byter current_user inne i transaktionen, så samma fråga
 * kan prövas för båda rollerna utan en ny anslutning.
 */

const somSuper = await withAnon((tx) => provaDatabasroll(tx));
check("sviten kör som en OSÄKER roll (superanvändaren)", somSuper.saker === false, somSuper);
check(
  "och skälet är utskrivet, inte bara ett nej",
  somSuper.skal.some((s) => /superanvändare|BYPASSRLS|äger/.test(s)),
  somSuper.skal,
);

// En roll byggd som driftens: login, medlem i authenticated, äger ingenting,
// ingen BYPASSRLS.
await withAnon(async (tx) => {
  await tx.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'clearance_api_prov') then
        create role clearance_api_prov login password 'prov';
      end if;
      grant authenticated to clearance_api_prov;
    end
    $$;
  `);
});
const somDrift = await withAnon(async (tx) => {
  await tx.query("set local role clearance_api_prov");
  const svar = await provaDatabasroll(tx);
  await tx.query("reset role");
  return svar;
});
check("en driftlik roll GODKÄNNS", somDrift.saker === true, somDrift);
check("och det är rätt roll som prövades", somDrift.roll === "clearance_api_prov", somDrift);

// app_worker har BYPASSRLS med flit (betrodd batchroll) - och ska därför
// aldrig duga som API-roll. Det är precis den förväxlingen kontrollen finns för.
const somWorker = await withAnon(async (tx) => {
  const finns = await tx.query("select 1 from pg_roles where rolname = 'app_worker'");
  if (finns.rowCount === 0) return null;
  await tx.query("set local role app_worker");
  const svar = await provaDatabasroll(tx);
  await tx.query("reset role");
  return svar;
});
if (somWorker) {
  check("arbetarrollen (BYPASSRLS) duger INTE som API-roll", somWorker.saker === false, somWorker);
  check(
    "och skälet pekar ut BYPASSRLS",
    somWorker.skal.some((s) => /BYPASSRLS/.test(s)),
    somWorker.skal,
  );
} else {
  check("arbetarrollen finns inte i den här databasen (hoppas över)", true);
}

/* --- 9. Hastighetsbegränsningen, mot den delade räknaren ------------------ */

/*
 * Räkningen låg i minnet per container fram till 20260811100000, och
 * prövades då med en påhittad klocka i tests/rateLimit.ts. Den ligger nu i
 * databasen, delad mellan alla uppgifter, och därför prövas den här - mot
 * en riktig Postgres, genom samma funktion API:et anropar.
 *
 * Fyra saker, och den tredje är den lätta att missa: två klienter måste
 * räknas var för sig, annars stänger första angriparen ute alla riktiga
 * användare. En överbelastning byggd av oss själva.
 */

await nollstallGranser();

const SMAL = { tak: 3, fonsterSek: 60 };
const utfall = [];
for (let i = 0; i < SMAL.tak + 1; i++) {
  utfall.push(await provaGrans("test:198.51.100.1", SMAL));
}
check("alla anrop inom taket släpps igenom", utfall.slice(0, SMAL.tak).every((u) => u.tillaten), utfall);
check("anropet över taket avvisas", utfall[SMAL.tak].tillaten === false, utfall[SMAL.tak]);
// Ett avslag utan besked om när man får försöka igen får klienten att
// försöka direkt - och göra saken värre.
check("avslaget säger när man får försöka igen", utfall[SMAL.tak].retryAfter > 0, utfall[SMAL.tak]);
check(
  "och det ligger inom fönstret",
  utfall[SMAL.tak].retryAfter <= SMAL.fonsterSek,
  utfall[SMAL.tak],
);

const annanKlient = await provaGrans("test:198.51.100.2", SMAL);
check("en spärrad klient stänger inte ute en annan", annanKlient.tillaten, annanKlient);

/*
 * Fönstret öppnar igen. Klockan går inte att ställa fram i en databas som
 * inte är vår att stanna, så testet ställer i stället tillbaka radens
 * nollställningstid - vilket är samma sak sett från funktionen.
 */
await withAnon(async (tx) => {
  await tx.query(
    "update app.rate_limits set nollstalls = clock_timestamp() - interval '1 second' where nyckel = $1",
    ["test:198.51.100.1"],
  );
});
const efterFonstret = await provaGrans("test:198.51.100.1", SMAL);
check("fönstret öppnar när tiden gått", efterFonstret.tillaten, efterFonstret);

/*
 * DET SOM VAR HELA POÄNGEN MED FLYTTEN: räkningen ska vara delad, inte
 * per process. Två separata anslutningar ur poolen är det närmaste den här
 * sviten kommer två containrar - de delar databas men inte processminne,
 * precis som två uppgifter i drift gör.
 */
await nollstallGranser();
const delad = await Promise.all(
  Array.from({ length: SMAL.tak + 2 }, () => provaGrans("test:198.51.100.3", SMAL)),
);
check(
  "taket håller även när anropen kommer parallellt över flera anslutningar",
  delad.filter((u) => u.tillaten).length === SMAL.tak,
  delad,
);

// Bokföringsraden är inte en klient och får aldrig räknas som en.
let reserveradAvvisad = false;
try {
  await provaGrans("__stadning__", SMAL);
} catch {
  reserveradAvvisad = true;
}
check("städningens egen rad går inte att räkna upp utifrån", reserveradAvvisad);

await nollstallGranser();

/* --- 10. Vad som händer när räkningen inte går att göra ------------------- */

/*
 * "Vid fel stänger vi" stod som en avsikt i två kommentarer. Det här är
 * enda stället i sviten där den faktiska servern reses - handle() anropas
 * direkt av alla andra avsnitt och går därmed förbi begränsningen helt.
 *
 * Databasen pekas om till en port där ingenting lyssnar. Släpper API:et
 * igenom anropet ändå är en databasstörning ett öppet fönster för
 * forcering av inloggningen, och det är den sortens fel som upptäcks efteråt.
 *
 * Sist i filen med flit: efter det här är poolen riktad mot ingenting.
 */
const riktigUrl = process.env.DATABASE_URL;
await closePool();
process.env.DATABASE_URL = "postgres://ingen@127.0.0.1:1/finns-inte";

const server = createApiServer();
await new Promise<void>((klar) => server.listen(0, "127.0.0.1", klar));
const port = (server.address() as { port: number }).port;
const stangt = await fetch(`http://127.0.0.1:${port}/v1/health`);
check("utan räkning svarar API:et 503 i stället för att släppa igenom", stangt.status === 503, stangt.status);
check("och säger när man får försöka igen", stangt.headers.get("retry-after") !== null);
const stangtSvar = (await stangt.json()) as { error?: { code?: string; message?: string } };
check(
  "beskedet är begripligt och avslöjar ingenting",
  /Försök igen/i.test(stangtSvar.error?.message ?? "") &&
    !/postgres|ECONNREFUSED|127\.0\.0\.1/i.test(JSON.stringify(stangtSvar)),
  stangtSvar,
);
server.close();

process.env.DATABASE_URL = riktigUrl;
await closePool();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
