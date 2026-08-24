/**
 * DOKUMENTLAGRINGEN: en signerad, kortlivad URL - aldrig sökvägen.
 *
 * Filerna ligger i objektlagring, inte i databasen. `public.case_documents`
 * vet VAD som finns och VEM som får se det; app.may_read_document() är den
 * enda fråga API:t ställer innan en URL signeras (index.ts). Den här filen
 * gör bara det sista steget: växlar en storage_path mot en presignerad
 * GET-URL som går ut på 60 sekunder.
 *
 * TVÅ REGLER:
 *  1. storage_path lämnar ALDRIG servern. Bara den signerade URL:en gör det,
 *     och den slutar fungera efter en minut.
 *  2. Ryggstödet är utbytbart. `blob` = Vercel Blob (det driften använder),
 *     `s3` = S3-kompatibel hink (AWS eller MinIO). Samma kontrakt utåt,
 *     samma säkerhetsmodell, olika leverantör.
 *
 * VAL AV RYGGSTÖD sker med driftparametern STORAGE_BACKEND. Är den osatt
 * väljs blob när ett Blob-kreditiv finns, annars s3 när en hink finns.
 * Ett okänt värde ger INGEN lagring alls - hellre ett tydligt "inte
 * ansluten" i /health och 404 på dokumentrutterna än att filer tyst hamnar
 * i fel ände av världen.
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MAX_FILSTORLEK } from "./filtyper";

const miljo = (namn: string): string => (process.env[namn] ?? "").trim();

/* --- Vilket ryggstöd är det som gäller? ---------------------------------- */

export type Ryggstod = "blob" | "s3" | "ingen";

/** Blob-kreditiv: läs-skriv-token, eller OIDC tillsammans med ett store-id. */
const blobKreditiv = (): boolean =>
  miljo("BLOB_READ_WRITE_TOKEN").length > 0 ||
  (miljo("VERCEL_OIDC_TOKEN").length > 0 && miljo("BLOB_STORE_ID").length > 0);

const s3Hink = (): string => miljo("DOCUMENTS_BUCKET");

let varnat = false;
export const valdRyggstod = (): Ryggstod => {
  const valt = miljo("STORAGE_BACKEND").toLowerCase();
  if (valt === "blob") return "blob";
  if (valt === "s3") return "s3";
  if (valt) {
    if (!varnat) {
      varnat = true;
      console.warn(`STORAGE_BACKEND="${valt}" är inte ett känt värde. Dokumentlagringen är avstängd.`);
    }
    return "ingen";
  }
  if (blobKreditiv()) return "blob";
  if (s3Hink()) return "s3";
  return "ingen";
};

/**
 * Behållaren som skickas in i seamen. För s3 är det hinken; för blob ett
 * valfritt prefix i butiken (tomt = butikens rot). Ett enda argument, två
 * betydelser - men aldrig samtidigt, eftersom bara ett ryggstöd är valt.
 */
const behallare = (): string => (valdRyggstod() === "blob" ? miljo("BLOB_PREFIX") : s3Hink());

/** Ansluten när det valda ryggstödet har det det behöver. /health rapporterar detta. */
export const storageConfigured = (): boolean => {
  const r = valdRyggstod();
  if (r === "blob") return blobKreditiv();
  if (r === "s3") return s3Hink().length > 0;
  return false;
};

/** Så länge en signerad URL lever. Kort med flit - den kringgår behörighet. */
export const DOCUMENT_URL_TTL_SECONDS = 60;

/** Så länge en uppladdnings-URL lever. Kort: den skriver, till skillnad från GET. */
export const UPLOAD_URL_TTL_SECONDS = 120;

/* --- Seamen: injicerbara så rutten går att pröva utan nät ---------------- */

export type Presigner = (bucket: string, storagePath: string, fileName: string) => Promise<string>;
export type UploadPresigner = (
  bucket: string,
  storagePath: string,
  contentType: string,
) => Promise<string>;
export type HeadReader = (bucket: string, storagePath: string) => Promise<{ storlek: number } | null>;
export type ByteReader = (
  bucket: string,
  storagePath: string,
  antalBytes: number,
) => Promise<Uint8Array | null>;
export type ObjectRemover = (bucket: string, storagePath: string) => Promise<void>;

/* --- Ryggstöd 1: S3-kompatibel hink (AWS eller MinIO) -------------------- */

const REGION = (process.env.S3_REGION ?? process.env.AWS_REGION ?? "eu-north-1").trim();
/** Tom = AWS. Satt (t.ex. http://clearance-minio:9000) = MinIO. */
const ENDPOINT = miljo("S3_ENDPOINT");
const FORCE_PATH_STYLE =
  (process.env.S3_FORCE_PATH_STYLE ?? (ENDPOINT ? "true" : "false")).trim().toLowerCase() === "true";
