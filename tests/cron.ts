/**
 * CRON-VAKTEN, KÖRD.
 *
 * api/cron/_vakt.ts är det enda som står mellan internet och "kör
 * faktureringen". Endpointerna under api/cron/ är HTTP-adresser som vilka
 * som helst: Vercels schemaläggare anropar dem, men så kan också vem som
 * helst som gissar sökvägen.
 *
 * tests/deploy.ts LÄSER filen och kräver att orden finns där. Det är en
 * svagare kontroll än den ser ut - en vakt kan innehålla varenda rätt ord
 * och ändå släppa igenom alla. Den här sviten KÖR den i stället.
 */

import { kor, rapportera, slappIn, type Fraga, type Svar } from "../api/cron/_vakt";

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

const svarare = (): Svar & { fangat: Fangat } => {
  const fangat: Fangat = { status: 0, body: null };
  return {
    fangat,
    setHeader: () => {},
    status(kod: number) {
      fangat.status = kod;
      return this;
    },
    json: (kropp: unknown) => {
      fangat.body = kropp;
    },
  };
};

const fraga = (auth?: string): Fraga => ({
  headers: auth === undefined ? {} : { authorization: auth },
});

const HEMLIG = "en-tillrackligt-lang-hemlighet";

/* --- 1. Utan hemlighet är dörren STÄNGD, inte öppen --------------------- */

/*
 * DET FARLIGA ALTERNATIVET ÄR ATT SLÄPPA IGENOM.
 *
 * "Ingen hemlighet är konfigurerad, alltså finns inget att jämföra med,
 * alltså kör" är den naturliga vägen att skriva det här fel - och den gör
 * en glömd miljövariabel till en öppen knapp för att köra faktureringen,
 * stänga konton och gallra data.
 */
delete process.env.CRON_SECRET;
{
  const res = svarare();
  const slapptes = slappIn(fraga(`Bearer ${HEMLIG}`), res);
  check("utan CRON_SECRET släpps ingen in", slapptes === false);
  check("och svaret är 503, inte 200", res.fangat.status === 503, res.fangat.status);
}

/* --- 2. En för kort hemlighet duger inte -------------------------------- */

process.env.CRON_SECRET = "kort";
{
  const res = svarare();
  check("en kort hemlighet räknas inte som hemlighet", slappIn(fraga("Bearer kort"), res) === false);
  check("och ger 503", res.fangat.status === 503, res.fangat.status);
}

/* --- 3. Med hemlighet: rätt in, fel ut ---------------------------------- */

process.env.CRON_SECRET = HEMLIG;
{
  const res = svarare();
  check("rätt hemlighet släpps in", slappIn(fraga(`Bearer ${HEMLIG}`), res) === true);
  check("och inget svar skickas då", res.fangat.status === 0);
}
for (const [namn, rubrik] of [
  ["fel hemlighet", "Bearer fel-hemlighet-som-ar-lang"],
  ["rätt hemlighet utan Bearer", HEMLIG],
  ["tom rubrik", ""],
  ["bara Bearer", "Bearer "],
  ["hemligheten med extra tecken", `Bearer ${HEMLIG}x`],
  ["ett prefix av hemligheten", `Bearer ${HEMLIG.slice(0, 10)}`],
] as const) {
  const res = svarare();
  check(`${namn} nekas`, slappIn(fraga(rubrik), res) === false, rubrik);
  check(`${namn} ger 401`, res.fangat.status === 401, res.fangat.status);
}
{
  const res = svarare();
  check("helt utan Authorization nekas", slappIn(fraga(), res) === false);
  check("och ger 401", res.fangat.status === 401, res.fangat.status);
}

/*
 * SKIFTLÄGE OCH LIKNANDE FÅR INTE PASSERA.
 *
 * En jämförelse som normaliserar innan den jämför gör hemlighetsrymden
 * mindre än den ser ut.
 */
{
  const res = svarare();
  check("versaler i hemligheten nekas", slappIn(fraga(`Bearer ${HEMLIG.toUpperCase()}`), res) === false);
}

/* --- 4. Ett steg som kastar stoppar inte de andra ----------------------- */

/*
 * Nattjobbet gör flera saker som inte beror på varandra. Kastar gallringen
 * ska faktureringen ändå köras - annars blir en enda trasig del ett stopp
 * för hela natten, och felet upptäcks vid nästa månadsskifte.
 */
{
  const kord: string[] = [];
  const utfall = await kor([
    { namn: "ett", gor: async () => { kord.push("ett"); } },
    { namn: "tva", gor: async () => { kord.push("tva"); throw new Error("gick sönder"); } },
    { namn: "tre", gor: async () => { kord.push("tre"); } },
  ]);
  check("alla steg körs trots att ett kastar", kord.join(",") === "ett,tva,tre", kord);
  check("utfallet bär ett resultat per steg", utfall.length === 3);
  check("det som gick bra är markerat som ok", utfall[0].fel === null && utfall[2].fel === null);
  check("det som kastade bär sitt fel", utfall[1].fel instanceof Error);
}

/* --- 5. Ett fel ger 500, inte 200 med en felrad i kroppen --------------- */

/*
 * Vercel märker en cron-körning som misslyckad på STATUSKODEN. Svarar vi
 * 200 på ett jobb som kastade blir en trasig fakturering en rad i en logg
 * ingen läser förrän någon undrar var pengarna tog vägen.
 */
{
  const res = svarare();
  rapportera(res, "nattjobb", [
    { namn: "ett", fel: null },
    { namn: "tva", fel: new Error("gick sönder") },
  ]);
  check("ett misslyckat steg ger 500", res.fangat.status === 500, res.fangat.status);
  const kropp = res.fangat.body as { jobb: string; kort: { steg: string; ok: boolean; fel: string | null }[] };
  check("kroppen namnger jobbet", kropp.jobb === "nattjobb");
  check("och säger vilket steg som föll", kropp.kort[1].ok === false && kropp.kort[1].fel === "gick sönder");
  check("och vilket som gick bra", kropp.kort[0].ok === true && kropp.kort[0].fel === null);
}
{
  const res = svarare();
  rapportera(res, "utkorg", [{ namn: "utkorg", fel: null }]);
  check("en ren körning ger 200", res.fangat.status === 200, res.fangat.status);
}
{
  const res = svarare();
  rapportera(res, "tomt", []);
  check("noll steg är inte ett fel", res.fangat.status === 200, res.fangat.status);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
