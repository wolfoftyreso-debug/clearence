/**
 * Ärendesammanfattningen och förhandsvisningen för kontaktförfrågningar.
 *
 * Två dokument med olika publik och OLIKA INNEHÅLLSREGLER:
 *
 *  - FÖRHANDSVISNINGEN ser rådgivaren FÖRE upplåsning. Den är avidentifierad:
 *    storleksband, problemtyp, komplexitet, brådska och dokumentlista -
 *    ALDRIG namn, organisationsnummer eller kontaktvägar. Regeln testas
 *    mekaniskt i tests/leadSummary.ts: förhandsvisningen serialiserad får
 *    inte innehålla identiteten.
 *
 *  - SAMMANFATTNINGEN låses upp mot villkor. Den innehåller identiteten,
 *    situationen, nyckeltalen, systemanalysens slutsats, dokumentlistan och
 *    skälet till kontakten - det rådgivaren behöver för att börja arbeta,
 *    utan ett enda extra formulär för företaget.
 *
 * Byggarna är rena funktioner ur samma data som resten av produkten:
 * ärendet och systemanalysen. Ingenting skrivs in en gång till.
 */

import type { CaseRecord } from "@/data/types";
import type { CrisisAnalysis } from "@/lib/crisisAnalysis";

export interface LeadPreview {
  sizeBand: string | null;
  problemType: string;
  complexity: "låg" | "medel" | "hög";
  urgency: string;
  documentCount: number;
  documentKinds: string[];
}

export interface LeadKeyFigure {
  label: string;
  value: string;
}

export interface LeadSummary {
  companyName: string;
  orgNumber: string;
  contactEmail: string | null;
  situation: string;
  keyFigures: LeadKeyFigure[];
  analysisTitle: string;
  documents: string[];
  reason: string;
}

const PROBLEM_TYPE: Record<string, string> = {
  reconstruction: "Rekonstruktionsläge",
  bankruptcy: "Konkursnära läge",
  stabilize: "Stabilisering",
};

const URGENCY: Record<string, string> = {
  immediate: "Omedelbar",
  weeks: "Inom veckor",
  months: "Inom månader",
};

/** "3 200 000 kr" - manuell gruppering, inte sv-SE:s hårda mellanslag. */
const kr = (raw: string | null): string | null => {
  const n = Number(raw ?? "");
  if (!raw || !Number.isFinite(n) || n <= 0) return null;
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
};

/**
 * Komplexiteten är en grov sortering för rådgivarens relevansbeslut, inte
 * en utfästelse: total skuld och antalet betalningsproblem räcker för att
 * skilja ett enmansbolag med en obetald faktura från en koncern i fritt
 * fall. Bedömningen förklaras alltid i den upplåsta sammanfattningen.
 */
const complexityOf = (caseRecord: CaseRecord): LeadPreview["complexity"] => {
  const debt = Number(caseRecord.totalDebt ?? "0") || 0;
  const problems = [
    caseRecord.canPaySalary === false,
    caseRecord.canPayTax === false,
    caseRecord.canPayRent === false,
    caseRecord.canPaySuppliers === false,
  ].filter(Boolean).length;
  if (debt >= 5_000_000 || problems >= 3) return "hög";
  if (debt >= 1_000_000 || problems >= 2) return "medel";
  return "låg";
};

export const buildLeadPreview = (
  caseRecord: CaseRecord,
  analysis: CrisisAnalysis,
  documentNames: string[],
): LeadPreview => ({
  sizeBand: caseRecord.employees ? `${caseRecord.employees} anställda` : null,
  problemType: PROBLEM_TYPE[analysis.type] ?? analysis.type,
  complexity: complexityOf(caseRecord),
  urgency: URGENCY[analysis.urgency] ?? analysis.urgency,
  documentCount: documentNames.length,
  // Filnamn kan innehålla bolagsnamnet; förhandsvisningen får bara typerna.
  documentKinds: [...new Set(documentNames.map(kindOfDocument))].sort(),
});

/** Grov dokumenttyp ur filnamnet - aldrig själva namnet. */
export const kindOfDocument = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.includes("kontrollbalans") || lower.includes("kbr")) return "Kontrollbalansräkning";
  if (lower.includes("protokoll")) return "Styrelseprotokoll";
  if (lower.includes("kallelse")) return "Kallelse";
  if (lower.endsWith(".se") || lower.endsWith(".si") || lower.includes("sie")) return "Bokföringsexport (SIE)";
  if (lower.includes("balans") || lower.includes("resultat")) return "Ekonomisk rapport";
  if (lower.includes("skatt")) return "Skatteunderlag";
  return "Övrigt underlag";
};

export const buildLeadSummary = (
  caseRecord: CaseRecord,
  analysis: CrisisAnalysis,
  documentNames: string[],
  contactEmail: string | null,
  reason: string,
): LeadSummary => {
  const figures: LeadKeyFigure[] = [];
  const debt = kr(caseRecord.totalDebt);
  if (debt) figures.push({ label: "Total skuld", value: debt });
  const liquidation = kr(caseRecord.quickLiquidationValue);
  if (liquidation) figures.push({ label: "Snabbt realiserbart värde", value: liquidation });
  const salary = kr(caseRecord.salaryAmount);
  if (salary) figures.push({ label: "Månadslöner", value: salary });
  const tax = kr(caseRecord.taxAmount);
  if (tax) figures.push({ label: "Skatt denna månad", value: tax });
  const rent = kr(caseRecord.rentAmount);
  if (rent) figures.push({ label: "Månadshyra", value: rent });

  return {
    companyName: caseRecord.companyName ?? "Ej angivet",
    orgNumber: caseRecord.orgNumber,
    contactEmail,
    situation: analysis.description,
    keyFigures: figures,
    analysisTitle: analysis.title,
    documents: documentNames,
    reason,
  };
};