const ACCESS_KEY = (process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? "").trim();
const SECRET_KEY = (process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? "").trim();

let client: S3Client | null = null;
const s3 = (): S3Client => {
  if (!client) {
    client = new S3Client({
      region: REGION,
      ...(ENDPOINT ? { endpoint: ENDPOINT, forcePathStyle: FORCE_PATH_STYLE } : {}),
      ...(ACCESS_KEY && SECRET_KEY
        ? { credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY } }
        : {}),
    });
  }
  return client;
};

const s3Presign: Presigner = async (bucket, storagePath, fileName) => {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: storagePath,
    // Ladda ned med rätt filnamn. Citattecken/bakstreck skalas bort så de
    // inte kan bryta headern.
    ResponseContentDisposition: `attachment; filename="${fileName.replace(/["\\\r\n]/g, "")}"`,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: DOCUMENT_URL_TTL_SECONDS });
};

const s3UploadPresign: UploadPresigner = async (bucket, storagePath, contentType) => {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: storagePath, ContentType: contentType });
  return getSignedUrl(s3(), cmd, { expiresIn: UPLOAD_URL_TTL_SECONDS });
};

const s3Head: HeadReader = async (bucket, storagePath) => {
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
  try {
    const svar = await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: storagePath }));
    return { storlek: Number(svar.ContentLength ?? 0) };
  } catch {
    return null;
  }
};

const s3FirstBytes: ByteReader = async (bucket, storagePath, antalBytes) => {
  try {
    const svar = await s3().send(
      new GetObjectCommand({ Bucket: bucket, Key: storagePath, Range: `bytes=0-${antalBytes - 1}` }),
    );
    const kropp = svar.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!kropp?.transformToByteArray) return null;
    return await kropp.transformToByteArray();
  } catch {
    return null;
  }
};

const s3Remove: ObjectRemover = async (bucket, storagePath) => {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: storagePath }));
};

/* --- Ryggstöd 2: Vercel Blob -------------------------------------------- */

type BlobModul = typeof import("@vercel/blob");
let blobModul: Promise<BlobModul> | null = null;
/** Lat import: sviter som kör S3-vägen ska inte behöva ladda Blob-SDK:n. */
const blobSdk = (): Promise<BlobModul> => (blobModul ??= import("@vercel/blob"));

/**
 * Butikens sökväg. Prefixet är valfritt; är det tomt ligger dokumenten i
 * butikens rot med exakt samma storage_path som databasen känner till.
 */
export const blobVag = (prefix: string, storagePath: string): string =>
  prefix ? `${prefix.replace(/^\/+|\/+$/g, "")}/${storagePath}` : storagePath;

/**
 * FILNAMNET VID NEDLADDNING.
 *
 * Blob sätter content-disposition själv, ur sökvägens sista led - det går
 * inte att skicka med ett eget som i S3:s response-content-disposition.
 * Därför lägger sakerLagringsvag() det sanerade filnamnet SIST i sökvägen
 * (`<ärende>/<slumpid>/<namn>`), och `fileName` här är bara en spegel av
 * det ledet. Argumentet finns kvar för att kontraktet ska vara ett enda,
 * oavsett ryggstöd.
 */
const blobPresign: Presigner = async (prefix, storagePath) => {
  const { issueSignedToken, presignUrl } = await blobSdk();
  const pathname = blobVag(prefix, storagePath);
  const validUntil = Date.now() + DOCUMENT_URL_TTL_SECONDS * 1000;
  const token = await issueSignedToken({ pathname, operations: ["get"], validUntil });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname,
    validUntil,
    access: "private",
  });
  return presignedUrl;
};

/**
 * Uppladdningen presigneras med TVÅ tak, inte noll: bara den utlovade
 * innehållstypen och bara upp till maxstorleken. Det är samma gränser som
 * provaMetadata() redan satt - men här sitter de i lagringens eget lås, så
 * de gäller även om klienten skickar något annat än den sa.
 */
const blobUploadPresign: UploadPresigner = async (prefix, storagePath, contentType) => {
  const { issueSignedToken, presignUrl } = await blobSdk();
  const pathname = blobVag(prefix, storagePath);
  const validUntil = Date.now() + UPLOAD_URL_TTL_SECONDS * 1000;
  const token = await issueSignedToken({
    pathname,
    operations: ["put"],
    validUntil,
    allowedContentTypes: [contentType],
    maximumSizeInBytes: MAX_FILSTORLEK,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: "put",
    pathname,
    validUntil,
    access: "private",
    allowedContentTypes: [contentType],
    maximumSizeInBytes: MAX_FILSTORLEK,
    allowOverwrite: false,
    addRandomSuffix: false,
  });
  return presignedUrl;
};

