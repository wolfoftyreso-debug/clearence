/**
 * "VISA, BERÄTTA INTE" - vakten.
 *
 * Designprincipen för hela plattformen:
 *
 *   Användaren ska aldrig behöva leta efter en funktion som CLEARANCE
 *   känner till. Nämner CLEARANCE en funktion ska den samtidigt kunna
 *   visa exakt var den finns, förklara varför den används, visa vad som
 *   sparats där och hur användaren själv administrerar den sedan.
 *
 * En princip som bara står i en designguide är en åsikt. Här görs den
 * mätbar, och den mäts på det enda som räknas: att adressen finns, att
 * ankaret finns i gränssnittet, och att alla fyra svaren är skrivna.
 *
 * Den dyraste kontrollen ligger sist: varje ankare katalogen pekar på
 * granskas mot källträdet. Byter någon namn på ett element eller tar
 * bort en vy fälls testet - i stället för att guiden tyst börjar peka
 * på ingenting.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  GUIDE_CATALOGUE,
  entryBriefing,
  guideEntry,
} from "../src/lib/guide/catalogue";
import {
  GUIDED_FLOWS,
  TOURS,
  flowSteps,
  guidedFlow,
  savedSteps,
  showMeSteps,
  tour,
  tourGroups,
  type GuideAction,
} from "../src/lib/guide/actions";
import { noMatchMessage, resolveShowMe } from "../src/lib/guide/showMe";
import { MICRO_LESSONS, dueLesson } from "../src/lib/guide/microLessons";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra: unknown = "") => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name} ${typeof extra === "string" ? extra : JSON.stringify(extra)}`);
  }
};

/* --- källträdet ------------------------------------------------------------ */

const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
};
walk(join(process.cwd(), "src"));
check("källfilerna hittades", files.length > 50, files.length);

/**
 * Ankarna som faktiskt finns i gränssnittet.
 *
 * Två former: skrivna rakt ut (`data-guide="handlingsplan"`) och
 * menyvalens, som kommer ur NavItem-listan i skalet
 * (`guide: "nav-oversikt"`). Båda räknas - det är samma attribut i
 * DOM:en, bara olika väg dit.
 *
 * Katalogen och åtgärdsspråket räknas INTE som källa till ankare: de
 * pekar på ankare, de skapar dem inte. Annars hade filen kunnat
 * intyga sig själv.
 */
const anchorsInUi = new Set<string>();
for (const file of files) {
  if (file.includes(join("lib", "guide"))) continue;
  const source = readFileSync(file, "utf8");
  for (const m of source.matchAll(/data-guide="([a-zA-Z0-9-]+)"/g)) anchorsInUi.add(m[1]);
  if (file.endsWith("DashboardShell.tsx")) {
    for (const m of source.matchAll(/guide:\s*"([a-zA-Z0-9-]+)"/g)) anchorsInUi.add(m[1]);
  }
}
check("gränssnittet har utpekade ankare", anchorsInUi.size >= 12, [...anchorsInUi].sort());

/**
 * Menyvalen per roll.
 *
 * Rollerna ser olika menyer, och ett menyval som bara finns för den ena
 * får inte ringas in för den andra. Listorna läses ur skalet, så att de
 * inte kan glida isär från det som faktiskt renderas.
 */
const shellSource = readFileSync(
  join(process.cwd(), "src/components/dashboard/DashboardShell.tsx"),
  "utf8",
);
const navAnchorsIn = (constName: string): Set<string> => {
  const block = shellSource.split(`const ${constName}: NavItem[] = [`)[1]?.split("];")[0] ?? "";
  return new Set([...block.matchAll(/guide:\s*"([a-zA-Z0-9-]+)"/g)].map((m) => m[1]));
};
const companyNavAnchors = navAnchorsIn("COMPANY_NAV");
const advisorNavAnchors = navAnchorsIn("ADVISOR_NAV");
const opsNavAnchors = navAnchorsIn("OPS_NAV");
check("företagsmenyn hittades", companyNavAnchors.size >= 6, [...companyNavAnchors]);
check("juristmenyn hittades", advisorNavAnchors.size >= 5, [...advisorNavAnchors]);
check("driftmenyn hittades", opsNavAnchors.size >= 9, [...opsNavAnchors]);
const menuFor = (audience: string): Set<string> =>
  audience === "advisor" ? advisorNavAnchors : audience === "ops" ? opsNavAnchors : companyNavAnchors;

