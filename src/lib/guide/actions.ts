/**
 * ÅTGÄRDSSPRÅKET: det CLEARANCE kan göra med gränssnittet.
 *
 * En vanlig chattbot svarar med text. Den här guiden STYR ytan medan den
 * pratar: öppnar menyn, ringar in valet, byter vy, rullar fram, pekar på
 * elementet och förklarar - samtidigt. Skälet är att man lär sig av att
 * se något hända, inte av att läsa var det ligger.
 *
 * Åtgärderna är DATA, inte funktionsanrop. Det gör tre saker: sekvensen
 * går att testa utan webbläsare, den går att spela upp igen, och den går
 * att avbryta mitt i utan att halva gränssnittet står kvar i ett
 * konstigt läge.
 *
 * Varje sekvens SLUTAR med att användaren står kvar på målet med
 * förklaringen framme. Guiden lämnar aldrig någon mitt i en flytt.
 */

import { entryBriefing, type GuideAudience, type GuideEntry } from "./catalogue";

export type GuideAction =
  /** Öppna sidomenyn (bara på små skärmar - på stora står den redan öppen). */
  | { kind: "oppna-meny" }
  | { kind: "stang-meny" }
  /** Ringa in ett element med den pulserande ringen. */
  | { kind: "markera"; anchor: string }
  /** Rulla fram till ett element. Alltid före markeringen. */
  | { kind: "rulla-till"; anchor: string }
  /** Förklaringsrutan intill elementet. */
  | { kind: "forklara"; anchor: string; text: string; heading?: string }
  /** Byt vy. */
  | { kind: "oppna-vy"; route: string }
  /** Växla till en flik eller undervy. */
  | { kind: "vaxla-flik"; anchor: string }
  /** Sätt markören i ett fält, så att användaren kan börja skriva direkt. */
  | { kind: "fokusera-falt"; anchor: string }
  /** Visa var något sparades. Ringen plus en kvittering. */
  | { kind: "visa-sparat"; anchor: string; what: string }
  /**
   * Guidat arbetsläge: guiden stannar och väntar på att användaren
   * klickar själv. Det är skillnaden mellan en demonstration och en
   * instruktör - handen är användarens.
   *
   * `label` är vad saken HETER på skärmen. Utan det stod det bara
   * "klicka på det markerade", och den som inte hittade markeringen fick
   * ingen andra ledtråd. Nu står namnet i klartext.
   *
   * `step` och `of` räknar de klick användaren faktiskt ska göra - inte
   * guidens interna moment. "Steg 3 av 12" i en rundtur med fyra stopp
   * är en felaktig uppgift om hur lång tid det tar, och den som tror sig
   * ha nio steg kvar hoppar av.
   */
  | { kind: "vanta-pa-klick"; anchor: string; text: string; label: string; step: number; of: number }
  /**
   * Ett steg i en RUNDTUR. Skillnaden mot vanta-pa-klick är hela poängen
   * med den här ändringen: en rundtur VISAR var saker ligger, den ber inte
   * användaren utföra något. Därför väntar guiden här på en Nästa-knapp i
   * panelen, inte på ett klick ute i vyn. Att tvinga ett klick på själva
   * ytan för att bara komma vidare i en presentation är att förväxla en
   * demonstration med ett prov - och det var precis det som kändes bakvänt.
   */
  | { kind: "tur-steg"; anchor: string; text: string; label: string; step: number; of: number }
  /** En kort paus, så att ögat hinner följa med. */
  | { kind: "andas"; ms: number };

/** Hur länge ett steg står kvar innan nästa tar vid, när inget annat sägs. */
export const STEP_MS = 1400;

/**
 * Vägen till en funktion: "visa mig var rapporterna finns".
 *
 * Sekvensen är den användaren beskrev: öppna menyn, markera valet, gå
 * dit, rulla fram, markera målet, förklara. Menysteget hoppas över för
 * funktioner utan eget menyval - att ringa in ett menyval som inte leder
 * dit vore att lära ut fel väg.
 */
