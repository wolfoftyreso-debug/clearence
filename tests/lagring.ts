/**
 * LAGRINGSVÄGEN, körd på riktigt.
 *
 * Rond 4 byggde innehållskontrollen men lämnade en ärlig lucka: själva
 * S3-anropen var oprövade. `presignUpload`, `laesHuvud`, `laesForstaBytes`
 * och `taBortObjekt` såg rimliga ut och hade aldrig kört.
 *
 * Den här sviten reser en S3-kompatibel server i processen och kör hela
 * tvåstegsuppladdningen genom den RIKTIGA AWS-SDK:n över RIKTIG HTTP:
 * presignering, PUT, HEAD, intervall-GET och DELETE. Det som prövas är vår
 * kod och SDK:ns trådbeteende.
 *
 * VAD SOM INTE PRÖVAS HÄR, sagt rakt ut: MinIO:s egna egenheter. En
 * S3-dubbel är inte MinIO, och den skillnaden går inte att testa bort -
 * bara att köra mot en riktig MinIO. Det som ÄR prövat är att vi bildar
 * rätt anrop, att en presignerad URL fungerar, och att bytesen vi läser
 * tillbaka är de som skrevs.
 *
 * Det avgörande fallet: en Linux-binär laddas upp genom en giltig,
 * presignerad URL med namnet "arsredovisning.pdf" - och bekräftelsesteget
 * ska AVVISA den och TA BORT den ur hinken.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

/* --- En S3-kompatibel dubbel -------------------------------------------- */

const objekt = new Map<string, { bytes: Buffer; contentType: string }>();
const settaAnrop: string[] = [];

const s3Dubbel = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", "http://x");
  // Path style (som mot MinIO): /<hink>/<objektnyckel>. Hinken skalas bort
  // så kartan nycklas på objektnyckeln - samma som koden skickar in.
  const segment = decodeURIComponent(url.pathname.replace(/^\//, "")).split("/");
  const nyckel = segment.slice(1).join("/");
  settaAnrop.push(`${req.method} ${url.pathname}`);

  if (req.method === "PUT") {
    const bitar: Buffer[] = [];
    req.on("data", (d) => bitar.push(d as Buffer));
    req.on("end", () => {
      objekt.set(nyckel, {
        bytes: Buffer.concat(bitar),
        contentType: String(req.headers["content-type"] ?? ""),
      });
      res.writeHead(200, { etag: '"abc"' });
      res.end();
    });
    return;
  }

  const o = objekt.get(nyckel);
  if (req.method === "HEAD") {
    if (!o) return void res.writeHead(404).end();
    res.writeHead(200, { "content-length": String(o.bytes.length), "content-type": o.contentType });
    return void res.end();
  }
  if (req.method === "GET") {
    if (!o) return void res.writeHead(404).end();
    const range = /bytes=(\d+)-(\d+)/.exec(String(req.headers.range ?? ""));
    if (range) {
      const fran = Number(range[1]);
      const till = Math.min(Number(range[2]), o.bytes.length - 1);
      const bit = o.bytes.subarray(fran, till + 1);
      res.writeHead(206, {
        "content-length": String(bit.length),
        "content-range": `bytes ${fran}-${till}/${o.bytes.length}`,
      });
      return void res.end(bit);
    }
    res.writeHead(200, { "content-length": String(o.bytes.length) });
    return void res.end(o.bytes);
  }
  if (req.method === "DELETE") {
    objekt.delete(nyckel);
    return void res.writeHead(204).end();
  }
  res.writeHead(405).end();
});

await new Promise<void>((klar) => s3Dubbel.listen(0, "127.0.0.1", klar));
const port = (s3Dubbel.address() as AddressInfo).port;

/* --- Miljön måste sättas FÖRE modulen läses ----------------------------- */

// storage.ts läser env vid inläsning (hink, endpoint, nycklar är const på
// modulnivå). Ett statiskt import hade därför lästs innan raderna nedan.
process.env.DOCUMENTS_BUCKET = "clearance-prov";
process.env.S3_ENDPOINT = `http://127.0.0.1:${port}`;
process.env.S3_FORCE_PATH_STYLE = "true";
process.env.S3_REGION = "eu-north-1";
process.env.S3_ACCESS_KEY_ID = "provnyckel";
process.env.S3_SECRET_ACCESS_KEY = "provhemlighet";

const lagring = await import("../server/storage");
const { provaFil } = await import("../server/filtyper");

check("lagringen rapporteras ansluten", lagring.storageConfigured() === true);

/* --- 1. Presignerad PUT: fungerar den på riktigt? ----------------------- */

const VAG = "aaaaaaaa-0000-0000-0000-00000000000a/1111-arsredovisning.pdf";
const uploadUrl = await lagring.presignUpload(VAG, "application/pdf");