const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
const ROUTES = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);

/* --- 1. Principen, punkt för punkt ---------------------------------------- */

check("katalogen täcker hela tjänsten", GUIDE_CATALOGUE.length >= 34, GUIDE_CATALOGUE.length);
check(
  "inga dubbletter bland id:n",
  new Set(GUIDE_CATALOGUE.map((e) => e.id)).size === GUIDE_CATALOGUE.length,
);

for (const entry of GUIDE_CATALOGUE) {
  // VAR: adressen ska finnas, och ankaret ska gå att peka på.
  check(`${entry.id}: adressen finns i appen`, ROUTES.includes(entry.route), entry.route);
  check(`${entry.id}: ankaret finns i gränssnittet`, anchorsInUi.has(entry.anchor), entry.anchor);
  for (const [role, anchor] of Object.entries(entry.navAnchor)) {
    check(
      `${entry.id}: menyankaret ${anchor} finns i gränssnittet`,
      anchorsInUi.has(anchor),
      anchor,
    );
    // Rollen måste vara en av postens egna: ett menyval för en roll som
    // inte ens har funktionen är en rad som aldrig kan bli sann.
    check(
      `${entry.id}: menyvalet hör till en roll posten gäller för`,
      entry.roles.includes(role as (typeof entry.roles)[number]),
      `${role} finns inte i ${JSON.stringify(entry.roles)}`,
    );
  }
  // VARFÖR, VAD SOM SPARAS, HUR MAN ÄNDRAR: alla tre skrivna, ingen tom.
  check(`${entry.id}: säger varför funktionen finns`, entry.why.length > 40, entry.why);
  check(`${entry.id}: säger vad som sparas där`, entry.saves.length > 20, entry.saves);
  check(`${entry.id}: säger hur användaren ändrar det`, entry.manage.length > 20, entry.manage);
  check(`${entry.id}: går att hitta med ord`, entry.synonyms.length >= 3, entry.synonyms);
  // En post utan roller går inte att nå för någon. En post med en roll
  // som inte finns är ett stavfel som annars märks först i drift.
  check(`${entry.id}: har minst en roll`, entry.roles.length >= 1, entry.roles);
  check(
    `${entry.id}: rollerna är riktiga`,
    entry.roles.every((r) => r === "company" || r === "advisor" || r === "ops"),
    entry.roles,
  );
  // Menyankaret måste finnas i den meny rollen faktiskt ser. Ett
  // företagsmenyval inringat för en jurist pekar på ingenting.
  for (const [role, anchor] of Object.entries(entry.navAnchor)) {
    check(
      `${entry.id}: menyankaret finns i ${role}-menyn`,
      menuFor(role).has(anchor),
      `${anchor} saknas i ${role}-menyn`,
    );
  }
  // Fyra svar i briefingen, i principens ordning.
  const briefing = entryBriefing(entry);
  check(`${entry.id}: briefingen har fyra delar`, briefing.length === 4, briefing.length);
  check(
    `${entry.id}: briefingen börjar med vad det är`,
    briefing[0].text === entry.label,
  );
}

// Ett skäl får inte bara upprepa etiketten. "Dokument: här ligger
// dokumenten" svarar inte på varför funktionen finns.
for (const entry of GUIDE_CATALOGUE) {
  const why = entry.why.toLowerCase();
  const label = entry.label.toLowerCase();
  check(
    `${entry.id}: skälet upprepar inte bara namnet`,
    !(why.startsWith(label) && why.length < label.length + 40),
    entry.why,
  );
}

// Två poster som gör anspråk på samma ord kan inte skiljas åt vid en
// sökning: träffen blir tvetydig och guiden tvingas fråga i stället för
// att visa. Överlapp är alltså inte en smaksak utan ett fel.
{
  const owner = new Map<string, string>();
  const clashes: string[] = [];
  for (const entry of GUIDE_CATALOGUE) {
    for (const synonym of entry.synonyms.map((s) => s.toLowerCase())) {
      const previous = owner.get(synonym);
      if (previous) clashes.push(`"${synonym}": ${previous} och ${entry.id}`);
      else owner.set(synonym, entry.id);
    }
  }
  check("inga två poster gör anspråk på samma ord", clashes.length === 0, clashes);
}

check("okänt id ger null i stället för att kasta", guideEntry("finns-inte") === null);

