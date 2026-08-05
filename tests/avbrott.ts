/**
 * AVBROTTET: samtalet som överlever att fliken dör.
 *
 * Introduktionssamtalet är produktens längsta sammanhängande arbete -
 * femton frågor, tre till fem minuter, oftast i en telefon som kan låsa
 * sig, byta app eller återvinna fliken när som helst. Fram till den här
 * filen fanns ingen post: varje svar levde i minnet, och en omladdning
 * kastade bort dem alla.
 *
 * Det som testas är löftena, inte implementationen:
 *
 *  - att en sparad post läses tillbaka med sina svar,
 *  - att lösenordet och e-postadressen ALDRIG finns i posten - det är
 *    filens hårdaste krav, och localStorage är läsbart för allt som kör
 *    i fliken,
 *  - att siffran som visas för användaren räknar riktiga svar och inte
 *    överhoppade frågor,
 *  - att trasig, föråldrad eller stympad data ger null i stället för ett
 *    halvt samtal - en halvläst post hade blivit en ny återvändsgränd,
 *  - att posten går att radera, så att "börja om" verkligen börjar om,
 *  - och att utloggningen städar spåren i webbläsaren: arbete och
 *    uppgifter om bolaget går, läsinställningar stannar.
 */

import {
  clearResume,
  hasResume,
  readResume,
  resumeAnswerCount,
  saveResume,
  type OnboardingResume,
} from "../src/lib/advisor/onboardingResume";
import { emptyProfile } from "../src/lib/advisor/companyProfile";
import { clearWorkTraces, PREFERENCE_KEYS, WORK_KEYS } from "../src/lib/localTraces";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const KEY = "clearance-onboarding-pagaende";

const sample = (over: Partial<OnboardingResume> = {}): OnboardingResume => ({
  stage: "intervju",
  entries: [
    { who: "radgivare", text: "Hej! Jag heter CLEARANCE." },
    { who: "user", text: "Jag är orolig för ekonomin" },
  ],
  name: "Erik Andersson",
  company: "Demobolaget AB",
  orgNumber: "556012-3456",
  situationId: "orolig",
  answers: { bransch: "Bygg och anläggning", anstallda: "6–10 personer" },
  profile: { ...emptyProfile(), industry: "Bygg och anläggning" },
  signals: { concentration: "hög", trend: "ner" },
  savedAt: "2026-08-05T10:00:00.000Z",
  ...over,
});

/* --- 1. Posten skrivs och läses ------------------------------------------- */

clearResume();
check("inget att återuppta från början", readResume() === null);
check("hasResume säger samma sak", hasResume() === false);

saveResume(sample());
const back = readResume();
check("posten läses tillbaka", back !== null);
check("stadiet följer med", back?.stage === "intervju");
check("svaren följer med", back?.answers.bransch === "Bygg och anläggning", JSON.stringify(back?.answers));
check("profilen följer med", back?.profile.industry === "Bygg och anläggning");
check("signalerna följer med", back?.signals.concentration === "hög" && back?.signals.trend === "ner");
check("replikerna följer med", back?.entries.length === 2);
check("hasResume ser posten", hasResume() === true);

/* --- 2. Det som ALDRIG får ligga i posten ---------------------------------- */

// Hela lagringen som text: det som inte syns här kan inte läcka härifrån.
const stored = localStorage.getItem(KEY) ?? "";
check("lösenordet finns inte i posten", !/lösenord|password/i.test(stored));
check("e-postadressen finns inte i posten", !/@/.test(stored), stored.slice(0, 200));
// Formen är låst i typen, men en framtida utvidgning ska stoppas här.
check(
  "posten har inga fält för lösenord eller e-post",
  !("password" in sample()) && !("email" in sample()),
);

/* --- 3. Siffran användaren får se ------------------------------------------ */

// Överhoppade frågor lagras som tom sträng. "Sex svar" när tre av dem
// var överhoppningar är en överdrift om hur mycket vi vet - och siffran
// visas i rutan som möter användaren efter omladdningen.
check("överhoppade frågor räknas inte som svar", resumeAnswerCount(sample({
  answers: { a: "Ja", b: "", c: "Nej", d: "" },
})) === 2);
check("ett tomt samtal räknas till noll", resumeAnswerCount(sample({ answers: {} })) === 0);

/* --- 4. Trasig data ger null, inte ett halvt samtal ------------------------ */