check("uppladdnings-URL:en pekar på vår endpoint", uploadUrl.startsWith(`http://127.0.0.1:${port}/`), uploadUrl.slice(0, 60));
check("den är signerad (X-Amz-Signature finns)", /X-Amz-Signature=/.test(uploadUrl));
check("den har en utgångstid", /X-Amz-Expires=\d+/.test(uploadUrl), uploadUrl.match(/X-Amz-Expires=\d+/)?.[0]);
check(
  "utgångstiden är kort (max 5 min)",
  Number(/X-Amz-Expires=(\d+)/.exec(uploadUrl)?.[1] ?? 99999) <= 300,
);
check("hinken ligger i sökvägen (path style mot MinIO)", uploadUrl.includes("/clearance-prov/"), uploadUrl.slice(0, 80));

/* --- 2. ANGREPPET: en Linux-binär som "arsredovisning.pdf" -------------- */

const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);

const putSvar = await fetch(uploadUrl, {
  method: "PUT",
  body: ELF,
  headers: { "content-type": "application/pdf" },
});
check("den presignerade PUT:en accepteras av lagringen", putSvar.ok, putSvar.status);
check("och filen ligger nu i hinken", objekt.has(VAG));

// Nu det som är hela poängen: servern läser tillbaka och prövar.
const huvud = await lagring.laesHuvud(VAG);
check("HEAD ger den LAGRADE storleken", huvud?.storlek === ELF.length, huvud);

const forsta = await lagring.laesForstaBytes(VAG, 1024);
check("intervall-GET ger bytes tillbaka", forsta !== null && forsta.length > 0, forsta?.length);
check(
  "och det är precis de bytes som skrevs",
  !!forsta && Buffer.from(forsta).subarray(0, ELF.length).equals(ELF),
  Array.from(forsta ?? []).slice(0, 8),
);

const domen = provaFil({
  filnamn: "arsredovisning.pdf",
  mimetyp: "application/pdf",
  storlek: huvud?.storlek ?? 0,
  bytes: forsta ?? new Uint8Array(0),
});
check("PRÖVNINGEN AVVISAR den förklädda binären", domen.ok === false, domen);

// Och den ska tas bort - en avvisad fil får inte ligga kvar i hinken.
await lagring.taBortObjekt(VAG);
check("den avvisade filen är BORTA ur hinken", !objekt.has(VAG));

/* --- 3. Den riktiga filen ska gå hela vägen ----------------------------- */

const PDF = Buffer.concat([
  Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]),
  Buffer.alloc(2000, 0x41),
]);
const VAG2 = "aaaaaaaa-0000-0000-0000-00000000000a/2222-arsredovisning.pdf";

const url2 = await lagring.presignUpload(VAG2, "application/pdf");
const put2 = await fetch(url2, { method: "PUT", body: PDF, headers: { "content-type": "application/pdf" } });
check("ett riktigt PDF laddas upp", put2.ok);

const huvud2 = await lagring.laesHuvud(VAG2);
const forsta2 = await lagring.laesForstaBytes(VAG2, 1024);
check("storleken läses tillbaka rätt", huvud2?.storlek === PDF.length, { fick: huvud2?.storlek, vantat: PDF.length });
check(
  "bara det begärda intervallet läses, inte hela filen",
  (forsta2?.length ?? 0) <= 1024,
  forsta2?.length,
);
const dom2 = provaFil({
  filnamn: "arsredovisning.pdf",
  mimetyp: "application/pdf",
  storlek: huvud2?.storlek ?? 0,
  bytes: forsta2 ?? new Uint8Array(0),
});
check("PRÖVNINGEN GODKÄNNER det riktiga dokumentet", dom2.ok === true, dom2);

/* --- 4. Nedladdningen: signerad, kortlivad, med filnamn ----------------- */

const nedladdning = await lagring.presignDocument(VAG2, "årsredovisning 2026.pdf");
check("nedladdnings-URL:en är signerad", /X-Amz-Signature=/.test(nedladdning));
check(
  "den går ut på 60 sekunder",
  /X-Amz-Expires=60(\D|$)/.test(nedladdning),
  nedladdning.match(/X-Amz-Expires=\d+/)?.[0],
);
check(
  "den ber om nedladdning med filnamn",
  /response-content-disposition=/i.test(nedladdning),
);
const hamtad = await fetch(nedladdning);
check("och den fungerar mot lagringen", hamtad.ok, hamtad.status);
check(
  "innehållet är filen vi laddade upp",
  Buffer.from(await hamtad.arrayBuffer()).equals(PDF),
);

/* --- 5. En fil som inte finns ------------------------------------------- */

check("HEAD på en okänd sökväg ger null, inte ett kast", (await lagring.laesHuvud("finns/inte.pdf")) === null);
check("intervall-GET på en okänd sökväg ger null", (await lagring.laesForstaBytes("finns/inte.pdf")) === null);

/* --- 6. Anropen gick verkligen ut på tråden ----------------------------- */

check("en PUT gick ut", settaAnrop.some((a) => a.startsWith("PUT ")), settaAnrop.slice(0, 3));
check("en HEAD gick ut", settaAnrop.some((a) => a.startsWith("HEAD ")));
check("en GET gick ut", settaAnrop.some((a) => a.startsWith("GET ")));
check("en DELETE gick ut", settaAnrop.some((a) => a.startsWith("DELETE ")));

s3Dubbel.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
