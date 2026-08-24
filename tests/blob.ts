/**
 * VERCEL BLOB, körd på riktigt - så långt det går härifrån.
 *
 * tests/lagring.ts reser en S3-dubbel och kör hela tvåstegsuppladdningen
 * genom AWS-SDK:n. Den här sviten gör samma sak för Blob: reser en dubbel
 * av Blobs KONTROLL-API (den som `VERCEL_BLOB_API_URL` pekar ut) och kör
 * signeringen, den presignerade PUT:en, HEAD och DELETE genom den RIKTIGA
 * @vercel/blob-SDK:n över RIKTIG HTTP.
 *
 * VAD SOM INTE PRÖVAS HÄR, sagt rakt ut:
 *
 *  1. Blobs egna objektvärd (`<butik>.private.blob.vercel-storage.com`) är
 *     hårdkodad i SDK:n och går inte att peka om. Nedladdnings-URL:en
 *     granskas därför till sin FORM - värd, sökväg, signatur, utgångstid -
 *     men hämtas inte. `laesForstaBytes` läsning mot den värden är av
 *     samma skäl inte körd; det som ÄR kört är strömklippningen
 *     (`forstaBytesUrStrom`), som är den del av den vi själva skrivit.
 *  2. Att den riktiga tjänsten svarar likadant som dubbeln. En dubbel är
 *     inte Vercel Blob, och den skillnaden går bara att köra bort mot en
 *     riktig butik.
 *
 * Det som ÄR prövat: att vi bildar rätt delegation (rätt sökväg, rätt
 * operation, rätt tak), att den presignerade PUT:en fungerar över tråden,
 * att storleken vi läser tillbaka är den lagrade, och att en avvisad fil
 * verkligen försvinner.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

const b64url = (s: string): string =>
  Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/* --- En dubbel av Blobs kontroll-API ------------------------------------ */

const BUTIK = "prov1234";

type Objekt = { bytes: Buffer; contentType: string };
const objekt = new Map<string, Objekt>();
const settaAnrop: string[] = [];
const signeringar: Record<string, unknown>[] = [];

const kropp = async (req: IncomingMessage): Promise<Buffer> => {
  const bitar: Buffer[] = [];
  for await (const d of req) bitar.push(d as Buffer);
  return Buffer.concat(bitar);
};

const svara = (res: ServerResponse, status: number, kropp: unknown) => {
  const text = JSON.stringify(kropp);
  res.writeHead(status, { "content-type": "application/json", "content-length": String(Buffer.byteLength(text)) });
  res.end(text);
};

const blobDubbel = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", "http://x");
    settaAnrop.push(`${req.method} ${url.pathname}`);

    // 1. Delegationen: POST /signed-token
    if (req.method === "POST" && url.pathname === "/signed-token") {
      const bod = JSON.parse((await kropp(req)).toString("utf8") || "{}") as Record<string, unknown>;
      signeringar.push(bod);
      const validUntil = Number(bod.validUntil ?? Date.now() + 3600_000);
      const delegationToken = `${b64url(JSON.stringify({ storeId: `store_${BUTIK}`, ...bod }))}.provsignatur`;
      return svara(res, 200, {
        delegationToken,
        clientSigningToken: b64url("provnyckel-for-hmac"),
        validUntil,
      });
    }

    // 2. Radering: POST /delete
    if (req.method === "POST" && url.pathname === "/delete") {
      const bod = JSON.parse((await kropp(req)).toString("utf8") || "{}") as { urls?: string[] };
      for (const u of bod.urls ?? []) objekt.delete(u);
      return svara(res, 200, {});
    }

    // 3. Den presignerade uppladdningen: PUT /?pathname=...
    if (req.method === "PUT") {
      const vag = url.searchParams.get("pathname") ?? "";
      if (!url.searchParams.get("vercel-blob-signature")) {
        return svara(res, 401, { error: { code: "not_allowed", message: "osignerad" } });
      }
      const data = await kropp(req);
      objekt.set(vag, { bytes: data, contentType: String(req.headers["content-type"] ?? "") });
      return svara(res, 200, {
        url: `https://${BUTIK}.private.blob.vercel-storage.com/${vag}`,
        downloadUrl: `https://${BUTIK}.private.blob.vercel-storage.com/${vag}?download=1`,
        pathname: vag,
        contentType: String(req.headers["content-type"] ?? ""),
        contentDisposition: `attachment; filename="${vag.split("/").pop() ?? ""}"`,
      });
    }

    // 4. HEAD görs som GET /?url=<sökväg>
    if (req.method === "GET") {
      const vag = url.searchParams.get("url") ?? "";
      const o = objekt.get(vag);
      if (!o) return svara(res, 404, { error: { code: "not_found", message: "finns inte" } });
      return svara(res, 200, {
        url: `https://${BUTIK}.private.blob.vercel-storage.com/${vag}`,
        downloadUrl: `https://${BUTIK}.private.blob.vercel-storage.com/${vag}?download=1`,
        pathname: vag,
        size: o.bytes.length,
        contentType: o.contentType,
        contentDisposition: `attachment; filename="${vag.split("/").pop() ?? ""}"`,
        cacheControl: "public, max-age=31536000",
        uploadedAt: new Date(0).toISOString(),
        etag: "provetag",
      });
    }

    return svara(res, 405, { error: { code: "not_allowed", message: "nej" } });
  })();
});

