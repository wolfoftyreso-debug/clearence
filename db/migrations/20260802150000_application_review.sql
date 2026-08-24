-- Granskning av rådgivaransökningar.
--
-- Ansökningsflödet var en återvändsgränd: rådgivaren skickade in, såg
-- "granskningen görs manuellt - vi hör av oss", och sedan fanns ingen vy och
-- ingen funktion för att faktiskt granska. Varje godkännande krävde en
-- direktändring i databasen, vilket i praktiken betyder att ansökningar blir
-- liggande. Det är produktens rekryteringskanal för rådgivare - utan
-- godkända rådgivare finns ingen katalog och ingen förmedling att fakturera.
--
-- Godkännandet är en databasfunktion, inte två klientanrop. Att skriva in
-- rådgivaren i katalogen och märka ansökan som godkänd måste vara EN
-- händelse: händer bara det ena finns antingen en publicerad rådgivare vars
-- ansökan ser obehandlad ut, eller en "godkänd" ansökan som aldrig syns i
-- katalogen. Båda upptäcks först av fel person.

/* -------------------------------------------------------------------------- */
/* Drift får läsa och handlägga                                               */
/* -------------------------------------------------------------------------- */

create policy applications_admin_read
  on public.professional_applications for select to authenticated
  using (public.is_platform_admin());

create policy applications_admin_update
  on public.professional_applications for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

/* -------------------------------------------------------------------------- */
/* Godkännande                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Godkänner en ansökan och publicerar rådgivaren i katalogen, atomärt.
 *
 * `verified` sätts till true - det är just det granskningen intygar, och
 * det är därför katalogens märke är värt något. Returnerar den nya
 * katalogpostens id.
 */
create or replace function public.approve_professional_application(p_application_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.professional_applications%rowtype;
  v_professional_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Kräver driftbehörighet';
  end if;

  select * into v_app
  from public.professional_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Ansökan finns inte';
  end if;
  if v_app.status = 'approved' then
    -- Idempotent nog: ett dubbelklick ska inte ge två katalogposter.
    raise exception 'Ansökan är redan godkänd';
  end if;

  insert into public.professionals
    (name, company, category, description, location, email, phone, website,
     fixed_prices, specializations, verified, active)
  values
    (v_app.contact_name, v_app.company, v_app.category, v_app.description,
     v_app.location, v_app.email, v_app.phone, v_app.website,
     coalesce(v_app.fixed_prices, '[]'::jsonb),
     coalesce(v_app.specializations, '{}'),
     true, true)
  returning id into v_professional_id;

  update public.professional_applications
  set status = 'approved', reviewed_at = now(), review_note = null
  where id = p_application_id;

  return v_professional_id;
end;
$$;

comment on function public.approve_professional_application(uuid) is
  'Publicering och statusbyte i EN händelse. Splittras de kan en publicerad rådgivare se obehandlad ut, eller en godkänd ansökan sakna katalogpost.';

/**
 * Begär komplettering eller avslår, med motivering.
 *
 * Motiveringen är obligatorisk vid båda: "vi behöver mer" utan att säga vad,
 * eller ett avslag utan skäl, lämnar den sökande utan nästa steg - och
 * driften utan minne av varför beslutet togs.
 */
create or replace function public.review_professional_application(
  p_application_id uuid,
  p_status public.application_status,
  p_note text
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Kräver driftbehörighet';
  end if;
  if p_status not in ('needs_info', 'rejected') then
    raise exception 'Använd approve_professional_application för godkännande';
  end if;
  if p_note is null or length(trim(p_note)) < 10 then
    raise exception 'Motivering krävs - den sökande ska veta vad som saknas eller varför det blev nej';
  end if;

  update public.professional_applications
  set status = p_status, review_note = trim(p_note), reviewed_at = now()
  where id = p_application_id;

  if not found then
    raise exception 'Ansökan finns inte';
  end if;
end;
$$;
