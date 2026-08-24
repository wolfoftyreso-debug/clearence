/**
 * DATAMINIMERING VID FRITEXT.
 *
 * Ett krissamtal drar åt sig känsliga uppgifter: personnummer, hälsa,
 * privata förhållanden, namngivna tredje personer. Sådant är särskilda
 * kategorier (GDPR art. 9) som produkten INTE samlar in avsiktligt - men
 * ett fritextfält kan råka bära det ändå. Motmedlet är enkelt och står
 * där texten skrivs: en kort påminnelse om att bara dela det läget kräver.
 *
 * Samma hållning som röret mot modellen (server/anthropic.ts:
 * DATAMINIMERING) och det docs/dataskydd.md §5/§8 efterlyser: en kort
 * användarinstruktion vid fritext. Texten bor här, som en enda sanning,
 * så att den ser likadan ut i samtalet, onboardingen och guiderna.
 */
export const DATA_MINIMERING_HINT =
  "Dela bara det som läget kräver. Undvik personnummer och uppgifter om " +
  "namngivna privatpersoner – CLEARANCE behöver dem inte.";
