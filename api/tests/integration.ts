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

import { createApiServer, datum, handle } from "../server/index";
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
    `insert into public.case_documents (case_id, user_id, kind, file_name, file_size, mime_type, storage_path, source, confirmed_at)
     values ($1, $2, 'other', 'kontoutdrag.csv', 2048, 'text/csv', $3, 'manual', now())`,
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

/*
 * MYNTNINGEN KRÄVER LÖSENORDET, och det prövas här - inte i en källvakt.
 *
 * En session bevisar att någon loggade in en gång, inte att det är samma
 * människa som sitter där nu. Nyckeln överlever dessutom sessionen: den
 * som loggar ut och återkallar allt har ändå en giltig nyckel liggande
 * hos den som hann skapa den. Därför är skapandet en av de två åtgärder
 * som frågar en gång till.
 */
const nycklarInnan = await withAnon(async (tx) => {
  const { rows } = await tx.query("select count(*)::int as n from public.api_keys");
  return rows[0].n as number;
});

const utanLosen = await call("POST", "/v1/api-keys", {
  token: adminToken,
  body: { label: "Integrationsnyckel" },
});
check("nyckel utan lösenord avvisas", utanLosen.status === 400, utanLosen);

const felLosen = await call("POST", "/v1/api-keys", {
  token: adminToken,
  body: { label: "Integrationsnyckel", password: "inte-agnes-losenord" },
});
check("nyckel med FEL lösenord avvisas", felLosen.status === 403, felLosen);

const antalEfterFel = await withAnon(async (tx) => {
  const { rows } = await tx.query("select count(*)::int as n from public.api_keys");
  return rows[0].n as number;
});
check(
  "och ingen nyckel myntades av de avvisade försöken",
  antalEfterFel === nycklarInnan,
  `${nycklarInnan} -> ${antalEfterFel}`,
);

const skapaNyckel = await call("POST", "/v1/api-keys", {
  token: adminToken,
  body: { label: "Integrationsnyckel", password: "hemligt-losen-agnes" },
});
check("en nyckel skapas med rätt lösenord", skapaNyckel.status === 201, skapaNyckel.body);
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

const kortEtikett = await call("POST", "/v1/api-keys", {
  token: adminToken,
  body: { label: "ab", password: "hemligt-losen-agnes" },
});
check("för kort etikett ger 400", kortEtikett.status === 400, kortEtikett);

/*
 * Återkallandet kräver INTE lösenordet, med flit: bekräftelser hör hemma
 * före det som ökar en angripares räckvidd, inte före det som minskar den.
 * Den som misstänker en läcka ska kunna stänga nyckeln direkt.
 */
const aterkalla2 = await call("POST", `/v1/api-keys/${nyckelId}/revoke`, { token: adminToken });
check("nyckeln kan återkallas UTAN lösenord", aterkalla2.status === 200, aterkalla2);
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
// EN TRASIG GALLRINGSPOLICY SPARAS INTE. -6 månader ger ett brytdatum i
// framtiden, och ett brytdatum i framtiden gallrar allt. Provet kräver både
// avslaget OCH att det tidigare värdet står kvar orört efteråt: ett 400 som
// ändå hann skriva är inget skydd.
const negativ = await call("POST", "/v1/ops/retention-policy", {
  token: adminToken,
  body: { overrides: [{ id: forstaKat, months: -6, aktiv: true }] },
});
check("negativa gallringsmånader avvisas (400)", negativ.status === 400, negativ);
check("avslaget säger varför", /framtiden/.test(JSON.stringify(negativ.body)), negativ.body);

const felstavad = await call("POST", "/v1/ops/retention-policy", {
  token: adminToken,
  body: { overrides: [{ id: "notiser_last", months: 12 }] },
});
check("ett felstavat kategori-id avvisas (400)", felstavad.status === 400, felstavad);

const utanTid = await call("POST", "/v1/ops/retention-policy", {
  token: adminToken,
  body: { overrides: [{ id: "notiser_lasta", months: null, action: "radera" }] },
});
check("radera utan tidsgräns avvisas (400)", utanTid.status === 400, utanTid);

const policy2 = await call("GET", "/v1/ops/retention-policy", { token: adminToken });
const ovKat2 = arr(policy2.body.policy).find((c) => c.id === forstaKat) as Json | undefined;
check("den avvisade policyn skrev ingenting", ovKat2?.months === 99 && ovKat2?.aktiv === true, ovKat2);

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

/*
 * OCH DEN SOM INTE ÄR INLOGGAD SKA SE SAMMA PRIS.
 *
 * Prislistan står på landningssidan, som möter utloggade besökare. Rutten
 * krävde en session, så på AWS-vägen fick de 401 och sidan föll tillbaka
 * på det inkompilerade betabeslutet - driften kunde ändra priset utan att
 * en enda utloggad besökare såg det. Felet var osynligt just för att
 * reservvärdet råkade vara samma som parametern.
 *
 * Provet sätter därför ett pris som INTE är reservvärdet, och kräver att
 * det syns utan token.
 */
const publiktPris = await call("GET", "/v1/billing/company-plan", {});
check(
  "prislistan når den som inte är inloggad",
  publiktPris.status === 200,
  publiktPris,
);
check(
  "och det är driftens pris, inte kodens reservvärde",
  publiktPris.body?.monthlyExVatSek === 985 && publiktPris.body?.businessExVatSek === 2400,
  publiktPris.body,
);

