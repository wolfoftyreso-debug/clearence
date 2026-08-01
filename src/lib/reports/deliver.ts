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

/**
 * Opens the report in a new tab where the user can print it or save it as a
 * PDF. Falls back to downloading the file when the tab cannot be opened,
 * which is usually a popup blocker - so the action never silently does
 * nothing.
 */
export const openReport = (model: ReportModel): DeliveryResult => {
  const html = renderReport(model);

  let printWindow: Window | null = null;
  try {
    // No "noopener" here: it makes window.open return null, and we need the
    // handle to write the document into. Nothing untrusted is being loaded -
    // the tab starts blank and receives markup this application rendered - so
    // there is no opener to protect against.
    printWindow = window.open("", "_blank");
  } catch {
    printWindow = null;
  }

  if (!printWindow) return downloadReport(model);

  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    return { ok: true, via: "print-window" };
  } catch {
    // Some environments hand back a window that cannot be written to.
    printWindow.close();
    return downloadReport(model);
  }
};
