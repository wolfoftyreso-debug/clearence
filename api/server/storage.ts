/**
 * DOKUMENTLAGRINGEN: en signerad, kortlivad URL - aldrig sökvägen.
 *
 * Filerna ligger i objektlagring (MinIO självhostat, S3 i moln), inte i
 * databasen. `public.case_documents` vet VAD som finns och VEM som får se
 * det; app.may_read_document() är den enda fråga API:t ställer innan en URL
 * signeras (index.ts). Den här filen gör bara det sista steget: växlar en
 * storage_path mot en presignerad GET-URL som går ut på 60 sekunder.
 *
 * TVÅ REGLER:
 *  1. storage_path lämnar ALDRIG servern. Bara den signerade URL:en gör det,
 *     och den slutar fungera efter en minut.
 *  2. Endpoint är konfigurerbar. Tom = AWS S3; satt = MinIO (då krävs
 *     forcePathStyle). Samma kod, egen eller molnad lagring.
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = (process.env.DOCUMENTS_BUCKET ?? "").trim();
const REGION = (process.env.S3_REGION ?? process.env.AWS_REGION ?? "eu-north-1").trim();
/** Tom = AWS. Satt (t.ex. http://clearance-minio:9000) = MinIO. */
const ENDPOINT = (process.env.S3_ENDPOINT ?? "").trim();
const FORCE_PATH_STYLE =
  (process.env.S3_FORCE_PATH_STYLE ?? (ENDPOINT ? "true" : "false")).trim().toLowerCase() === "true";
const ACCESS_KEY = (process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? "").trim();
const SECRET_KEY = (process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? "").trim();

/** Så länge en signerad URL lever. Kort med flit - den kringgår behörighet. */
export const DOCUMENT_URL_TTL_SECONDS = 60;

/** Ansluten när en hink är angiven. /health rapporterar detta. */
export const storageConfigured = (): boolean => BUCKET.length > 0;

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

/** Injicerbar så sviten kan pröva rutten utan nät eller riktig lagring. */
export type Presigner = (bucket: string, storagePath: string, fileName: string) => Promise<string>;

const defaultPresign: Presigner = async (bucket, storagePath, fileName) => {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: storagePath,
    // Ladda ned med rätt filnamn. Citattecken/bakstreck skalas bort så de
    // inte kan bryta headern.
    ResponseContentDisposition: `attachment; filename="${fileName.replace(/["\\\r\n]/g, "")}"`,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: DOCUMENT_URL_TTL_SECONDS });
};

/**
 * Signerar en nedladdnings-URL för ett dokument. Anroparen har REDAN frågat
 * app.may_read_document() - den här funktionen prövar inte behörighet, den
 * bara signerar. Håll ordningen: aldrig signera utan att ha fått true.
 */
export const presignDocument = async (
  storagePath: string,
  fileName: string,
  presign: Presigner = defaultPresign,
): Promise<string> => presign(BUCKET, storagePath, fileName);

/* --- Uppladdningen: signera in, och LÄS TILLBAKA för att pröva ---------- */

/** Så länge en uppladdnings-URL lever. Kort: den skriver, till skillnad från GET. */
export const UPLOAD_URL_TTL_SECONDS = 120;

/** Injicerbara, så rutten går att pröva utan nät och utan riktig lagring. */
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

const defaultUploadPresign: UploadPresigner = async (bucket, storagePath, contentType) => {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: storagePath, ContentType: contentType });
  return getSignedUrl(s3(), cmd, { expiresIn: UPLOAD_URL_TTL_SECONDS });
};

const defaultHead: HeadReader = async (bucket, storagePath) => {
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
  try {
    const svar = await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: storagePath }));
    return { storlek: Number(svar.ContentLength ?? 0) };
  } catch {
    return null;
  }
};

/**
 * Läser filens FÖRSTA bytes ur lagringen.
 *
 * Det är den här läsningen som gör kontrollen till en kontroll: signaturen
 * sitter i det som faktiskt lagrades, inte i det klienten påstod. Ett
 * intervall räcker - vi laddar aldrig ned hela filen för att titta på dess
 * fem första tecken.
 */
const defaultFirstBytes: ByteReader = async (bucket, storagePath, antalBytes) => {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
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

const defaultRemove: ObjectRemover = async (bucket, storagePath) => {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: storagePath }));
};

export const presignUpload = async (
  storagePath: string,
  contentType: string,
  presign: UploadPresigner = defaultUploadPresign,
): Promise<string> => presign(BUCKET, storagePath, contentType);

export const laesHuvud = async (
  storagePath: string,
  las: HeadReader = defaultHead,
): Promise<{ storlek: number } | null> => las(BUCKET, storagePath);

export const laesForstaBytes = async (
  storagePath: string,
  antalBytes = 1024,
  las: ByteReader = defaultFirstBytes,
): Promise<Uint8Array | null> => las(BUCKET, storagePath, antalBytes);

export const taBortObjekt = async (
  storagePath: string,
  taBort: ObjectRemover = defaultRemove,
): Promise<void> => taBort(BUCKET, storagePath);
