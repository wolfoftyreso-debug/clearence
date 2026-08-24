/**
 * HUNDRA SCENARIER GENOM DEN LEVANDE STACKEN.
 *
 * tests/scenarier.ts kör samma hundra situationer genom motorn: rena
 * funktioner, inget nät, inget radskydd. Det bevisar att RÄKNINGEN håller.
 *
 * Det bevisar inte att produkten håller. Mellan motorn och användaren
 * ligger en databas med radskydd, ett API, en serialisering och - sedan
 * flytten - Vercel-ingången. Ett belopp kan gå in som "1 200 000" och
 * komma tillbaka som något annat; ett ärende kan bli läsbart för fel
 * bolag. Ingetdera syns i en ren funktion.
 *
 * Den här sviten kör därför hundra ärenden genom api/[...path].ts mot en
 * riktig Postgres och kräver tre saker av varje:
 *
 *   1. TUR OCH RETUR UTAN FÖRLUST. Fältet som sparades är fältet som
 *      kommer tillbaka - tecken för tecken. Ett hårt mellanslag som blir
 *      ett vanligt, eller en null som blir "null", ändrar analysen.
 *   2. SAMMA ANALYS PÅ BÅDA SIDOR. Bedömningen räknad ur API:ts svar ska
 *      vara identisk med den räknad ur det som seedades. Går de isär är
 *      det transporten som ljuger, och det är den värsta sortens fel:
 *      båda sidor ser rätt ut var för sig.
 *   3. RADSKYDDET HÅLLER, HUNDRA GÅNGER. Varje ärende prövas av de två
 *      ägare det INTE tillhör. Ett enda 200 där är hela produktens löfte
 *      brutet.
 *
 * Ärendena seedas med SQL. Det är inte en genväg: egna API:t har ingen
 * skrivväg för ärenden - kontraktet deklarerar POST /cases, men servern
 * svarar 405, och det är nu nedskrivet i tests/apiSpec.ts.
 */

import vercelHandler from "../../api/[...path]";
import { closePool, withAnon } from "../db";
import { hashPassword } from "../auth";
import { nollstallGranser } from "../rateLimit";
import { analyseCrisis } from "../../src/lib/crisisAnalysis";
import { analysisInputFromCase } from "../../src/lib/caseAnalysis";
import type { CaseRecord } from "../../src/data/types";

