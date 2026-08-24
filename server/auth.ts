/**
 * Lösenord och sessioner.
 *
 * Databasen har ingen funktion som kan hasha eller verifiera ett lösenord,
 * med flit: ett databasintrång ska inte dela ut ett verifieringsorakel på
 * köpet. Hashningen bor här.
 *
 * **Valet av KDF, ärligt.** db/bootstrap.sql skrev "Argon2id eller bcrypt".
 * Båda kräver en nativ modul som ska byggas vid installation. Det här API:t
 * har exakt ett beroende (`pg`), och att lägga till en kompilerad modul för
 * att slippa skriva tolv rader är fel affär för en produkt vars hela
 * arkitekturpoäng är att inte sitta fast i någon annans byggkedja.
 *
 * `scrypt` finns i Node själv, är minneshård och är den KDF OWASP anger som
 * andrahandsval efter Argon2id. Parametrarna nedan (N=2^15, r=8, p=1 - 32 MiB arbetsminne)
 * är OWASP:s rekommendation. Formatet bär sina egna parametrar, så en
 * framtida höjning - eller ett byte till Argon2id - blir ett nytt prefix och
 * inte en migrering: `verifyPassword` läser vad hashen själv säger.
 */

import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

/*
 * TYPEN SKRIVS UT MED FLIT.
 *
 * `promisify(scrypt)` plockar node:cryptos TRE-argumentsöverlagring, så
 * anropen nedan - som skickar ett fjärde argument med kostnadsparametrarna
 * - blir typfel. Det syntes aldrig, eftersom serverkoden inte
 * typkontrollerades förrän tsconfig.server.json fanns; esbuild
 * transpilerar utan att kontrollera.
 */
type ScryptAsync = (
  losenord: string,
  salt: Buffer,
  keylen: number,
  optioner: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const scryptAsync = promisify(scrypt) as unknown as ScryptAsync;

const SCRYPT = { N: 32_768, r: 8, p: 1, keylen: 64 } as const;

/** `scrypt$N$r$p$salt$hash`, allt i base64url. */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password.normalize("NFKC"), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 256 * 1024 * 1024,
  })) as Buffer;
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
};

/**
 * Verifierar mot hashens EGNA parametrar, inte mot dagens konstanter.
 * Annars slutar alla gamla lösenord fungera den dag kostnaden höjs.
 */
export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  let derived: Buffer;
  try {
    derived = (await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 256 * 1024 * 1024,
    })) as Buffer;
  } catch {
    return false;
  }
  // Jämförelsen måste vara tidskonstant: en jämförelse som avbryter vid
  // första olika byten läcker hashen en byte i taget.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
};

/**
 * Sessionstoken. Klienten får token; databasen får bara SHA-256 av den.
 *
 * En databasdump ska inte vara en samling fungerande sessioner. Samma
 * princip som API-nycklarna redan bygger på.
 */
export const issueToken = (): { token: string; hash: string } => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256(token) };
};

export const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

/** Sessionens livslängd. Driftparameter, inte en siffra i koden. */
export const sessionTtlHours = (): number => Number(process.env.SESSION_TTL_HOURS ?? 12);
