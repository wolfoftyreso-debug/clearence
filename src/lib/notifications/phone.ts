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
 * SMS:et som bär koden.
 *
 * Texten formuleras HÄR bara för att den ska gå att läsa, prova och
 * granska som språk. Den skickas inte härifrån: strängen sätts ihop av
 * start_phone_verification i databasen, i samma transaktion som koden
 * föds. tests/notificationService.ts läser båda källorna och kräver att
 * de säger exakt samma sak - annars hade den lästa texten och den
 * skickade kunnat glida isär utan att någon märkte det.
 *
 * Det enda utskick som får gå till ett OVERIFIERAT nummer, och därför
 * det enda som inte får avslöja någonting alls om vem som begärt det
 * eller varför.
 */
export const verificationSms = (code: string): string =>
  `${code} är din kod för att slå på SMS-aviseringar. Koden gäller i ${VERIFICATION_TTL_MINUTES} minuter.`;

/*
 * HÄR LÅG generateCode() OCH hashCode(), OCH DE VAR HELA BRISTEN.
 *
 * Koden slumpades i webbläsaren, hashades i webbläsaren, och både hashen
 * och SMS-texten skickades in till databasen som argument. Den som kunde
 * anropa API:t kunde alltså välja koden själv, aldrig läsa något SMS och
 * ändå bekräfta. Verifieringen bevisade inte att någon hade telefonen -
 * den bevisade att någon kan räkna till sex.
 *
 * Frontend-säkerhet är inte en säkerhetsmekanism. Koden föds numera i
 * start_phone_verification (migration 20260822100000), lämnar databasen
 * bara som SMS, och klienten får `void` tillbaka. Lägg inte tillbaka
 * funktionerna: tests/sakerhet.ts läser den här filen och blir röd om
 * någon gör det.
 */
