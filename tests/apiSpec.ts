/**
 * Kontraktstester för det öppna API:t.
 *
 * Specen är ett löfte, så den vaktas som kod: giltig struktur, ärlig
 * statusmärkning (live/beta), unika operations-id:n, fyra objekten +
 * ärendet som resurser, webhooks för realtiden, strukturerade felkoder
 * - och datagränsen (aldrig automatiska bedömningar) utskriven.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

// Körs alltid från repo-roten (npm-skriptet) - bundlens __dirname
// pekar på cache-katalogen och duger inte som utgångspunkt.
const raw = readFileSync(join(process.cwd(), "api", "openapi.json"), "utf8");
const spec = JSON.parse(raw) as {
  openapi: string;
  info: { version: string; description: string };
  servers: { url: string; description: string }[];
  paths: Record<string, Record<string, unknown>>;
  webhooks: Record<string, unknown>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
};

check("giltig JSON och OpenAPI 3.1", spec.openapi === "3.1.0");
check("versionerad med beta-märkning", spec.info.version === "1.0.0-beta");
check("sandbox-miljön finns", spec.servers.some((s) => s.url.includes("sandbox")));
check("datagränsen står i kontraktet", spec.info.description.includes("aldrig automatiska bedömningar"));
check("bakåtkompatibiliteten lovas", spec.info.description.includes("fält läggs till, aldrig bort"));

/* Resurserna: fyra objekten + ärendet + rapport + delning. */
const paths = Object.keys(spec.paths);
for (const required of [
  "/cases",
  "/cases/{caseId}",
  "/cases/{caseId}/close",
  "/cases/{caseId}/journal",
  "/cases/{caseId}/documents",
  "/documents/{documentId}/review",
  "/cases/{caseId}/decisions",
  "/decisions/{decisionId}/reconsider",
  "/cases/{caseId}/tasks",
  "/cases/{caseId}/report",
  "/cases/{caseId}/share-links",
  "/shared/{token}",
]) {
  check(`resursen ${required} finns`, paths.includes(required));
}

/* Varje operation: operationId, sammanfattning och ÄRLIG statusmärkning. */
const ops: { id: string; status: string }[] = [];
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, def] of Object.entries(methods)) {
    if (method === "parameters") continue;
    const operation = def as { operationId?: string; summary?: string; "x-status"?: string };
    check(`${method.toUpperCase()} ${path} har operationId`, !!operation.operationId);
    check(`${method.toUpperCase()} ${path} har statusmärkning`, operation["x-status"] === "live" || operation["x-status"] === "beta");
    ops.push({ id: operation.operationId ?? "", status: operation["x-status"] ?? "" });
  }
}
check("operations-id:na är unika", new Set(ops.map((o) => o.id)).size === ops.length);
check("live-länkens läsning är live idag", (spec.paths["/shared/{token}"].get as { "x-status": string })["x-status"] === "live");
/* Journalen är den första nyckelburna resursen i drift (api_journal). */
const journalOp = spec.paths["/cases/{caseId}/journal"].get as { "x-status": string; description?: string };
check("journalens läsning är live idag", journalOp["x-status"] === "live");
check("journalens datagräns är utskriven", /utan before\/after|aldrig automatiska bedömningar/i.test(journalOp.description ?? ""));
check("journalens tystnadsprincip är utskriven", /samma tystnad/i.test(journalOp.description ?? ""));

/* Realtiden: webhooks för journalens händelser. */
for (const event of [
  "document.created",
  "document.review_changed",
  "case.status_changed",
  "decision.recorded",
  "decision.reconsidered",
  "report.generated",
  "task.completed",
]) {
  check(`webhooken ${event} är deklarerad`, event in spec.webhooks);
}

/* Felkoderna: strukturerade och uppräknade. */
const errorSchema = spec.components.schemas.Error as {
  properties: { code: { enum: string[] } };
};
check("felkoderna är uppräknade", errorSchema.properties.code.enum.length >= 6);
check("betalväggen har en egen felkod", errorSchema.properties.code.enum.includes("payment_required"));

/* Fyra objekten som scheman + beslutets premiss. */
for (const schema of ["Case", "JournalEvent", "Document", "Decision", "Task", "ShareLink", "SharedCaseView", "Error"]) {
  check(`schemat ${schema} finns`, schema in spec.components.schemas);
}
const decision = spec.components.schemas.Decision as { properties: { premise: { description: string } } };
check("beslutets premiss är dokumenterad", decision.properties.premise.description.includes("Omprövningsvillkoret"));
check("ordet AI förekommer inte", !/\bAI\b/i.test(raw));

/* --- Ärendet som API:et lämnar ifrån sig måste vara HELT ----------------- */

/*
 * Adaptern castar API-svaret rakt till CaseRecord. Ett fält som saknas i
 * serialiseraren blir därför inte ett tomt värde utan ett löfte som inte
 * hålls - och läsaren som gör recommendationReasons[0] kraschar. Det tog
 * ner hela översikten en gång; kontrollen finns för att det inte ska
 * kunna hända igen.
 */
const apiSource = readFileSync(join(process.cwd(), "api/server/index.ts"), "utf8");
const toCaseBlock = apiSource.slice(
  apiSource.indexOf("const toCase = (row"),
  apiSource.indexOf("const toDecision = (row"),
);
const typesSource = readFileSync(join(process.cwd(), "src/data/types.ts"), "utf8");
const caseBlock = typesSource.slice(
  typesSource.indexOf("export interface CaseRecord {"),
  typesSource.indexOf("export type NewCase"),
);
const contractFields = [...caseBlock.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
check("CaseRecord-fälten hittades", contractFields.length > 20, contractFields.length);

const missing = contractFields.filter((f) => !new RegExp(`\\b${f}:`).test(toCaseBlock));
check(
  "API:ets toCase bär hela CaseRecord",
  missing.length === 0,
  `saknas: ${missing.join(", ")}`,
);

// Listorna får aldrig vara undefined - läsaren indexerar dem.
for (const listField of ["recommendationReasons", "recommendationNextSteps"]) {
  check(
    `${listField} normaliseras till en array`,
    new RegExp(`${listField}:\\s*asStringArray`).test(toCaseBlock),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