/* --- 2. Vägen dit: sekvensen som faktiskt körs ---------------------------- */

const kinds = (actions: GuideAction[]): string[] => actions.map((a) => a.kind);

{
  const entry = guideEntry("dokument")!;
  const steps = showMeSteps(entry);
  check("vägen öppnar menyn först", kinds(steps)[0] === "oppna-meny", kinds(steps));
  check(
    "menyvalet ringas in innan vyn byts",
    kinds(steps).indexOf("markera") < kinds(steps).indexOf("oppna-vy"),
    kinds(steps),
  );
  check("vyn öppnas", steps.some((s) => s.kind === "oppna-vy" && s.route === entry.route));
  check(
    "det rullas fram innan målet ringas in",
    kinds(steps).indexOf("rulla-till") < kinds(steps).lastIndexOf("markera"),
  );
  // Sekvensen ska SLUTA med förklaringen. Att lämna någon mitt i en
  // flytt är det enda sättet en guide kan göra saken värre.
  check("sekvensen slutar med förklaringen", kinds(steps).at(-1) === "forklara", kinds(steps));
  const last = steps.at(-1)!;
  check(
    "förklaringen bär alla tre svaren",
    last.kind === "forklara" &&
      last.text.includes(entry.why) &&
      last.text.includes(entry.saves) &&
      last.text.includes(entry.manage),
  );
  check("förklaringen pekar på målet", last.kind === "forklara" && last.anchor === entry.anchor);
}

{
  // Är användaren redan på sidan ska guiden inte navigera i onödan - ett
  // vybyte till den vy man redan är i läser som att något gick fel.
  const steps = showMeSteps(guideEntry("dokument")!, { alreadyThere: true });
  check("ingen navigering när man redan är framme", !kinds(steps).includes("oppna-vy"), kinds(steps));
  check("men målet ringas ändå in", kinds(steps).includes("markera"));
}

{
  // En funktion utan eget menyval ska inte få ett menyval inringat.
  const kbr = guideEntry("kontrollbalans")!;
  check("kontrollbalansräkningen har inget menyval", Object.keys(kbr.navAnchor).length === 0);
  const steps = showMeSteps(kbr);
  check("då ringas inget menyval in", !kinds(steps).includes("oppna-meny"), kinds(steps));
  check("men vyn öppnas ändå", kinds(steps).includes("oppna-vy"));
}

{
  // Samma funktion, två roller, olika vägar dit. Företagaren har ett
  // menyval för handlingarna; juristen når dem genom det aktiva ärendet
  // och ska därför inte få ett menyval inringat som inte finns hos hen.
  const entry = guideEntry("dokument")!;
  check("företagaren har ett menyval till handlingarna", !!entry.navAnchor.company);
  check("juristen har inget", entry.navAnchor.advisor === undefined);
  check(
    "företagaren får menyvägen visad",
    kinds(showMeSteps(entry, { role: "company" })).includes("oppna-meny"),
  );
  check(
    "juristen leds rakt till vyn utan ett menyval som inte finns",
    !kinds(showMeSteps(entry, { role: "advisor" })).includes("oppna-meny"),
    kinds(showMeSteps(entry, { role: "advisor" })),
  );
  check(
    "men juristen kommer ändå fram",
    showMeSteps(entry, { role: "advisor" }).some(
      (s) => s.kind === "oppna-vy" && s.route === entry.route,
    ),
  );
}

/* --- 3. Kvitteringen: var det sparades ------------------------------------- */

{
  const steps = savedSteps(guideEntry("dokument")!, "Analysen från introduktionen.");
  check("kvitteringen visar var det sparades", kinds(steps).includes("visa-sparat"));
  check("kvitteringen är kortare än en rundtur", steps.length <= 4, steps.length);
  const last = steps.at(-1)!;
  check(
    "kvitteringen säger också hur man ändrar det",
    last.kind === "forklara" && last.text.includes(guideEntry("dokument")!.manage),
  );
}

/* --- 4. Guidat arbetsläge: guiden väntar, användaren klickar --------------- */

