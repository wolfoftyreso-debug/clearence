/**
 * HASTIGHETSBEGRÄNSNINGEN: den del som inte kräver en databas.
 *
 * SJÄLVA RÄKNINGEN PRÖVAS INTE HÄR LÄNGRE, och det är en följd av att den
 * flyttat. Den bodde i minnet i den här processen, och gick därför att
 * prova med en påhittad klocka. Nu räknas anropet av app.rate_limit_hit()
 * i databasen - delat mellan alla uppgifter, vilket var hela poängen - och
 * ett test av en attrapp hade prövat attrappen.
 *
 *     Taket, fönstret, retry-after och att två klienter räknas var för sig:
 *     api/tests/integration.ts, avsnitt 9, mot en riktig Postgres.
 *
 * Kvar här är det som är den här processens eget: konstanterna, och
 * uppslaget av vem anropet kommer ifrån. Det senare är trivialt att läsa
 * och lätt att få fel - en tom rubrik som blir en tom nyckel gör hela
 * världen till en enda klient.
 */

import { ALLMAN, klientNyckel, LOGIN } from "../api/server/rateLimit";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};

/* --- Inloggningen är hårdare satt ------------------------------------------ */

/*
 * Inloggningen är den enda ytan där ett gissat värde ger åtkomst. Blir de
 * två gränserna någon gång lika hårda är det för att någon höjt
 * inloggningens tak utan att tänka på vad ytan är.
 */
check("inloggningen har lägre tak än övrigt", LOGIN.tak < ALLMAN.tak);
check("inloggningens fönster är längre", LOGIN.fonsterSek > ALLMAN.fonsterSek);
// Ett tak på noll spärrar alla; ett tak på tusen spärrar ingen.
check("inloggningens tak är satt i en rimlig storleksordning", LOGIN.tak >= 3 && LOGIN.tak <= 30, String(LOGIN.tak));
check("och fönstret mäts i minuter, inte sekunder", LOGIN.fonsterSek >= 60, String(LOGIN.fonsterSek));

/* --- Vem anropet kommer ifrån ---------------------------------------------- */

/*
 * Bakom lastbalanseraren är socketadressen alltid balanserarens. Utan
 * x-forwarded-for delar hela världen en räknare, och första klienten som
 * slår i taket stänger ute alla andra.
 *
 * DE TRE KONTROLLERNA HÄR SA TIDIGARE FEL SAK. De krävde att adressen togs
 * ur rubrikens FÖRSTA post - alltså precis den del angriparen själv skriver.
 * nginx sätter "$proxy_add_x_forwarded_for", som lägger den observerade
 * adressen SIST; den som roterade det första värdet fick därför en färsk
 * räknare per anrop och kunde forcera inloggningen fritt. Kontrollerna
 * beskrev buggen, så de var gröna medan spärren inte fanns.
 *
 * Rätt post är den som det sista BETRODDA mellanledet självt såg: räknat
 * från höger, TRUSTED_PROXY_HOPS steg in. Angreppsfallen prövas i
 * tests/sakerhet.ts; här prövas formen på uppslaget.
 */
process.env.TRUSTED_PROXY_HOPS = "1";
check(
  "klienten läses ur x-forwarded-for, från det betrodda mellanledet",
  klientNyckel({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, "192.0.2.1") === "10.0.0.1",
);
check(
  "utan rubriken används socketadressen",
  klientNyckel({}, "198.51.100.4") === "198.51.100.4",
);
check(
  "en tom rubrik faller tillbaka i stället för att ge tom nyckel",
  klientNyckel({ "x-forwarded-for": "" }, "198.51.100.4") === "198.51.100.4",
);
// Rubriken kan komma som en lista när flera mellanled satt sin egen. Hela
// kedjan läses ihop, och det sista steget är det som räknas.
check(
  "en upprepad rubrik läses som EN kedja, och sista steget gäller",
  klientNyckel({ "x-forwarded-for": ["198.51.100.9, 10.0.0.1", "10.0.0.2"] }, "192.0.2.1") ===
    "10.0.0.2",
);
// Mellanslag runt adressen är vanligt och får inte bli en egen nyckel.
check(
  "blanktecken trimmas bort",
  klientNyckel({ "x-forwarded-for": "  203.0.113.9 , 10.0.0.1  " }, "192.0.2.1") === "10.0.0.1",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