await new Promise<void>((klar) => blobDubbel.listen(0, "127.0.0.1", klar));
const port = (blobDubbel.address() as AddressInfo).port;

/* --- Miljön måste sättas FÖRE modulen läses ----------------------------- */

process.env.VERCEL_BLOB_API_URL = `http://127.0.0.1:${port}`;
process.env.VERCEL_BLOB_RETRIES = "0";
process.env.BLOB_READ_WRITE_TOKEN = `vercel_blob_rw_${BUTIK}_hemlighet`;
delete process.env.STORAGE_BACKEND;
delete process.env.DOCUMENTS_BUCKET;

const lagring = await import("../server/storage");
const { provaFil, sakerLagringsvag, MAX_FILSTORLEK } = await import("../server/filtyper");

/* --- 1. Vilket ryggstöd valdes, och varför? ----------------------------- */

check("blob väljs när ett Blob-kreditiv finns", lagring.valdRyggstod() === "blob", lagring.valdRyggstod());
check("lagringen rapporteras ansluten", lagring.storageConfigured() === true);

process.env.STORAGE_BACKEND = "s3";
check("STORAGE_BACKEND=s3 väger tyngre än kreditivet", lagring.valdRyggstod() === "s3");
check("men utan hink är s3 inte ansluten", lagring.storageConfigured() === false);
process.env.STORAGE_BACKEND = "minio";
check("ett okänt värde ger INGEN lagring, inte en gissning", lagring.valdRyggstod() === "ingen");
check("och /health säger då 'inte ansluten'", lagring.storageConfigured() === false);
delete process.env.STORAGE_BACKEND;
check("utan STORAGE_BACKEND är blob tillbaka", lagring.valdRyggstod() === "blob");

/* --- 2. Sökvägen i butiken ---------------------------------------------- */

check("utan prefix är butikssökvägen exakt storage_path", lagring.blobVag("", "a/b/c.pdf") === "a/b/c.pdf");
check("med prefix läggs det först", lagring.blobVag("clearance", "a/b.pdf") === "clearance/a/b.pdf");
check("snedstreck i prefixet dubbleras inte", lagring.blobVag("/clearance/", "a/b.pdf") === "clearance/a/b.pdf");

/* --- 3. Strömklippningen: fem tecken, inte tjugofem megabyte ------------ */

const strommaAv = (...bitar: Uint8Array[]): { strom: ReadableStream<Uint8Array>; avbrutet: () => boolean } => {
  let avbrutet = false;
  let i = 0;
  const strom = new ReadableStream<Uint8Array>({
    pull(styrning) {
      if (i < bitar.length) styrning.enqueue(bitar[i++]);
      else styrning.close();
    },
    cancel() {
      avbrutet = true;
    },
  });
  return { strom, avbrutet: () => avbrutet };
};

