/**
 * ARBETARENS ROLL: den motsatta grinden mot API:ts.
 *
 * server/db.ts vägrar starta om API:t ansluter som en roll som KAN gå förbi
 * radskyddet. Den här filen vägrar tvärtom: en arbetare som INTE kan gå
 * förbi radskyddet får inte köra.
 *
 * VARFÖR DET BEHÖVS, OCH VARFÖR DET INTE BEHÖVDES FÖRR.
 *
 * I containern hade varje process sin egen DATABASE_URL: API-poden fick
 * app_api, cron-jobben fick app_worker. På Vercel delar alla funktioner i
 * ett projekt samma miljövariabler. Blir DATABASE_URL app_api - vilket den
 * MÅSTE vara, annars vägrar API:t starta - så kör nattjobbet som en roll
 * som ser noll rader.
 *
 * OCH DET SYNS INTE. En generalrepetition mot en riktig databas visade
 * exakt vad som händer:
 *
 *   select count(*) from public.cases              -> 0
 *   select count(*) from public.case_invitations   -> 0
 *   select count(*) from public.customer_invoices  -> 0
 *
 * Gallringen hittar inget att gallra, faktureringen inget att fakturera,
 * inbjudningarna ingen att mejla. Inget steg kastar, så cron-endpointen
 * svarar 200 och Vercel märker körningen som lyckad. Fakturorna uteblir i
 * en månad innan någon undrar varför.
 *
 * En tyst nolla är värre än ett fel. Därför kastar den här grinden.
 */

import type { Client } from "pg";

export interface Arbetarbesked {
  roll: string;
  duger: boolean;
  skal: string[];
}

/**
 * Kan den här anslutningen arbeta över alla bolag?
 *
 * Tre sätt, alla giltiga:
 *   - BYPASSRLS: rollen app_worker, som db/roles-selfhosted.sql skapar.
 *   - Ägarskap: en tabells ägare är undantagen sin egen RLS. Det är så
 *     sviterna kör, och så ett managed Postgres brukar se ut där
 *     BYPASSRLS inte går att dela ut.
 *   - Superanvändare: bara i utveckling.
 */
export const provaArbetarroll = async (klient: Client): Promise<Arbetarbesked> => {
  const { rows } = await klient.query(
    `select current_user as roll,
            r.rolsuper,
            r.rolbypassrls,
            (select count(*)::int
               from pg_class c
               join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public'
                and c.relkind in ('r', 'p')
                and pg_has_role(r.oid, c.relowner, 'USAGE')) as agda_tabeller
       from pg_roles r
      where r.rolname = current_user`,
  );
  const rad = rows[0];
  if (!rad) return { roll: "okänd", duger: false, skal: ["rollen gick inte att slå upp"] };

  const skal: string[] = [];
  if (rad.rolsuper === true) skal.push("superanvändare");
  if (rad.rolbypassrls === true) skal.push("BYPASSRLS");
  if (Number(rad.agda_tabeller) > 0) skal.push(`äger ${rad.agda_tabeller} tabeller`);
  return { roll: String(rad.roll), duger: skal.length > 0, skal };
};

/** Samma prövning, men den STOPPAR jobbet. */
export const kravArbetarroll = async (klient: Client): Promise<void> => {
  const besked = await provaArbetarroll(klient);
  if (besked.duger) return;
  throw new Error(
    [
      "",
      "  ARBETAREN KAN INTE SE NÅGOT.",
      "",
      `  Rollen "${besked.roll}" går inte förbi radskyddet och sätter ingen`,
      "  användaridentitet. Varje fråga returnerar då noll rader: gallringen",
      "  hittar inget att gallra, faktureringen inget att fakturera, utkorgen",
      "  ingen att mejla - och inget av det kastar, så körningen ser lyckad ut.",
      "",
      "  Sätt WORKER_DATABASE_URL till arbetarens egen roll (app_worker eller",
      "  schemats ägare). API:ts DATABASE_URL ska INTE vara den rollen - server/db.ts",
      "  vägrar starta på en roll som kan gå förbi radskyddet, och det är avsiktligt.",
      "",
    ].join("\n"),
  );
};

/**
 * Arbetarens anslutningssträng.
 *
 * WORKER_DATABASE_URL först, DATABASE_URL som fallback. Fallbacken finns
 * för utveckling och för sviterna, som kör allt mot en databas som ägaren -
 * och den är ofarlig just för att grinden ovan ändå prövar rollen.
 */
export const arbetarUrl = (): string | undefined =>
  process.env.WORKER_DATABASE_URL ?? process.env.DATABASE_URL;
