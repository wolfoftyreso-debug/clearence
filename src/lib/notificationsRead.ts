/**
 * Klockans minne.
 *
 * Notiscentret hade tidigare inget. Siffran visade samma tal i evighet -
 * man klickade på en notis, gick dit, gjorde saken, kom tillbaka, och
 * siffran stod kvar. En räknare som inte går att beta av är inte en
 * räknare utan en dekoration, och den lär användaren att inte titta på
 * den. Det är dyrt i en produkt vars hela poäng är att peka på det som
 * brinner.
 *
 * TVÅ SAKER SKILJER DET HÄR FRÅN EN VANLIG "LÄST"-FLAGGA:
 *
 * 1. Kvitteringen hänger på radens FINGERAVTRYCK, inte på dess id. En
 *    frist som går från "om tre dagar" till "förfaller idag" har samma
 *    id men är ny information, och blir därför oläst igen. Att kvittera
 *    en notis en gång ska inte tysta hela dess upptrappning.
 *
 * 2. Ingenting döljs. En läst rad ligger kvar i listan, den slutar bara
 *    räknas. Klockan får aldrig bli en plats där man kan gömma en frist
 *    genom att klicka bort den.
 *
 * Minnet är per ENHET, som resten av notisvalen (se
 * NotificationCategory i notifications.ts). Det är rätt nivå: kvitterat
 * på jobbdatorn betyder inte kvitterat i mobilen, och den som byter
 * enhet mitt i en kris ska se allt igen snarare än att missa något.
 */

import type { NotificationItem } from "./notifications";
import { signatureOf } from "./notifications";

const KEY = "clearance-notifications-read";

/** Taket för hur många kvitteringar som sparas. */
const MAX_REMEMBERED = 200;

/**
 * Kvitteringarna, nyast sist. Fingeravtryck, inte id: se filhuvudet.
 *
 * En array och inte ett set, för att ordningen är det som gör att
 * gallringen nedan tar bort det äldsta.
 */
const load = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

const save = (signatures: string[]): void => {
  try {
    // Gallras uppifrån: en lista som växer utan gräns fyller lagringen
    // och gör att INGENTING går att spara, inte ens det senaste.
    localStorage.setItem(KEY, JSON.stringify(signatures.slice(-MAX_REMEMBERED)));
    window.dispatchEvent(new CustomEvent(READ_EVENT));
  } catch {
    /* utan lagring finns inget minne - klockan visar allt som oläst */
  }
};

/** Namnet på händelsen som säger att minnet ändrats. */
export const READ_EVENT = "clearance-notifications-read";

export const readSignatures = (): Set<string> => new Set(load());

export const markRead = (item: NotificationItem): void => {
  const signature = signatureOf(item);
  const current = load();
  if (current.includes(signature)) return;
  save([...current, signature]);
};

export const markAllRead = (items: readonly NotificationItem[]): void => {
  const current = load();
  const additions = items.map(signatureOf).filter((s) => !current.includes(s));
  if (additions.length === 0) return;
  save([...current, ...additions]);
};

/** Bara för inställningarna: släpp minnet och visa allt igen. */
export const forgetRead = (): void => save([]);

export const isRead = (item: NotificationItem, read: Set<string> = readSignatures()): boolean =>
  read.has(signatureOf(item));

/**
 * Siffran på klockan.
 *
 * OLÄST **och** KRÄVER något. De två villkoren tillsammans är hela
 * poängen: utan det första går siffran aldrig ner, utan det andra räknar
 * den rader som själva säger att inget behöver göras.
 */
export const badgeCount = (
  items: readonly NotificationItem[],
  read: Set<string> = readSignatures(),
): number => items.filter((item) => item.demandsAction && !isRead(item, read)).length;

/**
 * Etiketten på knappen. Skriven så att den stämmer med siffran - en
 * skärmläsare ska inte få höra "väntar på ditt svar" om något som inte
 * gör det.
 */
export const bellLabel = (count: number): string => {
  if (count === 0) return "Notiser: inget kräver dig just nu";
  if (count === 1) return "Notiser: en sak kräver dig";
  return `Notiser: ${count} saker kräver dig`;
};
