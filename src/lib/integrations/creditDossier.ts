/**
 * Kreditunderlaget: det dokument ett företag skickar när det söker
 * finansiering - factoring, rörelsekredit, brygglån eller
 * rekonstruktionsfinansiering.
 *
 * GRÄNSEN, beslutad i docs/VISION.md och värd att upprepa där koden bor:
 * plattformen PRODUCERAR underlag, den REKOMMENDERAR inte kredit och den
 * FÖRMEDLAR ingenting. Ny skuld till ett bolag nära obestånd kan skada
 * borgenärerna, och förmedling är blockerad tills tillståndsfrågor (FI) och
 * medverkansansvar är juridiskt bedömda. Det här dokumentet är företagets
 * eget, att skicka till vem det vill.
 *
 * Underlagets värdegrund är densamma som resten av produkten: ärlighet som
 * konkurrensfördel. Ett kreditunderlag från Clearance redovisar ÄVEN det
 * som talar emot - skattesituationen, dag då kassan tar slut, KBR-läget.
 * En finansiär som upptäcker att underlaget döljer saker slutar läsa
 * underlag härifrån, och då är hela kanalen död. Därför vägrar byggaren
 * producera ett dokument när väsentliga fält saknas, i stället för att
 * skriva ett tunnare dokument som ser komplett ut.
 */

import type { CaseRecord } from "@/data/types";
import type { ReportModel, Tone } from "../reports/types";

export interface CreditDossierInput {
  caseRecord: CaseRecord;
  /** Ur likviditetsplanen. Null = planen är inte gjord. */
  liquidity: {
    openingBalance: number;
    daysUntilNegative: number | null;
    horizonDays: number;
    monthlyIn: number;
    monthlyOut: number;
  } | null;
  /** Ur KBR-beräkningen. Null = inte gjord. */
  kbr: {
    shareCapital: number;
    equity: number;
    required: boolean;
  } | null;
  /** Vad pengarna ska användas till och hur mycket. Företagets egna ord. */
  request: {
    amount: number;
    purpose: string;
    /** T.ex. "factoring", "rörelsekredit", "brygglån". */
    kind: string;
  };
  generatedAt: string;
}

export type CreditDossierResult =
  | { ok: true; report: ReportModel; package: CreditPackage }
  | { ok: false; missing: string[] };

/**
 * Det maskinläsbara paketet - samma innehåll som dokumentet, för den dag en
 * mottagare hellre tar JSON. Versionsmärkt som aktexporten.
 */
export interface CreditPackage {
  format: "clearance-kreditunderlag";
  formatVersion: 1;
  generatedAt: string;
  company: { orgNumber: string; name: string | null; employees: string | null };
  request: { amount: number; purpose: string; kind: string };
  position: {
    totalDebt: number | null;
    liquidity: CreditDossierInput["liquidity"];
    kbr: CreditDossierInput["kbr"];
    assessment: CaseRecord["recommendationType"];
  };
  /** Alltid med: vad underlaget INTE är. */
  disclaimer: string;
}

