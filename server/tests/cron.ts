/**
 * CRON-ENDPOINTERNA, KÖRDA MOT EN RIKTIG DATABAS.
 *
 * tests/cron.ts kör vakten (`slappIn`, `kor`, `rapportera`) utan databas -
 * snabbt, i varje `npm test`. Det den INTE kan pröva är att endpointerna
 * faktiskt gör något: att `runUtkorg` tömmer en kö, att nattjobbets sju steg
 * går igenom, att anslutningen öppnas och stängs.
 *
 * Det är just den luckan som gjorde att ett tidigt utkast av
 * api/cron/utkorg.ts anslöt och kopplade ner igen UTAN att tömma något -
 * en endpoint som svarade 200 på att ha gjort ingenting, och som varje
 * källkodsvakt hade godkänt.
 *
 * Körs sist i server/tests/run.sh: nattjobbet gallrar och fakturerar, alltså
 * ändrar det data som de andra proven vilar på.
 */

import nattjobb from "../../api/cron/nattjobb";
import utkorg from "../../api/cron/utkorg";
import aviseringar from "../../api/cron/aviseringar";
import simulering from "../../api/cron/simulering";
import type { Fraga, Svar } from "../../api/cron/_vakt";
import { koppla_ner } from "../../db/worker/email-worker";

let passed = 0;
let failed = 0;
const check = (namn: string, ok: boolean, extra?: unknown) => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${namn}`, extra === undefined ? "" : extra);
  }
};

interface Fangat {
  status: number;
  body: unknown;
}

const kor = async (
  handler: (req: Fraga, res: Svar) => Promise<void>,
  auth?: string,
): Promise<Fangat> => {
  const fangat: Fangat = { status: 0, body: null };
  const res: Svar = {
    setHeader: () => {},
    status(kod: number) {
      fangat.status = kod;
      return this;
    },
    json: (kropp: unknown) => {
      fangat.body = kropp;
    },
  };
  await handler({ headers: auth === undefined ? {} : { authorization: auth } }, res);
  return fangat;
};

const HEMLIG = process.env.CRON_SECRET ?? "";
check("sviten kör med en hemlighet satt", HEMLIG.length >= 16);

const jobben = [
  { namn: "nattjobb", handler: nattjobb, steg: 7 },
  { namn: "utkorg", handler: utkorg, steg: 1 },
  { namn: "aviseringar", handler: aviseringar, steg: 1 },
  { namn: "simulering", handler: simulering, steg: 1 },
] as const;

for (const jobb of jobben) {
  // Stängd för den som inte har hemligheten. Det här är det som står
  // mellan internet och "kör faktureringen".
  const utan = await kor(jobb.handler);
  check(`${jobb.namn}: utan hemlighet nekas`, utan.status === 401, utan);

  const fel = await kor(jobb.handler, "Bearer fel-hemlighet-men-lang-nog");
  check(`${jobb.namn}: fel hemlighet nekas`, fel.status === 401, fel);

  // Och öppen för schemaläggaren - med databasen på riktigt bakom sig.
  const ratt = await kor(jobb.handler, `Bearer ${HEMLIG}`);
  check(`${jobb.namn}: rätt hemlighet kör`, ratt.status === 200, ratt);

  const kropp = ratt.body as { jobb?: string; kort?: { steg: string; ok: boolean }[] } | null;
  check(`${jobb.namn}: svaret namnger jobbet`, kropp?.jobb === jobb.namn, kropp);
  check(`${jobb.namn}: alla ${jobb.steg} steg rapporteras`, kropp?.kort?.length === jobb.steg, kropp?.kort?.length);
  check(
    `${jobb.namn}: inget steg kastade`,
    (kropp?.kort ?? []).every((s) => s.ok),
    (kropp?.kort ?? []).filter((s) => !s.ok),
  );
}

/*
 * NATTJOBBET FÅR INTE BERO PÅ MEJLKONFIGURATIONEN.
 *
 * Gallringen, raderingen, kreditkontrollerna och de två faktureringarna
 * skickar inte ett enda mejl. Ändå stoppades de en gång av att
 * resolveMailConfig kastade VID IMPORT på en ofullständig SMTP-konfig -
 * en saknad SMTP_HOST tog hela natten med sig.
 *
 * Här körs nattjobbet med mejlkonfigurationen borttagen. Går det igenom
 * är beroendet brutet på riktigt, inte bara i en kommentar.
 */
{
  const sparade = {
    MAIL_TRANSPORT: process.env.MAIL_TRANSPORT,
    SMTP_HOST: process.env.SMTP_HOST,
    MAIL_FROM: process.env.MAIL_FROM,
  };
  process.env.MAIL_TRANSPORT = "smtp";
  delete process.env.SMTP_HOST;

  const svar = await kor(nattjobb, `Bearer ${HEMLIG}`);
  const kropp = svar.body as { kort?: { steg: string; ok: boolean }[] } | null;
  const brutna = (kropp?.kort ?? []).filter((s) => !s.ok).map((s) => s.steg);
  check("nattjobbet kör utan mejlkonfiguration", svar.status === 200, svar);
  check("och inget steg faller på den", brutna.length === 0, brutna);

  for (const [k, v] of Object.entries(sparade)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

/*
 * OCH ATT KONTROLLEN OVAN KAN SE ETT FEL.
 *
 * Ett jobb vars steg kastar ska ge 500, inte 200 med en felrad i kroppen -
 * Vercel märker en cron-körning som misslyckad på STATUSKODEN. Utan
 * databas kastar utkorgen, och det är precis det läget som prövas här.
 */
{
  const riktig = process.env.DATABASE_URL;
  /*
   * ANSLUTNINGEN MÅSTE STÄNGAS FÖRST.
   *
   * anslut() är idempotent - `if (klient) return`. Utan det här steget
   * ligger anslutningen från körningen ovan kvar, DATABASE_URL läses
   * aldrig om, och provet svarade 200 på en databas som inte finns. Det
   * var inte ett fel i produkten utan i provet, och ett prov som inte kan
   * misslyckas prövar ingenting.
   */
  await koppla_ner();
  process.env.DATABASE_URL = "postgres://ingen@127.0.0.1:1/finns-inte";

  const svar = await kor(utkorg, `Bearer ${HEMLIG}`);
  check("ett jobb utan databas svarar 500, inte 200", svar.status === 500, svar);
  const kropp = svar.body as { kort?: { steg: string; ok: boolean; fel: string | null }[] } | null;
  check(
    "och säger att det var anslutningen",
    kropp?.kort?.[0]?.steg === "anslutning" && kropp.kort[0].ok === false,
    kropp,
  );

  process.env.DATABASE_URL = riktig;
  await koppla_ner();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