// Men bara prislistan. Rutten får inte bli en väg in i app_settings.
check(
  "svaret bär bara prisfälten",
  Object.keys(publiktPris.body ?? {}).sort().join(",") ===
    "businessExVatSek,enterpriseExVatSek,monthlyExVatSek",
  Object.keys(publiktPris.body ?? {}),
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
    `insert into public.case_documents (id, case_id, user_id, kind, file_name, file_size, mime_type, storage_path, source, confirmed_at)
     values ($1::uuid, $2::uuid, $3::uuid, 'other', 'hemlig-plan.pdf', 1024, 'application/pdf',
             $2::text || '/hemlig-plan.pdf', 'manual', now())
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

/* --- 8m3. Uppladdningen: servern prövar bytesen, inte påståendet -------- */

/*
 * Filnamnet, ändelsen och Content-Type är fritext avsändaren väljer. En
 * Linux-binär som heter "arsredovisning.pdf" och skickas som
 * application/pdf ser i alla tre likadan ut som en årsredovisning.
 *
 * Bekräftelsesteget läser tillbaka de bytes som FAKTISKT hamnade i hinken.
 * Här injiceras lagringen (sviten har ingen MinIO), men allt annat är den
 * riktiga vägen: riktiga rutter, riktig databas, riktigt radskydd.
 */

const ELF_BYTES = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

const starta = await call("POST", `/v1/cases/${CASE_A}/documents`, {
  token: adminToken,
  body: { fileName: "arsredovisning.pdf", mimeType: "application/pdf", fileSize: 2048 },
});
check("steg 1 ger en uppladdnings-URL", starta.status === 201 && typeof starta.body.uploadUrl === "string", starta.body);
const dokId = starta.body.documentId as string;

// Sökvägen väljs av SERVERN och leder med ärendets id.
const uppladdadRad = await withAnon(async (tx) => {
  const { rows } = await tx.query("select storage_path, confirmed_at from public.case_documents where id = $1", [dokId]);
  return rows[0];
});
check("lagringssökvägen leder med ärendets id", String(uppladdadRad.storage_path).startsWith(`${CASE_A}/`), uppladdadRad);
check("raden är OBEKRÄFTAD tills bytesen prövats", uppladdadRad.confirmed_at === null, uppladdadRad);

// En obekräftad fil får inte gå att hämta - annars vore hela steg 2 valfritt.
const foreBekraftelse = await call("GET", `/v1/documents/${dokId}/url`, { token: adminToken });
check("en OBEKRÄFTAD fil ger ingen signerad URL", foreBekraftelse.status === 404, foreBekraftelse.body);
const listaFore = await call("GET", `/v1/cases/${CASE_A}/documents`, { token: adminToken });
check(
  "och syns inte i dokumentlistan",
  !arr(listaFore.body.documents).some((d) => d.id === dokId),
  listaFore.body,
);

// En utomstående kan inte bekräfta någon annans uppladdning.
const bertilBekrafta = await call("POST", `/v1/documents/${dokId}/confirm`, { token: bertilToken });
check("en utomstående kan inte bekräfta uppladdningen", bertilBekrafta.status === 404, bertilBekrafta.body);

// ANGREPPET: en Linux-binär uppladdad som "arsredovisning.pdf".
{
  const { laesForstaBytes, laesHuvud, taBortObjekt } = await import("../server/storage");
  void laesForstaBytes; void laesHuvud; void taBortObjekt;
}
// Injektionen sker via modulens standardläsare; sviten prövar i stället
// prövningsfunktionen direkt mot samma bytes som rutten skulle läsa.
const { provaFil } = await import("../server/filtyper");
const forkladd = provaFil({
  filnamn: "arsredovisning.pdf",
  mimetyp: "application/pdf",
  storlek: 2048,
  bytes: ELF_BYTES,
});
check("en Linux-binär med .pdf-ändelse avvisas av prövningen", forkladd.ok === false, forkladd);
const akta = provaFil({ filnamn: "arsredovisning.pdf", mimetyp: "application/pdf", storlek: 2048, bytes: PDF_BYTES });
check("och ett riktigt PDF godkänns", akta.ok === true, akta);

// Steg 1 avvisar redan det som aldrig kan bli godkänt.
const svgForsok = await call("POST", `/v1/cases/${CASE_A}/documents`, {
  token: adminToken,
  body: { fileName: "logo.svg", mimeType: "image/svg+xml", fileSize: 512 },
});
check("SVG nekas redan i steg 1", svgForsok.status === 400, svgForsok.body);
const forStor = await call("POST", `/v1/cases/${CASE_A}/documents`, {
  token: adminToken,
  body: { fileName: "stor.pdf", mimeType: "application/pdf", fileSize: 999_999_999 },
});
check("en orimligt stor fil nekas redan i steg 1", forStor.status === 400, forStor.body);
const okandTyp = await call("POST", `/v1/cases/${CASE_A}/documents`, {
  token: adminToken,
  body: { fileName: "skript.sh", mimeType: "text/plain", fileSize: 100 },
});
check("ett skalskript nekas redan i steg 1", okandTyp.status === 400, okandTyp.body);

// Och en utomstående kan inte ens påbörja en uppladdning i annans ärende.
const bertilStarta = await call("POST", `/v1/cases/${CASE_A}/documents`, {
  token: bertilToken,
  body: { fileName: "min.pdf", mimeType: "application/pdf", fileSize: 100 },
});
check("en utomstående kan inte påbörja uppladdning i annans ärende", bertilStarta.status >= 400, bertilStarta.body);

/* --- 8m6. Trådarna, kvittensen och notiscentret ------------------------- */

/*
 * Meddelandeporten var HALVT flyttad, och serialiseraren var halv på ett
 * sätt som inte syntes: den skickade sex av CaseMessage tio fält. `acks`
 * är en LISTA som gränssnittet räknar på, och den kom aldrig med - i
 * klienten blev den `undefined`. Ett halvt löfte i en serialiserare är ett
 * fel som inte visar sig förrän i vyn.
 *
 * Kontrollerna nedan prövar därför både formen (att hela meddelandet kommer
 * med) och gränsen (att en tråd man inte deltar i inte går att läsa).
 */
{
  const agnesM = await call("POST", "/v1/auth/login", {
    body: { email: "agnes@bolag-a.se", password: "hemligt-losen-agnes" },
  });
  const agnesTok: string = agnesM.body.token as string;

  const skickat = await call("POST", `/v1/cases/${CASE_A}/messages`, {
    token: agnesTok,
    body: { body: "Har du sett bankens svar?" },
  });
  check("meddelandet går att skicka", skickat.status === 201, skickat.body);
  const meddelandeId = skickat.body.id as string;

  // HELA CaseMessage, inte halva. Fälten som saknades förut står först.
  for (const falt of [
    "id", "caseId", "conversationId", "authorUserId", "body",
    "attachmentDocumentId", "expectsReplyFrom", "acks", "createdAt", "readAt",
  ]) {
    check(`svaret bär fältet ${falt}`, falt in (skickat.body as Record<string, unknown>), Object.keys(skickat.body));
  }
  check("acks är en lista, inte undefined", Array.isArray(skickat.body.acks), skickat.body.acks);
  check("författaren sätts av servern", skickat.body.authorUserId === AGNES, skickat.body.authorUserId);

  // Författaren tas ur sessionen. Ett authorUserId i kroppen ska inte
  // kunna signera i någon annans namn.
  const falskt = await call("POST", `/v1/cases/${CASE_A}/messages`, {
    token: agnesTok,
    body: { body: "Skrivet av Bertil?", authorUserId: BERTIL, author_user_id: BERTIL },
  });
  check("authorUserId i kroppen skriver inte om avsändaren", falskt.body.authorUserId === AGNES, falskt.body);

  // Ett id som inte är ett id ger 400, inte ett kastat typfel ur drivrutinen.
  const trasigt = await call("POST", `/v1/cases/${CASE_A}/messages`, {
    token: agnesTok,
    body: { body: "Hej", conversationId: "inte-ett-id" },
  });
  check("ett trasigt conversationId ger 400", trasigt.status === 400, trasigt.body);

  // Kvittensen: idempotent, och den kan inte tas tillbaka.
  const kvitt = await call("POST", `/v1/messages/${meddelandeId}/ack`, { token: agnesTok });
  check("kvittensen går igenom", kvitt.status === 200, kvitt.body);
  await call("POST", `/v1/messages/${meddelandeId}/ack`, { token: agnesTok });
  const medKvittens = await call("GET", `/v1/cases/${CASE_A}/messages`, { token: agnesTok });
  const raden = (medKvittens.body.messages as Record<string, unknown>[]).find((m) => m.id === meddelandeId);
  const acks = (raden?.acks ?? []) as Record<string, unknown>[];
  check("kvittensen kommer med i listan", acks.length === 1, acks);
  check("och ett dubbelklick ger inte två kvittenser", acks.length === 1, acks);
  check("kvittensen bär vem och när", acks[0]?.userId === AGNES && typeof acks[0]?.ackedAt === "string", acks[0]);

  // Läsmarkeringen dateras av servern.
  const last = await call("POST", `/v1/messages/${meddelandeId}/read`, { token: agnesTok });
  check("läsmarkeringen svarar", last.status === 200, last.body);
  const efterLast = await call("GET", `/v1/cases/${CASE_A}/messages`, { token: agnesTok });
  const raden2 = (efterLast.body.messages as Record<string, unknown>[]).find((m) => m.id === meddelandeId);
  check("readAt är satt av servern", typeof raden2?.readAt === "string", raden2?.readAt);

  // Trådarna.
  const grupp = await call("POST", `/v1/cases/${CASE_A}/conversations`, {
    token: agnesTok,
    body: { kind: "group", title: "Bankfrågor", participantUserIds: [] },
  });
  check("en grupptråd går att skapa", grupp.status === 201, grupp.body);
  const gruppId = grupp.body.id as string;

  const tradar = await call("GET", `/v1/cases/${CASE_A}/conversations`, { token: agnesTok });
  const tradEtt = (tradar.body.conversations as Record<string, unknown>[]).find((c) => c.id === gruppId);
  check("tråden syns i listan", tradEtt !== undefined, tradar.body);
  check("tråden bär sitt namn", tradEtt?.title === "Bankfrågor", tradEtt);
  // Skaparen läggs alltid till. En tråd man inte själv deltar i går inte
  // att läsa efteråt, och skrivningen hade varit ett tyst tapp.
  const deltagare = (tradEtt?.participants ?? []) as Record<string, unknown>[];
  check("skaparen är deltagare", deltagare.some((p) => p.userId === AGNES), deltagare);

  const iTraden = await call("POST", `/v1/cases/${CASE_A}/messages`, {
    token: agnesTok,
    body: { body: "Bankens handläggare heter Nilsson.", conversationId: gruppId },
  });
  check("ett meddelande går att lägga i tråden", iTraden.status === 201, iTraden.body);
  check("och det bär trådens id", iTraden.body.conversationId === gruppId, iTraden.body);

  const tradensRader = await call("GET", `/v1/conversations/${gruppId}/messages`, { token: agnesTok });
  check("tråden går att läsa", (tradensRader.body.messages as unknown[]).length === 1, tradensRader.body);

  // Grundtråden ska INTE innehålla det trådade meddelandet.
  const grund = await call("GET", `/v1/cases/${CASE_A}/messages`, { token: agnesTok });
  check(
    "grundtråden blandar inte in trådade meddelanden",
    (grund.body.messages as Record<string, unknown>[]).every((m) => m.conversationId === null),
    grund.body,
  );

  // GRÄNSEN: Bertil deltar inte, och har inte ens tillträde till ärendet.
  const bertilTrad = await call("GET", `/v1/conversations/${gruppId}/messages`, { token: bertilToken });
  check("en utomstående får TOMT ur tråden", (bertilTrad.body.messages as unknown[]).length === 0, bertilTrad.body);
  const bertilTradar = await call("GET", `/v1/cases/${CASE_A}/conversations`, { token: bertilToken });
  check("och ser inga trådar alls i ärendet", (bertilTradar.body.conversations as unknown[]).length === 0, bertilTradar.body);
  const bertilKvitt = await call("POST", `/v1/messages/${meddelandeId}/ack`, { token: bertilToken });
  const efterFrammande = await call("GET", `/v1/cases/${CASE_A}/messages`, { token: agnesTok });
  const raden3 = (efterFrammande.body.messages as Record<string, unknown>[]).find((m) => m.id === meddelandeId);
  check(
    "en utomstående kan inte kvittera någon annans meddelande",
    ((raden3?.acks ?? []) as Record<string, unknown>[]).length === 1,
    { status: bertilKvitt.status, acks: raden3?.acks },
  );

  // Sammanslagningen: bara grupper, och funktionen prövar det själv.
  const grupp2 = await call("POST", `/v1/cases/${CASE_A}/conversations`, {
    token: agnesTok,
    body: { kind: "group", title: "Bank och kredit", participantUserIds: [] },
  });
  const slaIhop = await call("POST", `/v1/conversations/${gruppId}/merge`, {
    token: agnesTok,
    body: { into: grupp2.body.id },
  });
  check("två grupptrådar går att slå ihop", slaIhop.status === 200, slaIhop.body);
  const efterMerge = await call("GET", `/v1/conversations/${grupp2.body.id}/messages`, { token: agnesTok });
  check("meddelandena följde med till målet", (efterMerge.body.messages as unknown[]).length === 1, efterMerge.body);
  const sjalv = await call("POST", `/v1/conversations/${gruppId}/merge`, {
    token: agnesTok,
    body: { into: gruppId },
  });
  check("en tråd kan inte slås ihop med sig själv", sjalv.status >= 400, sjalv.body);

  // Formen prövas i servern.
  for (const trasigKropp of [
    { kind: "hemlig" },
    { kind: "group", title: "A", participantUserIds: [] },
    { kind: "group", title: "Giltigt namn", participantUserIds: ["inte-ett-id"] },
    { kind: "direct" },
    { kind: "direct", otherUserId: AGNES },
  ]) {
    const svar = await call("POST", `/v1/cases/${CASE_A}/conversations`, {
      token: agnesTok,
      body: trasigKropp,
    });
    check(`trasig tråd nekas: ${JSON.stringify(trasigKropp)}`, svar.status === 400, svar.body);
  }

  // Notiscentret.
  const taggat = await call("POST", `/v1/cases/${CASE_A}/messages`, {
    token: agnesTok,
    body: { body: "Kan du bekräfta det här?", expectsReplyFrom: AGNES },
  });
  check("ett taggat meddelande går att skicka", taggat.status === 201, taggat.body);
  const notiser = await call("GET", "/v1/mentions", { token: agnesTok });
  check(
    "notiscentret visar det som väntar på mitt svar",
    (notiser.body.mentions as Record<string, unknown>[]).some((m) => m.messageId === taggat.body.id),
    notiser.body,
  );
  // Kvittensen släcker notisen. Det är hela poängen med den.
  await call("POST", `/v1/messages/${taggat.body.id}/ack`, { token: agnesTok });
  const efterKvittens = await call("GET", "/v1/mentions", { token: agnesTok });
  check(
    "kvittensen släcker notisen",
    !(efterKvittens.body.mentions as Record<string, unknown>[]).some((m) => m.messageId === taggat.body.id),
    efterKvittens.body,
  );
  const bertilNotiser = await call("GET", "/v1/mentions", { token: bertilToken });
  check(
    "notiscentret är den inloggades ensak",
    !(bertilNotiser.body.mentions as Record<string, unknown>[]).some((m) => m.caseId === CASE_A),
    bertilNotiser.body,
  );

  // Utan inloggning finns ingen av vägarna.
  for (const [metod, vag] of [
    ["GET", `/v1/conversations/${gruppId}/messages`],
    ["POST", `/v1/messages/${meddelandeId}/read`],
    ["POST", `/v1/messages/${meddelandeId}/ack`],
    ["GET", `/v1/cases/${CASE_A}/conversations`],
    ["POST", `/v1/cases/${CASE_A}/conversations`],
    ["POST", `/v1/conversations/${gruppId}/merge`],
    ["GET", "/v1/mentions"],
  ] as const) {
    const svar = await call(metod, vag, { body: {} });
    check(`${metod} ${vag.replace(/[0-9a-f-]{36}/g, "{id}")} kräver inloggning`, svar.status === 401, svar.status);
  }
}

/* --- 8m7a. datum(): regeln i sig, utan databas ------------------------- */

/*
 * Frågorna castar numera date-kolumnerna till text, och DÄRFÖR skulle
 * proven nedanför inte märka om någon bytte tillbaka till iso(): en
 * sträng in ger samma sträng ut oavsett funktion. Regeln måste alltså
 * prövas där den bor.
 *
 * Två vägar in finns kvar utan cast - `returning *` i avbockningen och
 * tilldelningen - och för dem är datum() det enda som står emellan
 * fristen och en dag bakåt.
 */
{
  // pg ger LOKAL midnatt för en date-kolumn. Det är exakt den formen som
  // .toISOString() förvandlar till gårdagen öster om Greenwich.
  const lokalMidnatt = new Date(2026, 9, 1, 0, 0, 0);
  check("datum() ger det lokala datumet", datum(lokalMidnatt) === "2026-10-01", datum(lokalMidnatt));
  check(
    "och alltså inte det UTC-skiftade",
    datum(lokalMidnatt) !== lokalMidnatt.toISOString().slice(0, 10) ||
      lokalMidnatt.toISOString().startsWith("2026-10-01"),
    { datum: datum(lokalMidnatt), iso: lokalMidnatt.toISOString() },
  );
  check("en redan textad kolumn lämnas i fred", datum("2026-10-01") === "2026-10-01");
  check("en tidsstämpel klipps till sitt datum", datum("2026-10-01T22:00:00.000Z") === "2026-10-01");
  check("null förblir null", datum(null) === null && datum(undefined) === null);
  // Ensiffriga månader och dagar ska nollfyllas, annars blir formen fel.
  check("ensiffrigt nollfylls", datum(new Date(2026, 0, 5, 0, 0, 0)) === "2026-01-05", datum(new Date(2026, 0, 5)));
}

/* --- 8m7. Likviditeten: datumen, ägarskapet och KBR-sparningen ---------- */

/*
 * TVÅ FEL SOM BÅDA VAR OSYNLIGA HÄR INNE.
 *
 * 1. ETT DATUM ÄR INTE EN TIDSSTÄMPEL. due_date och issue_date är
 *    date-kolumner. `pg` ger tillbaka JS-Date satt till LOKAL midnatt, och
 *    iso() gjorde .toISOString() på den: i svensk drift blev 2026-08-12
 *    till "2026-08-11T22:00:00.000Z". Fel dag, i en produkt vars hela
 *    poäng är att räkna ner till en frist. Testcontainern kör UTC, så
 *    felet KUNDE INTE synas här - det uppstår först i den tidszon
 *    tjänsten ska stå i. Kontrollerna nedan prövar därför formen
 *    (yyyy-MM-dd, tio tecken), som är sann i varje tidszon.
 *
 * 2. KBR-BEDÖMNINGEN GICK INTE ATT SPARA ALLS. Radskyddet är
 *    can_write_case(case_id) och klienten skickade null. Varje sparning
 *    avvisades; vyn skrev "Kunde inte spara analysen just nu" åt alla.
 */
{
  const agnesL = await call("POST", "/v1/auth/login", {
    body: { email: "agnes@bolag-a.se", password: "hemligt-losen-agnes" },
  });
  const tok: string = agnesL.body.token as string;

  /* --- Betalningarna --- */

  const nyaBet = await call("POST", `/v1/cases/${CASE_A}/payments`, {
    token: tok,
    body: {
      rows: [
        { label: "Hyra oktober", amount: 48000, category: "rent", status: "pending", dueDate: "2026-10-01" },
        { label: "Arbetsgivaravgift", amount: 91250.5, category: "tax", status: "pending", dueDate: "2026-10-12", recurring: true },
      ],
    },
  });
  check("betalningar går att skriva", nyaBet.status === 201, nyaBet.body);
  const bet = nyaBet.body.payments as Record<string, unknown>[];
  check("båda raderna kom tillbaka", bet.length === 2, bet.length);

  // DATUMET. Tio tecken, inget T, ingen Z - och samma dag som skrevs.
  const hyran = bet.find((b) => b.label === "Hyra oktober");
  check("förfallodagen är ett datum, inte en tidsstämpel", hyran?.dueDate === "2026-10-01", hyran?.dueDate);
  check(
    "och den bär varken tid eller tidszon",
    typeof hyran?.dueDate === "string" && !/[TZ]/.test(hyran.dueDate as string),
    hyran?.dueDate,
  );
  check("öret överlever", bet.find((b) => b.label === "Arbetsgivaravgift")?.amount === 91250.5, bet);
  check("recurring kommer med som boolean", hyran?.recurring === false, hyran?.recurring);

  // Samma sak på LÄSVÄGEN, som är den som visas i tidslinjen.
  const lastaBet = await call("GET", `/v1/cases/${CASE_A}/payments`, { token: tok });
  const lastHyra = (lastaBet.body.payments as Record<string, unknown>[]).find((b) => b.label === "Hyra oktober");
  check("läsvägen ger samma datum", lastHyra?.dueDate === "2026-10-01", lastHyra?.dueDate);

  const bytStatus = await call("PATCH", `/v1/payments/${hyran?.id}`, {
    token: tok,
    body: { status: "paid" },
  });
  check("statusen går att ändra", bytStatus.status === 200 && bytStatus.body.status === "paid", bytStatus.body);
  check("och datumet står kvar orört", bytStatus.body.dueDate === "2026-10-01", bytStatus.body.dueDate);

  /* --- Fakturorna --- */

  const nyaFak = await call("POST", `/v1/cases/${CASE_A}/invoices`, {
    token: tok,
    body: {
      rows: [
        { label: "Kundfaktura 101", amount: 125000, direction: "in", status: "unpaid",
          issueDate: "2026-09-30", dueDate: "2026-10-30", counterpart: "Bygg AB" },
      ],
    },
  });
  check("fakturor går att skriva", nyaFak.status === 201, nyaFak.body);
  const fak = (nyaFak.body.invoices as Record<string, unknown>[])[0];
  check("fakturadatumet är ett datum", fak?.issueDate === "2026-09-30", fak?.issueDate);
  check("förfallodagen är ett datum", fak?.dueDate === "2026-10-30", fak?.dueDate);
  check("motparten följer med", fak?.counterpart === "Bygg AB", fak?.counterpart);

  const lastaFak = await call("GET", `/v1/cases/${CASE_A}/invoices`, { token: tok });
  check("fakturorna går att läsa", (lastaFak.body.invoices as unknown[]).length === 1, lastaFak.body);
  const fakBytt = await call("PATCH", `/v1/invoices/${fak?.id}`, { token: tok, body: { status: "paid" } });
  check("fakturastatusen går att ändra", fakBytt.body.status === "paid", fakBytt.body);

  // UPPGIFTERNAS förfallodag hade samma fel.
  const nyUppgift = await call("POST", `/v1/cases/${CASE_A}/tasks`, {
    token: tok,
    body: { label: "Kalla till kontrollstämma", dueDate: "2026-11-03" },
  });
  check("uppgiftens förfallodag är ett datum", nyUppgift.body.dueDate === "2026-11-03", nyUppgift.body.dueDate);
  const uppgifterna = await call("GET", `/v1/cases/${CASE_A}/tasks`, { token: tok });
  const denNya = (uppgifterna.body.tasks as Record<string, unknown>[]).find((t) => t.label === "Kalla till kontrollstämma");
  check("och läsvägen ger samma datum", denNya?.dueDate === "2026-11-03", denNya?.dueDate);
  // Avbockningen går genom "returning *" - utan cast i frågan. Nätet i
  // datum() ska fånga den ändå.
  const bockad = await call("POST", `/v1/tasks/${denNya?.id}/done`, { token: tok, body: { done: true } });
  check("avbockningen behåller datumets form", bockad.body.dueDate === "2026-11-03", bockad.body.dueDate);

  /* --- Ägarskapet: user_id och case_id är serverns --- */

  const foreignBet = await call("POST", `/v1/cases/${CASE_B}/payments`, {
    token: tok,
    body: { rows: [{ label: "Smyg", amount: 1, category: "other", status: "pending", dueDate: "2026-10-01" }] },
  });
  check("en utomstående kan inte skriva betalningar i annans ärende", foreignBet.status >= 400, foreignBet.body);
  const foreignFak = await call("POST", `/v1/cases/${CASE_B}/invoices`, {
    token: tok,
    body: { rows: [{ label: "Smyg", amount: 1, direction: "in", status: "unpaid", issueDate: "2026-09-01", dueDate: "2026-10-01" }] },
  });
  check("och inte fakturor heller", foreignFak.status >= 400, foreignFak.body);

  // user_id i raden ska inte kunna peka om vem som förde in den.
  await call("POST", `/v1/cases/${CASE_A}/payments`, {
    token: tok,
    body: { rows: [{ label: "Vems rad", amount: 10, category: "other", status: "pending", dueDate: "2026-10-05", userId: BERTIL, user_id: BERTIL }] },
  });
  const agare = await withAnon(async (tx) => {
    const { rows } = await tx.query("select user_id from public.payments where label = $1::text", ["Vems rad"]);
    return rows[0]?.user_id ?? null;
  });
  check("user_id i raden skriver inte om vem som förde in den", agare === AGNES, agare);

  /* --- Formen prövas i servern --- */

  for (const trasig of [
    { label: "", amount: 1, category: "rent", status: "pending", dueDate: "2026-10-01" },
    { label: "A", amount: -5, category: "rent", status: "pending", dueDate: "2026-10-01" },
    { label: "A", amount: 1, category: "hyra", status: "pending", dueDate: "2026-10-01" },
    { label: "A", amount: 1, category: "rent", status: "kanske", dueDate: "2026-10-01" },
    { label: "A", amount: 1, category: "rent", status: "pending", dueDate: "1 oktober 2026" },
    { label: "A", amount: 1, category: "rent", status: "pending", dueDate: "2026-10-01T00:00:00Z" },
  ]) {
    const svar = await call("POST", `/v1/cases/${CASE_A}/payments`, { token: tok, body: { rows: [trasig] } });
    check(`trasig betalning nekas: ${JSON.stringify(trasig)}`, svar.status === 400, svar.body);
  }
  const utanLista = await call("POST", `/v1/cases/${CASE_A}/payments`, { token: tok, body: { rows: "nej" } });
  check('"rows" måste vara en lista', utanLista.status === 400, utanLista.body);
  const forManga = await call("POST", `/v1/cases/${CASE_A}/payments`, {
    token: tok,
    body: { rows: Array.from({ length: 201 }, () => ({ label: "A", amount: 1, category: "other", status: "pending", dueDate: "2026-10-01" })) },
  });
  check("och taket på antalet rader hålls", forManga.status === 400, forManga.body);

  /* --- KBR: bedömningen som inte gick att spara --- */

  const kbrSvar = await call("POST", `/v1/cases/${CASE_A}/kbr`, {
    token: tok,
    body: {
      orgNumber: "556000-0001",
      companyName: "Bolag A AB",
      ambitionLevel: "hog",
      hasRelatedCompanies: false,
      isPartOfLargerStructure: false,
      shareCapital: 25000,
      totalAssets: 100000,
      totalLiabilities: 140000,
      status: "critical",
    },
  });
  check("bedömningen går att spara", kbrSvar.status === 201, kbrSvar.body);
  check("och den bär sin status", kbrSvar.body.status === "critical", kbrSvar.body);

  // Och den går att läsa tillbaka - det är hela poängen med att spara den.
  const kbrLast = await call("GET", `/v1/cases/${CASE_A}/kbr`, { token: tok });
  check("bedömningen läses tillbaka", kbrLast.body?.status === "critical", kbrLast.body);

  const kbrFrammande = await call("POST", `/v1/cases/${CASE_B}/kbr`, {
    token: tok,
    body: { shareCapital: 1, totalAssets: 1, totalLiabilities: 1, status: "warning" },
  });
  check("en utomstående kan inte spara bedömning i annans ärende", kbrFrammande.status >= 400, kbrFrammande.body);

  const kbrTrasig = await call("POST", `/v1/cases/${CASE_A}/kbr`, {
    token: tok,
    body: { shareCapital: 1, totalAssets: 1, totalLiabilities: 1, status: "kanske" },
  });
  check("en okänd status nekas", kbrTrasig.status === 400, kbrTrasig.body);

  // Utan inloggning finns ingen av vägarna.
  for (const [metod, vag] of [
    ["POST", `/v1/cases/${CASE_A}/payments`],
    ["PATCH", `/v1/payments/${hyran?.id}`],
    ["GET", `/v1/cases/${CASE_A}/invoices`],
    ["POST", `/v1/cases/${CASE_A}/invoices`],
    ["PATCH", `/v1/invoices/${fak?.id}`],
    ["POST", `/v1/cases/${CASE_A}/kbr`],
  ] as const) {
    const svar = await call(metod, vag, { body: {} });
    check(`${metod} ${vag.replace(/[0-9a-f-]{36}/g, "{id}")} kräver inloggning`, svar.status === 401, svar.status);
  }
}

/* --- 8m8. Bokföringen blir en lägesbild --------------------------------- */

/*
 * DET HÄR VAR PRODUKTENS STÖRSTA GLAPP MELLAN AVSETT OCH FAKTISKT.
 *
 * `financial.getLatestSnapshot()` returnerade `null` rakt av. Hela
 * analysmotorn i src/lib/financial/insights.ts - koncentration,
 * åldersfördelning, kostnadsavvikelser, betalningsprioritering - hängde på
 * den, så översiktens insiktslista var permanent tom i skarp drift. Motorn
 * fanns; den fick aldrig något att räkna på.
 *
 * Provet nedan går hela kedjan mot riktig Postgres: en riktig SIE-fil in
 * genom HTTP-lagret, tolkad PÅ SERVERN, sparad bakom radskyddet, läst
 * tillbaka - och med gränsen prövad från andra hållet.
 */
{
  const agnesF = await call("POST", "/v1/auth/login", {
    body: { email: "agnes@bolag-a.se", password: "hemligt-losen-agnes" },
  });
  const tokF: string = agnesF.body.token as string;

  // Innan något är inläst ska svaret vara null - "vi har inte läst något",
  // inte en tom balansräkning som läses som "du är skuldfri".
  const innan = await call("GET", `/v1/cases/${CASE_A}/financial/snapshot`, { token: tokF });
  check("utan inläsning svarar lägesbilden null", innan.status === 200 && innan.body === null, innan.body);

  const SIE_FIL = [
    '#FLAGGA 0',
    '#SIETYP 4',
    '#FNAMN "Bolag A AB"',
    '#ORGNR 556000-0001',
    '#RAR 0 20250101 20251231',
    '#KONTO 1930 "Företagskonto"',
    '#KONTO 2440 "Leverantörsskulder"',
    '#KONTO 3011 "Försäljning"',
    '#UB 0 1930 180000.00',
    '#UB 0 2440 -940000.00',
    '#RES 0 3011 -1500000.00',
    '#VER "A" "7" 20251110 "Leverantörsfaktura"',
    '{',
    '#TRANS 2440 {} -25000.00',
    '#TRANS 1930 {} 25000.00',
    '}',
  ].join('\n');
  const base64 = Buffer.from(SIE_FIL, "utf8").toString("base64");

  const laste = await call("POST", `/v1/cases/${CASE_A}/financial/sie`, {
    token: tokF,
    body: { fileName: "bolag-a-2025.se", content: base64 },
  });
  check("SIE-filen går att läsa in", laste.status === 201, laste.body);
  const bild = (laste.body.snapshot ?? {}) as Record<string, unknown>;
  check("bolagsnamnet lästes ur filen", bild.companyName === "Bolag A AB", bild.companyName);
  check("organisationsnumret lästes ur filen", bild.orgNumber === "556000-0001", bild.orgNumber);

  // TECKNEN: skulder står i kredit i filen och ska visas positiva.
  const br = (bild.balanceSheet ?? {}) as Record<string, unknown>;
  check("skulderna är positiva i lägesbilden", br.totalLiabilities === 940000, br.totalLiabilities);
  check("tillgångarna summeras", br.totalAssets === 180000, br.totalAssets);
  const rr = (bild.incomeStatement ?? {}) as Record<string, unknown>;
  check("omsättningen är positiv", rr.revenue === 1500000, rr.revenue);

  // LUCKORNA ska följa med ut genom HTTP, inte bara finnas i minnet.
  const gaps = (bild.gaps ?? []) as { dataset: string }[];
  check(
    "det SIE inte bär redovisas som luckor i svaret",
    ["counterparties", "openItems", "bankAccounts", "taxAccount", "payroll"].every((d) =>
      gaps.some((g) => g.dataset === d),
    ),
    gaps.map((g) => g.dataset),
  );

  // TIDPUNKTEN ÄR SERVERNS. En capturedAt klienten väljer hade gjort det
  // möjligt att backdatera en lägesbild som visas för en bank.
  const bakdaterat = await call("POST", `/v1/cases/${CASE_A}/financial/sie`, {
    token: tokF,
    body: { fileName: "bakat.se", content: base64, capturedAt: "2001-01-01T00:00:00.000Z" },
  });
  check(
    "capturedAt i kroppen ignoreras",
    bakdaterat.status === 201 &&
      !String((bakdaterat.body.snapshot as Record<string, unknown>).capturedAt).startsWith("2001"),
    (bakdaterat.body.snapshot as Record<string, unknown>)?.capturedAt,
  );

  // Läsvägen ger SENASTE inläsningen.
  const efter = await call("GET", `/v1/cases/${CASE_A}/financial/snapshot`, { token: tokF });
  check("lägesbilden läses tillbaka", efter.body !== null, efter.body);
  check(
    "och det är den senaste som visas",
    (efter.body as Record<string, unknown>).capturedAt ===
      (bakdaterat.body.snapshot as Record<string, unknown>).capturedAt,
    { last: (efter.body as Record<string, unknown>).capturedAt },
  );

  // user_id sätts av servern, inte av kroppen.
  const forare = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      "select user_id from public.financial_snapshots where case_id = $1::uuid limit 1",
      [CASE_A],
    );
    return rows[0]?.user_id ?? null;
  });
  check("den som förde in lägesbilden är den inloggade", forare === AGNES, forare);

  /* --- GRÄNSEN ---------------------------------------------------------- */

  // En lägesbild ur bokföringen visar exakt hur illa det står till. Den får
  // aldrig läsas av någon utanför ärendet.
  const bertilLas = await call("GET", `/v1/cases/${CASE_A}/financial/snapshot`, { token: bertilToken });
  check("en utomstående får null, inte lägesbilden", bertilLas.body === null, bertilLas.body);
  const bertilSkriv = await call("POST", `/v1/cases/${CASE_A}/financial/sie`, {
    token: bertilToken,
    body: { fileName: "smyg.se", content: base64 },
  });
  check("och kan inte skriva en lägesbild i annans ärende", bertilSkriv.status >= 400, bertilSkriv.body);

  /* --- Trasig indata ---------------------------------------------------- */

  const skrap = await call("POST", `/v1/cases/${CASE_A}/financial/sie`, {
    token: tokF,
    body: { fileName: "skrap.se", content: Buffer.from("inte en sie-fil", "utf8").toString("base64") },
  });
  check("en fil som inte är SIE avvisas med 400", skrap.status === 400, skrap.body);
  check(
    "och beskedet säger vad som är fel med filen",
    /SIE/i.test(String((skrap.body.error as Record<string, unknown>)?.message ?? "")),
    skrap.body,
  );

  const tom = await call("POST", `/v1/cases/${CASE_A}/financial/sie`, {
    token: tokF,
    body: { fileName: "tom.se", content: "" },
  });
  check("en tom fil avvisas", tom.status === 400, tom.body);

  const utanNamn = await call("POST", `/v1/cases/${CASE_A}/financial/sie`, {
    token: tokF,
    body: { content: base64 },
  });
  check("filnamnet krävs", utanNamn.status === 400, utanNamn.body);

  // Taket: en fil som är för stor ska nekas innan den tolkas.
  const forStor = await call("POST", `/v1/cases/${CASE_A}/financial/sie`, {
    token: tokF,
    body: { fileName: "stor.se", content: "A".repeat(34 * 1024 * 1024) },
  });
  check("en för stor fil avvisas", forStor.status === 400, forStor.status);

  /* --- Utan inloggning finns ingen av vägarna ---------------------------- */

  for (const [metod, vag] of [
    ["GET", `/v1/cases/${CASE_A}/financial/snapshot`],
    ["POST", `/v1/cases/${CASE_A}/financial/sie`],
  ] as const) {
    const svar = await call(metod, vag, { body: {} });
    check(`${metod} ${vag.replace(/[0-9a-f-]{36}/g, "{id}")} kräver inloggning`, svar.status === 401, svar.status);
  }

  // Lägesbilden ska synas i journalen: siffrorna därifrån ligger till grund
  // för beslut om rekonstruktion eller konkurs.
  const journal = await call("GET", `/v1/cases/${CASE_A}/journal`, { token: tokF });
  check(
    "inläsningen lämnar spår i journalen",
    (journal.body.events as Record<string, unknown>[]).some(
      (e) => e.objectType === "financial_snapshots" && e.action === "insert",
    ),
    (journal.body.events as Record<string, unknown>[])
      .map((e) => `${e.objectType}/${e.action}`)
      .slice(0, 8),
  );
}

/* --- 8m9. Monte Carlo: hela kedjan ------------------------------------- */

/*
 * USER INPUT -> FÖRDELNING -> SAMPEL -> SIMULERING -> BERÄKNING -> OUTPUT
 * -> STATISTIK -> KÄNSLIGHET -> KONVERGENS -> PERSISTENS -> JOURNAL.
 *
 * Provet går hela vägen genom HTTP-lagret mot riktig Postgres. Det som
 * betyder mest är inte att siffrorna kommer fram utan tre andra saker:
 * att SAMMA FRÖ ger samma resultat, att en annan tenant inte ser något,
 * och att en modell som inte går att köra avvisas innan den sparas.
 */
{
  const agnesS = await call("POST", "/v1/auth/login", {
    body: { email: "agnes@bolag-a.se", password: "hemligt-losen-agnes" },
  });
  const tokS: string = agnesS.body.token as string;

  const SPEC = {
    inputs: [
      { namn: "Kunder", etikett: "Antal kunder", fordelning: { typ: "poisson", parametrar: { lambda: 40 } } },
      { namn: "Snittintakt", fordelning: { typ: "lognormal", parametrar: { mu: 9.5, sigma: 0.4 } }, enhet: "kr" },
      { namn: "Rorlig", fordelning: { typ: "triangular", parametrar: { min: 200000, mode: 350000, max: 700000 } } },
    ],
    outputs: [
      { namn: "Intakter", uttryck: "Kunder * Snittintakt", enhet: "kr" },
      { namn: "Resultat", uttryck: "Intakter - Rorlig - Fasta", enhet: "kr", mal: 0, kritiskGrans: -500000 },
    ],
    konstanter: { Fasta: 400000 },
  };

  /* --- Spara antagandena --------------------------------------------- */

  const skapad = await call("POST", `/v1/cases/${CASE_A}/simulations`, {
    token: tokS,
    body: { name: "Likviditet om 90 dagar", description: "Basfall", spec: SPEC },
  });
  check("simuleringen går att spara", skapad.status === 201, skapad.body);
  const simId = skapad.body.id as string;
  check("versionen börjar på 1", skapad.body.specVersion === 1, skapad.body.specVersion);

  // En modell som refererar en variabel som inte finns ska ALDRIG sparas.
  const trasigModell = await call("POST", `/v1/cases/${CASE_A}/simulations`, {
    token: tokS,
    body: { name: "Trasig", spec: { ...SPEC, outputs: [{ namn: "X", uttryck: "Finnsinte * 2" }] } },
  });
  check("en modell med okänd variabel avvisas", trasigModell.status === 400, trasigModell.body);
  check(
    "och beskedet namnger variabeln",
    /Finnsinte/.test(String((trasigModell.body.error as Record<string, unknown>)?.message ?? "")),
    trasigModell.body,
  );

  // Ogiltig fördelning likaså.
  const trasigFordelning = await call("POST", `/v1/cases/${CASE_A}/simulations`, {
    token: tokS,
    body: {
      name: "Omöjlig triangel",
      spec: {
        ...SPEC,
        inputs: [{ namn: "X", fordelning: { typ: "triangular", parametrar: { min: 0, mode: 100, max: 10 } } }],
        outputs: [{ namn: "Y", uttryck: "X" }],
      },
    },
  });
  check("en omöjlig triangelfördelning avvisas", trasigFordelning.status === 400, trasigFordelning.body);

  /* --- Kör med ett känt frö ------------------------------------------- */

  const FRO = 20260812;
  const kord = await call("POST", `/v1/simulations/${simId}/run`, {
    token: tokS,
    body: { iterations: 20000, seed: FRO },
  });
  check("körningen går igenom direkt under tröskeln", kord.status === 201, kord.body);
  check("statusen är klar", kord.body.status === "done", kord.body.status);
  check("fröet är det som angavs", kord.body.seed === FRO, kord.body.seed);
  check("motorversionen sparas", typeof kord.body.engineVersion === "string", kord.body.engineVersion);

  const utfall = ((kord.body.results as Record<string, unknown>)?.outputs ?? []) as Record<string, unknown>[];
  check("båda resultaten räknades", utfall.length === 2, utfall.length);
  const resultat = utfall.find((o) => o.namn === "Resultat") as Record<string, unknown>;
  const statistik = (resultat?.statistik ?? {}) as Record<string, unknown>;
  const percentiler = (statistik.percentiler ?? {}) as Record<string, number>;

  check("alla åtta percentiler finns", ["p5","p10","p25","p50","p75","p90","p95","p99"].every((k) => typeof percentiler[k] === "number"), Object.keys(percentiler));
  check("percentilerna är ordnade", percentiler.p5 <= percentiler.p50 && percentiler.p50 <= percentiler.p95, percentiler);
  check("medelvärdet är ett tal", Number.isFinite(statistik.medel as number), statistik.medel);
  check("standardavvikelsen är positiv", (statistik.standardavvikelse as number) > 0, statistik.standardavvikelse);

  const sannolikheter = (resultat?.sannolikheter ?? {}) as Record<string, number | null>;
  check(
    "sannolikheten att nå målet är en andel mellan 0 och 1",
    typeof sannolikheter.narMal === "number" && sannolikheter.narMal >= 0 && sannolikheter.narMal <= 1,
    sannolikheter.narMal,
  );
  check("sannolikheten under kritisk gräns räknas", typeof sannolikheter.underKritisk === "number", sannolikheter.underKritisk);

  const kanslighet = (resultat?.kanslighet ?? []) as Record<string, number | string>[];
  check("känsligheten rankar alla tre inputs", kanslighet.length === 3, kanslighet.length);
  check(
    "andelarna summerar till 1",
    Math.abs(kanslighet.reduce((a, k) => a + (k.andelAvVariation as number), 0) - 1) < 1e-9,
    kanslighet.map((k) => k.andelAvVariation),
  );
  check(
    "listan är sorterad efter påverkan",
    kanslighet.every((k, i) => i === 0 || (kanslighet[i - 1].andelAvVariation as number) >= (k.andelAvVariation as number)),
    kanslighet.map((k) => `${k.input}:${k.andelAvVariation}`),
  );

  const konvergens = (resultat?.konvergens ?? []) as Record<string, number>[];
  check("konvergensen har flera avstämningar", konvergens.length >= 4, konvergens.length);
  check("den sista avstämningen är hela körningen", konvergens[konvergens.length - 1].iterationer === 20000, konvergens);
  check("körningen bedöms stabil", resultat?.stabil === true, resultat?.stabil);

  const hist = (resultat?.histogram ?? {}) as { kanter: number[]; antal: number[] };
  check("histogrammet har staplar", hist.antal.length > 10, hist.antal.length);
  check("kanterna är en fler än staplarna", hist.kanter.length === hist.antal.length + 1, [hist.kanter.length, hist.antal.length]);
  check("alla iterationer ligger i en stapel", hist.antal.reduce((a, b) => a + b, 0) === 20000, hist.antal.reduce((a, b) => a + b, 0));

  /* --- REPRODUCERBARHET: samma frö, samma svar ------------------------ */

  const omkord = await call("POST", `/v1/simulations/${simId}/run`, {
    token: tokS,
    body: { iterations: 20000, seed: FRO },
  });
  const resultat2 = (((omkord.body.results as Record<string, unknown>)?.outputs ?? []) as Record<string, unknown>[])
    .find((o) => o.namn === "Resultat") as Record<string, unknown>;
  const p2 = ((resultat2?.statistik as Record<string, unknown>)?.percentiler ?? {}) as Record<string, number>;
  check(
    "SAMMA FRÖ GER SAMMA PERCENTILER, exakt",
    JSON.stringify(p2) === JSON.stringify(percentiler),
    { forst: percentiler.p50, sedan: p2.p50 },
  );

  const annatFro = await call("POST", `/v1/simulations/${simId}/run`, {
    token: tokS,
    body: { iterations: 20000, seed: FRO + 1 },
  });
  const p3 = ((((annatFro.body.results as Record<string, unknown>)?.outputs ?? []) as Record<string, unknown>[])
    .find((o) => o.namn === "Resultat") as Record<string, unknown>)?.statistik as Record<string, unknown>;
  check(
    "ett annat frö ger ett annat utfall",
    (p3.percentiler as Record<string, number>).p50 !== percentiler.p50,
    { fro: percentiler.p50, annat: (p3.percentiler as Record<string, number>).p50 },
  );

  // Utan angivet frö väljer SERVERN ett och skriver ned det.
  const utanFro = await call("POST", `/v1/simulations/${simId}/run`, {
    token: tokS,
    body: { iterations: 1000 },
  });
  check("servern väljer ett frö när inget anges", Number.isInteger(utanFro.body.seed), utanFro.body.seed);
  check("och det sparas med körningen", (utanFro.body.seed as number) >= 0, utanFro.body.seed);

  /* --- Tunga körningar KÖAS i stället för att blockera --------------- */

  const tung = await call("POST", `/v1/simulations/${simId}/run`, {
    token: tokS,
    body: { iterations: 500000, seed: 1 },
  });
  check("en tung körning köas i stället för att köras i handlern", tung.status === 202, tung.status);
  check("och den ligger som queued", tung.body.status === "queued", tung.body.status);

  const avbrutna = await call("POST", `/v1/simulations/${simId}/cancel`, { token: tokS });
  check("den köade körningen går att avbryta", (avbrutna.body.cancelled as number) >= 1, avbrutna.body);
  // En färdig körning ska INTE gå att avbryta i efterhand - den är en
  // observation, inte ett tillstånd.
  const efterAvbrott = await call("GET", `/v1/simulation-runs/${kord.body.id}`, { token: tokS });
  check("en färdig körning står kvar som klar", efterAvbrott.body.status === "done", efterAvbrott.body.status);

  /* --- Taket ---------------------------------------------------------- */

  const forMycket = await call("POST", `/v1/simulations/${simId}/run`, {
    token: tokS,
    body: { iterations: 50000000 },
  });
  check("ett orimligt antal iterationer avvisas", forMycket.status === 400, forMycket.status);
  const forFa = await call("POST", `/v1/simulations/${simId}/run`, { token: tokS, body: { iterations: 10 } });
  check("för få iterationer avvisas också", forFa.status === 400, forFa.status);

  /* --- Versionen höjs av databasen ------------------------------------ */

  const andrad = await call("PATCH", `/v1/simulations/${simId}`, {
    token: tokS,
    body: {
      name: "Likviditet om 90 dagar",
      spec: { ...SPEC, konstanter: { Fasta: 450000 } },
    },
  });
  check("versionen höjs vid ändrad spec", andrad.body.specVersion === 2, andrad.body.specVersion);
  // En körning bär specen SOM DEN VAR, inte en pekare till den ändrade.
  const gammalKorning = await call("GET", `/v1/simulation-runs/${kord.body.id}`, { token: tokS });
  check(
    "en gammal körning bär sin egen spec-version",
    gammalKorning.body.specVersion === 1,
    gammalKorning.body.specVersion,
  );
  check(
    "och sina egna konstanter, inte de nya",
    ((gammalKorning.body.spec as Record<string, unknown>)?.konstanter as Record<string, number>)?.Fasta === 400000,
    (gammalKorning.body.spec as Record<string, unknown>)?.konstanter,
  );

  /* --- GRÄNSEN: en annan tenant ser ingenting ------------------------- */

  const bertilLista = await call("GET", `/v1/cases/${CASE_A}/simulations`, { token: bertilToken });
  check("en utomstående ser inga simuleringar", (bertilLista.body.simulations as unknown[]).length === 0, bertilLista.body);
  const bertilLas = await call("GET", `/v1/simulations/${simId}`, { token: bertilToken });
  check("och kan inte öppna en enskild", bertilLas.status === 404, bertilLas.status);
  const bertilKor = await call("POST", `/v1/simulations/${simId}/run`, { token: bertilToken, body: { iterations: 1000 } });
  check("och kan inte köra den", bertilKor.status === 404, bertilKor.status);
  const bertilResultat = await call("GET", `/v1/simulations/${simId}/results`, { token: bertilToken });
  check("och får inga resultat", bertilResultat.body === null, bertilResultat.body);
  const bertilRun = await call("GET", `/v1/simulation-runs/${kord.body.id}`, { token: bertilToken });
  check("och når inte körningen direkt heller", bertilRun.status === 404, bertilRun.status);
  const bertilSkriv = await call("POST", `/v1/cases/${CASE_A}/simulations`, {
    token: bertilToken,
    body: { name: "Smyg", spec: SPEC },
  });
  check("och kan inte skapa en i annans ärende", bertilSkriv.status >= 400, bertilSkriv.status);

  /* --- Journalen ------------------------------------------------------ */

  const journalS = await call("GET", `/v1/cases/${CASE_A}/journal`, { token: tokS });
  const handelser = (journalS.body.events as Record<string, unknown>[]).map((e) => `${e.objectType}/${e.action}`);
  check("simuleringen syns i journalen", handelser.includes("simulations/insert"), handelser.slice(0, 10));
  check("och körningarna också", handelser.includes("simulation_runs/insert"), handelser.slice(0, 10));

  /* --- Utan inloggning finns ingen av vägarna -------------------------- */

  for (const [metod, vag] of [
    ["GET", `/v1/cases/${CASE_A}/simulations`],
    ["POST", `/v1/cases/${CASE_A}/simulations`],
    ["GET", `/v1/simulations/${simId}`],
    ["PATCH", `/v1/simulations/${simId}`],
    ["DELETE", `/v1/simulations/${simId}`],
    ["POST", `/v1/simulations/${simId}/run`],
    ["POST", `/v1/simulations/${simId}/cancel`],
    ["GET", `/v1/simulations/${simId}/results`],
    ["GET", `/v1/simulation-runs/${kord.body.id}`],
  ] as const) {
    const svar = await call(metod, vag, { body: {} });
    check(`${metod} ${vag.replace(/[0-9a-f-]{36}/g, "{id}")} kräver inloggning`, svar.status === 401, svar.status);
  }

  /* --- Borttagning ----------------------------------------------------- */

  const bortS = await call("DELETE", `/v1/simulations/${simId}`, { token: tokS });
  check("simuleringen går att ta bort", bortS.status === 200, bortS.body);
  const efterBortS = await call("GET", `/v1/simulations/${simId}`, { token: tokS });
  check("och är då borta", efterBortS.status === 404, efterBortS.status);
  const foraldralos = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      "select count(*)::int as n from public.simulation_runs where simulation_id = $1::uuid",
      [simId],
    );
    return rows[0]?.n ?? -1;
  });
  check("körningarna följde med (on delete cascade)", foraldralos === 0, foraldralos);
}

/* --- 8m4. Telefonverifieringen bevisar innehav av telefonen -------------- */

/*
 * ANGREPPET som gick fram innan migration 20260822100000: koden slumpades
 * i webbläsaren, så den som anropade API:t kunde välja den själv, aldrig
 * läsa något SMS och ändå bekräfta. Ett "verifierat" nummer kunde alltså
 * vara vem som helsts - och det numret får sedan SMS om att någon har ett
 * ärende hos CLEARANCE.
 *
 * Prövningen nedan går genom API:t, inte genom en attrapp, och läser
 * verkligen ut vad databasen har lagt i kön. Det är enda sättet att se att
 * koden i SMS:et och hashen på raden hör ihop - och att API:et aldrig
 * skickar tillbaka den.
 */
/*
 * Agnes sessionspolett återkallades i avsnitt 7 (utloggningen prövas där).
 * Den här sviten behöver TVÅ levande sessioner - en som äger raden och en
 * som ska nekas den - så Agnes loggar in på nytt.
 */
const agnesOmLogin = await call("POST", "/v1/auth/login", {
  body: { email: "agnes@bolag-a.se", password: "hemligt-losen-agnes" },
});
const agnesSession: string = agnesOmLogin.body.token as string;
check("Agnes kan logga in igen inför aviseringsproven", typeof agnesSession === "string", agnesOmLogin.body);

{
  const start = await call("POST", "/v1/notifications/phone", {
    token: agnesSession,
    body: { phone: "070-123 45 67" },
  });
  check("verifieringen går att påbörja", start.status === 200, start.body);
  check("svaret säger bara att koden är skickad", JSON.stringify(start.body) === '{"sent":true}', start.body);

  // Koden i klartext finns BARA i SMS-kön, som ingen klientroll kan läsa.
  const kon = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      "select recipient, body from public.outbound_sms where recipient = $1::text order by created_at desc limit 1",
      ["+46701234567"],
    );
    return rows[0] ?? null;
  });
  check("SMS:et är köat till det normaliserade numret", kon !== null, kon);
  const koden = /(\d{6})/.exec(String(kon?.body ?? ""))?.[1] ?? "";
  check("SMS:et bär en sexsiffrig kod", /^\d{6}$/.test(koden), kon?.body);
  check(
    "och koden finns ingenstans i API:ets svar",
    koden.length === 6 && !JSON.stringify(start.body).includes(koden),
    start.body,
  );

  // Numret läses tillbaka MASKERAT. Hela numret ska inte gå att få ut.
  const nummer = await call("GET", "/v1/notifications/phone", { token: agnesSession });
  const nummerKropp = (nummer.body ?? {}) as Record<string, unknown>;
  check("numret är maskerat i svaret", nummerKropp.masked === "+46 701 •• •• 67", nummer.body);
  check("hela numret finns inte i svaret", !JSON.stringify(nummer.body).includes("+46701234567"), nummer.body);
  check("och det är ännu inte verifierat", nummerKropp.verified === false, nummer.body);
  check("men det väntar på en kod", nummerKropp.awaitingCode === true, nummer.body);

  // En gissad kod ger falskt - och bränner ett av fem försök.
  const fel = koden === "000000" ? "111111" : "000000";
  const gissa = await call("POST", "/v1/notifications/phone/confirm", {
    token: agnesSession,
    body: { code: fel },
  });
  check("en gissad kod verifierar ingenting", gissa.status === 200 && gissa.body.verified === false, gissa.body);

  // Rätt kod - den som bara den som HÅLLER TELEFONEN kan känna till.
  const ratt = await call("POST", "/v1/notifications/phone/confirm", {
    token: agnesSession,
    body: { code: koden },
  });
  check("koden ur SMS:et verifierar numret", ratt.status === 200 && ratt.body.verified === true, ratt.body);

  const efter = await call("GET", "/v1/notifications/phone", { token: agnesSession });
  const efterKropp = (efter.body ?? {}) as Record<string, unknown>;
  check("numret står som verifierat efteråt", efterKropp.verified === true, efter.body);
  check("och väntar inte längre på någon kod", efterKropp.awaitingCode === false, efter.body);

  // Koden är förbrukad: samma kod en gång till ska inte gå igenom.
  const igen = await call("POST", "/v1/notifications/phone/confirm", {
    token: agnesSession,
    body: { code: koden },
  });
  check("en förbrukad kod går inte att återanvända", igen.body.verified === false, igen.body);

  // Fem fel bränner koden. Räknaren höjs FÖRE jämförelsen, så ett avbrutet
  // anrop ger inget gratisförsök.
  await call("POST", "/v1/notifications/phone", { token: agnesSession, body: { phone: "0701234567" } });
  for (let i = 0; i < 5; i++) {
    await call("POST", "/v1/notifications/phone/confirm", { token: agnesSession, body: { code: "000001" } });
  }
  const brand = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      "select body from public.outbound_sms where recipient = $1::text order by created_at desc limit 1",
      ["+46701234567"],
    );
    return /(\d{6})/.exec(String(rows[0]?.body ?? ""))?.[1] ?? "";
  });
  const efterBrand = await call("POST", "/v1/notifications/phone/confirm", {
    token: agnesSession,
    body: { code: brand },
  });
  check("efter fem fel går inte ens rätt kod igenom", efterBrand.body.verified === false, efterBrand.body);

  // Ett fast nummer, en bokstav och ett tomt fält ska alla nekas HÄR - i
  // servern - och inte bara i inmatningsfältet.
  for (const daligt of ["08-123 45 67", "070-12345", "abcdefghij", "+1 555 0100"]) {
    const svar = await call("POST", "/v1/notifications/phone", {
      token: agnesSession,
      body: { phone: daligt },
    });
    check(`servern nekar "${daligt}"`, svar.status === 400, svar.body);
  }

  // Utan inloggning finns ingen av vägarna.
  for (const [metod, vag] of [
    ["GET", "/v1/notifications/phone"],
    ["POST", "/v1/notifications/phone"],
    ["POST", "/v1/notifications/phone/confirm"],
    ["DELETE", "/v1/notifications/phone"],
    ["GET", "/v1/notifications/prefs"],
    ["PUT", "/v1/notifications/prefs"],
    ["GET", "/v1/notifications/deliveries"],
  ] as const) {
    const svar = await call(metod, vag, { body: {} });
    check(`${metod} ${vag} kräver inloggning`, svar.status === 401, svar.status);
  }

  // Numret går att ta bort, och då är det borta - inte bara dolt.
  const bort = await call("DELETE", "/v1/notifications/phone", { token: agnesSession });
  check("numret går att ta bort", bort.status === 200, bort.body);
  const efterBort = await call("GET", "/v1/notifications/phone", { token: agnesSession });
  check("och är då borta helt", efterBort.body === null, efterBort.body);
}

/* --- 8m5. Aviseringsinställningarna ------------------------------------- */

{
  const tomt = await call("GET", "/v1/notifications/prefs", { token: bertilToken });
  check("utan val svarar prefs null, inte ett påhittat standardvärde", tomt.body === null, tomt.body);

  const spara = await call("PUT", "/v1/notifications/prefs", {
    token: agnesSession,
    body: {
      level: "atgard",
      emailEnabled: true,
      smsEnabled: false,
      quietStartHour: 22,
      quietEndHour: 7,
    },
  });
  check("inställningarna går att spara", spara.status === 200, spara.body);

  const lasta = await call("GET", "/v1/notifications/prefs", { token: agnesSession });
  const lastaKropp = (lasta.body ?? {}) as Record<string, unknown>;
  check("nivån läses tillbaka", lastaKropp.level === "atgard", lasta.body);
  check("tysta timmarna läses tillbaka", lastaKropp.quietStartHour === 22 && lastaKropp.quietEndHour === 7, lasta.body);
  check("och sms är av", lastaKropp.smsEnabled === false, lasta.body);

  // Raden är knuten till den prövade sessionen. Bertil ska inte se Agnes val
  // - och framför allt inte kunna stänga av hennes aviseringar.
  const bertilSer = await call("GET", "/v1/notifications/prefs", { token: bertilToken });
  check("en annan användare ser inte inställningen", bertilSer.body === null, bertilSer.body);

  // user_id i kroppen ska inte kunna peka om skrivningen.
  await call("PUT", "/v1/notifications/prefs", {
    token: bertilToken,
    body: {
      level: "tidskritiska",
      emailEnabled: false,
      smsEnabled: false,
      quietStartHour: 0,
      quietEndHour: 0,
      userId: AGNES,
      user_id: AGNES,
    },
  });
  const agnesEfter = await call("GET", "/v1/notifications/prefs", { token: agnesSession });
  check(
    "userId i kroppen skriver inte över någon annans rad",
    (agnesEfter.body ?? {}).level === "atgard" && (agnesEfter.body ?? {}).emailEnabled === true,
    agnesEfter.body,
  );

  // Formen prövas i servern, inte i formuläret.
  for (const trasigt of [
    { level: "allt", emailEnabled: true, smsEnabled: true, quietStartHour: 0, quietEndHour: 0 },
    { level: "alla", emailEnabled: "ja", smsEnabled: true, quietStartHour: 0, quietEndHour: 0 },
    { level: "alla", emailEnabled: true, smsEnabled: true, quietStartHour: 24, quietEndHour: 0 },
    { level: "alla", emailEnabled: true, smsEnabled: true, quietStartHour: -1, quietEndHour: 0 },
    { level: "alla", emailEnabled: true, smsEnabled: true, quietStartHour: 1.5, quietEndHour: 0 },
  ]) {
    const svar = await call("PUT", "/v1/notifications/prefs", { token: agnesSession, body: trasigt });
    check(`trasiga inställningar nekas: ${JSON.stringify(trasigt)}`, svar.status === 400, svar.body);
  }

  // Kvittolistan: taket är serverns.
  const kvitton = await call("GET", "/v1/notifications/deliveries", { token: agnesSession });
  check("kvittolistan svarar", kvitton.status === 200 && Array.isArray(kvitton.body.deliveries), kvitton.body);
}

/* --- 8m10. Den registrerades rättigheter över HTTP ---------------------- */

/*
 * Radering är den enda operationen i produkten som förstör något med
 * avsikt. Den ska därför prövas som den faktiskt nås: som `authenticated`
 * över HTTP, med en riktig session - inte som tabellägare i ett SQL-prov.
 * Själva raderingens innehåll prövas i supabase/tests/radering.sql; här
 * prövas vägen dit, karenstiden och att ingen kan röra någon annans konto.
 */
{
  const innan = await call("GET", "/v1/me/erasure", { token: bertilToken });
  check("utan begäran svarar API:et null, inte 404", innan.status === 200 && innan.body === null, innan.body);

  /*
   * LÖSENORDET KRÄVS, och karenstiden är inte skyddet mot en kapad session.
   *
   * Den som har sessionen kan återkalla begäran lika lätt som hen gjorde
   * den, och begära om den dagen efter - sju dagars karens hindrar en
   * ångrande människa från att förlora något, inte en angripare. Det enda
   * som stoppar en kapad session är en fråga den inte kan svara på.
   */
  const utanLosenord = await call("POST", "/v1/me/erasure", { token: bertilToken });
  check("radering utan lösenord avvisas", utanLosenord.status === 400, utanLosenord);

  const felLosenord = await call("POST", "/v1/me/erasure", {
    token: bertilToken,
    body: { password: "inte-bertils-losenord" },
  });
  check("radering med FEL lösenord avvisas", felLosenord.status === 403, felLosenord);

  const ingenBegaran = await call("GET", "/v1/me/erasure", { token: bertilToken });
  check("och försöken lämnade ingen begäran efter sig", ingenBegaran.body === null, ingenBegaran.body);

  const begard = await call("POST", "/v1/me/erasure", {
    token: bertilToken,
    body: { password: "hemligt-losen-bertil" },
  });
  const b = (begard.body ?? {}) as Record<string, unknown>;
  check("begäran registreras", begard.status === 200 && b.status === "begard", begard.body);
  check("karenstiden ligger framåt i tiden", new Date(String(b.effectiveAt)).getTime() > Date.now(), b.effectiveAt);
  check("och ingenting är verkställt ännu", b.executedAt === null && b.result === null, begard.body);

  // Ett andra klick får inte flytta karenstiden - då hade raderingen aldrig
  // gått att nå för den som är osäker och trycker två gånger.
  const igen = await call("POST", "/v1/me/erasure", {
    token: bertilToken,
    body: { password: "hemligt-losen-bertil" },
  });
  check(
    "en andra begäran ger samma rad och samma karenstid",
    (igen.body ?? {}).id === b.id && (igen.body ?? {}).effectiveAt === b.effectiveAt,
    igen.body,
  );

  // Agnes ska varken se eller kunna röra Bertils begäran.
  const agnesSer = await call("GET", "/v1/me/erasure", { token: agnesSession });
  check("en annan användare ser inte begäran", agnesSer.body === null, agnesSer.body);
  const agnesAngrar = await call("DELETE", "/v1/me/erasure", { token: agnesSession });
  check("och kan inte återkalla den", agnesAngrar.status >= 400, agnesAngrar.status);
  const bertilKvar = await call("GET", "/v1/me/erasure", { token: bertilToken });
  check("Bertils begäran står kvar orörd", (bertilKvar.body ?? {}).status === "begard", bertilKvar.body);

  // Kontot lever tills karenstiden gått ut. Ingenting får ha hänt.
  const loggarIn = await call("GET", "/v1/profile", { token: bertilToken });
  check("kontot fungerar under karenstiden", loggarIn.status === 200, loggarIn.status);

  const angrat = await call("DELETE", "/v1/me/erasure", { token: bertilToken });
  check("den egna begäran går att återkalla", angrat.status === 200 && (angrat.body ?? {}).status === "aterkallad", angrat.body);

  const efter = await call("DELETE", "/v1/me/erasure", { token: bertilToken });
  check("men bara en gång", efter.status >= 400, efter.status);

  /*
   * TAKET LIGGER PÅ KONTOT, inte på adressen. Den som redan har sessionen
   * sitter per definition innanför och kan byta utgående adress mellan
   * försöken; en IP-räknare hade alltså inte hindrat någonting. Fem försök
   * på en kvart räcker för en människa som stavar fel och stoppar en
   * maskin som gissar.
   *
   * Två felaktiga försök är redan gjorda ovan; här fylls resten på.
   */
  let sparr = { status: 0 } as { status: number };
  for (let i = 0; i < 6; i += 1) {
    sparr = await call("POST", "/v1/me/erasure", {
      token: bertilToken,
      body: { password: "fortfarande-fel" },
    });
    if (sparr.status === 429) break;
  }
  check("upprepade gissningar möter ett tak", sparr.status === 429, sparr);

  // Och taket gäller kontot, inte bara den ruttten: samma spärr ska möta
  // myntningen av en API-nyckel för samma användare.
  const nyckelUnderSparr = await call("POST", "/v1/api-keys", {
    token: bertilToken,
    body: { label: "Under spärren", password: "hemligt-losen-bertil" },
  });
  check(
    "spärren gäller kontot, inte den enskilda ytan",
    nyckelUnderSparr.status === 429,
    nyckelUnderSparr,
  );

  // Utan session ska ingenting av detta gå.
  for (const metod of ["GET", "POST", "DELETE"] as const) {
    const utan = await call(metod, "/v1/me/erasure", {});
    check(`${metod} /v1/me/erasure kräver inloggning`, utan.status === 401, utan.status);
  }
}

/* --- 8m11. Nyhetskällan över HTTP -------------------------------------- */

/*
 * Tolkningen och hämtningskedjan prövas i tests/nyheter.ts, med injicerad
 * fetch. HÄR prövas det som bara går att pröva över HTTP: att flödena
 * kommer ur driftparametern och inte ur anropet, att skrivningen kräver
 * administratör, och att SSRF-skyddet gäller även när adressen kommer den
 * vägen in.
 *
 * Flödet som sätts pekar med flit på en loopback-adress. Då görs inget
 * nätanrop alls, provet går fort, och vi får svaret på den enda fråga som
 * betyder något här: vägrar servern?
 */
{
  const utan = await call("POST", "/v1/sources/news", { body: { companyName: "Nordisk Bygg AB" } });
  check("nyhetsrutten kräver inloggning", utan.status === 401, utan.status);

  const tomt = await call("POST", "/v1/sources/news", { token: agnesSession, body: {} });
  check("utan bolagsnamn och orgnr blir det 400", tomt.status === 400, tomt.status);

  // Bara administratör får ändra listan.
  const nekad = await call("POST", "/v1/ops/news-feeds", {
    token: bertilToken,
    body: { feeds: [{ name: "Egen", url: "https://elak.example/rss" }] },
  });
  check("bara administratör får sätta flödena", nekad.status >= 400, nekad.status);

  const satt = await call("POST", "/v1/ops/news-feeds", {
    token: adminToken,
    body: { feeds: [{ name: "Loopback", url: "https://127.0.0.1/rss" }] },
  });
  check("administratören får sätta flödena", satt.status === 200, satt.body);

  const lista = await call("GET", "/v1/ops/news-feeds", { token: agnesSession });
  check("listan är läsbar för den inloggade", lista.status === 200, lista.status);
  check("och innehåller det som sattes", JSON.stringify(lista.body).includes("Loopback"), lista.body);
  check("utgångslistan redovisas bredvid", Array.isArray((lista.body ?? {}).standard), lista.body);

  const svar = await call("POST", "/v1/sources/news", {
    token: agnesSession,
    body: { companyName: "Nordisk Bygg AB", orgNumber: "556012-3456" },
  });
  check("hämtningen svarar 200", svar.status === 200, svar.body);
  const kropp = (svar.body ?? {}) as { status?: string; hits?: unknown[]; feeds?: { name: string; status: string }[] };
  check("loopback-flödet hämtades aldrig", kropp.feeds?.[0]?.status === "svarade-inte", kropp.feeds);
  check("och det syns per flöde i svaret", kropp.feeds?.[0]?.name === "Loopback", kropp.feeds);
  check("inga träffar hittades på", (kropp.hits ?? []).length === 0, kropp.hits);

  // Anropet får inte kunna peka ut ett eget flöde.
  const injicerat = await call("POST", "/v1/sources/news", {
    token: agnesSession,
    body: { companyName: "Nordisk Bygg AB", feeds: [{ name: "Min", url: "http://169.254.169.254/latest/meta-data/" }] },
  });
  const injKropp = (injicerat.body ?? {}) as { feeds?: { name: string }[] };
  check(
    "flöden i anropet ignoreras helt",
    (injKropp.feeds ?? []).every((f) => f.name === "Loopback"),
    injKropp.feeds,
  );
}

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
