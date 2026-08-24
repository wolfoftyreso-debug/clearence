-- Exitorsak (P0) och hälsoläget (P1).
--
-- P0 gör North Star mätbar: "antal företag som återgår till ekonomisk
-- stabilitet med hjälp av CLEARANCE". Utan registrerad exitorsak går det
-- inte att skilja bra churn (stabiliserad, rekonstruktion genomförd) från
-- dålig (konkurs, tyst avhopp) - och då kan varken G6 eller North Star
-- bevisas. Krisfasens slut stämplas därför med orsak, av en företrädare,
-- genom en funktion - aldrig genom en rå kolumnuppdatering.
--
-- P1 bär G6 på företagssidan: ett bolag som lyckats ska kunna STANNA i ett
-- enklare hälsoläge (bevakning, årshjul, snabb väg tillbaka om läget
-- försämras) i stället för att lämna. closed_at markerar krisfasens slut;
-- health_mode = true betyder att ärendet lever vidare i hälsoläget.
-- Ingenting raderas vid avslut - akten består (samma princip som
-- kontostängningen: frysning, aldrig radering).

alter table public.cases
  add column closed_at timestamptz,
  add column exit_reason text
    check (exit_reason in ('stabilized', 'reconstruction_completed', 'bankruptcy', 'liquidated', 'other')),
  add column exit_note text,
  add column health_mode boolean not null default false;

comment on column public.cases.exit_reason is
  'Krisfasens utfall. stabilized/reconstruction_completed = North Star-utfall (bra churn). Sätts endast via close_case().';
comment on column public.cases.health_mode is
  'Ärendet lever vidare i hälsoläget efter en lyckad krisfas: bevakning och årshjul i stället för krisstyrning.';

create index cases_open_idx on public.cases (user_id) where closed_at is null or health_mode;

/**
 * Avslutar krisfasen. Kräver skrivroll i ärendet - att förklara krisen
 * över är ett företrädarbeslut. Lyckade utfall kan gå vidare till
 * hälsoläget; misslyckade kan det inte (G6 är ett mått, inte smink).
 */
create or replace function public.close_case(
  p_case_id uuid,
  p_reason text,
  p_note text default null,
  p_enter_health boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_closed timestamptz;
begin
  if not public.can_write_case(p_case_id) then
    raise exception 'Kräver företrädarbehörighet i ärendet';
  end if;
  if p_reason not in ('stabilized', 'reconstruction_completed', 'bankruptcy', 'liquidated', 'other') then
    raise exception 'Ogiltig avslutsorsak';
  end if;
  if p_enter_health and p_reason not in ('stabilized', 'reconstruction_completed') then
    raise exception 'Hälsoläget är för lyckade utfall - vid % avslutas ärendet helt', p_reason;
  end if;
  select closed_at into v_closed from public.cases where id = p_case_id for update;
  if v_closed is not null then
    raise exception 'Ärendet är redan avslutat';
  end if;

  update public.cases
  set closed_at = now(),
      exit_reason = p_reason,
      exit_note = nullif(trim(coalesce(p_note, '')), ''),
      health_mode = p_enter_health,
      updated_at = now()
  where id = p_case_id;
end;
$$;

comment on function public.close_case(uuid, text, text, boolean) is
  'Stämplar krisfasens slut med orsak (North Star-mätningen). Lyckade utfall kan fortsätta i hälsoläget. Ingenting raderas.';

/**
 * Återupptar krisläget - antingen från ett helt avslutat ärende (misstag,
 * eller läget försämrades efter fullt avslut) eller från hälsoläget.
 * Exithistoriken skrivs INTE över förrän nästa avslut: kolumnerna nollas,
 * men händelseloggen har kvar hela förloppet.
 */
create or replace function public.reopen_case(p_case_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_write_case(p_case_id) then
    raise exception 'Kräver företrädarbehörighet i ärendet';
  end if;
  update public.cases
  set closed_at = null,
      exit_reason = null,
      exit_note = null,
      health_mode = false,
      updated_at = now()
  where id = p_case_id;
  if not found then
    raise exception 'Ärendet finns inte';
  end if;
end;
$$;

/**
 * North Star och churn-mätningen, för driftpanelen. Endast drift.
 */
create or replace function public.north_star_counts()
returns table (
  recovered bigint,
  in_health bigint,
  bad_churn bigint,
  open_cases bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    count(*) filter (where exit_reason in ('stabilized', 'reconstruction_completed')),
    count(*) filter (where health_mode),
    count(*) filter (where exit_reason in ('bankruptcy', 'liquidated')),
    count(*) filter (where closed_at is null)
  from public.cases
  where public.is_platform_admin();
$$;

comment on function public.north_star_counts() is
  'Drift: North Star (återhämtade bolag), hälsoläget, dålig churn och öppna ärenden. Nollor för icke-administratörer.';

revoke all on function public.close_case(uuid, text, text, boolean) from public;
revoke all on function public.reopen_case(uuid) from public;
revoke all on function public.north_star_counts() from public;
grant execute on function public.close_case(uuid, text, text, boolean) to authenticated;
grant execute on function public.reopen_case(uuid) to authenticated;
grant execute on function public.north_star_counts() to authenticated;