const blobHead: HeadReader = async (prefix, storagePath) => {
  const { head } = await blobSdk();
  try {
    const svar = await head(blobVag(prefix, storagePath));
    return { storlek: Number(svar.size ?? 0) };
  } catch {
    return null;
  }
};

/**
 * Tar de första bytesen ur en ström och SLÄPPER RESTEN.
 *
 * Blob har inget intervall-läge motsvarande S3:s Range, så avbrottet är
 * det som håller löftet: vi vill se filens fem första tecken, inte hämta
 * tjugofem megabyte för att göra det. `cancel()` stänger anslutningen så
 * fort vi har nog.
 */
export const forstaBytesUrStrom = async (
  strom: ReadableStream<Uint8Array>,
  antalBytes: number,
): Promise<Uint8Array> => {
  const lasare = strom.getReader();
  const bitar: Uint8Array[] = [];
  let samlat = 0;
  try {
    while (samlat < antalBytes) {
      const { done, value } = await lasare.read();
      if (done) break;
      if (!value || value.length === 0) continue;
      bitar.push(value);
      samlat += value.length;
    }
  } finally {
    await lasare.cancel().catch(() => undefined);
  }
  const ut = new Uint8Array(Math.min(samlat, antalBytes));
  let i = 0;
  for (const bit of bitar) {
    if (i >= ut.length) break;
    const n = Math.min(bit.length, ut.length - i);
    ut.set(bit.subarray(0, n), i);
    i += n;
  }
  return ut;
};

const blobFirstBytes: ByteReader = async (prefix, storagePath, antalBytes) => {
  const { get } = await blobSdk();
  try {
    const svar = await get(blobVag(prefix, storagePath), { access: "private" });
    if (!svar || svar.statusCode !== 200 || !svar.stream) return null;
    return await forstaBytesUrStrom(svar.stream, antalBytes);
  } catch {
    return null;
  }
};

const blobRemove: ObjectRemover = async (prefix, storagePath) => {
  const { del } = await blobSdk();
  await del(blobVag(prefix, storagePath));
};

/* --- Växeln: ett kontrakt, två ryggstöd ---------------------------------- */

const defaultPresign: Presigner = (b, p, f) =>
  valdRyggstod() === "blob" ? blobPresign(b, p, f) : s3Presign(b, p, f);
const defaultUploadPresign: UploadPresigner = (b, p, t) =>
  valdRyggstod() === "blob" ? blobUploadPresign(b, p, t) : s3UploadPresign(b, p, t);
const defaultHead: HeadReader = (b, p) =>
  valdRyggstod() === "blob" ? blobHead(b, p) : s3Head(b, p);
const defaultFirstBytes: ByteReader = (b, p, n) =>
  valdRyggstod() === "blob" ? blobFirstBytes(b, p, n) : s3FirstBytes(b, p, n);
const defaultRemove: ObjectRemover = (b, p) =>
  valdRyggstod() === "blob" ? blobRemove(b, p) : s3Remove(b, p);

/* --- Kontraktet utåt: oförändrat sedan S3-tiden -------------------------- */

/**
 * Signerar en nedladdnings-URL för ett dokument. Anroparen har REDAN frågat
 * app.may_read_document() - den här funktionen prövar inte behörighet, den
 * bara signerar. Håll ordningen: aldrig signera utan att ha fått true.
 */
export const presignDocument = async (
  storagePath: string,
  fileName: string,
  presign: Presigner = defaultPresign,
): Promise<string> => presign(behallare(), storagePath, fileName);

export const presignUpload = async (
  storagePath: string,
  contentType: string,
  presign: UploadPresigner = defaultUploadPresign,
): Promise<string> => presign(behallare(), storagePath, contentType);

export const laesHuvud = async (
  storagePath: string,
  las: HeadReader = defaultHead,
): Promise<{ storlek: number } | null> => las(behallare(), storagePath);

/**
 * Läser filens FÖRSTA bytes ur lagringen.
 *
 * Det är den här läsningen som gör kontrollen till en kontroll: signaturen
 * sitter i det som faktiskt lagrades, inte i det klienten påstod.
 */
export const laesForstaBytes = async (
  storagePath: string,
  antalBytes = 1024,
  las: ByteReader = defaultFirstBytes,
): Promise<Uint8Array | null> => las(behallare(), storagePath, antalBytes);

export const taBortObjekt = async (
  storagePath: string,
  taBort: ObjectRemover = defaultRemove,
): Promise<void> => taBort(behallare(), storagePath);
