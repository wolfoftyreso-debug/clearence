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
