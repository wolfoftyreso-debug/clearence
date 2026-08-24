/*
 * ANON SKA LÄSA PRISET - INTE ALLT ANNAT SOM RÅKAT HAMNA I SAMMA TABELL.
 *
 * Policyn "Settings are readable by everyone" skrevs för en enda sak, och
 * kommentaren ovanför den säger det rakt ut: "priset visas för utloggade
 * besökare på startsidan." Men villkoret var `using (true)`, alltså HELA
 * tabellen, och sedan dess har två nycklar tillkommit:
 *
 *   - news_feeds       (driftens RSS-adresser)
 *   - retention_policy (gallringstiderna per kategori)
 *
 * Ingen beslutade att de skulle vara publika. De ärvde det, tyst, av en
 * policy skriven innan de fanns. Ingen av dem är en hemlighet - det finns
 * inga nycklar eller lösenord i app_settings, och det är kontrollerat -
 * men en utloggad besökare har ingen anledning att läsa vilka flöden
 * driften bevakar eller hur länge avslutade ärenden sparas.
 *
 * Det som ändras är alltså inte att något läcker, utan att den publika
 * ytan blir den som var avsedd. Nästa nyckel som läggs till ärver
 * ingenting: den syns bara för inloggade tills någon uttryckligen
 * lägger till den i listan nedan.
 *
 * Inloggade läser fortfarande hela tabellen. Skrivning är oförändrat
 * admin-gatad.
 */

drop policy if exists "Settings are readable by everyone" on public.app_settings;

-- Utloggade: bara de nycklar som en publik sida faktiskt behöver.
create policy "Anon reads only public settings"
  on public.app_settings for select
  to anon
  using (key in ('company_plan'));

-- Inloggade: hela tabellen. Ingen av nycklarna är hemlig; gränsen här är
-- "behöver man ett konto för att se driftens parametrar", och svaret är ja.
create policy "Signed-in users read settings"
  on public.app_settings for select
  to authenticated
  using (true);

comment on table public.app_settings is
  'Driftparametrar. Utloggade ser bara company_plan; inloggade ser alla. Skrivning kräver plattformsadmin. Inga hemligheter lagras här - de bor i Secrets Manager.';
