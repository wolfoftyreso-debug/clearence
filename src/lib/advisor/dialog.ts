/**
 * Krisrådgivarens dialogmotor.
 *
 * Samtalet är gränssnittet - men sanningen är deterministisk. Varje
 * krissituation är ett definierat flöde: rådgivaren ställer sina frågor,
 * svaren bedöms med samma regelverk som resten av produkten, och svaret
 * blir en bedömning med konkreta handlingar. Ingen språkmodell är
 * inblandad: samma svar på samma frågor ger alltid samma bedömning, och
 * analysövervakningen kan bevisa det.
 *
 * Rådgivningsgränsen gäller i varje mening: motorn säger "talar för",
 * "kan" och "ofta avgörande" - aldrig "du ska". Bedömningen är underlag
 * för beslut som stäms av med revisor eller juridisk rådgivare.
 *
 * Flödena täcker de vanligaste akuta situationerna. Fritext som inte
 * matchar något flöde får ett ärligt svar med vägen till den breda
 * nulägesanalysen - hellre "det där behöver utredas ordentligt" än en
 * gissning.
 */

import { parseAmount } from "@/lib/caseAnalysis";

export type DialogStepKind = "amount" | "yesno" | "text" | "choice";

export interface DialogStep {
  id: string;
  /** Frågan som rådgivaren ställer, i du-form. */
  prompt: string;
  kind: DialogStepKind;
  /** Placeholder/exempel i inmatningsfältet. */
  hint?: string;
  /** Svarskortets alternativ - kind "choice" väljer, skriver inte. */
  options?: string[];
}

export interface DialogAction {
  label: string;
  href: string;
  why: string;
}

/** En rad i lägesbilden: område, allvarston och en kort not. */
export interface SnapshotRow {
  tone: "critical" | "warning" | "success";
  label: string;
  note: string;
}

/** Mätaren: ett tal som blir begripligare som stapel än som mening. */
export interface DialogMeter {
  label: string;
  /** 0-100, redan avrundad. */
  percent: number;
  note: string;
}

/** Processtidslinjen: i vilken ordning det händer. */
export interface PlanRow {
  when: string;
  label: string;
}

export interface DialogAssessment {
  severity: "critical" | "serious" | "elevated";
  severityLabel: string;
  paragraphs: string[];
  actions: DialogAction[];
  /**
   * Conversation UI, inte chat UI: rådgivaren väljer det medium som bär
   * budskapet bäst. Text när något förklaras, lägesbild när områden
   * prioriteras, mätare när något mäts, tidslinje när det är en process.
   * Blocken är deterministiska delar av bedömningen - inga påhittade
   * siffror, bara användarens egna i annan form.
   */
  snapshot?: SnapshotRow[];
  meter?: DialogMeter;
  plan?: PlanRow[];
  /**
   * Källmärkningen: varje bedömning bär sin källa, synligt. Dialogens
   * svar är användarens egna uppgifter - alltså en tolkning (medel),
   * tills de stäms mot verifierade data (hög). Saknas underlag säger
   * fallbacken det i stället för att gissa (låg).
   */
  confidence: { level: "high" | "medium" | "low"; note: string };
  /**
   * Förslag till protokollförbart beslut, med premissen utskriven.
   * Premissen är omprövningsvillkoret: när verkligheten motsäger den
   * ska beslutet upp igen - det är beslutsminnets hela poäng.
   */
  decisionSuggestion: { title: string; premise: string } | null;
}

export interface DialogFlow {
  id: string;
  title: string;
  /** Kort etikett för snabbvalsknappen. */
  chip: string;
  /**
   * Bekräftelsen (konstitutionens steg 1-2): först förståelse, sedan
   * riktning. ALDRIG juridik, aldrig "fel". 1-3 meningar - sedan kommer
   * första frågan, en i taget.
   */
  ack: string;
  /** Fritextmönster som väljer flödet. */
  triggers: RegExp[];
  steps: DialogStep[];
  assess(answers: Record<string, string>): DialogAssessment;
}