{
  const bit = (n: number, v: number) => new Uint8Array(n).fill(v);
  const { strom, avbrutet } = strommaAv(bit(8, 1), bit(8, 2), bit(8, 3));
  const ut = await lagring.forstaBytesUrStrom(strom, 10);
  check("klippningen ger exakt så många bytes som begärdes", ut.length === 10, ut.length);
  check("och det är de FÖRSTA bytesen, i ordning", ut[0] === 1 && ut[7] === 1 && ut[8] === 2 && ut[9] === 2);
  check("resten av strömmen släpps (cancel)", avbrutet() === true);
}
{
  const { strom } = strommaAv(new Uint8Array([1, 2, 3]));
  const ut = await lagring.forstaBytesUrStrom(strom, 1024);
  check("en kortare fil ger det den har, inte ett kast", ut.length === 3);
}
{
  const { strom } = strommaAv();
  const ut = await lagring.forstaBytesUrStrom(strom, 1024);
  check("en tom fil ger noll bytes, inte ett kast", ut.length === 0);
}

/* --- 4. Uppladdningen: delegation, presignerad PUT, riktig HTTP --------- */

const CASE = "aaaaaaaa-0000-0000-0000-00000000000a";
const VAG = sakerLagringsvag(CASE, "årsredovisning 2026.pdf", "1111");
check("filnamnet är sökvägens sista led (Blob läser det därifrån)", VAG.endsWith("/arsredovisning-2026.pdf"), VAG);

signeringar.length = 0;
const uploadUrl = await lagring.presignUpload(VAG, "application/pdf");

check("uppladdnings-URL:en pekar på kontroll-API:t", uploadUrl.startsWith(`http://127.0.0.1:${port}/`), uploadUrl.slice(0, 60));
{
  const u = new URL(uploadUrl);
  check("den bär en signatur", (u.searchParams.get("vercel-blob-signature") ?? "").length > 10);
  check("och en delegation", (u.searchParams.get("vercel-blob-delegation") ?? "").length > 10);
  check("sökvägen är vår, inte klientens", u.searchParams.get("pathname") === VAG);
  check("överskrivning är förbjuden", u.searchParams.get("vercel-blob-allow-overwrite") === "false");
  check("slumpsuffix är avstängt (sökvägen ska vara den vi lagrat)", u.searchParams.get("vercel-blob-add-random-suffix") === "false");
  check("innehållstypen är låst", u.searchParams.get("vercel-blob-allowed-content-types") === "application/pdf");
  const tak = Number(u.searchParams.get("vercel-blob-maximum-size-in-bytes"));
  check("en maxstorlek är satt", Number.isFinite(tak) && tak > 0, tak);
  // Utgångstiden skrivs INTE som en egen parameter när den är samma som
  // delegationens tak - SDK:n utelämnar den då och CDN:et faller tillbaka
  // på delegationen. Den prövas därför där den faktiskt sitter: i det vi
  // bad kontroll-API:t om.
  const param = u.searchParams.get("vercel-blob-valid-until");
  check("ingen utgångstid SENARE än delegationens smugit in", param === null || Number(param) <= Number(signeringar[0]?.validUntil), param);
}
{
  const d = signeringar[0] ?? {};
  check("delegationen gäller BARA den här sökvägen", d.pathname === VAG, d.pathname);
  check("och BARA put - inte läsning, inte radering", JSON.stringify(d.operations) === '["put"]', d.operations);
  check("taken följer med in i delegationen", d.maximumSizeInBytes === MAX_FILSTORLEK, d.maximumSizeInBytes);
  check("innehållstypen låses redan i delegationen", JSON.stringify(d.allowedContentTypes) === '["application/pdf"]', d.allowedContentTypes);
  const kvar = (Number(d.validUntil) - Date.now()) / 1000;
  check("uppladdningen går ut inom två minuter", kvar > 0 && kvar <= lagring.UPLOAD_URL_TTL_SECONDS, kvar);
}