let passed = 0;
let failed = 0;
const check = (namn: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${namn}${extra === undefined ? "" : ` :: ${JSON.stringify(extra)?.slice(0, 300)}`}`);
  }
};

/* --- Vercel-ingången, som i drift -------------------------------------- */

interface Svar {
  status: number;
  body: unknown;
}

const anropa = async (
  metod: string,
  vag: string,
  val: { token?: string; body?: unknown } = {},
): Promise<Svar> => {
  const fangat: Svar = { status: 0, body: null };
  const res = {
    setHeader: () => {},
    status(kod: number) {
      fangat.status = kod;
      return this;
    },
    json: (kropp: unknown) => {
      fangat.body = kropp;
    },
  };
  const headers: Record<string, string> = { host: "clearance.se" };
  if (val.token) headers.authorization = `Bearer ${val.token}`;
  if (val.body !== undefined) headers["content-type"] = "application/json";
  await vercelHandler(
    { method: metod, url: `/api${vag}`, headers, body: val.body, socket: { remoteAddress: "127.0.0.1" } },
    res,
  );
  return fangat;
};

/* --- Hundra bolag, tre ägare -------------------------------------------- */

/*
 * SITUATIONERNA ÄR VALDA, INTE SLUMPADE.
 *
 * Samma spännvidd som tests/scenarier.ts: betalningsförmågan i alla
 * kombinationer, obesvarade frågor, beloppen som folk faktiskt skriver,
 * förfallodagar som inte finns varje månad, och siffror från noll till
 * miljarder.
 */
type Situation = Partial<CaseRecord>;

const SITUATIONER: Situation[] = [];
for (let bitar = 0; bitar < 16; bitar += 1) {
  SITUATIONER.push({
    canPaySalary: (bitar & 1) !== 0,
    canPayTax: (bitar & 2) !== 0,
    canPayRent: (bitar & 4) !== 0,
    canPaySuppliers: (bitar & 8) !== 0,
  });
}
for (const belopp of [
  "0", "1", "1 200 000", "9 999 999 999", "180 000 kr", "1.200.000",
  "180000,50", "-500 000", "vet ej", "", "180 000", "12,5",
]) {
  SITUATIONER.push({ totalDebt: belopp, quickLiquidationValue: belopp, salaryAmount: belopp, taxAmount: belopp });
}
for (const dag of [1, 12, 25, 28, 29, 30, 31]) {
  SITUATIONER.push({ salaryDay: dag, taxDay: dag, rentDay: dag });
}
for (const anst of ["", "0", "1", "9", "250", "1 000", "ca 12 st"]) {
  SITUATIONER.push({ employees: anst, canPaySalary: false });
}
SITUATIONER.push({ canPaySalary: null, canPayTax: null, canPayRent: null, canPaySuppliers: null });
SITUATIONER.push({ canPaySalary: false, canPayTax: null, canPayRent: null, canPaySuppliers: null });
SITUATIONER.push({ companyName: '"Bolaget" <b>AB</b> & Co' });
SITUATIONER.push({ companyName: "Å".repeat(200) + " AB" });
SITUATIONER.push({ companyName: "Bolag med ' apostrof AB" });
SITUATIONER.push({ orgNumber: "556000-0000" });
SITUATIONER.push({ employees: "5", totalDebt: "45 000 000", quickLiquidationValue: "0", canPayTax: false, canPaySalary: false });
// Fyll ut till exakt hundra med tydligt numrerade grundlägen, så att
// antalet är ett beslut och inte en slump.
while (SITUATIONER.length < 100) {
  const i = SITUATIONER.length;
  SITUATIONER.push({ totalDebt: String((i + 1) * 100_000), quickLiquidationValue: String(i * 50_000) });
}
SITUATIONER.length = 100;

const AGARE = [
  { id: "5ce0a110-0000-4000-8000-00000000000a", epost: "scen-a@exempel.se", losen: "scen-losen-a-1234" },
  { id: "5ce0a110-0000-4000-8000-00000000000b", epost: "scen-b@exempel.se", losen: "scen-losen-b-1234" },
  { id: "5ce0a110-0000-4000-8000-00000000000c", epost: "scen-c@exempel.se", losen: "scen-losen-c-1234" },
];

const grund = (i: number): CaseRecord => ({
  id: `5cea0000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  orgNumber: `5560${String(10 + i).padStart(2, "0")}-${String(1000 + i).slice(0, 4)}`,
  companyName: `Scenariobolaget ${i} AB`,
  employees: "5",
  canPaySalary: true,
  salaryAmount: "180 000",
  salaryDay: 25,
  canPayTax: true,
  taxAmount: "90 000",
  taxDay: 12,
  canPayRent: true,
  rentAmount: "58 000",
  rentDay: 1,
  canPaySuppliers: true,
  totalDebt: "1 200 000",
  quickLiquidationValue: "800 000",
  recommendationType: null,
  recommendationTitle: null,
  recommendationDescription: null,
  recommendationReasons: [],
  recommendationNextSteps: [],
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z",
});

const ARENDEN = SITUATIONER.map((situation, i) => ({
  agare: AGARE[i % AGARE.length],
  arende: { ...grund(i), ...situation } as CaseRecord,
}));

/* --- Seedning ------------------------------------------------------------ */

await withAnon(async (tx) => {
  for (const a of AGARE) {
    const hash = await hashPassword(a.losen);
    await tx.query(
      `insert into auth.users (id, email, password_hash) values ($1, $2, $3)
       on conflict (id) do update set password_hash = excluded.password_hash`,
      [a.id, a.epost, hash],
    );
    await tx.query(
      `insert into public.user_profiles (user_id, display_name) values ($1, $2)
       on conflict (user_id) do nothing`,
      [a.id, a.epost],
    );
  }
  for (const { agare, arende: c } of ARENDEN) {
    await tx.query(
      `insert into public.cases
         (id, user_id, org_number, company_name, employees,
          can_pay_salary, salary_amount, salary_day,
          can_pay_tax, tax_amount, tax_day,
          can_pay_rent, rent_amount, rent_day,
          can_pay_suppliers, total_debt, quick_liquidation_value)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       on conflict (id) do nothing`,
      [
        c.id, agare.id, c.orgNumber, c.companyName, c.employees,
        c.canPaySalary, c.salaryAmount, c.salaryDay,
        c.canPayTax, c.taxAmount, c.taxDay,
        c.canPayRent, c.rentAmount, c.rentDay,
        c.canPaySuppliers, c.totalDebt, c.quickLiquidationValue,
      ],
    );
  }
});

check("hundra ärenden är seedade", ARENDEN.length === 100, ARENDEN.length);

/* --- Inloggning ---------------------------------------------------------- */

await nollstallGranser();
const poletter = new Map<string, string>();
for (const a of AGARE) {
  const svar = await anropa("POST", "/v1/auth/login", { body: { email: a.epost, password: a.losen } });
  const kropp = svar.body as { token?: string } | null;
  check(`${a.epost} kan logga in`, svar.status === 200 && typeof kropp?.token === "string", svar);
  poletter.set(a.id, kropp?.token ?? "");
}
await nollstallGranser();

