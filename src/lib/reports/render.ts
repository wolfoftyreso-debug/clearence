/**
 * Renders a ReportModel to a standalone, printable HTML document.
 *
 * Pure and dependency-free, so it can be tested in node and so the produced
 * file works with no network - it has to survive being emailed to an advisor
 * and opened somewhere we know nothing about.
 *
 * The design follows the application: A4, flat, hairline rules, no colour
 * used for decoration. Tone colours survive printing because they carry
 * meaning (a critical deadline must not turn grey), which is what
 * print-color-adjust is for.
 */

import type { ReportBlock, ReportModel, ReportSection, Tone } from "./types";

/**
 * Values reach this from user input and, for company names, from a public
 * register. Everything is escaped before it goes into the document.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const TONE_COLOUR: Record<Tone, string> = {
  neutral: "#1f2937",
  good: "#0f6b46",
  warning: "#8a5a00",
  critical: "#a3161b",
};

const TONE_SURFACE: Record<Tone, string> = {
  neutral: "#f6f6f4",
  good: "#eef7f2",
  warning: "#fdf6e7",
  critical: "#fcf0f0",
};

const TONE_BORDER: Record<Tone, string> = {
  neutral: "#d9d9d4",
  good: "#a8cfbc",
  warning: "#e6c98a",
  critical: "#e2a9ab",
};

const formatGeneratedAt = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

const renderBlock = (block: ReportBlock): string => {
  switch (block.kind) {
    case "paragraph":
      return `<p class="para">${escapeHtml(block.text)}</p>`;

    case "keyValues":
      return `<dl class="kv">${block.items
        .map(
          (item) => `<div class="kv-row">
  <dt>${escapeHtml(item.label)}</dt>
  <dd class="tone-${item.tone ?? "neutral"}">${escapeHtml(item.value)}${
    item.note ? `<span class="kv-note">${escapeHtml(item.note)}</span>` : ""
  }</dd>
</div>`,
        )
        .join("")}</dl>`;

    case "figures":
      return `<div class="figures">${block.items
        .map(
          (item) => `<div class="figure">
  <p class="figure-value tone-${item.tone ?? "neutral"}">${escapeHtml(item.value)}</p>
  <p class="figure-label">${escapeHtml(item.label)}</p>
  ${item.note ? `<p class="figure-note">${escapeHtml(item.note)}</p>` : ""}
</div>`,
        )
        .join("")}</div>`;

    case "table": {
      if (block.rows.length === 0) {
        return `<p class="empty">${escapeHtml(
          block.emptyText ?? "Inga poster angivna.",
        )}</p>`;
      }
      const head = block.columns
        .map(
          (c) =>
            `<th class="${c.align === "right" ? "right" : "left"}${
              c.numeric ? " num" : ""
            }">${escapeHtml(c.label)}</th>`,
        )
        .join("");
      const body = block.rows
        .map(
          (row) =>
            `<tr>${row.cells
              .map((cell, i) => {
                const col = block.columns[i];
                return `<td class="${col?.align === "right" ? "right" : "left"}${
                  col?.numeric ? " num" : ""
                } tone-${row.tone ?? "neutral"}">${escapeHtml(cell)}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("");
      const totals = block.totals
        ? `<tfoot><tr>${block.totals
            .map((cell, i) => {
              const col = block.columns[i];
              return `<td class="${col?.align === "right" ? "right" : "left"}${
                col?.numeric ? " num" : ""
              }">${escapeHtml(cell)}</td>`;
            })
            .join("")}</tr></tfoot>`
        : "";
      return `<table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${totals}</table>`;
    }

    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag} class="list">${block.items
        .map(
          (item) =>
            `<li class="${item.emphasis ? "emphasis" : ""}">${escapeHtml(item.text)}${
              item.note ? `<span class="list-note">${escapeHtml(item.note)}</span>` : ""
            }</li>`,
        )
        .join("")}</${tag}>`;
    }

    case "callout":
      return `<div class="callout tone-surface-${block.tone}">
  <p class="callout-title">${escapeHtml(block.title)}</p>
  <p class="callout-body">${escapeHtml(block.body)}</p>
  ${block.legalRef ? `<p class="callout-ref">${escapeHtml(block.legalRef)}</p>` : ""}
</div>`;
  }
};

const renderSection = (section: ReportSection): string => `
<section class="section">
  <h2>${escapeHtml(section.title)}</h2>
  ${section.intro ? `<p class="section-intro">${escapeHtml(section.intro)}</p>` : ""}
  ${section.blocks.map(renderBlock).join("\n")}
</section>`;

export const renderReport = (model: ReportModel): string => {
  const { meta } = model;
  const identity = [meta.companyName, meta.orgNumber].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CLEARANCE – ${escapeHtml(meta.documentTitle)}${
    meta.companyName ? ` – ${escapeHtml(meta.companyName)}` : ""
  }</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }

  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0 auto;
    max-width: 190mm;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1f2937;
    background: #ffffff;
  }

  /* Tone colours carry meaning - a critical deadline must not print grey. */
  .tone-neutral { color: ${TONE_COLOUR.neutral}; }
  .tone-good { color: ${TONE_COLOUR.good}; }
  .tone-warning { color: ${TONE_COLOUR.warning}; }
  .tone-critical { color: ${TONE_COLOUR.critical}; }

  .tone-surface-neutral { background: ${TONE_SURFACE.neutral}; border-color: ${TONE_BORDER.neutral}; }
  .tone-surface-good { background: ${TONE_SURFACE.good}; border-color: ${TONE_BORDER.good}; }
  .tone-surface-warning { background: ${TONE_SURFACE.warning}; border-color: ${TONE_BORDER.warning}; }
  .tone-surface-critical { background: ${TONE_SURFACE.critical}; border-color: ${TONE_BORDER.critical}; }

  header.doc {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    padding-bottom: 12px;
    border-bottom: 2px solid #1f3a5f;
    margin-bottom: 22px;
  }
  .brand { font-size: 15pt; font-weight: 700; letter-spacing: 0.06em; color: #1f3a5f; }
  .brand-sub { font-size: 8pt; color: #6b7280; letter-spacing: 0.02em; margin-top: 2px; }
  .doc-meta { text-align: right; font-size: 8.5pt; color: #6b7280; }
  .doc-meta strong { display: block; color: #1f2937; font-size: 10pt; }

  h1 { font-size: 17pt; margin: 0 0 4px; letter-spacing: -0.01em; }
  .identity { font-size: 10pt; color: #4b5563; margin: 0 0 20px; }

  h2 {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #6b7280;
    margin: 0 0 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #e5e7eb;
  }
  .section { margin-top: 22px; break-inside: avoid; }
  .section-intro { margin: 0 0 10px; color: #4b5563; }
  .para { margin: 0 0 10px; }

  .kv { margin: 0; }
  .kv-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 5px 0;
    border-bottom: 1px solid #f0f0ee;
  }
  .kv-row:last-child { border-bottom: 0; }
  .kv dt { color: #6b7280; }
  .kv dd { margin: 0; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
  .kv-note { display: block; font-weight: 400; font-size: 8.5pt; color: #6b7280; }

  .figures { display: flex; gap: 10px; flex-wrap: wrap; }
  .figure {
    flex: 1 1 150px;
    border: 1px solid #e5e7eb;
    padding: 10px 12px;
  }
  .figure-value { margin: 0; font-size: 16pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .figure-label { margin: 2px 0 0; font-size: 9pt; color: #4b5563; }
  .figure-note { margin: 1px 0 0; font-size: 8pt; color: #6b7280; }

  .table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .table th {
    text-align: left;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
    font-weight: 600;
    padding: 0 8px 5px 0;
    border-bottom: 1px solid #d1d5db;
  }
  .table td { padding: 5px 8px 5px 0; border-bottom: 1px solid #f0f0ee; vertical-align: top; }
  .table tfoot td {
    font-weight: 700;
    border-top: 1px solid #d1d5db;
    border-bottom: 0;
    padding-top: 7px;
  }
  .table .right { text-align: right; padding-right: 0; }
  .table .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .empty { color: #6b7280; font-style: italic; margin: 0; }

  .list { margin: 0; padding-left: 18px; }
  .list li { margin-bottom: 6px; }
  .list li.emphasis { font-weight: 600; }
  .list-note { display: block; font-weight: 400; font-size: 8.5pt; color: #6b7280; }

  .callout {
    border: 1px solid;
    border-left-width: 3px;
    padding: 10px 12px;
    margin: 0 0 10px;
    break-inside: avoid;
  }
  .callout-title { margin: 0; font-weight: 700; font-size: 10pt; }
  .callout-body { margin: 3px 0 0; font-size: 9.5pt; }
  .callout-ref { margin: 5px 0 0; font-size: 8.5pt; color: #4b5563; font-style: italic; }

  .disclaimer {
    margin-top: 26px;
    padding-top: 10px;
    border-top: 1px solid #d1d5db;
    font-size: 8.5pt;
    color: #4b5563;
    line-height: 1.5;
    break-inside: avoid;
  }
  .disclaimer strong { color: #1f2937; }

  footer.doc {
    margin-top: 14px;
    font-size: 7.5pt;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .print-bar {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: #1f3a5f;
    color: #ffffff;
    padding: 10px 14px;
    margin: -24px -24px 22px;
    font-size: 9.5pt;
  }
  .print-bar button {
    font: inherit;
    font-weight: 600;
    background: #ffffff;
    color: #1f3a5f;
    border: 0;
    padding: 7px 14px;
    cursor: pointer;
  }
  .print-bar button:hover { background: #e8eef5; }

  @media print {
    body { padding: 0; max-width: none; }
    .print-bar { display: none; }
    /* Tones are information here, not decoration. */
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="print-bar">
  <span>Välj <strong>Spara som PDF</strong> som destination i utskriftsdialogen.</span>
  <button type="button" onclick="window.print()">Skriv ut / spara som PDF</button>
</div>

<header class="doc">
  <div>
    <div class="brand">CLEARANCE</div>
    <div class="brand-sub">Vägledning vid företagskris</div>
  </div>
  <div class="doc-meta">
    <strong>${escapeHtml(meta.documentTitle)}</strong>
    ${meta.reference ? `Referens: ${escapeHtml(meta.reference)}<br>` : ""}
    Upprättad ${escapeHtml(formatGeneratedAt(meta.generatedAt))}
  </div>
</header>

<h1>${escapeHtml(meta.documentTitle)}</h1>
${identity ? `<p class="identity">${escapeHtml(identity)}</p>` : ""}

${model.lead.map(renderBlock).join("\n")}

${model.sections.map(renderSection).join("\n")}

<div class="disclaimer">
  <strong>Ansvarsfriskrivning.</strong> ${escapeHtml(model.disclaimer)}
</div>

<footer class="doc">
  <span>CLEARANCE – ${escapeHtml(meta.documentTitle)}</span>
  <span>Upprättad ${escapeHtml(formatGeneratedAt(meta.generatedAt))}</span>
</footer>
</body>
</html>`;
};
