/**
 * Signeringen: ett godkännande som lämnar bevis efter sig.
 *
 * BankID byggs INTE. Det kräver avtal, kostar per signering och skulle
 * hålla funktionen låst på obestämd tid. I stället gör vi det enda
 * BankID egentligen köper oss - kopplar en namngiven person till ett
 * EXAKT innehåll vid en EXAKT tidpunkt, kontrollerbart i efterhand -
 * med en enkel elektronisk signatur.
 *
 * ÄRLIGHETEN ÄR FUNKTIONEN. Produkten används av människor med
 * juridiskt ansvar. Att låta dem tro att det här är BankID vore värre
 * än att inte ha signering alls, så begränsningen står i klartext både
 * i gränssnittet och på intyget.
 */

/** Det som faktiskt intygas. Versionerad: texten kopieras in i raden. */
export const SIGNATURE_STATEMENT = {
  version: "1.0",
  text:
    "Jag intygar att jag har läst handlingen i sin helhet, att uppgifterna " +
    "i den är riktiga såvitt jag känner till, och att jag godkänner den i " +
    "min roll i ärendet. Jag är införstådd med att tidpunkten och " +
    "handlingens innehåll förseglas och kan visas upp i efterhand.",
} as const;

/**
 * Vad signaturen ÄR och inte är. Visas vid signeringen och på intyget.
 *
 * eIDAS art. 3.10: en enkel elektronisk signatur. Den får inte förvägras
 * rättslig verkan enbart för att den är elektronisk (art. 25.1), och i
 * svensk rätt gäller fri bevisprövning. Men bevisvärdet är lägre än en
 * avancerad eller kvalificerad signatur, och det ska sägas rakt ut.
 */
export const SIGNATURE_LIMITS = [
  "Din identitet bygger på inloggningen till kontot, inte på legitimation.",
  "Detta är en enkel elektronisk signatur – inte BankID, och inte en avancerad eller kvalificerad signatur.",
  "Där lag kräver en viss form, som vid bevittnad namnteckning, räcker den inte.",
] as const;

/** Vad signaturen faktiskt bevisar. Lika viktigt som begränsningarna. */
export const SIGNATURE_STRENGTHS = [
  "Vem: kontot och namnet du skriver in.",
  "Vad: handlingens innehåll förseglas med en kontrollsumma.",
  "När: tidpunkten sätts av servern, inte av din enhet.",
  "Att det syns om innehållet ändras efteråt.",
] as const;

/** SHA-256 som gemener hex. Samma funktion vid signering och kontroll. */
export const sha256Hex = async (bytes: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/** Kontrollsumman i läsbara block. En hex-remsa på 64 tecken läses inte. */
export const formatFingerprint = (hash: string): string =>
  (hash.match(/.{1,8}/g) ?? []).slice(0, 4).join(" ").toUpperCase();

export type SignatureIntegrity = "unchanged" | "changed" | "unverifiable";

/**
 * Efterhandskontrollen - hela poängen med hashen.
 *
 * En ändrad fil gör INTE signaturen ogiltig. Den betyder att någon
 * signerade ett annat innehåll än det som ligger där nu, och det är en
 * helt annan sak att berätta för användaren.
 */
export const checkIntegrity = (
  signedHash: string,
  currentHash: string | null,
): SignatureIntegrity => {
  if (!currentHash) return "unverifiable";
  return signedHash.toLowerCase() === currentHash.toLowerCase() ? "unchanged" : "changed";
};

export const INTEGRITY_LABEL: Record<SignatureIntegrity, string> = {
  unchanged: "Innehållet är oförändrat sedan signeringen",
  changed: "Innehållet har ändrats efter signeringen",
  unverifiable: "Innehållet kan inte kontrolleras i den här sessionen",
};

/** Namnet måste vara skrivet, inte klickat. Två tecken är inte ett namn. */
export const isValidSignerName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 120 && /\p{L}/u.test(trimmed);
};

/** "3 mars 2026 kl. 14:07" - tidpunkten ska gå att läsa högt. */
export const formatSignedAt = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })} kl. ${d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`;
};
