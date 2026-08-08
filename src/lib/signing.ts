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
  "Signaturerna länkas i en kedja – ändras en tidigare post syns det på alla följande.",
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

/**
 * BEVISKEDJAN: en oföränderlig länkad rad av signaturhändelser.
 *
 * En kontrollsumma på dokumentet visar att just DEN handlingen inte ändrats.
 * Men en angripare som kommer åt lagret kan ta bort en signatur, ändra ett
 * namn eller backa en tidsstämpel. Kedjan täpper till det: varje post bär
 * kontrollsumman av den FÖREGÅENDE posten, och postens egen kontrollsumma
 * räknas över allt i posten plus den länken. Ändras något i en tidigare post
 * går den inte längre ihop - och alla följande länkar brister med den. Man
 * kan alltså inte tyst skriva om historien; man måste räkna om HELA kedjan,
 * och att den räknats om syns.
 *
 * Det här är inte en kvalificerad signatur och ersätter inte BankID (se
 * SIGNATURE_LIMITS). Det är en ärlig, kontrollerbar beviskedja - vem, vad,
 * när, i vilken ordning - och det är det bevisvärde en enkel elektronisk
 * signatur kan bära under fri bevisprövning.
 */
export interface SignatureEvidence {
  /** Kontrollsumman av det EXAKTA innehåll som signerades. */
  documentHash: string;
  /** Vilken intygstext som gällde (SIGNATURE_STATEMENT.version). */
  statementVersion: string;
  /** Namnet undertecknaren skrev. */
  signerName: string;
  /**
   * Identiteten: det inloggade kontots id. Signaturen binds till kontot,
   * inte till legitimation - och det är det SIGNATURE_LIMITS säger rakt ut.
   */
  signerAccountId: string;
  /** Serverns tidpunkt (ISO), inte enhetens. */
  signedAt: string;
  /** Föregående posts kontrollsumma. null = första länken i kedjan. */
  prevRecordHash: string | null;
}

/** Ett kanoniskt, entydigt textavtryck av posten - underlaget för hashen. */
const canonicalEvidence = (e: SignatureEvidence): string =>
  [
    e.documentHash.toLowerCase(),
    e.statementVersion,
    e.signerName.trim(),
    e.signerAccountId,
    e.signedAt,
    e.prevRecordHash?.toLowerCase() ?? "",
  ].join("\n");

/**
 * Postens egen kontrollsumma. Binder ihop ALLT i posten med föregående länk,
 * så att varken innehåll, namn, tid, ordning eller identitet går att ändra
 * i efterhand utan att det syns.
 */
export const signatureRecordHash = async (e: SignatureEvidence): Promise<string> =>
  sha256Hex(new TextEncoder().encode(canonicalEvidence(e)).buffer);

export type ChainStatus = "intact" | "broken";

/**
 * Kontrollerar hela kedjan: att varje post pekar på rätt föregående länk och
 * att varje kontrollsumma faktiskt räknas fram ur postens innehåll. Ett enda
 * ändrat tecken någonstans ger "broken".
 */
export const verifyChain = async (
  records: { evidence: SignatureEvidence; recordHash: string }[],
): Promise<ChainStatus> => {
  let prev: string | null = null;
  for (const r of records) {
    if ((r.evidence.prevRecordHash ?? null) !== prev) return "broken";
    const beraknad = await signatureRecordHash(r.evidence);
    if (beraknad.toLowerCase() !== r.recordHash.toLowerCase()) return "broken";
    prev = r.recordHash;
  }
  return "intact";
};

export const CHAIN_LABEL: Record<ChainStatus, string> = {
  intact: "Signaturkedjan är obruten – ingen post har ändrats i efterhand",
  broken: "Signaturkedjan går inte ihop – en post har ändrats eller tagits bort",
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
