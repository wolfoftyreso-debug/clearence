/**
 * ReportModel → PDF.
 *
 * Samma datamodell som HTML-renderingen, samma innehåll i samma ordning -
 * PDF:en är inte en skärmdump av sidan utan en egen, ren sättning av
 * rapporten. Tabeller sätts som vänster/höger-rader (beskrivning till
 * vänster, belopp högerställt), precis vad fakturor och frister behöver.
 */

import { PdfWriter } from "@/lib/pdf";
import type { ReportBlock, ReportModel } from "./types";

const swedishDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

const renderBlock = (pdf: PdfWriter, block: ReportBlock): void => {
  switch (block.kind) {
    case "paragraph":
      pdf.text(block.text);
      break;
    case "keyValues":
      for (const item of block.items) {
        pdf.row(item.label, item.value, { font: "bold", size: 10.5 });
        if (item.note) pdf.text(item.note, { size: 9, gray: 0.4, indent: 12 });
      }
      pdf.space(4);
      break;
    case "figures":
      for (const item of block.items) {
        pdf.row(item.label, item.value, { font: "bold" });
        if (item.note) pdf.text(item.note, { size: 9, gray: 0.4, indent: 12 });
      }
      pdf.space(4);
      break;
    case "table": {
      if (block.rows.length === 0) {
        if (block.emptyText) pdf.text(block.emptyText, { gray: 0.4, size: 9.5 });
        break;
      }
      const lastCol = block.columns.length - 1;
      pdf.row(
        block.columns.slice(0, lastCol).map((c) => c.label).join("  ·  "),
        block.columns[lastCol]?.label ?? "",
        { size: 9, gray: 0.4 },
      );
      pdf.rule(0.85);
      for (const row of block.rows) {
        pdf.row(row.cells.slice(0, lastCol).join("  ·  "), row.cells[lastCol] ?? "");
      }
      if (block.totals) {
        pdf.rule(0.85);
        pdf.row(
          block.totals.slice(0, lastCol).join("  ·  "),
          block.totals[lastCol] ?? "",
          { font: "bold" },
        );
      }
      pdf.space(4);
      break;
    }
    case "list": {
      block.items.forEach((item, index) => {
        const marker = block.ordered ? `${index + 1}.` : "•";
        pdf.text(`${marker}  ${item.text}`, {
          font: item.emphasis ? "bold" : "regular",
          indent: 4,
        });
        if (item.note) pdf.text(item.note, { size: 9, gray: 0.4, indent: 18 });
      });
      pdf.space(4);
      break;
    }
    case "callout":
      pdf.rule(0.6);
      pdf.text(block.title, { font: "bold", size: 10.5 });
      pdf.text(block.body);
      if (block.legalRef) pdf.text(block.legalRef, { size: 9, gray: 0.4 });
      pdf.rule(0.6);
      break;
  }
};

export const renderReportPdf = (model: ReportModel): Uint8Array => {
  const who = model.meta.companyName ?? model.meta.orgNumber ?? "";
  const pdf = new PdfWriter(`Clearance · ${model.meta.documentTitle}${who ? ` · ${who}` : ""}`);

  pdf.text(model.meta.documentTitle, { font: "bold", size: 17, spaceAfter: 2 });
  const metaLine = [
    model.meta.companyName,
    model.meta.orgNumber ? `Org.nr ${model.meta.orgNumber}` : null,
    model.meta.reference ? `Ref ${model.meta.reference}` : null,
    swedishDate(model.meta.generatedAt),
  ]
    .filter(Boolean)
    .join("  ·  ");
  pdf.text(metaLine, { size: 9, gray: 0.4, spaceAfter: 6 });
  pdf.rule();
  pdf.space(6);

  for (const block of model.lead) renderBlock(pdf, block);

  for (const section of model.sections) {
    pdf.space(8);
    pdf.text(section.title, { font: "bold", size: 12.5, spaceAfter: 2 });
    if (section.intro) pdf.text(section.intro, { size: 9.5, gray: 0.35 });
    for (const block of section.blocks) renderBlock(pdf, block);
  }

  pdf.space(10);
  pdf.rule();
  pdf.text(model.disclaimer, { size: 8.5, gray: 0.4 });

  return pdf.toBytes();
};
