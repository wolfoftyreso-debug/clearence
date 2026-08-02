/**
 * AI-lägesrapporten: ledningssammanfattningen som möter användaren vid
 * inloggning.
 *
 * Rapporten ska kännas som om en erfaren rekonstruktör just satt sig in i
 * bolaget och ger VD en lägesbild: hur allvarligt är det, vad betyder det,
 * vad måste göras nu, vilka risker finns, vilka möjligheter finns kvar,
 * och vilken väg rekommenderas - alltid motiverad.
 *
 * Motorn är deterministisk: samma ärendedata ger samma rapport, tecken
 * för tecken. Det är ett medvetet val, inte en begränsning - i den här
 * produkten får ingen analys bero på en extern tjänsts dagsform, inget
 * bolags siffror lämnar servern, och varje formulering går att testa.
 * Rapporten ANALYSERAR (prioriterar, förklarar samband, lyfter det som
 * riskerar att missas) i stället för att återge listor.
 *
 * Ton: professionell, lugn, saklig, handlingsorienterad. Aldrig panik,
 * aldrig bagatellisering, aldrig uppgiven - möjlighetsavsnittet är
 * obligatoriskt. Skriven för en företagare: facktermer förklaras i
 * löptext första gången de används.
 */

import type { CaseRecord, CaseTask, CaseMemberRecord, PaymentRecord, KbrStatus } from "@/data/types";
import type { TimelineEvent } from "@/lib/crisisAnalysis";
import { countdownTo } from "@/lib/actionPlan";
import { parseAmount } from "@/lib/caseAnalysis";

export type Severity = "stable" | "elevated" | "serious" | "critical";

export type ActionHorizon = "omedelbart" | "idag" | "denna vecka" | "kan vänta";

export interface SummaryAction {
  horizon: ActionHorizon;
  label: string;
  why: string;
  href: string | null;
}