const rejects = (label: string, raw: string) => {
  localStorage.setItem(KEY, raw);
  check(label, readResume() === null, localStorage.getItem(KEY)?.slice(0, 80) ?? "");
};

rejects("skräp i lagringen avvisas", "{inte json");
rejects("fel version avvisas", JSON.stringify({ version: 99, value: sample() }));
rejects("saknad post avvisas", JSON.stringify({ version: 1 }));
rejects(
  "okänt stadium avvisas",
  JSON.stringify({ version: 1, value: { ...sample(), stage: "losenord" } }),
);
rejects(
  "kontostadiet går inte att återuppta",
  JSON.stringify({ version: 1, value: { ...sample(), stage: "form" } }),
);
rejects(
  "svar som inte är text avvisas",
  JSON.stringify({ version: 1, value: { ...sample(), answers: { a: 3 } } }),
);
rejects(
  "post utan repliker avvisas",
  JSON.stringify({ version: 1, value: { ...sample(), entries: [] } }),
);
rejects(
  "post utan namn avvisas",
  JSON.stringify({ version: 1, value: { ...sample(), name: null } }),
);
rejects(
  "post utan profil avvisas",
  JSON.stringify({ version: 1, value: { ...sample(), profile: null } }),
);

// En replik med fel avsändare plockas bort, men resten av samtalet
// överlever. Att kasta hela posten för en trasig rad hade varit att
// straffa användaren för vår egen bugg.
localStorage.setItem(
  KEY,
  JSON.stringify({
    version: 1,
    value: {
      ...sample(),
      entries: [{ who: "spöke", text: "?" }, { who: "user", text: "Ja" }],
    },
  }),
);
const rensad = readResume();
check("trasig replik plockas bort", rensad?.entries.length === 1);
check("resten av samtalet överlever", rensad?.entries[0]?.text === "Ja");

/* --- 5. Börja om ----------------------------------------------------------- */

saveResume(sample());
clearResume();
check("posten går att radera", readResume() === null);
check("hasResume följer med i raderingen", hasResume() === false);

/* --- 6. Utloggningen städar spåren ----------------------------------------- */

// Ett halvfärdigt introduktionssamtal innehåller ett personnamn, ett
// organisationsnummer och svar om ett bolags ekonomiska problem. Det
// får inte ligga kvar åt nästa person som loggar in på samma dator.
saveResume(sample());
for (const key of WORK_KEYS) localStorage.setItem(key, "något");
for (const key of PREFERENCE_KEYS) localStorage.setItem(key, "min inställning");
clearWorkTraces();

check(
  "allt arbete är städat efter utloggningen",
  WORK_KEYS.every((k) => localStorage.getItem(k) === null),
  WORK_KEYS.filter((k) => localStorage.getItem(k) !== null).join(", "),
);
check("det avbrutna samtalet är städat", readResume() === null);
check(
  "läsinställningarna står kvar",
  PREFERENCE_KEYS.every((k) => localStorage.getItem(k) === "min inställning"),
  PREFERENCE_KEYS.filter((k) => localStorage.getItem(k) === null).join(", "),
);

// Listan får aldrig krympa i tysthet. Varje nyckel nedan bär uppgifter
// om ett bolag eller en person, och den som tar bort en rad ska behöva
// ta bort den här raden också.
for (const key of [
  "clearance-onboarding-pagaende",
  "clearance-onboarding",
  "clearance-wizard-draft",
  "clearance-kbr-draft",
  "clearance-liquidity-draft",
  "clearance-active-case",
  "clearance-notifications-read",
  "clearance-akt",
  "clearance-akt-samling",
  "clearance-kreditunderlag",
  "clearance-time-rate",
  "clearance-time-vat",
]) {
  check(`${key} städas vid utloggning`, (WORK_KEYS as readonly string[]).includes(key));
}

// Demoläget är en hel databas, inte ett spår. Att städa den vid
// utloggning hade raderat demoföretaget mitt under en visning.
check(
  "demotillståndet rörs inte",
  !(WORK_KEYS as readonly string[]).includes("clearance-demo-state"),
);
// Ingen nyckel får stå i båda listorna - då är avsikten oklar.
check(
  "listorna överlappar inte",
  !WORK_KEYS.some((k) => (PREFERENCE_KEYS as readonly string[]).includes(k)),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
