/**
 * Intelligenta uppgifter: spelböckerna bakom handlingsplanen.
 *
 * En uppgift i Clearance ska aldrig bara vara en punkt i en checklista.
 * Systemet ska veta VARFÖR uppgiften finns, VAD som ligger bakom
 * bedömningen, VAD som händer om den inte utförs, och - viktigast -
 * hjälpa användaren att GENOMFÖRA den, steg för steg. När stegen är
 * gjorda ser systemet det och slutför uppgiften automatiskt.
 *
 * Spelboken matchas på uppgiftens text (utvärderingens sådda uppgifter
 * har kända formuleringar); okända uppgifter får en ärlig grundvy utan
 * påhittade steg. Allt är deterministiskt och testbart - konsekvenser
 * formuleras enligt kommunikationsprincipen: "kan", aldrig "kommer att".
 *
 * Rådgivarmatchningen väger ärendetyp, specialisering, verifiering och
 * pristransparens - och säger VARFÖR en rådgivare föreslås. Källorna för
 * rådgivarregistret är medvetet pluggbara: idag vårt eget granskade
 * partnerregister; officiella register kompletterar när/om sådana blir
 * åtkomliga (ANTAGANDE: inget färdigt myndighets-API över rekonstruktörer
 * eller förvaltare är bekräftat - arkitekturen får inte vila på det).
 */

import type { CaseRecord, CaseMemberRecord, DocumentRecord, PaymentRecord, KbrStatus, ProfessionalRecord } from "@/data/types";

export interface TaskContext {
  caseRecord: CaseRecord;
  members: CaseMemberRecord[];
  documents: DocumentRecord[];
  payments: PaymentRecord[];
  kbr: { status: KbrStatus; createdAt: string } | null;
}

export interface ProcessStep {
  label: string;
  href: string;
  /** true när systemet kan se att steget är gjort. */
  done: boolean;
}

export interface TaskPlaybook {
  id: string;
  why: string;
  /** Underlagen bakom bedömningen - vad systemet faktiskt vet. */
  basis: string[];
  consequence: string;
  steps: ProcessStep[];
  /** true = processen är genomförd; uppgiften kan slutföras automatiskt. */
  complete: boolean;
  /** Spelboken erbjuder rådgivarmatchning. */
  offersMatching: boolean;
}

const advisorInCase = (ctx: TaskContext): boolean =>
  ctx.members.some(
    (m) => !m.revokedAt && ["reconstructor", "trustee", "legal_advisor"].includes(m.role),
  );

const minutesSaved = (ctx: TaskContext): boolean =>
  ctx.documents.some((d) => d.note?.startsWith("Genererad mall"));

const basisFor = (ctx: TaskContext): string[] => {
  const c = ctx.caseRecord;
  const basis: string[] = [];
  const cannot = [
    c.canPaySalary === false ? "lönerna" : null,
    c.canPayTax === false ? "skatten" : null,
    c.canPayRent === false ? "hyran" : null,
    c.canPaySuppliers === false ? "leverantörerna" : null,
  ].filter(Boolean);
  if (cannot.length > 0) basis.push(`Registrerat i utvärderingen: ${cannot.join(", ")} kan inte betalas fullt ut.`);
  if (c.recommendationTitle) basis.push(`Utvärderingens bedömning: ${c.recommendationTitle.toLowerCase().replace(/\.$/, "")}.`);
  if (ctx.kbr) basis.push(`Kontrollbalansbedömning finns (${ctx.kbr.status}).`);
  if (basis.length === 0) basis.push("Uppgiften kommer från ärendets handlingsplan.");
  return basis;
};