const SEVERITY_LABELS: Record<DialogAssessment["severity"], string> = {
  critical: "Kritiskt läge",
  serious: "Allvarligt läge",
  elevated: "Förhöjd risk",
};

/** Samma sifferformat som rapportmotorn: vanligt mellanslag, inte NBSP. */
const kr = (n: number): string =>
  `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

const yes = (answer: string | undefined): boolean =>
  (answer ?? "").trim().toLowerCase().startsWith("ja");

const amountOf = (answer: string | undefined): number => parseAmount(answer ?? "");

/**
 * Konstitutionens tak: aldrig fler än tre rekommenderade nästa steg.
 * Flödena listar sina handlingar i prioritetsordning - de tre första är
 * de tre viktigaste, resten stryks här och ingen annanstans.
 */
const withLabel = (
  a: Omit<DialogAssessment, "severityLabel" | "confidence"> & Partial<Pick<DialogAssessment, "confidence">>,
): DialogAssessment => ({
  ...a,
  actions: a.actions.slice(0, 3),
  severityLabel: SEVERITY_LABELS[a.severity],
  confidence:
    a.confidence ?? {
      level: "medium",
      note: "Tolkning utifrån uppgifterna du lämnat i samtalet – kompletteras de ändras bilden.",
    },
});

/* --- flödena --------------------------------------------------------------- */

const taxFlow: DialogFlow = {
  id: "skatt",
  title: "Skatten kan inte betalas",
  chip: "Kan inte betala skatten",
  ack: "Jag förstår – skatten kan inte betalas. Det är en pressande situation, och den går att hantera. Vi tar det steg för steg, så att rätt saker blir gjorda i rätt ordning.",
  triggers: [/moms/i, /skatt/i, /arbetsgivaravgift/i, /skattekonto/i],
  steps: [
    { id: "saknas", prompt: "Hur mycket saknas för att kunna betala hela skatten på förfallodagen?", kind: "amount", hint: "t.ex. 150 000 kr" },
    { id: "loner", prompt: "Har ni löner som ska betalas ut inom 30 dagar?", kind: "yesno" },
    { id: "fordringar", prompt: "Hur mycket väntas komma in från kundfakturor före skattens förfallodag? Skriv 0 om inget.", kind: "amount", hint: "t.ex. 80 000 kr" },
    { id: "kbr", prompt: "Är en kontrollbalansräkning upprättad eller påbörjad?", kind: "yesno" },
  ],
  assess(answers) {
    const gap = amountOf(answers.saknas);
    const incoming = amountOf(answers.fordringar);
    const covered = gap > 0 && incoming >= gap;

    const paragraphs: string[] = [];
    paragraphs.push(
      gap > 0
        ? `Det saknas ${kr(gap)} till skatten. En skatteskuld som förfaller obetald är den allvarligaste fristen i svensk kris­juridik: från förfallodagen kan styrelse och företrädare bli personligt betalningsansvariga för skatteskulden (59 kap. skatteförfarandelagen), om inte aktiva åtgärder – anstånd, ansökan om rekonstruktion eller konkurs – vidtagits senast den dagen.`
        : `Du har inte angett något belopp, men redan risken att inte kunna betala skatten i tid är skäl att agera: företrädaransvaret (59 kap. skatteförfarandelagen) prövas mot vad som gjorts senast på förfallodagen.`,
    );
    if (covered) {
      paragraphs.push(
        `De väntade kundinbetalningarna (${kr(incoming)}) kan täcka bristen – men en väntad betalning är inte en gjord betalning. Räkna bara med det som hinner landa före förfallodagen, och sök anstånd för resten.`,
      );
    } else if (incoming > 0) {
      paragraphs.push(
        `Väntade kundinbetalningar på ${kr(incoming)} täcker inte hela bristen. Skillnaden behöver hanteras med anstånd eller finansiering – inte med hopp.`,
      );
    }
    if (yes(answers.loner)) {
      paragraphs.push(
        `Att löner förfaller samtidigt skärper läget: att betala vissa skulder men inte andra i ett obeståndsläge kan angripas i efterhand. Om pengarna inte räcker till både skatt och löner talar det för att rekonstruktion eller konkurs behöver prövas nu – vid en sådan kan den statliga lönegarantin träda in för de anställda.`,
      );
    }
    if (!yes(answers.kbr)) {
      paragraphs.push(
        `Ingen kontrollbalansräkning är påbörjad. Vid skäl att anta att halva aktiekapitalet är förbrukat är styrelsen skyldig att genast upprätta en (25 kap. 13 § aktiebolagslagen) – en obetalbar skatteskuld är ofta ett sådant skäl.`,
      );
    }
    paragraphs.push(
      `Det här är underlag för beslut – stäm av med revisor eller juridisk rådgivare innan ni väljer väg.`,
    );

    const actions: DialogAction[] = [
      {
        label: "Ansök om anstånd hos Skatteverket",
        href: "/kunskap",
        why: "Ett beviljat anstånd flyttar förfallodagen – och därmed företrädaransvarets prövningspunkt.",
      },
      { label: "Se hur länge pengarna räcker", href: "/dashboard/liquidity", why: "Likviditetsplanen visar om bristen är tillfällig eller strukturell." },
    ];
    if (!yes(answers.kbr)) {
      actions.push({ label: "Gör kontrollbalansbedömningen", href: "/kbr", why: "Skyldigheten inträder vid skäl att anta kapitalbrist – dokumentera att ni prövat frågan." });
    }
    if (yes(answers.loner)) {
      actions.push({ label: "Hitta rekonstruktör eller jurist", href: "/marketplace", why: "Räcker pengarna inte till både skatt och löner behöver insolvensalternativen prövas med rätt kompetens." });
    }

    return withLabel({
      severity: "critical",
      paragraphs,
      actions,
      snapshot: [
        { tone: "critical", label: "Skattefristen", note: "Företrädaransvaret prövas mot förfallodagen" },
        {
          tone: gap > 0 && covered ? "success" : "warning",
          label: "Likviditet",
          note:
            gap > 0
              ? covered
                ? "Väntade inbetalningar kan täcka bristen - om de hinner fram"
                : `${kr(Math.max(gap - incoming, 0))} saknas även efter väntade inbetalningar`
              : "Beloppet är inte fastställt",
        },
        yes(answers.loner)
          ? { tone: "warning", label: "Löner", note: "Förfaller inom 30 dagar - prioriteringen är juridiskt känslig" }
          : { tone: "success", label: "Löner", note: "Inga löner under press den närmaste månaden" },
      ],
      meter:
        gap > 0
          ? {
              label: "Väntade kundinbetalningar mot bristen",
              percent: Math.min(100, Math.round((incoming / gap) * 100)),
              note: `${kr(incoming)} väntas av ${kr(gap)} som saknas`,
            }
          : undefined,
      plan: [
        { when: "Idag", label: "Förbered anståndsansökan till Skatteverket" },
        { when: "Före förfallodagen", label: "Beslut om väg - anstånd, uppgörelse eller insolvensprövning" },
        { when: "Om 7 dagar", label: "Uppföljning mot likviditetsplanen" },
      ],
      decisionSuggestion: {
        title: "Hantera skattebristen före förfallodagen",
        premise: `Beslutet vilar på uppgifterna i samtalet: ${gap > 0 ? `${kr(gap)} saknas` : "beloppet är inte fastställt"}, ${incoming > 0 ? `${kr(incoming)} väntas från kunder` : "inga kundinbetalningar väntas"}${yes(answers.loner) ? ", löner förfaller inom 30 dagar" : ""}. Ändras någon av uppgifterna bör beslutet omprövas.`,
      },
    });
  },
};

const wagesFlow: DialogFlow = {
  id: "loner",
  title: "Lönerna kan inte betalas",
  chip: "Kan inte betala lönerna",
  ack: "Jag förstår – lönerna kan inte betalas. Det är en av de situationer företagare upplever som mest stressande, och det finns ordnade vägar igenom den. Mitt mål är att du får kontroll över läget och rätt beslut dokumenterade.",
  // \b framför ordet räcker: "lön" i "affärsplan" finns inte, och svenska
  // böjningar (lönerna, lönen) fångas utan slut-gräns. Observera att \b
  // inte fungerar EFTER å/ä/ö i JavaScript - därför bara ledande gräns.
  triggers: [/\bl[öo]n/i, /anställd/i, /personal/i],
  steps: [
    { id: "saknas", prompt: "Hur mycket saknas för nästa löneutbetalning?", kind: "amount", hint: "t.ex. 200 000 kr" },
    { id: "antal", prompt: "Hur många anställda berörs?", kind: "choice", options: ["1–5", "6–20", "21–50", "Fler än 50"] },
    { id: "skatt", prompt: "Finns det samtidigt skatter eller avgifter som förfaller den närmaste månaden?", kind: "yesno" },
  ],
  assess(answers) {
    const gap = amountOf(answers.saknas);
    const staff = (answers.antal ?? "").trim();
    const paragraphs: string[] = [
      `${gap > 0 ? `Det saknas ${kr(gap)} till nästa löneutbetalning${staff ? ` för ${staff} anställda` : ""}.` : "Lönerna riskerar att inte kunna betalas."} Uteblivna löner är i praktiken en obeståndssignal: de anställda kan begära bolaget i konkurs, och förtroendet är svårt att reparera.`,
      `Vid företagsrekonstruktion eller konkurs träder den statliga lönegarantin in och betalar de anställdas löner upp till taket – de anställda är alltså mindre utsatta i ett ordnat förfarande än i ett utdraget informellt betalningsdröjsmål.`,
    ];
    if (yes(answers.skatt)) {
      paragraphs.push(
        `Att skatter förfaller samtidigt gör prioriteringen juridiskt känslig: betalningar som gynnar vissa borgenärer i ett obeståndsläge kan återvinnas, och obetald skatt aktiverar företrädaransvaret. Det talar för att pröva rekonstruktionsfrågan nu i stället för att välja vilka räkningar som betalas.`,
      );
    }
    paragraphs.push(`Det här är underlag för beslut – stäm av med revisor eller juridisk rådgivare innan ni väljer väg.`);
    return withLabel({
      severity: "critical",
      paragraphs,
      snapshot: [
        { tone: "critical", label: "Löner", note: staff ? `${staff} anställda berörs av nästa utbetalning` : "Nästa utbetalning är under press" },
        yes(answers.skatt)
          ? { tone: "warning", label: "Skatter", note: "Förfaller samtidigt - prioriteringen kan angripas i efterhand" }
          : { tone: "success", label: "Skatter", note: "Ingen samtidig skattepress registrerad" },
        { tone: "success", label: "Lönegarantin", note: "Skyddar de anställda vid rekonstruktion eller konkurs" },
      ],
      plan: [
        { when: "Idag", label: "Likviditetsbilden: exakt vad som finns och vad som förfaller" },
        { when: "Före lönekörningen", label: "Beslut om väg - egen finansiering eller rekonstruktionsprövning" },
        { when: "Om 7 dagar", label: "Uppföljning mot planen" },
      ],
      actions: [
        { label: "Se hur länge pengarna räcker", href: "/dashboard/liquidity", why: "Likviditetsplanen visar om lönebristen är en engångshändelse eller ett mönster." },
        { label: "Hitta rekonstruktör", href: "/marketplace", why: "Rekonstruktion med lönegaranti kan vara de anställdas bästa skydd." },
        { label: "Läs om lönegarantin", href: "/kunskap", why: "Vad garantin täcker, och vad som krävs för att den ska gälla." },
      ],
      decisionSuggestion: {
        title: "Pröva rekonstruktionsfrågan före nästa löneutbetalning",
        premise: `Beslutet vilar på att ${gap > 0 ? kr(gap) : "ett belopp"} saknas till lönerna${yes(answers.skatt) ? " och att skatter förfaller samtidigt" : ""}. Kommer pengar in som täcker lönerna bör beslutet omprövas.`,
      },
    });
  },
};

const receivableFlow: DialogFlow = {
  id: "kundforlust",
  title: "En stor kundfordran betalas inte",
  chip: "Kund betalar inte",
  ack: "Jag förstår – en kund betalar inte. Det är ett vanligt och hanterbart problem, men det ska tas på allvar innan det blir ett större. Vi går igenom det steg för steg.",
  triggers: [/\bkund/i, /fordran/i, /faktur/i, /betalar inte/i],
  steps: [
    { id: "belopp", prompt: "Hur stor är den obetalda fordran?", kind: "amount", hint: "t.ex. 100 000 kr" },
    { id: "forsenad", prompt: "Hur många dagar försenad är betalningen?", kind: "amount", hint: "t.ex. 45" },
    { id: "paminnelse", prompt: "Har ni skickat skriftlig påminnelse eller inkassokrav?", kind: "yesno" },
  ],
  assess(answers) {
    const amount = amountOf(answers.belopp);
    const days = amountOf(answers.forsenad);
    const paragraphs: string[] = [
      `${amount > 0 ? `En fordran på ${kr(amount)}` : "En större fordran"}${days > 0 ? ` som är ${days} dagar försenad` : ""} är inte bara ett kassaflödesproblem – den kan också vara en kundförlust under uppsegling. Ju äldre fordran, desto lägre är sannolikheten att den betalas fullt ut.`,
      yes(answers.paminnelse)
        ? `Påminnelse är skickad. Nästa steg i trappan är ansökan om betalningsföreläggande hos Kronofogden – en billig och snabb väg till en exekutionstitel om kunden inte bestrider.`
        : `Ingen skriftlig påminnelse är skickad än. Börja där: dokumenterade krav är förutsättningen för både inkasso och betalningsföreläggande, och de avbryter preskription.`,
      `Räkna samtidigt inte med pengarna i likviditetsplanen förrän de är på kontot – en plan som vilar på en osäker fordran är ingen plan.`,
    ];
    return withLabel({
      severity: days > 60 || amount > 100000 ? "serious" : "elevated",
      paragraphs,
      actions: [
        { label: "Uppdatera likviditetsplanen", href: "/dashboard/liquidity", why: "Flytta eller osäkra fordran så planen visar verkligheten." },
        { label: "Läs om betalningsföreläggande", href: "/kunskap", why: "Vägen från obetald faktura till exekutionstitel, steg för steg." },
        { label: "Se vad siffrorna säger", href: "/dashboard", why: "Insikterna visar om fler fordringar är på väg åt samma håll." },
      ],
      decisionSuggestion: null,
    });
  },
};

const enforcementFlow: DialogFlow = {
  id: "kronofogden",
  title: "Brev från Kronofogden",
  chip: "Brev från Kronofogden",
  ack: "Jag förstår – ett brev från Kronofogden. Det känns allvarligt, och det finns en tydlig ordning för hur det hanteras. Vi tar det lugnt och metodiskt, en fråga i taget.",
  triggers: [/kronofogd/i, /betalningsföreläggande/i, /utmätning/i, /delgiv/i],
  steps: [
    { id: "belopp", prompt: "Vilket belopp kräver motparten?", kind: "amount", hint: "t.ex. 75 000 kr" },
    { id: "bestrider", prompt: "Anser ni att kravet är felaktigt, helt eller delvis?", kind: "yesno" },
    { id: "fler", prompt: "Har fler krav eller förelägganden kommit de senaste tre månaderna?", kind: "yesno" },
  ],
  assess(answers) {
    const amount = amountOf(answers.belopp);
    const paragraphs: string[] = [
      `Ett betalningsföreläggande${amount > 0 ? ` på ${kr(amount)}` : ""} har en förklaringsfrist – svara inom den tid som står i brevet. Ett föreläggande som inte bestrids i tid blir ett utslag: en exekutionstitel som kan gå direkt till utmätning, och en betalningsanmärkning som skadar bolagets kreditvärdighet i åratal.`,
      yes(answers.bestrider)
        ? `Anser ni att kravet är felaktigt ska det bestridas skriftligen inom fristen – då kan målet i stället prövas av domstol, och inget utslag meddelas. Bestrid bara det som faktiskt är fel; ett ogrundat bestridande skjuter bara upp kostnaden.`
        : `Är kravet riktigt men pengarna saknas: kontakta sökanden om en avbetalningsplan före utslaget, och räkna in kravet i likviditetsplanen. Ett utslag är en offentlig obeståndssignal som banker och leverantörer ser.`,
    ];
    if (yes(answers.fler)) {
      paragraphs.push(
        `Att flera krav kommer samtidigt är ett mönster, inte en otur. Då är frågan inte längre "hur hanterar vi det här brevet" utan "är bolaget på obestånd" – och den frågan ska prövas ordentligt, med kontrollbalansbedömningen som start.`,
      );
    }
    paragraphs.push(`Det här är underlag för beslut – stäm av med juridisk rådgivare, särskilt före ett bestridande.`);
    return withLabel({
      severity: yes(answers.fler) ? "critical" : "serious",
      paragraphs,
      plan: [
        { when: "Idag", label: "Läs förklaringsfristen i brevet - den styr allt" },
        {
          when: "Inom fristen",
          label: yes(answers.bestrider)
            ? "Bestrid skriftligen - då prövas målet i domstol i stället"
            : "Kontakta sökanden om avbetalningsplan före utslaget",
        },
        { when: "Om 7 dagar", label: "Uppföljning - och kontroll att inget nytt föreläggande kommit" },
      ],
      actions: [
        { label: "Läs om betalningsföreläggande", href: "/kunskap", why: "Fristerna, bestridandet och vad ett utslag innebär." },
        ...(yes(answers.fler)
          ? [{ label: "Gör kontrollbalansbedömningen", href: "/kbr", why: "Flera samtidiga krav är ofta skäl att anta kapitalbrist." }]
          : []),
        { label: "Hitta jurist", href: "/marketplace", why: "Ett bestridande och dess följder bör utformas med juridiskt stöd." },
      ],
      decisionSuggestion: yes(answers.bestrider)
        ? {
            title: "Bestrid kravet inom förklaringsfristen",
            premise: `Beslutet vilar på bedömningen att kravet${amount > 0 ? ` på ${kr(amount)}` : ""} är felaktigt helt eller delvis. Visar underlaget senare att kravet är riktigt bör beslutet omprövas och en betalningslösning sökas.`,
          }
        : null,
    });
  },
};

const bankFlow: DialogFlow = {
  id: "banken",
  title: "Banken säger nej",
  chip: "Banken säger nej",
  ack: "Jag förstår – banken säger nej. Det är ett bakslag, men sällan slutet: det finns fler vägar till finansiering än bankens. Vi börjar med att förstå läget.",
  // Ledande ordgräns så "affärsplan" inte läses som "lån".
  triggers: [/\bbank/i, /kredit/i, /\bl[åa]n/i, /finansier/i],
  steps: [
    { id: "vad", prompt: "Vad har hänt – har banken sagt nej till ny finansiering, eller sagt upp en befintlig kredit?", kind: "text", hint: "Beskriv kort" },
    { id: "belopp", prompt: "Hur mycket finansiering behöver bolaget den närmaste tiden?", kind: "amount", hint: "t.ex. 500 000 kr" },
    { id: "sakerheter", prompt: "Finns det säkerheter som inte redan är pantsatta – fastighet, fordringar, varulager?", kind: "yesno" },
  ],
  assess(answers) {
    const amount = amountOf(answers.belopp);
    const paragraphs: string[] = [
      `Ett nej från banken är sällan slutet – men det är ett skäl att byta metod. Bankens beslut bygger på det underlag den ser: ett strukturerat kreditunderlag med siffror, säkerheter och en trovärdig plan prövas på andra villkor än en muntlig förfrågan.`,
      yes(answers.sakerheter)
        ? `Att det finns opantsatta säkerheter är ett verkligt förhandlingskort – mot banken, men också mot andra finansiärer: factoring på kundfordringar och lager- eller fastighetsbelåning prissätts på säkerheten, inte bara på bolagets historik.`
        : `Utan fria säkerheter smalnar vägarna: då väger kassaflödesprognosen och ägarnas eget åtagande tyngre, och alternativ som förskott från kunder eller ägartillskott bör upp på bordet.`,
      `${amount > 0 ? `Behovet på ${kr(amount)} ska` : "Behovet ska"} också prövas mot likviditetsplanen: finansiering som täpper ett strukturellt underskott köper tid men löser inget – då är rekonstruktion med skulduppgörelse ibland det ärligare alternativet.`,
      `Det här är underlag för beslut – stäm av med revisor eller rådgivare innan nya åtaganden görs.`,
    ];
    return withLabel({
      severity: "serious",
      paragraphs,
      actions: [
        { label: "Sammanställ kreditunderlaget", href: "/dashboard/kreditunderlag", why: "Siffror, säkerheter och plan i ett dokument – underlaget banken eller finansiären faktiskt prövar." },
        { label: "Se hur länge pengarna räcker", href: "/dashboard/liquidity", why: "Skiljer tillfälligt glapp från strukturellt underskott – de kräver olika lösningar." },
        { label: "Hitta finansiär eller rådgivare", href: "/marketplace", why: "Fler vägar än banken: factoring, säkerhetsbelåning, rekonstruktionsfinansiering." },
      ],
      decisionSuggestion: null,
    });
  },
};

export const DIALOG_FLOWS: DialogFlow[] = [taxFlow, wagesFlow, receivableFlow, enforcementFlow, bankFlow];

/* --- motorn ---------------------------------------------------------------- */

/**
 * Fritext → flöde. Första matchande flödet i definitionsordning vinner;
 * ordningen är medveten (skatt före kund: "kan inte betala moms för att
 * kunden inte betalat" ska börja i skatteflödet, som är den vassare
 * fristen). Ingen träff ger null - och då säger rådgivaren ärligt att
 * situationen behöver den breda utvärderingen i stället för en gissning.
 */
export const matchFlow = (text: string): DialogFlow | null =>
  DIALOG_FLOWS.find((flow) => flow.triggers.some((t) => t.test(text))) ?? null;

/** Svar på fritext som inte matchar något flöde. */
export const FALLBACK_REPLY = [
  "Det där behöver utredas bredare än ett snabbt samtal – och en gissning vore fel mot dig.",
  "Gör den fria nulägesanalysen, så går vi igenom hela situationen: siffrorna, fristerna och alternativen. Den tar 5–10 minuter, och resultatet blir grunden för allt annat i ärendet.",
] as const;

/* --- Clara ----------------------------------------------------------------- */

/**
 * Claras röst regleras av Conversation Constitution
 * (docs/conversation-constitution.md): bekräfta, skapa trygghet, EN
 * fråga i taget, max tre rekommendationer, namnet sparsamt. Texterna
 * här är de enda ställen där Clara presenterar sig - en röst, en källa.
 */
export const CLARA = {
  name: "Clara",
  /** Hälsning i ett ärende som redan finns. Namnet används sparsamt. */
  greeting: (displayName: string | null): string =>
    displayName
      ? `Hej ${displayName.split(" ")[0]}. Beskriv vad som har hänt, så tar vi det därifrån – eller välj en situation nedan.`
      : "Hej. Beskriv vad som har hänt, så tar vi det därifrån – eller välj en situation nedan.",
} as const;

/**
 * Onboardingen: den första upplevelsen är ett samtal, inte ett
 * dashboard. Clara frågar EN sak i taget - namn, företag, situation -
 * och öppnar sedan nulägesanalysen själv. Användaren ska aldrig behöva
 * tänka "var ska jag klicka?".
 */
export const ONBOARDING = {
  intro: [
    "Hej. Jag heter Clara och jag hjälper dig genom den här processen.",
    "Om ditt företag har ekonomiska problem är du inte ensam. Det kan kännas överväldigande, men vi tar en sak i taget – mitt jobb är att hjälpa dig skapa struktur, förstå dina alternativ och dokumentera allt längs vägen.",
    "Låt oss börja. Vad heter du?",
  ],
  askCompany: (name: string): string => `Tack ${name.split(" ")[0]}. Vilket företag gäller det?`,
  askSituation: "Tack. Först behöver jag förstå din situation. Vilket av följande stämmer bäst?",
  situations: [
    { id: "oro", label: "Jag är orolig för ekonomin" },
    { id: "fakturor", label: "Jag kan inte betala vissa fakturor" },
    { id: "loner", label: "Jag kan inte betala löner" },
    { id: "ansvar", label: "Jag riskerar personligt betalningsansvar" },
    { id: "vet-inte", label: "Jag vet inte riktigt vad problemet är" },
  ],
  /**
   * Avslutet: bekräftelse + vad som händer härnäst. Nulägesanalysen är
   * faktainsamlingen - Clara öppnar den, användaren letar inte.
   */
  closing: [
    "Tack. Då har jag det jag behöver för att börja.",
    "Jag öppnar nu nulägesanalysen. Den tar 5–10 minuter och ger oss en gemensam bild av läget – siffrorna, fristerna och alternativen. Jag finns här när den är klar.",
  ],
} as const;

/**
 * Lägesbilden i Claras hälsning: tre områden med ton och not, byggda ur
 * ärendets registrerade uppgifter. "Jag har en ganska bra bild av
 * situationen" - visad, inte påstådd.
 */
export const buildCaseSnapshot = (input: {
  coverageRatio: number | null;
  passedDeadlines: number;
  daysToNextDeadline: number | null;
  kbrDone: boolean;
}): SnapshotRow[] => [
  {
    tone: input.coverageRatio !== null && input.coverageRatio < 50 ? "critical" : input.coverageRatio !== null && input.coverageRatio < 100 ? "warning" : "success",
    label: "Likviditet",
    note:
      input.coverageRatio === null
        ? "Skuldtäckningen är inte fastställd än"
        : `Snabba avyttringsvärdet täcker ${input.coverageRatio} % av skulderna`,
  },
  {
    tone: input.passedDeadlines > 0 ? "critical" : (input.daysToNextDeadline ?? 99) <= 7 ? "warning" : "success",
    label: "Frister",
    note:
      input.passedDeadlines > 0
        ? `${input.passedDeadlines} ${input.passedDeadlines === 1 ? "datum har" : "datum har"} passerat - hanteras i handlingsplanen`
        : input.daysToNextDeadline !== null
          ? `Närmaste bevakade datum om ${input.daysToNextDeadline} dagar`
          : "Inga kommande frister i underlaget",
  },
  {
    tone: input.kbrDone ? "success" : "warning",
    label: "Dokumentation",
    note: input.kbrDone
      ? "Kontrollbalansbedömningen är gjord och journalförd"
      : "Kontrollbalansbedömningen är inte gjord än",
  },
];

/**
 * Beslutsuppföljningen - minnet som gör Clara till en rådgivare och
 * inte en chatbot. Frågan byggs ur beslutets premiss: det som gällde
 * när beslutet togs är det som ska prövas mot verkligheten.
 */
export const decisionCheckIn = (decision: {
  title: string;
  premise: string | null;
  decidedAt: string;
}): string => {
  const d = new Date(decision.decidedAt);
  const months = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
  const when = `${d.getDate()} ${months[d.getMonth()]}`;
  return decision.premise
    ? `Den ${when} beslutade ni: ”${decision.title}”. ${decision.premise} Är det fortfarande planen?`
    : `Den ${when} beslutade ni: ”${decision.title}”. Är det fortfarande planen?`;
};

/** Formaterar ett svar för journalen/samtalsloggen. */
export const answerLabel = (step: DialogStep, raw: string): string => {
  if (step.kind === "yesno") return yes(raw) ? "Ja" : "Nej";
  if (step.kind === "amount") {
    const n = amountOf(raw);
    return n > 0 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : raw.trim() || "0";
  }
  return raw.trim();
};