export const showMeSteps = (
  entry: GuideEntry,
  opts?: { alreadyThere?: boolean; role?: GuideAudience },
): GuideAction[] => {
  const steps: GuideAction[] = [];
  // Menyvalet gäller den här publiken eller ingen. Saknas det går guiden
  // rakt till vyn i stället för att ringa in något som inte finns.
  //
  // Driftvyerna når bara den som ser driftmenyn, och den menyn hänger på
  // att posten är märkt "ops" - därför läses menyvalet ur postens EGNA
  // nycklar när den efterfrågade rollen saknas i den. En admin som
  // frågar med sin företagsroll ska ändå få driftmenyn visad.
  const navAnchor =
    entry.navAnchor[opts?.role ?? "company"] ??
    (entry.roles.length === 1 ? entry.navAnchor[entry.roles[0]] ?? null : null);
  if (!opts?.alreadyThere && navAnchor) {
    steps.push({ kind: "oppna-meny" });
    steps.push({ kind: "markera", anchor: navAnchor });
    steps.push({
      kind: "forklara",
      anchor: navAnchor,
      heading: "Här ligger det",
      text: `${entry.label} nås härifrån. Nästa gång hittar du hit själv.`,
    });
    steps.push({ kind: "andas", ms: 600 });
  }
  if (!opts?.alreadyThere) {
    steps.push({ kind: "oppna-vy", route: entry.route });
    steps.push({ kind: "stang-meny" });
  }
  steps.push({ kind: "rulla-till", anchor: entry.anchor });
  steps.push({ kind: "markera", anchor: entry.anchor });
  steps.push({
    kind: "forklara",
    anchor: entry.anchor,
    heading: entry.label,
    // De fyra svaren, i principens ordning, i en förklaringsruta.
    text: entryBriefing(entry)
      .slice(1)
      .map((row) => `${row.label}: ${row.text}`)
      .join("\n\n"),
  });
  return steps;
};

/**
 * Kvitteringen: "jag sparade precis det där under X".
 *
 * Kortare än en rundtur med flit. Den som mitt i ett samtal får veta att
 * något sparats ska se VAR, inte få en genomgång av hela vyn.
 */
export const savedSteps = (entry: GuideEntry, what: string): GuideAction[] => [
  { kind: "oppna-vy", route: entry.route },
  { kind: "rulla-till", anchor: entry.anchor },
  { kind: "visa-sparat", anchor: entry.anchor, what },
  {
    kind: "forklara",
    anchor: entry.anchor,
    heading: "Sparat",
    text: `${what}\n\nDet ligger under ${entry.label}. ${entry.manage}`,
  },
];

export interface FlowStep {
  /** Elementet användaren ska klicka på. */
  anchor: string;
  /** Vad saken HETER på skärmen, ord för ord. */
  label: string;
  /** Vad hen ska göra, och varför just nu. */
  text: string;
  /** Vyn steget utförs i, om det skiljer sig från föregående. */
  route?: string;
}

export interface GuidedFlow {
  id: string;
  label: string;
  /** Vad flödet leder till. Sägs innan det börjar - ingen ska gissa. */
  outcome: string;
  steps: FlowStep[];
  /** Rollerna flödet gäller för. Samma skäl som i katalogen. */
  roles: GuideAudience[];
}

/**
 * Guidat arbetsläge, som data.
 *
 * Guiden öppnar rätt sida, markerar nästa knapp och VÄNTAR. Den klickar
 * inte åt användaren: den som får se sin egen hand utföra momentet minns
 * det, den som får se en animation gör det inte.
 */
export const GUIDED_FLOWS: GuidedFlow[] = [
  {
    id: "forsta-analysen",
    label: "Gör din första analys",
    outcome: "En bedömning av läget som vilar på dina siffror, och en handlingsplan som följer av den.",
    roles: ["company"],
    steps: [
      {
        route: "/wizard",
        anchor: "wizard-start",
        label: "Nulägesanalysen",
        text: "Här lämnar du siffrorna – löner, skatt, hyra och skulder. Det är de fyra som avgör vilka alternativ som finns kvar.",
      },
      {
        route: "/dashboard",
        anchor: "kontrollomrade",
        label: "Kontrolläge",
        text: "När analysen är klar hamnar bevakningen här. Datumen räknas ner även när du inte är inloggad.",
      },
      {
        route: "/dashboard",
        anchor: "handlingsplan",
        label: "Nästa steg",
        text: "Och det som ska göras hamnar här, i den ordning fristerna kräver. Varje rad leder in i verktyget som löser den.",
      },
    ],
  },
  {
    id: "sa-arbetar-du-i-ett-klientarende",
    label: "Så arbetar du i ett klientärende",
    outcome: "Vägen från uppdragslistan till det aktiva ärendet, och var du ser vad klienten själv har gjort.",
    roles: ["advisor"],
    steps: [
      {
        route: "/arenden",
        anchor: "klientlistan",
        label: "Klienter",
        text: "Uppdragen sorteras efter vad som brådskar, inte efter när de kom in. Välj ett ärende – hela inloggade läget följer med dit.",
      },
      {
        route: "/dashboard",
        anchor: "systemanalysen",
        label: "Systemanalysen",
        text: "Systemanalysen är din genväg in i ärendet: läget, riskerna och den rekommenderade vägen, med motivering.",
      },
      {
        route: "/dashboard/handelser",
        anchor: "handelseloggen",
        label: "Händelselogg",
        text: "Och här ser du vad klienten faktiskt gjort och när. Loggen skrivs av databasen och går inte att ändra i efterhand.",
      },
    ],
  },
];