export const playbookForTask = (label: string, ctx: TaskContext): TaskPlaybook => {
  const c = ctx.caseRecord;

  if (/kontakta en (rekonstruktör|insolvensjurist)/i.test(label)) {
    const invited = advisorInCase(ctx);
    const hasDocs = ctx.documents.length > 0;
    return {
      id: "kontakta-radgivare",
      why:
        c.recommendationType === "bankruptcy"
          ? "Bedömningen pekar mot en ordnad avveckling, och ordningen avgörs av vem som leder den. Ett ombud med konkursvana skyddar både bolaget och företrädarna genom processen."
          : "Bedömningen pekar mot rekonstruktion, och en ansökan kräver att en rekonstruktör bedömer verksamheten som livskraftig. Rätt person tidigt höjer chansen att ansökan går igenom.",
      basis: basisFor(ctx),
      consequence:
        "Utan rådgivare fattas de tidskritiska besluten utan vana ögon - vissa misstag i det här skedet kan få långtgående juridiska konsekvenser.",
      steps: [
        { label: "Se matchade rådgivare och skicka förfrågan", href: "/marketplace", done: invited },
        { label: "Samla underlaget rådgivaren behöver (akten)", href: "/dashboard/dokument", done: hasDocs },
        { label: "Bjud in rådgivaren till ärendet", href: "/dashboard/deltagare", done: invited },
      ],
      complete: invited,
      offersMatching: true,
    };
  }

  if (/likviditetsbudget|likviditetsprognos/i.test(label)) {
    const hasPlan = ctx.payments.length > 0;
    return {
      id: "likviditet",
      why: "Både din egen bedömning och en eventuell ansökan vilar på att veta exakt när kassan tar slut - dag för dag, inte på känsla.",
      basis: basisFor(ctx),
      consequence: "Utan prognos upptäcks bristen när den redan inträffat, och handlingsutrymmet är då mindre.",
      steps: [{ label: "Bygg likviditetsplanen post för post", href: "/likviditetsplan", done: hasPlan }],
      complete: hasPlan,
      offersMatching: false,
    };
  }

  if (/sammanställ underlag/i.test(label)) {
    const enough = ctx.documents.length >= 2;
    return {
      id: "underlag",
      why: "Skuldlista, bokslut och kontoutdrag är det första varje rådgivare, bank och domstol frågar efter. Samlat underlag gör varje möte kortare.",
      basis: basisFor(ctx),
      consequence: "Saknat underlag försenar varje nästa steg - och förseningar i det här läget kostar handlingsutrymme.",
      steps: [
        { label: "Ladda upp kontoutdrag och rapporter", href: "/dashboard/dokument", done: ctx.documents.length > 0 },
        { label: "Komplettera tills akten håller (minst bokslut + kontoutdrag)", href: "/dashboard/dokument", done: enough },
      ],
      complete: enough,
      offersMatching: false,
    };
  }

  if (/verksam åtgärd|rekonstruktionsansökan före skattens/i.test(label)) {
    const kbrDone = ctx.kbr !== null;
    const protocol = minutesSaved(ctx);
    return {
      id: "verksam-atgard",
      why: "Skyddet mot personligt betalningsansvar för bolagets skatter ligger i en verksam åtgärd senast på skattens förfallodag. Datumet styr, inte avsikten.",
      basis: basisFor(ctx),
      consequence: "Det finns situationer där företrädare kan bli personligt ansvariga för obetald skatt - beslutet bör inte skjutas upp.",
      steps: [
        { label: "Läs vad som räknas som verksam åtgärd", href: "/kunskap/foretradaransvar", done: false },
        { label: "Gör kontrollbalansbedömningen", href: "/kbr", done: kbrDone },
        { label: "Protokollför styrelsens beslut (mall finns)", href: "/dashboard/dokument", done: protocol },
      ],
      complete: kbrDone && protocol,
      offersMatching: false,
    };
  }

  if (/anstånd hos skatteverket/i.test(label)) {
    return {
      id: "anstand",
      why: "Ett beviljat anstånd flyttar förfallodagen - och därmed även fristen för företrädaransvaret.",
      basis: basisFor(ctx),
      consequence: "Utan anstånd eller annan åtgärd före förfallodagen är ansvarsfrågan öppen.",
      steps: [
        { label: "Läs om företrädaransvaret och fristen", href: "/kunskap/foretradaransvar", done: false },
        { label: "Hämta skattekontoutdraget och läs in det", href: "/dashboard/dokument", done: ctx.documents.length > 0 },
      ],
      complete: false,
      offersMatching: false,
    };
  }

  if (/gör utvärderingen|fyll i utvärderingen/i.test(label)) {
    return {
      id: "utvardering",
      why: "Bedömningen räknas fram ur svaren om löner, skatt, hyra och leverantörer. Utan dem finns ingen bedömning - bara en tom mall.",
      basis: basisFor(ctx),
      consequence:
        "Ett ärende utan underlag ser ut som ett lugnt ärende. Det är den farligaste sortens tystnad i den här produkten.",
      steps: [{ label: "Svara på frågorna om betalningarna", href: "/wizard", done: false }],
      complete: false,
      offersMatching: false,
    };
  }

  if (/kontrollbalansbedömning|kontrollbalansräkning/i.test(label)) {
    const done = ctx.kbr !== null;
    return {
      id: "kontrollbalans",
      why: "Skyldigheten att upprätta kontrollbalansräkning hänger på det egna kapitalet, inte på likviditeten - den kan alltså ha inträtt medan bolaget fortfarande betalar allt i tid.",
      basis: basisFor(ctx),
      consequence:
        "Görs ingen bedömning kan styrelseledamöterna bli personligt ansvariga för skulder som uppkommer därefter. Ett daterat beslut är det som bryter den kedjan.",
      steps: [{ label: "Gör kontrollbalansbedömningen", href: "/kbr", done }],
      complete: done,
      offersMatching: false,
    };
  }

  if (/förhandla betalningsplaner|kontakta nyckelleverantör/i.test(label)) {
    // "Klart" är inte att ha ringt - det är att den nya överenskommelsen
    // står i ärendet. En uppskjuten betalning är den enda spår systemet
    // kan se, och därför det enda som får räknas.
    const postponed = ctx.payments.some((p) => p.status === "postponed");
    return {
      id: "betalningsplan",
      why: "Förhandlingsläget är bäst medan betalningarna fortfarande sköts. Den som hör av sig först får villkor; den som hör av sig efter en utebliven betalning får krav.",
      basis: basisFor(ctx),
      consequence:
        "Uteblivna betalningar utan förvarning gör motparten till borgenär i stället för till samarbetspartner - och en borgenär som känner sig förbigången driver in hårdare.",
      steps: [
        { label: "Läs vad som gäller de första veckorna", href: "/kunskap/likviditetskris-forsta-steg", done: false },
        { label: "Se vilka betalningar som ligger närmast", href: "/dashboard#frister", done: false },
        { label: "Registrera den nya planen: markera betalningen som uppskjuten", href: "/dashboard#frister", done: postponed },
      ],
      complete: postponed,
      offersMatching: false,
    };
  }

  if (/fakturabelåning|checkkredit/i.test(label)) {
    return {
      id: "finansiering",
      why: "Fakturabelåning och checkkredit ändrar inte hur mycket bolaget tjänar - de flyttar pengarna dit där de behövs i tiden. Det är rätt verktyg mot en tillfällig svacka och fel verktyg mot en varaktig förlust.",
      basis: basisFor(ctx),
      consequence:
        "Extern finansiering som tas UTAN en prognos löser en månad och fördjupar nästa. Ordningen spelar roll: prognosen först, samtalet med banken sedan.",
      steps: [
        { label: "Gör prognosen först - den visar hur stort behovet är", href: "/likviditetsplan", done: ctx.payments.length > 0 },
        { label: "Ta upp finansieringen med någon som kan siffrorna", href: "/marketplace", done: false },
      ],
      complete: false,
      offersMatching: true,
    };
  }

  if (/informera personalen/i.test(label)) {
    return {
      id: "personalen",
      why: "De anställda omfattas av den statliga lönegarantin, men skyddet gäller först när konkursen är beslutad. Det är den skillnaden som avgör vad man ärligt kan lova på ett möte.",
      basis: basisFor(ctx),
      consequence:
        "Personal som får veta av någon annan slutar lyssna på ledningen - och i en avveckling är det ledningens ord som håller ihop de sista veckorna.",
      steps: [
        { label: "Läs vad lönegarantin täcker, och när", href: "/kunskap/lonegaranti", done: false },
      ],
      complete: false,
      offersMatching: false,
    };
  }

  if (/selektiva betalningar/i.test(label)) {
    return {
      id: "selektiva-betalningar",
      why: "Betalningar till enskilda borgenärer nära en konkurs kan komma att gås igenom i efterhand. Det gäller även betalningar som kändes självklara när de gjordes.",
      basis: basisFor(ctx),
      consequence:
        "En betalning som görs nu kan behöva förklaras senare - av dig, i efterhand, utan möjlighet att göra om den.",
      steps: [
        { label: "Läs vad som gäller kring betalningar före en konkurs", href: "/kunskap/konkurs", done: false },
        { label: "Stäm av med en jurist innan nästa betalning", href: "/marketplace", done: advisorInCase(ctx) },
      ],
      complete: false,
      offersMatching: true,
    };
  }

  if (/avyttra tillgångar/i.test(label)) {
    return {
      id: "avyttring",
      why: "Tillgångar som inte behövs för driften binder pengar som behövs för den. Vad som är kritiskt avgörs av verksamheten, inte av bokfört värde.",
      basis: basisFor(ctx),
      consequence:
        "En försäljning nära en konkurs kan komma att prövas i efterhand, särskilt till närstående eller till underpris. Dokumentera hur priset sattes.",
      steps: [
        { label: "Läs om ordningen de första veckorna", href: "/kunskap/likviditetskris-forsta-steg", done: false },
        { label: "Lägg in effekten i likviditetsplanen", href: "/likviditetsplan", done: ctx.payments.length > 0 },
      ],
      complete: false,
      offersMatching: false,
    };
  }

  // Okänd uppgift: ärlig grundvy, inga påhittade steg.
  return {
    id: "generisk",
    why: c.recommendationTitle
      ? `Uppgiften ingår i handlingsplanen för bedömningen: ${c.recommendationTitle.toLowerCase().replace(/\.$/, "")}.`
      : "Uppgiften ingår i ärendets handlingsplan.",
    basis: basisFor(ctx),
    consequence: "Öppna punkter i handlingsplanen är dokumenterade åtaganden - det som inte görs syns.",
    steps: [],
    complete: false,
    offersMatching: false,
  };
};