export interface SummarySection {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface ExecutiveSummary {
  severity: Severity;
  severityLabel: string;
  headline: string;
  sections: SummarySection[];
  actions: SummaryAction[];
  strategy: string;
  generatedAt: string;
}

export interface SummaryInput {
  caseRecord: CaseRecord;
  timeline: TimelineEvent[];
  tasks: CaseTask[];
  members: CaseMemberRecord[];
  kbr: { status: KbrStatus; createdAt: string } | null;
  documentCount: number;
  payments: PaymentRecord[];
  now: Date;
}

const sek = (value: number): string =>
  `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

const HORIZON_ORDER: ActionHorizon[] = ["omedelbart", "idag", "denna vecka", "kan vänta"];

export const buildExecutiveSummary = (input: SummaryInput): ExecutiveSummary => {
  const { caseRecord: c, timeline, tasks, members, kbr, documentCount, now } = input;

  const name = c.companyName ?? c.orgNumber;
  const cannotPay = [c.canPaySalary, c.canPayTax, c.canPayRent, c.canPaySuppliers].filter(
    (v) => v === false,
  ).length;
  const totalDebt = parseAmount(c.totalDebt);
  const liquidation = parseAmount(c.quickLiquidationValue);
  const coverage = totalDebt > 0 ? liquidation / totalDebt : null;

  const sorted = [...timeline].sort((a, b) => a.iso.localeCompare(b.iso));
  const withCountdown = sorted.map((e) => ({ event: e, countdown: countdownTo(e.iso, now) }));
  const passed = withCountdown.filter((x) => x.countdown.tone === "passed");
  const today = withCountdown.filter((x) => x.countdown.tone === "today");
  const soon = withCountdown.filter((x) => x.countdown.tone === "soon");

  /* --- allvarsgrad ---------------------------------------------------------- */
  let severity: Severity = "stable";
  if (cannotPay >= 1 || soon.length > 0) severity = "elevated";
  if (cannotPay >= 2 || c.recommendationType === "reconstruction" || today.length > 0)
    severity = "serious";
  if (
    passed.length > 0 ||
    c.canPayTax === false ||
    c.recommendationType === "bankruptcy" ||
    cannotPay >= 3
  )
    severity = "critical";

  const severityLabel = {
    stable: "Under kontroll",
    elevated: "Förhöjd uppmärksamhet",
    serious: "Allvarligt läge",
    critical: "Kritiskt läge",
  }[severity];

  const headline = {
    stable: `Läget för ${name} är hanterbart, och de närmaste stegen handlar om att behålla kontrollen.`,
    elevated: `${name} har ansträngd likviditet. Läget är hanterbart, men några beslut bör inte skjutas upp.`,
    serious: `Situationen för ${name} är allvarlig. Med rätt ordning på besluten finns handlingsutrymme kvar.`,
    critical: `Läget för ${name} kräver omedelbara beslut. Prioriteringen nedan är gjord för att skydda både bolaget och dess företrädare.`,
  }[severity];

  /* --- 1. lägesbild ---------------------------------------------------------- */
  const situation: string[] = [];
  {
    const parts: string[] = [];
    if (cannotPay === 0) {
      parts.push(
        `Enligt de uppgifter som är registrerade kan bolaget i nuläget hantera sina löpande betalningar.`,
      );
    } else {
      const what = [
        c.canPaySalary === false ? "lönerna" : null,
        c.canPayTax === false ? "skatten" : null,
        c.canPayRent === false ? "hyran" : null,
        c.canPaySuppliers === false ? "leverantörerna" : null,
      ].filter(Boolean);
      parts.push(
        `Bolaget bedömer själv att ${what.join(", ").replace(/, ([^,]*)$/, " och $1")} inte kan betalas fullt ut i närtid. Det är den uppgiften som driver allvaret i lägesbilden.`,
      );
    }
    if (totalDebt > 0) {
      parts.push(
        coverage !== null && coverage < 1
          ? `Skulderna uppgår till omkring ${sek(totalDebt)}, medan tillgångarna vid en snabb försäljning bedöms täcka ungefär ${Math.round((coverage ?? 0) * 100)} procent av dem.`
          : `Skulderna uppgår till omkring ${sek(totalDebt)}.`,
      );
    }
    situation.push(parts.join(" "));
    if (c.recommendationTitle) {
      situation.push(
        `Utvärderingens samlade bedömning: ${c.recommendationTitle.toLowerCase().replace(/\.$/, "")}. ${c.recommendationReasons[0] ?? ""}`.trim(),
      );
    }
  }

  /* --- 2. vad betyder detta -------------------------------------------------- */
  const meaning: string[] = [];
  if (c.canPayTax === false) {
    meaning.push(
      "Juridiskt: att skatten inte kan betalas är den enskilt viktigaste signalen. Bolagets företrädare kan i vissa situationer bli personligt betalningsansvariga för obetald skatt, och skyddet ligger i att vidta en verksam åtgärd senast på skattens förfallodag – till exempel att ansöka om företagsrekonstruktion eller konkurs. Datumet styr, inte avsikten.",
    );
  }
  if (severity === "serious" || severity === "critical") {
    meaning.push(
      "Styrelseansvar: finns det skäl att anta att mer än halva aktiekapitalet är förbrukat ska styrelsen genast upprätta en kontrollbalansräkning – en särskild balansräkning som visar om den gränsen passerats. Att dokumentera när frågan prövades är i sig ett skydd för ledamöterna.",
    );
  }
  if (c.canPaySalary === false) {
    meaning.push(
      "Operativt: att lönerna är i fara påverkar personalen före allt annat. Vid en rekonstruktion eller konkurs kan den statliga lönegarantin ta över lönebetalningarna under en period – de anställda är mer skyddade än många tror, och det är ett skäl att välja en ordnad process i tid.",
    );
  }
  meaning.push(
    withCountdown.length > 0
      ? `Likviditetsmässigt: ${withCountdown.length} datum bevakas i ärendet. Närmast ligger ${withCountdown[0].event.label.toLowerCase()} (${withCountdown[0].countdown.label}). Varje passerat datum utan beslut minskar handlingsutrymmet.`
      : "Likviditetsmässigt: inga förfallodagar är registrerade ännu – lägg in de närmaste betalningarna så att rapporten kan bevaka dem.",
  );

  /* --- 3. prioriterad handlingsplan ------------------------------------------ */
  const actions: SummaryAction[] = [];
  for (const x of passed) {
    actions.push({
      horizon: "omedelbart",
      label: `Hantera passerat datum: ${x.event.label}`,
      why: "Datumet har passerat utan registrerad åtgärd. Det behöver hanteras eller dokumenteras nu.",
      href: "/dashboard",
    });
  }
  if (c.canPayTax === false) {
    actions.push({
      horizon: passed.length > 0 ? "omedelbart" : "idag",
      label: "Bestäm åtgärd före skattens förfallodag",
      why: "Skyddet mot personligt betalningsansvar ligger i en verksam åtgärd senast på förfallodagen.",
      href: "/kunskap/foretradaransvar",
    });
  }
  const seriousRec = c.recommendationType === "reconstruction" || c.recommendationType === "bankruptcy";
  if (!kbr && (seriousRec || severity === "critical")) {
    actions.push({
      horizon: "idag",
      label: "Gör kontrollbalansbedömningen",
      why: "Skyldigheten inträder redan vid skäl att anta kapitalbrist, och ett daterat beslut skyddar styrelsen.",
      href: "/kbr",
    });
  }
  for (const x of today) {
    actions.push({
      horizon: "idag",
      label: x.event.label,
      why: "Förfaller idag.",
      href: "/dashboard",
    });
  }
  for (const x of soon) {
    actions.push({
      horizon: "denna vecka",
      label: x.event.label,
      why: `Förfaller ${countdownTo(x.event.iso, now).label}.`,
      href: "/dashboard",
    });
  }
  const activeMembers = members.filter((m) => !m.revokedAt);
  if (activeMembers.length <= 1) {
    actions.push({
      horizon: severity === "critical" ? "denna vecka" : "kan vänta",
      label: "Bjud in revisor eller rådgivare till ärendet",
      why: "Rätt kompetens tidigt minskar risken för kostsamma felbeslut, och alla ser samma underlag.",
      href: "/dashboard/deltagare",
    });
  }
  const openTasks = tasks.filter((t) => !t.doneAt);
  for (const t of openTasks.slice(0, 3)) {
    actions.push({
      horizon: "denna vecka",
      label: t.label,
      why: "Öppen punkt i handlingsplanen.",
      href: "/dashboard",
    });
  }
  if (documentCount === 0) {
    actions.push({
      horizon: "kan vänta",
      label: "Samla underlagen i ärendet",
      why: "Kontoutdrag och rapporter på ett ställe gör varje rådgivarmöte kortare.",
      href: "/dashboard/dokument",
    });
  }
  actions.sort((a, b) => HORIZON_ORDER.indexOf(a.horizon) - HORIZON_ORDER.indexOf(b.horizon));

  /* --- 4. riskanalys ---------------------------------------------------------- */
  const risks: string[] = [];
  if (c.canPayTax === false) {
    risks.push(
      "Det finns situationer där företrädare kan bli personligt ansvariga för bolagets obetalda skatter. Här behöver styrelsen vara särskilt uppmärksam på sina skyldigheter – beslutet om åtgärd bör inte skjutas upp.",
    );
  }
  if (severity !== "stable") {
    risks.push(
      "Om inget görs krymper alternativen i takt med kassan: en rekonstruktion kräver likviditet för driften under processen, och ett underhandsackord kräver förhandlingsutrymme. Att vänta är också ett beslut – men ett odokumenterat sådant.",
    );
  }
  if (passed.length > 0) {
    risks.push(
      `${passed.length} bevakade datum har redan passerat. Passerade frister är olösta problem, inte historia – de ligger kvar överst i handlingsplanen tills de hanterats.`,
    );
  }
  if (risks.length === 0) {
    risks.push(
      "Inga akuta risker syns i det registrerade underlaget. Risken i ett stabilt läge är i stället invaggning – fortsätt bevaka fristerna och håll dokumentationen levande.",
    );
  }

  /* --- 5. möjligheter (aldrig tomt, aldrig uppgivet) -------------------------- */
  const opportunities: string[] = [];
  {
    const works = [
      c.canPaySalary !== false ? "lönerna" : null,
      c.canPayTax !== false ? "skatten" : null,
      c.canPayRent !== false ? "hyran" : null,
      c.canPaySuppliers !== false ? "leverantörsbetalningarna" : null,
    ].filter(Boolean);
    if (works.length > 0) {
      opportunities.push(
        `Det som fortfarande bär: ${works.join(", ").replace(/, ([^,]*)$/, " och $1")} kan enligt uppgifterna hanteras. Det är kärnan att bygga vidare på.`,
      );
    }
    if (coverage !== null && coverage >= 0.5) {
      opportunities.push(
        `Tillgångssidan täcker en betydande del av skulderna (${Math.round(coverage * 100)} procent vid snabb försäljning) – det ger förhandlingsutrymme gentemot borgenärerna.`,
      );
    }
    if (activeMembers.length > 1) {
      opportunities.push(
        "Ärendet delas redan med fler ögon – styrelse, revisor eller rådgivare ser samma underlag, vilket höjer kvaliteten på besluten.",
      );
    }
    opportunities.push(
      "Att situationen hanteras strukturerat är i sig en styrka: frister bevakas, beslut dokumenteras i händelseloggen och underlaget är samlat. Det är precis det en rekonstruktör, bank eller domstol vill se.",
    );
  }

  /* --- 6. rekommenderad strategi (alltid motiverad) --------------------------- */
  let strategy: string;
  switch (c.recommendationType) {
    case "stabilize":
      strategy =
        "Utifrån den information som finns idag bedöms den mest ändamålsenliga vägen vara att stabilisera i egen regi: säkra de kritiska betalningarna i tidsordning, förhandla med de största borgenärerna och följa likviditeten vecka för vecka. Motivet är att betalningsförmågan i huvudsak håller – då är en formell process ett dyrare verktyg än vad situationen kräver.";
      break;
    case "reconstruction":
      strategy =
        "Utifrån den information som finns idag bedöms den mest ändamålsenliga vägen vara att fokusera på likviditeten, säkra de kritiska betalningarna och utreda förutsättningarna för en företagsrekonstruktion innan andra alternativ övervägs. Motivet är att verksamheten bedöms ha livskraft medan balansräkningen inte bär – exakt den situation rekonstruktionsverktyget är byggt för, med betalningspaus och lönegaranti som andrum.";
      break;
    case "bankruptcy":
      strategy =
        "Utifrån den information som finns idag bedöms den mest ändamålsenliga vägen vara en ordnad avveckling: att själv ta initiativet till processen i stället för att inväntas av borgenärerna. Motivet är att en egen ansökan i rätt tid skyddar företrädarna, ger personalen lönegarantin snabbare och ger verksamhetens bärkraftiga delar störst chans att leva vidare i annan form.";
      break;
    default:
      strategy =
        "Ingen samlad rekommendation kan lämnas ännu – gör utvärderingen så att bedömningen vilar på bolagets faktiska uppgifter i stället för antaganden. Det tar några minuter och är grunden för allt annat i rapporten.";
  }

  const sections: SummarySection[] = [
    { id: "lage", title: "Övergripande lägesbild", paragraphs: situation },
    { id: "innebord", title: "Vad betyder detta?", paragraphs: meaning },
    { id: "risker", title: "Riskanalys", paragraphs: risks },
    { id: "mojligheter", title: "Möjligheter", paragraphs: opportunities },
  ];

  return {
    severity,
    severityLabel,
    headline,
    sections,
    actions,
    strategy,
    generatedAt: now.toISOString(),
  };
};