/* --- 5. ANGREPPET: en Linux-binär som "arsredovisning.pdf" -------------- */

const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);

const putSvar = await fetch(uploadUrl, {
  method: "PUT",
  body: ELF,
  headers: { "content-type": "application/pdf" },
});
check("den presignerade PUT:en accepteras av lagringen", putSvar.ok, putSvar.status);
check("och filen ligger nu i butiken", objekt.has(VAG));

const huvud = await lagring.laesHuvud(VAG);
check("HEAD ger den LAGRADE storleken", huvud?.storlek === ELF.length, huvud);

const domen = provaFil({
  filnamn: "arsredovisning.pdf",
  mimetyp: "application/pdf",
  storlek: huvud?.storlek ?? 0,
  bytes: new Uint8Array(ELF),
});
check("PRÖVNINGEN AVVISAR den förklädda binären", domen.ok === false, domen);

await lagring.taBortObjekt(VAG);
check("den avvisade filen är BORTA ur butiken", !objekt.has(VAG));

/* --- 6. Den riktiga filen ska gå hela vägen ----------------------------- */

const PDF = Buffer.concat([
  Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]),
  Buffer.alloc(2000, 0x41),
]);
const VAG2 = sakerLagringsvag(CASE, "årsredovisning 2026.pdf", "2222");

const url2 = await lagring.presignUpload(VAG2, "application/pdf");
const put2 = await fetch(url2, { method: "PUT", body: PDF, headers: { "content-type": "application/pdf" } });
check("ett riktigt PDF laddas upp", put2.ok, put2.status);

const huvud2 = await lagring.laesHuvud(VAG2);
check("storleken läses tillbaka rätt", huvud2?.storlek === PDF.length, { fick: huvud2?.storlek, vantat: PDF.length });
const dom2 = provaFil({
  filnamn: "årsredovisning 2026.pdf",
  mimetyp: "application/pdf",
  storlek: huvud2?.storlek ?? 0,
  bytes: new Uint8Array(PDF.subarray(0, 1024)),
});
check("PRÖVNINGEN GODKÄNNER det riktiga dokumentet", dom2.ok === true, dom2);

/* --- 7. Nedladdningen: formen på den signerade URL:en -------------------- */

signeringar.length = 0;
const nedladdning = await lagring.presignDocument(VAG2, "årsredovisning 2026.pdf");
{
  const u = new URL(nedladdning);
  check("nedladdningen går till butikens PRIVATA värd", u.hostname === `${BUTIK}.private.blob.vercel-storage.com`, u.hostname);
  check("och till exakt vår sökväg", decodeURIComponent(u.pathname) === `/${VAG2}`, u.pathname);
  check("URL:en är signerad", (u.searchParams.get("vercel-blob-signature") ?? "").length > 10);
  const d = signeringar[0] ?? {};
  const kvar = (Number(d.validUntil) - Date.now()) / 1000;
  check("den går ut inom en minut", kvar > 0 && kvar <= lagring.DOCUMENT_URL_TTL_SECONDS, kvar);
  check("läsdelegationen gäller BARA den sökvägen", d.pathname === VAG2, d.pathname);
  check("och BARA get - aldrig put eller delete", JSON.stringify(d.operations) === '["get"]', d.operations);
}

/* --- 8. En fil som inte finns ------------------------------------------- */

check("HEAD på en okänd sökväg ger null, inte ett kast", (await lagring.laesHuvud("finns/inte.pdf")) === null);

/* --- 9. Anropen gick verkligen ut på tråden ----------------------------- */

check("delegationer begärdes", settaAnrop.filter((a) => a === "POST /signed-token").length === 3, settaAnrop);
check("en PUT gick ut", settaAnrop.some((a) => a.startsWith("PUT ")));
check("en GET (head) gick ut", settaAnrop.some((a) => a.startsWith("GET ")));
check("en DELETE gick ut", settaAnrop.some((a) => a === "POST /delete"));

blobDubbel.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