export const guidedFlow = (id: string): GuidedFlow | null =>
  GUIDED_FLOWS.find((f) => f.id === id) ?? null;

/** Ett guidat flöde som en åtgärdssekvens. */
export const flowSteps = (flow: GuidedFlow): GuideAction[] => {
  const steps: GuideAction[] = [];
  let route: string | null = null;
  flow.steps.forEach((step, i) => {
    if (step.route && step.route !== route) {
      steps.push({ kind: "oppna-vy", route: step.route });
      route = step.route;
    }
    steps.push({ kind: "rulla-till", anchor: step.anchor });
    steps.push({
      kind: "vanta-pa-klick",
      anchor: step.anchor,
      text: step.text,
      label: step.label,
      // Räknat i KLICK, inte i guidens moment. Se kommentaren vid
      // åtgärdstypen ovan.
      step: i + 1,
      of: flow.steps.length,
    });
  });
  return steps;
};

/**
 * RUNDTURERNA: presentationer, inte prov.
 *
 * En rundtur svarar på "var ligger allt?", och skiljer sig från ett guidat
 * arbetsläge på en enda men avgörande punkt: den ber dig inte GÖRA något.
 * Den pekar, förklarar, och går vidare när DU säger till - med en
 * Nästa-knapp, som en installationsguide. Att i stället kräva ett klick på
 * själva ytan bara för att bläddra framåt kändes bakvänt, och det var det:
 * en presentation ska inte hålla dig gisslan tills du prickat rätt ruta.
 *
 * Rundturerna bor i en egen lista, skild från GUIDED_FLOWS, just för att
 * de två inte får blandas ihop igen: det guidade arbetsläget SKA vänta på
 * användarens hand (man minns det man gjort själv), rundturen ska inte.
 */
export const TOURS: GuidedFlow[] = [
  {
    id: "sa-hittar-du-tillbaka",
    label: "Så hittar du tillbaka till allt",
    outcome: "En rundtur på under en minut genom de fyra ytor du kommer att använda mest. Bläddra med Nästa.",
    roles: ["company", "advisor"],
    steps: [
      { route: "/dashboard", anchor: "kontrollomrade", label: "Kontrolläge", text: "Kontrolläget: svaret på om systemet håller uppsikt åt dig. Här ligger bevakningen av frister och nyckeltal." },
      { route: "/dashboard/liquidity", anchor: "likviditetsvyn", label: "Likviditet", text: "Likviditeten: dagen kassan tar slut, och vad som ligger bakom siffran. Det är den viktigaste siffran i hela läget." },
      { route: "/dashboard/dokument", anchor: "dokumentvyn", label: "Dokument", text: "Dokumenten: allt som produceras i ärendet hamnar här av sig självt – rapporter, underlag och mallar." },
      { route: "/dashboard/handelser", anchor: "handelseloggen", label: "Händelselogg", text: "Händelseloggen: spåret som visar när ni insåg och när ni agerade. Den skrivs av systemet och går inte att ändra i efterhand." },
    ],
  },
];

export const tour = (id: string): GuidedFlow | null =>
  TOURS.find((t) => t.id === id) ?? null;

/**
 * En rundtur som grupper av åtgärder, en grupp per stopp.
 *
 * Grupperna, och inte en enda platt kö, är det som gör TILLBAKA möjligt:
 * motorn kan spela om vilken grupp som helst, i vilken ordning som helst.
 * Varje grupp navigerar (även till samma vy - react-router struntar i det)
 * så att ett hopp bakåt landar rätt oavsett var man kom ifrån, rullar fram
 * och stannar på ett tur-steg som väntar på Nästa.
 */
export const tourGroups = (t: GuidedFlow): GuideAction[][] =>
  t.steps.map((step, i) => {
    const grupp: GuideAction[] = [];
    if (step.route) grupp.push({ kind: "oppna-vy", route: step.route });
    grupp.push({ kind: "rulla-till", anchor: step.anchor });
    grupp.push({
      kind: "tur-steg",
      anchor: step.anchor,
      text: step.text,
      label: step.label,
      step: i + 1,
      of: t.steps.length,
    });
    return grupp;
  });