check("det finns guidade flöden", GUIDED_FLOWS.length >= 2);
for (const flow of GUIDED_FLOWS) {
  check(`${flow.id}: säger vad det leder till`, flow.outcome.length > 40, flow.outcome);
  check(`${flow.id}: har minst en roll`, flow.roles.length >= 1, flow.roles);
  check(`${flow.id}: har minst tre steg`, flow.steps.length >= 3, flow.steps.length);
  for (const step of flow.steps) {
    check(`${flow.id}: ankaret ${step.anchor} finns`, anchorsInUi.has(step.anchor), step.anchor);
    if (step.route) {
      check(`${flow.id}: adressen ${step.route} finns`, ROUTES.includes(step.route), step.route);
    }
    check(`${flow.id}: steget säger varför`, step.text.length > 40, step.text);
  }
  const steps = flowSteps(flow);
  // Kärnan i guidat läge: guiden KLICKAR INTE ÅT NÅGON. Den som utför
  // momentet själv minns det; den som ser en animation gör det inte.
  check(
    `${flow.id}: guiden väntar på användarens klick`,
    steps.filter((s) => s.kind === "vanta-pa-klick").length === flow.steps.length,
    kinds(steps),
  );
  check(
    `${flow.id}: guiden klickar inte åt användaren`,
    !steps.some((s) => s.kind === "vaxla-flik"),
  );
}
check("okänt flöde ger null", guidedFlow("finns-inte") === null);

/* --- 4b. Rundturerna: bläddras med Nästa, ALDRIG med ett klick i vyn ------- */

/*
 * En rundtur är en presentation, inte ett prov. Skillnaden mot ett guidat
 * arbetsläge är hela poängen med att de ligger i skilda listor, och den
 * mäts här: en rundtur får inte innehålla ett enda vanta-pa-klick. Gjorde
 * den det vore vi tillbaka i "klicka på rutan för att komma vidare", som
 * var precis det som kändes bakvänt.
 */
check("det finns minst en rundtur", TOURS.length >= 1, TOURS.length);
check("okänd rundtur ger null", tour("finns-inte") === null);
check(
  "en rundtur och ett guidat flöde delar aldrig id",
  TOURS.every((t) => !GUIDED_FLOWS.some((f) => f.id === t.id)),
);
for (const t of TOURS) {
  check(`${t.id}: säger vad den leder till`, t.outcome.length > 40, t.outcome);
  check(`${t.id}: har minst en roll`, t.roles.length >= 1, t.roles);
  check(`${t.id}: har minst tre stopp`, t.steps.length >= 3, t.steps.length);
  check(`${t.id}: går att slå upp`, tour(t.id)?.id === t.id);
  for (const step of t.steps) {
    check(`${t.id}: ankaret ${step.anchor} finns`, anchorsInUi.has(step.anchor), step.anchor);
    if (step.route) {
      check(`${t.id}: adressen ${step.route} finns`, ROUTES.includes(step.route), step.route);
    }
    check(`${t.id}: stoppet säger något`, step.text.length > 40, step.text);
  }
  const groups = tourGroups(t);
  check(`${t.id}: en grupp per stopp`, groups.length === t.steps.length, groups.length);
  const alla = groups.flat();
  // KÄRNAN: en rundtur bläddras, den kräver inga klick ute i vyn.
  check(
    `${t.id}: inget stopp kräver ett klick i vyn`,
    !alla.some((a) => a.kind === "vanta-pa-klick"),
    kinds(alla),
  );
  check(
    `${t.id}: varje stopp är ett tur-steg`,
    alla.filter((a) => a.kind === "tur-steg").length === t.steps.length,
    kinds(alla),
  );
  check(
    `${t.id}: varje grupp slutar på sitt tur-steg`,
    groups.every((g) => g.at(-1)?.kind === "tur-steg"),
  );
  check(`${t.id}: guiden klickar inte åt användaren`, !alla.some((a) => a.kind === "vaxla-flik"));
}

// Motorn måste faktiskt köra rundturen med Nästa, annars är listan ovan en
// oanvänd datastruktur. Vaktas som text i källan - MEN UTAN KOMMENTARER.
// Kontrollerna nedan letade förut i hela filen, och den här filens egna
// kommentarer nämner både "Nästa" och "onNext": prosa hade räckt för att
// göra dem gröna. Samma fälla har fällt fyra andra vakter i det här
// projektet, och den är alltid tyst.
{
  const utanKommentarer = (kod: string): string =>
    kod.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const provider = utanKommentarer(
    readFileSync(join(process.cwd(), "src/components/guide/GuideProvider.tsx"), "utf8"),
  );
  check("motorn har ett rundtursläge", provider.includes("awaitingNext"));
  check("motorn kan starta en rundtur", /\brunTour\s*[,(:=]/.test(provider), "runTour används inte, den bara nämns");
  const spotlight = utanKommentarer(
    readFileSync(join(process.cwd(), "src/components/guide/Spotlight.tsx"), "utf8"),
  );
  check(
    "panelen har en Nästa-väg",
    /onNext\s*[?)}&|]/.test(spotlight) && />\s*Nästa|Nästa\s*</.test(spotlight),
    "onNext anropas inte, eller så står Nästa bara i prosa",
  );
  const bar = readFileSync(join(process.cwd(), "src/components/guide/ShowMeBar.tsx"), "utf8");
  check("rundturen går att starta från ytan", bar.includes("runTour"));
}

