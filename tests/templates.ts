/**
 * Tester för dokumentmallarna.
 *
 * Laghänvisningarna testas ordagrant: ett styrelseprotokoll som pekar på
 * fel paragraf är ett fel med rättslig innebörd. Luckorna testas också -
 * ett saknat fält ska synas som [LUCKA], aldrig fyllas med en gissning.
 */

import {
  boardMinutesKbr,
  boardMinutesReconstruction,
  noticeControlMeeting,
} from "../src/lib/documentTemplates";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const input = {
  companyName: "Demobolaget AB",
  orgNumber: "556012-3456",
  place: "Stockholm",
  date: "2026-08-03",
  attendees: [
    { name: "Anna Andersson", role: "Företrädare" },
    { name: "Bo Berg", role: "Styrelseledamot" },
  ],
};

/* --- KBR-protokollet ------------------------------------------------------ */
const kbr = boardMinutesKbr(input);
check("KBR: rätt laghänvisning", kbr.body.includes("25 kap. 13 § aktiebolagslagen (2005:551)"));
check("KBR: revisorsgranskningen nämns med 14 §", kbr.body.includes("25 kap. 14 §"));
check("KBR: kontrollstämman förbereds med 15 §", kbr.body.includes("25 kap. 15 §"));
check("KBR: 'skäl att anta' - inte 'konstaterat'", kbr.body.includes("skäl att anta"));
check("KBR: bolaget och orgnr står med", kbr.body.includes("Demobolaget AB") && kbr.body.includes("556012-3456"));
check("KBR: närvarande listas", kbr.body.includes("Anna Andersson, företrädare"));
check("KBR: underskriftsrad per person", (kbr.body.match(/________________________________/g) ?? []).length === 2);
check("KBR: utkastmarkeringen står först", kbr.body.startsWith("UTKAST FRÅN CLEARANCE"));
check("KBR: datum i klartext", kbr.body.includes("3 augusti 2026"));
check("KBR: filnamn bär datum", kbr.fileName === "styrelseprotokoll-kbr-2026-08-03.txt");

/* --- Kallelsen ------------------------------------------------------------ */
const notice = noticeControlMeeting(input);
check("Kallelse: 15 § för framläggandet", notice.body.includes("25 kap. 15 § aktiebolagslagen"));
check("Kallelse: likvidationsfrågan på dagordningen", notice.body.includes("likvidation"));
check("Kallelse: bolagsordningen ska kontrolleras", notice.body.includes("bolagsordningen"));
check("Kallelse: 7 kap. för kallelsesättet", notice.body.includes("7 kap. aktiebolagslagen"));

/* --- Rekonstruktionsprotokollet ------------------------------------------- */
const rek = boardMinutesReconstruction(input);
check("Rekonstruktion: 2022 års lag", rek.body.includes("lagen (2022:964) om"));
check("Rekonstruktion: livskraftskravet formuleras", rek.body.includes("livskraft"));
check("Rekonstruktion: rekonstruktör föreslås", rek.body.includes("föreslå rekonstruktör"));

/* --- Luckorna ------------------------------------------------------------- */
const bare = boardMinutesKbr({ companyName: "", orgNumber: "", place: "", date: "fel", attendees: [] });
check("tomt bolagsnamn blir synlig lucka", bare.body.includes("[BOLAGSNAMN]"));
check("tom ort blir synlig lucka", bare.body.includes("[ORT]"));
check("ogiltigt datum blir synlig lucka", bare.body.includes("[DATUM]"));
check("inga närvarande blir synlig lucka", bare.body.includes("[NÄRVARANDE]"));
check("determinism: samma indata, samma dokument", boardMinutesKbr(input).body === kbr.body);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