/* -------------------------------------------------------------------------- */
/* Rådgivarmatchningen                                                        */
/* -------------------------------------------------------------------------- */

export interface ProfessionalMatch {
  professional: ProfessionalRecord;
  score: number;
  reasons: string[];
}

export const matchProfessionals = (
  caseRecord: CaseRecord,
  professionals: ProfessionalRecord[],
): ProfessionalMatch[] => {
  const wantedCategory =
    caseRecord.recommendationType === "reconstruction"
      ? "rekonstruktor"
      : caseRecord.recommendationType === "bankruptcy"
        ? "affarsjurist"
        : null;

  return professionals
    .map((professional) => {
      let score = 0;
      const reasons: string[] = [];
      if (wantedCategory && professional.category === wantedCategory) {
        score += 50;
        reasons.push(
          wantedCategory === "rekonstruktor"
            ? "arbetar med företagsrekonstruktion, vilket utvärderingen pekar mot"
            : "har konkurs- och obeståndsvana, vilket situationen kräver",
        );
      }
      const spec = (professional.specializations ?? []).join(" ").toLowerCase();
      if (caseRecord.canPayTax === false && /styrelseansvar|obestånd/.test(spec)) {
        score += 20;
        reasons.push("specialiserad på företrädaransvar och obeståndsfrågor");
      }
      if (/kontrollbalans/.test(spec)) {
        score += 10;
        reasons.push("erfarenhet av kontrollbalansräkningar");
      }
      if (professional.verified) {
        score += 15;
        reasons.push("granskad och godkänd i partnerregistret");
      }
      if ((professional.fixedPrices ?? []).length > 0) {
        score += 5;
        reasons.push("öppna fasta priser");
      }
      return { professional, score, reasons };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
};