/* --- 5. "Visa mig": fritext in, rätt plats ut ------------------------------ */

const shows: [string, string][] = [
  ["Visa mig var rapporterna finns", "dokument"],
  ["var sparas rapporterna", "dokument"],
  ["dokumenten", "dokument"],
  ["hur mycket pengar har vi kvar", "likviditet"],
  ["runway", "likviditet"],
  ["jag vill se händelseloggen", "handelselogg"],
  ["hur bjuder jag in min revisor", "deltagare"],
  ["kontrollbalansräkning", "kontrollbalans"],
  ["kbr", "kontrollbalans"],
  ["visa mig kontrollområdet", "kontrollomrade"],
  ["stäng av sms", "aviseringar"],
  ["vad kan jag göra", "alternativ"],
  ["hitta hjälp", "radgivare"],
  ["prata med clearance", "samtalet"],
  ["gör om utvärderingen", "nulagesanalys"],
  ["lägesrapport", "systemanalysen"],
  ["planera kassan", "likviditetsplan"],
  ["underlag till banken", "kreditunderlag"],
  ["styrelseprotokoll", "dokumentmallar"],
  ["skatteverket", "skattekonto"],
  ["dela länk", "arendelank"],
  ["stänga ärendet", "avsluta-arendet"],
  ["mina kvitton", "fakturor"],
  ["koppla eget system", "api-nycklar"],
  ["vad säger lagen", "kunskap"],
];
for (const [query, expected] of shows) {
  const result = resolveShowMe(query);
  check(
    `"${query}" leder till ${expected}`,
    result.entry?.id === expected,
    result.entry?.id ?? "ingen träff",
  );
}

// Rollen filtrerar. En företagare som frågar efter juristens ärendelista
// ska INTE ledas dit och landa på en tom sida - att peka någon mot en yta
// hen inte har är precis det principen finns för att förhindra.
{
  check(
    "juristen hittar sin klientlista",
    resolveShowMe("mina klienter", "advisor").entry?.id === "klienter",
    resolveShowMe("mina klienter", "advisor").entry?.id,
  );
  check(
    "företagaren leds inte till juristens klientlista",
    resolveShowMe("mina klienter", "company").entry?.id !== "klienter",
    resolveShowMe("mina klienter", "company").entry?.id ?? "ingen träff",
  );
  check(
    "företagaren hittar sin likviditetsplanerare",
    resolveShowMe("lägga in betalningar", "company").entry?.id === "likviditetsplan",
    resolveShowMe("lägga in betalningar", "company").entry?.id,
  );
  check(
    "juristen erbjuds aldrig en företagsyta som alternativ",
    resolveShowMe("wxyz", "advisor").alternatives.every((e) => e.roles.includes("advisor")),
    resolveShowMe("wxyz", "advisor").alternatives.map((e) => e.id),
  );
  check(
    "och företagaren aldrig en juristyta",
    resolveShowMe("wxyz", "company").alternatives.every((e) => e.roles.includes("company")),
    resolveShowMe("wxyz", "company").alternatives.map((e) => e.id),
  );
}

