/**
 * Mobilnumret.
 *
 * Ett nummer som skrivits fel skickar SMS till en främling. I den här
 * produkten är det inte en skönhetsfläck: aviseringen säger att någon
 * har ett ärende hos CLEARANCE, och CLEARANCE finns bara för bolag i
 * kris. Numret måste därför både SE RÄTT UT och VERIFIERAS innan det
 * används - att lita på inmatningen är att lita på att ingen har
 * fingrar.
 *
 * Numret lagras normaliserat (E.164) så att samma nummer inskrivet på
 * fyra sätt blir en rad, inte fyra.
 */

/** Landsnumret. Egen konstant för den dag fler länder blir aktuella. */
const SE = "+46";

/**
 * Normaliserar ett svenskt mobilnummer till E.164, eller null.
 *
 * Godtar 070-123 45 67, 0701234567, +46701234567, 0046701234567 och
 * 46701234567. Fasta nummer godtas inte: ett SMS till en fast telefon
 * kommer aldrig fram, och ett tyst misslyckande är värre än ett nej.
 */
export const normalisePhone = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Bara siffror, plus och de vanliga avskiljarna får förekomma. En
  // bokstav betyder att någon skrivit något annat än ett nummer.
  if (!/^[+\d\s()-]+$/.test(trimmed)) return null;

  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+46")) digits = digits.slice(3);
  else if (digits.startsWith("0046")) digits = digits.slice(4);
  else if (digits.startsWith("46") && !digits.startsWith("460")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  else return null;

  if (digits.includes("+")) return null;
  // Svenska mobilnummer: 7 följt av 8 siffror.
  if (!/^7\d{8}$/.test(digits)) return null;
  return `${SE}${digits}`;
};

export const isMobileNumber = (raw: string): boolean => normalisePhone(raw) !== null;

/**
 * Numret som det visas tillbaka för användaren: +46 70 123 45 67.
 * Grupperingen är den svenska, för det är så någon läser sitt eget
 * nummer och kontrollerar att det stämmer.
 */
export const formatPhone = (e164: string): string => {
  const m = /^\+46(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  if (!m) return e164;
  return `+46 ${m[1]}${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
};

/**
 * Numret maskerat. Används överallt utom i fältet där användaren just
 * skrivit in det: en skärmdump av inställningarna ska inte lämna ut
 * hela numret.
 */
export const maskPhone = (e164: string): string => {
  const m = /^\+46(\d{3})\d{4}(\d{2})$/.exec(e164);
  if (!m) return "•••";
  return `+46 ${m[1]} •• •• ${m[2]}`;
};

/* --- Verifieringen -------------------------------------------------------- */

/** Koden är sex siffror. Kortare gissas, längre skrivs fel. */
export const VERIFICATION_CODE_LENGTH = 6;

/** Koden lever i tio minuter. */
export const VERIFICATION_TTL_MINUTES = 10;

/** Antal försök innan koden bränns. Skyddar mot att gissa sig igenom. */
export const VERIFICATION_MAX_ATTEMPTS = 5;

export const isVerificationCode = (code: string): boolean =>
  new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`).test(code.trim());

/**
 * SMS:et som bär koden. Det enda utskick som får gå till ett
 * OVERIFIERAT nummer - och därför det enda som inte får avslöja
 * någonting alls om vem som begärt det eller varför.
 */
export const verificationSms = (code: string): string =>
  `${code} är din kod för att slå på SMS-aviseringar. Koden gäller i ${VERIFICATION_TTL_MINUTES} minuter.`;

/**
 * Koden som hash. Klartexten lämnar aldrig klienten - den går till
 * mottagarens telefon, inte till vår databas. Samma regel som för
 * API-nycklar och sessionspoletter.
 */
export const hashCode = async (code: string): Promise<string> => {
  const bytes = new TextEncoder().encode(code.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/** Sex slumpsiffror ur kryptografiskt slumptal, inte ur Math.random. */
export const generateCode = (): string => {
  const bytes = new Uint8Array(VERIFICATION_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
};
