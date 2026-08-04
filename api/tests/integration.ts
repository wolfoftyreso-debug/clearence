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

import { handle } from "../server/index";
import { closePool, withAnon, withUser } from "../server/db";
import { hashPassword, verifyPassword } from "../server/auth";

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

await closePool();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