// DRIFTVYERNA: bara för den som administrerar tjänsten, och aldrig
// synliga för en kund. En företagare som får se "Analysövervakning" i
// en lista har fått veta att vi övervakar hens analys - och att röja
// tjänstens insida för en kund är värre än att inte kunna visa den.
{
  const opsEntries = GUIDE_CATALOGUE.filter((e) => e.roles.includes("ops"));
  check("driftvyerna finns i katalogen", opsEntries.length >= 9, opsEntries.length);
  check(
    "ingen driftvy är märkt som en kundyta",
    opsEntries.every((e) => e.roles.length === 1),
    opsEntries.filter((e) => e.roles.length > 1).map((e) => e.id),
  );
  check(
    "alla driftvyer ligger under /admin",
    opsEntries.every((e) => e.route.startsWith("/admin")),
    opsEntries.map((e) => e.route),
  );
  // Och det omvända: inget under /admin får vara märkt som en kundyta.
  check(
    "ingen kundyta pekar in i driften",
    GUIDE_CATALOGUE.filter((e) => e.route.startsWith("/admin")).every(
      (e) => e.roles.length === 1 && e.roles[0] === "ops",
    ),
  );

  check(
    "driften hittar sin analysövervakning",
    resolveShowMe("analysövervakning", ["company", "ops"]).entry?.id === "analysovervakning",
    resolveShowMe("analysövervakning", ["company", "ops"]).entry?.id,
  );
  check(
    "driften hittar systemloggarna",
    resolveShowMe("tekniska fel", ["company", "ops"]).entry?.id === "loggar",
    resolveShowMe("tekniska fel", ["company", "ops"]).entry?.id,
  );
  check(
    "företagaren leds aldrig in i driften",
    resolveShowMe("analysövervakning", "company").entry === null,
    resolveShowMe("analysövervakning", "company").entry?.id,
  );
  check(
    "och erbjuds den aldrig ens som alternativ",
    resolveShowMe("wxyz", "company").alternatives.every((e) => !e.roles.includes("ops")),
  );
  check(
    "juristen heller inte",
    resolveShowMe("systemloggar", "advisor").entry === null,
    resolveShowMe("systemloggar", "advisor").entry?.id,
  );
  // Adminen behåller sin egen roll: driftbehörigheten tar inte bort
  // ytorna hen använder som företagare i sitt eget konto.
  check(
    "adminen når fortfarande produktens ytor",
    resolveShowMe("var sparas rapporterna", ["company", "ops"]).entry?.id === "dokument",
    resolveShowMe("var sparas rapporterna", ["company", "ops"]).entry?.id,
  );
  // Menyvalet: driftvyerna ska ringa in driftmenyn, även när anropet
  // kommer med adminens produktroll.
  const drift = guideEntry("loggar")!;
  check(
    "driftvyn ringar in driftmenyn även när rollen är company",
    showMeSteps(drift, { role: "company" }).some(
      (s) => s.kind === "markera" && s.anchor === "nav-loggar",
    ),
    kinds(showMeSteps(drift, { role: "company" })),
  );
}

// Ingen träff är ett hederligt svar. En gissning är det inte: en guide
// som ibland pekar fel lär ut fel väg med auktoritet.
{
  const miss = resolveShowMe("wxyz qqq");
  check("obegripligt ger ingen träff", miss.entry === null);
  check("men aldrig en återvändsgränd", miss.alternatives.length > 0);
  check("och den säger vad den förstod", noMatchMessage(miss).includes("wxyz"), noMatchMessage(miss));
  const empty = resolveShowMe("   ");
  check("tomt uppmanar till att skriva något", noMatchMessage(empty).includes("Skriv vad du letar efter"));
  check("och erbjuder ändå alternativ", empty.alternatives.length > 0);
}

/* --- 6. Mikroutbildningen: en i taget, aldrig när det brinner -------------- */

check("det finns mikrolektioner", MICRO_LESSONS.length >= 4);
check(
  "inga dubbletter bland lektionernas id",
  new Set(MICRO_LESSONS.map((l) => l.id)).size === MICRO_LESSONS.length,
);
check(
  "ingen ordning krockar",
  new Set(MICRO_LESSONS.map((l) => l.order)).size === MICRO_LESSONS.length,
  MICRO_LESSONS.map((l) => l.order),
);
for (const lesson of MICRO_LESSONS) {
  check(`lektionen ${lesson.id} pekar på ett ankare som finns`, anchorsInUi.has(lesson.anchor), lesson.anchor);
  // En mening, inte ett stycke. Poängen med mikroutbildning är att den
  // är mikro.
  check(`lektionen ${lesson.id} är kort`, lesson.text.length <= 160, lesson.text.length);
  check(`lektionen ${lesson.id} har en uppföljning`, !!lesson.followUp);
  check(
    `lektionen ${lesson.id} påminner senare, inte direkt`,
    lesson.followUpAfterMinutes >= 3,
    lesson.followUpAfterMinutes,
  );
}

