/**
 * HASTIGHETSBEGRÄNSNINGEN.
 *
 * Utan den kan vem som helst pröva lösenord mot inloggningen så fort
 * nätet orkar, och ett forcerat konto är hela ärendet - ett bolag i
 * rekonstruktion har sin samlade dokumentation där.
 *
 * Fyra saker prövas, och den tredje är den som är lätt att missa:
 *
 *  1. Att taket faktiskt håller.
 *  2. Att fönstret öppnar igen när tiden gått.
 *  3. Att två klienter räknas var för sig. En delad räknare betyder att
 *     första angriparen stänger ute alla riktiga användare - en
 *     överbelastning byggd av oss själva.
 *  4. Att inloggningen har ett hårdare tak än övrigt.
 */

import {
  ALLMAN,
  klientNyckel,
  LOGIN,
  nollstallGranser,
  provaGrans,
} from "../api/server/rateLimit";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const NU = 1_800_000_000_000;

/* --- Taket håller --------------------------------------------------------- */

nollstallGranser();
let sista = { tillaten: true, retryAfter: 0 };
for (let i = 0; i < LOGIN.tak; i++) {
  sista = provaGrans("login:1.2.3.4", LOGIN, NU);
}
check("alla försök inom taket släpps igenom", sista.tillaten);
const over = provaGrans("login:1.2.3.4", LOGIN, NU);
check("försöket över taket avvisas", !over.tillaten);
// Ett avslag utan besked om när man får försöka igen får klienten att
// försöka direkt - och göra saken värre.
check("avslaget säger när man får försöka igen", over.retryAfter > 0, String(over.retryAfter));
check("och det ligger inom fönstret", over.retryAfter <= LOGIN.fonsterSek, String(over.retryAfter));

/* --- Fönstret öppnar igen -------------------------------------------------- */

const efter = provaGrans("login:1.2.3.4", LOGIN, NU + LOGIN.fonsterSek * 1000 + 1);
check("fönstret öppnar när tiden gått", efter.tillaten);

/* --- Klienter räknas var för sig ------------------------------------------- */

nollstallGranser();
for (let i = 0; i < LOGIN.tak + 5; i++) provaGrans("login:9.9.9.9", LOGIN, NU);
const annan = provaGrans("login:8.8.8.8", LOGIN, NU);
check("en spärrad klient stänger inte ute en annan", annan.tillaten);

/* --- Inloggningen är hårdare satt ------------------------------------------ */

check("inloggningen har lägre tak än övrigt", LOGIN.tak < ALLMAN.tak);
check("inloggningens fönster är längre", LOGIN.fonsterSek > ALLMAN.fonsterSek);

/* --- Vem anropet kommer ifrån ---------------------------------------------- */

/*
 * Bakom lastbalanseraren är socketadressen alltid balanserarens. Utan
 * x-forwarded-for delar hela världen en räknare, och första klienten som
 * slår i taket stänger ute alla andra.
 */
check(
  "klienten läses ur x-forwarded-for",
  klientNyckel({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, "10.0.0.1") === "203.0.113.7",
);
check(
  "utan rubriken används socketadressen",
  klientNyckel({}, "198.51.100.4") === "198.51.100.4",
);
check(
  "en tom rubrik faller tillbaka i stället för att ge tom nyckel",
  klientNyckel({ "x-forwarded-for": "" }, "198.51.100.4") === "198.51.100.4",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