// Egen tusentalsgruppering, inte toLocaleString: den ger U+00A0, som ser ut
// som mellanslag men inte är det, och bryter sökningar i färdiga dokument.
// Samma beslut som formatOre i src/lib/invoice.ts.
const sek = (value: number): string =>
  `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

const DISCLAIMER =
  "Underlaget är sammanställt av företaget självt i Clearance ur de uppgifter " +
  "företaget lämnat och läst in. Clearance och Landvex AB rekommenderar inte " +
  "kreditgivning, förmedlar inte krediter och ansvarar inte för beslut som " +
  "fattas på underlaget. Uppgifterna har inte reviderats.";

/**
 * Bygger underlaget, eller vägrar med en lista på vad som saknas.
 *
 * Kravet på likviditetsplan är absolut: ett kreditunderlag utan
 * likviditetsprognos för ett bolag i kris är inte ofullständigt, det är
 * missvisande - frågan varje finansiär ställer är "när tar pengarna slut".
 */
export const buildCreditDossier = (input: CreditDossierInput): CreditDossierResult => {
  const missing: string[] = [];
  if (!input.caseRecord.companyName) missing.push("företagsnamn");
  if (!input.liquidity) missing.push("likviditetsplan (gör den i Likviditetsplanering)");
  if (input.request.amount <= 0) missing.push("sökt belopp");
  if (input.request.purpose.trim().length < 10)
    missing.push("ändamål (beskriv vad finansieringen ska användas till)");
  if (missing.length > 0) return { ok: false, missing };

  const liquidity = input.liquidity!;
  const runwayTone: Tone =
    liquidity.daysUntilNegative === null
      ? "good"
      : liquidity.daysUntilNegative < 30
        ? "critical"
        : "warning";

  const report: ReportModel = {
    meta: {
      documentTitle: "Kreditunderlag",
      companyName: input.caseRecord.companyName,
      orgNumber: input.caseRecord.orgNumber,
      reference: input.caseRecord.id.slice(0, 8),
      generatedAt: input.generatedAt,
    },
    lead: [
      {
        kind: "keyValues",
        items: [
          { label: "Sökt finansiering", value: sek(input.request.amount) },
          { label: "Typ", value: input.request.kind },
          {
            label: "Kassan räcker",
            value:
              liquidity.daysUntilNegative === null
                ? `mer än ${liquidity.horizonDays} dagar`
                : `${liquidity.daysUntilNegative} dagar`,
            tone: runwayTone,
          },
        ],
      },
      { kind: "paragraph", text: input.request.purpose },
    ],
    sections: [
      {
        title: "Likviditet",
        intro:
          "Ur företagets likviditetsplan i Clearance. Prognosen bygger på de " +
          "betalningar och fordringar företaget själv registrerat.",
        blocks: [
          {
            kind: "keyValues",
            items: [
              { label: "Kassa vid underlagets datum", value: sek(liquidity.openingBalance) },
              { label: "Inbetalningar per månad", value: sek(liquidity.monthlyIn) },
              { label: "Utbetalningar per månad", value: sek(liquidity.monthlyOut) },
              {
                label: "Dag då kassan är förbrukad",
                value:
                  liquidity.daysUntilNegative === null
                    ? `Inte inom prognosens ${liquidity.horizonDays} dagar`
                    : `Om ${liquidity.daysUntilNegative} dagar`,
                tone: runwayTone,
              },
            ],
          },
        ],
      },
      {
        title: "Ställning och skulder",
        intro:
          "Det som talar emot redovisas här, av samma skäl som resten: ett " +
          "underlag som döljer något är värdelöst för båda parter.",
        blocks: [
          {
            kind: "keyValues",
            items: [
              {
                label: "Total skuld enligt företaget",
                value:
                  input.caseRecord.totalDebt !== null
                    ? sek(Number(input.caseRecord.totalDebt))
                    : "Ej angiven",
              },
              ...(input.kbr
                ? [
                    {
                      label: "Eget kapital mot aktiekapital",
                      value: `${sek(input.kbr.equity)} av ${sek(input.kbr.shareCapital)}`,
                      tone: (input.kbr.required ? "critical" : "neutral") as Tone,
                      note: input.kbr.required
                        ? "Kontrollbalansräkning krävs (ABL 25 kap. 13 §)."
                        : undefined,
                    },
                  ]
                : []),
              {
                label: "Clearances lägesbedömning",
                value:
                  input.caseRecord.recommendationTitle ??
                  input.caseRecord.recommendationType ??
                  "Ej gjord",
              },
            ],
          },
        ],
      },
    ],
    disclaimer: DISCLAIMER,
  };

  return {
    ok: true,
    report,
    package: {
      format: "clearance-kreditunderlag",
      formatVersion: 1,
      generatedAt: input.generatedAt,
      company: {
        orgNumber: input.caseRecord.orgNumber,
        name: input.caseRecord.companyName,
        employees: input.caseRecord.employees,
      },
      request: input.request,
      position: {
        totalDebt: input.caseRecord.totalDebt !== null ? Number(input.caseRecord.totalDebt) : null,
        liquidity: input.liquidity,
        kbr: input.kbr,
        assessment: input.caseRecord.recommendationType,
      },
      disclaimer: DISCLAIMER,
    },
  };
};