const NOW = new Date("2026-08-05T10:00:00");
{
  const empty = { shown: {}, reminded: [] };
  const first = dueLesson({
    visibleAnchors: ["kontrollomrade", "handlingsplan"],
    acute: false,
    now: NOW,
    memory: empty,
  });
  check("första lektionen är den med lägst ordning", first?.lesson.id === "kontrollomrade", first?.lesson.id);
  check("och det är den korta förklaringen", first?.phase === "forsta");

  // Regel 2: aldrig när det brinner.
  check(
    "ingen undervisning när läget är akut",
    dueLesson({ visibleAnchors: ["kontrollomrade"], acute: true, now: NOW, memory: empty }) === null,
  );

  // Regel 1: en lektion visas en gång.
  const seen = { shown: { kontrollomrade: NOW.toISOString() }, reminded: [] };
  const second = dueLesson({
    visibleAnchors: ["kontrollomrade", "handlingsplan"],
    acute: false,
    now: NOW,
    memory: seen,
  });
  check("en visad lektion upprepas inte", second?.lesson.id === "handlingsplan", second?.lesson.id);

  // Lektionen hör till sin yta: ingen förklaring av händelseloggen på
  // likviditetssidan.
  check(
    "lektionen visas bara där ytan finns",
    dueLesson({ visibleAnchors: ["likviditetsvyn"], acute: false, now: NOW, memory: empty })?.lesson.id ===
      "likviditet",
  );

  // Påminnelsen: efter sin tid, och bara då.
  const later = new Date(NOW.getTime() + 4 * 60_000);
  const reminder = dueLesson({
    visibleAnchors: ["kontrollomrade"],
    acute: false,
    now: later,
    memory: seen,
  });
  check("påminnelsen kommer när tiden gått", reminder?.phase === "paminnelse", reminder?.phase);
  check("och den knyter an till något nytt", reminder?.text.includes("varningar") ?? false, reminder?.text);
  const tooEarly = dueLesson({
    visibleAnchors: ["kontrollomrade"],
    acute: false,
    now: new Date(NOW.getTime() + 60_000),
    memory: seen,
  });
  check("men inte före sin tid", tooEarly === null, tooEarly?.phase);

  // En avklarad påminnelse kommer inte igen.
  check(
    "en avklarad påminnelse upprepas inte",
    dueLesson({
      visibleAnchors: ["kontrollomrade"],
      acute: false,
      now: later,
      memory: { shown: seen.shown, reminded: ["kontrollomrade"] },
    }) === null,
  );

  // Allt visat och påmint: tyst.
  const done = {
    shown: Object.fromEntries(MICRO_LESSONS.map((l) => [l.id, NOW.toISOString()])),
    reminded: MICRO_LESSONS.map((l) => l.id),
  };
  check(
    "när allt är visat är det tyst",
    dueLesson({ visibleAnchors: MICRO_LESSONS.map((l) => l.anchor), acute: false, now: later, memory: done }) ===
      null,
  );
}

/* --- 7. Principen gäller hela plattformen --------------------------------- */

// Guiden ska vara monterad, annars är allt ovan en oanvänd modul.
check(
  "guiden är monterad i appen",
  appSource.includes("<GuideProvider>"),
);
check(
  "mikroutbildningen är monterad i skalet",
  readFileSync(join(process.cwd(), "src/components/dashboard/DashboardShell.tsx"), "utf8").includes(
    "<MicroLessons",
  ),
);
check(
  '"Visa mig" finns i samtalet',
  readFileSync(join(process.cwd(), "src/pages/DashboardSamtal.tsx"), "utf8").includes("<ShowMeBar"),
);
// Ringen får inte låsa skärmen. En guide man inte kan gå ifrån är en
// dialogruta med extra steg.
{
  const spotlight = readFileSync(join(process.cwd(), "src/components/guide/Spotlight.tsx"), "utf8");
  check("overlayen släpper igenom klick", spotlight.includes("pointer-events-none"));
  check("men rutans egna knappar tar emot", spotlight.includes("pointer-events-auto"));
}
{
  const provider = readFileSync(join(process.cwd(), "src/components/guide/GuideProvider.tsx"), "utf8");
  check("Escape avbryter", provider.includes('e.key === "Escape"'));
  check("guiden avbryts om användaren byter vy själv", provider.includes("ownRoute"));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