/* --- Hundra ärenden, tre krav var ---------------------------------------- */

/** Fälten som ska överleva turen ut och tillbaka, orörda. */
const FALT: (keyof CaseRecord)[] = [
  "orgNumber", "companyName", "employees",
  "canPaySalary", "salaryAmount", "salaryDay",
  "canPayTax", "taxAmount", "taxDay",
  "canPayRent", "rentAmount", "rentDay",
  "canPaySuppliers", "totalDebt", "quickLiquidationValue",
];

let ronn = 0;
for (const { agare, arende: forvantat } of ARENDEN) {
  const id = `#${forvantat.id.slice(-3)} ${forvantat.companyName}`;
  const token = poletter.get(agare.id) ?? "";

  // Hastighetsgränsen är delad och räknas i databasen. Nollställ med jämna
  // mellanrum, annars är det gränsen som prövas och inte flödet.
  ronn += 1;
  if (ronn % 25 === 0) await nollstallGranser();

  /* 1. Ägaren läser sitt ärende genom Vercel-ingången. */
  const svar = await anropa("GET", `/v1/cases/${forvantat.id}`, { token });
  check(`${id}: ägaren får sitt ärende`, svar.status === 200, { status: svar.status, body: svar.body });
  if (svar.status !== 200) continue;

  /* 2. Tur och retur utan förlust. */
  let tappat: string | null = null;
  for (const falt of FALT) {
    const ute = (svar.body as Record<string, unknown>)[falt];
    const inne = forvantat[falt];
    if (JSON.stringify(ute) !== JSON.stringify(inne)) {
      tappat = `${String(falt)}: skickade ${JSON.stringify(inne)}, fick ${JSON.stringify(ute)}`;
      break;
    }
  }
  check(`${id}: fälten kommer tillbaka orörda`, tappat === null, tappat);

  /* 3. Samma analys på båda sidor om transporten. */
  const franApi = analyseCrisis(analysisInputFromCase(svar.body as CaseRecord));
  const franKallan = analyseCrisis(analysisInputFromCase(forvantat));
  check(
    `${id}: analysen är densamma före och efter transporten`,
    JSON.stringify(franApi) === JSON.stringify(franKallan),
    { api: franApi.type, kalla: franKallan.type },
  );

  /* 4. Radskyddet: de andra två ser ingenting. */
  for (const annan of AGARE) {
    if (annan.id === agare.id) continue;
    const nekat = await anropa("GET", `/v1/cases/${forvantat.id}`, { token: poletter.get(annan.id) ?? "" });
    check(
      `${id}: ${annan.epost} nekas ärendet`,
      nekat.status === 404,
      { status: nekat.status, body: nekat.body },
    );
  }

  /* 5. Utan polett: ingenting. */
  const utan = await anropa("GET", `/v1/cases/${forvantat.id}`);
  check(`${id}: utan inloggning nekas ärendet`, utan.status === 401, utan.status);
}

/* --- Listan visar bara det egna ------------------------------------------ */

await nollstallGranser();
for (const a of AGARE) {
  const lista = await anropa("GET", "/v1/cases", { token: poletter.get(a.id) ?? "" });
  check(`${a.epost}: listan svarar`, lista.status === 200, lista.status);
  const egna = new Set(ARENDEN.filter((x) => x.agare.id === a.id).map((x) => x.arende.id));
  // Kontraktet svarar { cases: [...] }, inte en naken lista.
  const rader = ((lista.body as { cases?: { id: string }[] } | null)?.cases ?? []);
  check(`${a.epost}: listan har kontraktets form`, Array.isArray(rader), lista.body);
  const fick = new Set(rader.map((c) => c.id));
  const frammande = [...fick].filter((x) => !egna.has(x));
  check(`${a.epost}: listan bär inga främmande ärenden`, frammande.length === 0, frammande.slice(0, 5));
  const saknade = [...egna].filter((x) => !fick.has(x));
  check(`${a.epost}: listan bär alla egna ärenden`, saknade.length === 0, saknade.slice(0, 5));
}

/*
 * SJÄLVPROVET: prövade vi något?
 *
 * Blev alla ärenden 404 för alla hade radskyddskontrollerna varit gröna
 * på ingenting alls.
 */
{
  const forsta = ARENDEN[0];
  const eget = await anropa("GET", `/v1/cases/${forsta.arende.id}`, { token: poletter.get(forsta.agare.id) ?? "" });
  check("kontrollen kunde faktiskt läsa ett ärende", eget.status === 200, eget.status);
}

await closePool();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
