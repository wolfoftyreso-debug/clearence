-- Byråns egen profiladministration.
--
-- Andra halvan av anspråksflödet: godkännandet kopplade profilen till
-- kontot och satte Verifierad - men en profil som inte går att hålla
-- aktuell förfaller till samma skick som en förifylld. Innehavaren ska
-- kunna uppdatera det som beskriver tjänsten: beskrivning, ort,
-- kontaktvägar, specialiseringar, fasta priser och faktureringsadress.
--
-- Det innehavaren INTE kan röra är lika viktigt: namn, byrå, kategori och
-- verifieringsmärket är identitet och granskning - de ändras av driften,
-- efter kontroll, aldrig av ett formulär. En katalog där byrån själv kan
-- byta namn är ett ryktesbibliotek igen.

/**
 * Innehavarens egen profil, inklusive faktureringsadressen som inte ingår
 * i den publika katalogvyn. Null-resultat = inget konto kopplat.
 */
create or replace function public.get_my_professional_profile()
returns table (
  id uuid,
  name text,
  company text,
  category text,
  verified boolean,
  description text,
  location text,
  email text,
  phone text,
  website text,
  specializations text[],
  fixed_prices jsonb,
  billing_email text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.company, p.category::text, p.verified,
         p.description, p.location, p.email, p.phone, p.website,
         p.specializations, p.fixed_prices, p.billing_email
  from public.professionals p
  where p.user_id = auth.uid()
    and p.active = true
  order by p.created_at
  limit 1;
$$;

/**
 * Uppdaterar innehavarens profil. Formuläret skickar hela tillståndet -
 * ett utelämnat fält är ett tömt fält, inte ett orört. Identitetsfälten
 * och verifieringen finns med avsikt inte bland parametrarna.
 */
create or replace function public.update_my_professional_profile(
  p_description text,
  p_location text,
  p_email text,
  p_phone text,
  p_website text,
  p_specializations text[],
  p_fixed_prices jsonb,
  p_billing_email text
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Kräver inloggning';
  end if;

  -- Fasta priser: en lista av {service, price}, priser >= 0. Valideras
  -- här - en trasig struktur ska stoppas vid dörren, inte rendera sönder
  -- katalogen.
  if p_fixed_prices is not null then
    if jsonb_typeof(p_fixed_prices) <> 'array' then
      raise exception 'Fasta priser ska vara en lista';
    end if;
    for v_item in select * from jsonb_array_elements(p_fixed_prices) loop
      if coalesce(trim(v_item->>'service'), '') = '' then
        raise exception 'Varje fast pris behöver en tjänstebeskrivning';
      end if;
      if (v_item->>'price') is null or (v_item->>'price')::numeric < 0 then
        raise exception 'Varje fast pris behöver ett belopp (0 kr eller mer)';
      end if;
    end loop;
  end if;
  if p_website is not null and trim(p_website) <> ''
     and p_website !~* '^https?://' then
    raise exception 'Webbadressen ska börja med http:// eller https://';
  end if;

  update public.professionals
  set description = nullif(trim(coalesce(p_description, '')), ''),
      location = nullif(trim(coalesce(p_location, '')), ''),
      email = nullif(trim(coalesce(p_email, '')), ''),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      website = nullif(trim(coalesce(p_website, '')), ''),
      specializations = coalesce(p_specializations, '{}'),
      fixed_prices = coalesce(p_fixed_prices, '[]'::jsonb),
      billing_email = nullif(trim(coalesce(p_billing_email, '')), ''),
      updated_at = now()
  where user_id = auth.uid()
    and active = true;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Ingen byråprofil är kopplad till ditt konto';
  end if;
end;
$$;

comment on function public.update_my_professional_profile(text, text, text, text, text, text[], jsonb, text) is
  'Innehavarens egen profiluppdatering. Namn, byrå, kategori och verified kan bara driften ändra - de är identitet och granskning, inte formulärfält.';

revoke all on function public.get_my_professional_profile() from public;
revoke all on function public.update_my_professional_profile(text, text, text, text, text, text[], jsonb, text) from public;
grant execute on function public.get_my_professional_profile() to authenticated;
grant execute on function public.update_my_professional_profile(text, text, text, text, text, text[], jsonb, text) to authenticated;
