/**
 * DOKUMENTLAGRINGEN: signeringen och regeln runt den.
 *
 * Det farligaste en signerad URL kan göra är att signeras UTAN att någon
 * frågat om läsaren får se dokumentet - då kringgår den hela radskyddet.
 * Sviten vaktar att rutten ställer den frågan (app.may_read_document) och att
 * storage_path aldrig går ut i svaret.
 */

import { DOCUMENT_URL_TTL_SECONDS, presignDocument, storageConfigured } from "../server/storage";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};

/* --- Modulen -------------------------------------------------------------- */

check("lagringen är ansluten när en hink är satt", storageConfigured() === true);
check("URL:en är kortlivad (60 s)", DOCUMENT_URL_TTL_SECONDS === 60);

// presignDocument skickar hink + sökväg + filnamn till signeraren och
// lämnar tillbaka det den ger. Ingen egen behörighetsprövning här.
{
  const sedd: { bucket?: string; path?: string; file?: string } = {};
  const url = await presignDocument("case-1/handling.pdf", "handling.pdf", async (bucket, path, file) => {
    sedd.bucket = bucket;
    sedd.path = path;
    sedd.file = file;
    return `https://minio.local/${bucket}/${path}?sig=abc`;
  });
  check("hinken skickas med till signeraren", sedd.bucket === "clearance-test-bucket", sedd.bucket);
  check("storage_path skickas till signeraren", sedd.path === "case-1/handling.pdf");
  check("filnamnet skickas med", sedd.file === "handling.pdf");
  check("den signerade URL:en returneras", url.includes("sig=abc"));
}

/* --- Rutten: ordningen som är hela poängen ------------------------------- */

const api = readFileSync(join(process.cwd(), "server/index.ts"), "utf8");
const route = api.slice(
  api.indexOf('"/v1/documents/:documentId/url"'),
  api.indexOf('"/v1/documents/:documentId/review"'),
);
check("url-rutten hittades", route.length > 100);
check("rutten frågar may_read_document innan den signerar", /may_read_document/.test(route));
const mayIdx = route.indexOf("may_read_document");
const signIdx = route.indexOf("presignDocument");
check("och den frågan kommer FÖRE signeringen", mayIdx > 0 && signIdx > 0 && mayIdx < signIdx);
check("svaret bär url och en utgångstid, inte sökvägen", /body:\s*\{\s*url/.test(route) && !/body:[^}]*storage_path/.test(route));
check("okänt/obehörigt dokument ger 404 (samma tystnad)", /notFound\(/.test(route));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
