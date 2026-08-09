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
import { closePool, withAnon, withUser } from "../server/db";
import { hashPassword, verifyPassword } from "../server/auth";
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
