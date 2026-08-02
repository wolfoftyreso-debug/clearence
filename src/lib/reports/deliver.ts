/**
 * Getting a rendered report in front of the user.
 *
 * Real PDF output happens through the browser's own print dialog ("Spara som
 * PDF"), not a bundled PDF library. That keeps roughly a megabyte out of the
 * bundle, gets correct Swedish text shaping and hyphenation for free, and
 * produces a selectable, searchable document rather than an image.
 *
 * The old export claimed to produce a PDF and actually downloaded an .html
 * file, which is why this is split out and named for what it does.
 */

import { renderReport } from "./render";
import { renderReportPdf } from "./pdf";
import type { ReportModel } from "./types";

export type DeliveryResult =
  | { ok: true; via: "print-window" | "download" }
  | { ok: false; reason: string };

const slug = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "rapport";

export const reportFileName = (model: ReportModel): string => {
  const date = new Date(model.meta.generatedAt);
  const iso = Number.isNaN(date.getTime())
    ? "odaterad"
    : date.toISOString().slice(0, 10);
  const who = model.meta.companyName ?? model.meta.orgNumber ?? "clearance";
  return `${slug(model.meta.documentTitle)}-${slug(who)}-${iso}.html`;
};

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/**
 * Laddar ner rapporten som riktig PDF - byggd av vår egen sättning
 * (src/lib/reports/pdf.ts), inte via utskriftsdialogen. Fungerar därmed
 * även i inbäddade vyer där både popupfönster och utskrift kan blockeras.
 */
export const downloadReportPdf = (model: ReportModel): DeliveryResult => {
  try {
    const bytes = renderReportPdf(model);
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    downloadBlob(blob, reportFileName(model).replace(/\.html$/, ".pdf"));
    return { ok: true, via: "download" };
  } catch {
    return { ok: false, reason: "PDF-filen kunde inte skapas." };
  }
};

/** Saves the report as a self-contained file the user can keep or email. */
export const downloadReport = (model: ReportModel): DeliveryResult => {
  try {
    const blob = new Blob([renderReport(model)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reportFileName(model);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true, via: "download" };
  } catch {
    return { ok: false, reason: "Rapporten kunde inte laddas ner." };
  }
};

// Den gamla popupvägen (window.open + document.write) är borttagen med
// avsikt: i inbäddade och mobila vyer blockerades den tyst, vilket är
// varför alla rapporter numera går genom visaren i appen
// (useInlineReport) eller riktiga PDF-nedladdningar. Återinför den inte.
