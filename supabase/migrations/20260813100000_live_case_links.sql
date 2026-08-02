-- Live ärendelänk: en säker länk som ÄR ärendet, alltid aktuell.
--
-- Ingen rapport som måste skapas manuellt - länken visar ärendets
-- nuläge varje gång den öppnas. En källa till sanningen för kretsen:
-- revisor, jurist, bank, försäkringsbolag, finansiär.
--
-- Säkerhetsmodellen skiljer sig MEDVETET från inbjudningarna. En
-- inbjudan ger medlemskap (adressen är nyckeln). En live-länk ger
-- LÄSNING av ett SCOPAT utsnitt: den kan tidsbegränsas, återkallas
-- när som helst, och varje öppning loggas. Företrädaren väljer nivå:
--   overview  status, lägesbild och frister - inga dokument
--   full      även dokumentlistan med granskningsstatus
--
-- Länken levererar strukturerad, spårbar ärendedata - ALDRIG
-- automatiska bedömningar. Mottagarens system drar sina egna
-- slutsatser ur samma datamodell (maskinläsbart format).

create table public.case_share_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  scope text not null default 'overview' check (scope in ('overview', 'full')),
  label text check (label is null or length(label) <= 120),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

comment on table public.case_share_links is
  'Live ärendelänkar: scopad läsning, tidsbegränsad, återkallbar, åtkomstloggad. Id:t är länkens token.';

create index case_share_links_case_idx on public.case_share_links (case_id, created_at desc);

alter table public.case_share_links enable row level security;

create policy "Case writers manage share links"
  on public.case_share_links for select
  using (public.can_write_case(case_id));

create policy "Case writers create share links"
  on public.case_share_links for insert
  with check (created_by = auth.uid() and public.can_write_case(case_id));

create policy "Case writers revoke share links"
  on public.case_share_links for update
  using (public.can_write_case(case_id))
  with check (public.can_write_case(case_id));

-- Åtkomstloggen: varje öppning, alltid. Ingen läsning utan spår.
create table public.share_link_access (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.case_share_links(id) on delete cascade,
  accessed_at timestamptz not null default now()
);

alter table public.share_link_access enable row level security;

create policy "Case writers read the access log"
  on public.share_link_access for select
  using (exists (
    select 1 from public.case_share_links l
    where l.id = share_link_access.link_id and public.can_write_case(l.case_id)
  ));

/**
 * Hämtningen: anonym, scopad, loggad. Returnerar null-likt fel för
 * återkallade, utgångna och okända länkar - samma tystnad för alla,
 * så att en länk inte kan användas för att sondera vilka ärenden som
 * finns.
 */
create or replace function public.fetch_shared_case(p_token uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.case_share_links%rowtype;
  v_case public.cases%rowtype;
  v_docs jsonb;
begin
  select * into v_link from public.case_share_links
  where id = p_token and revoked_at is null and expires_at > now();
  if not found then
    return null;
  end if;

  insert into public.share_link_access (link_id) values (v_link.id);

  select * into v_case from public.cases where id = v_link.case_id;

  if v_link.scope = 'full' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'file_name', d.file_name,
      'kind', d.kind,
      'review_status', d.review_status,
      'created_at', d.created_at
    ) order by d.created_at desc), '[]'::jsonb)
    into v_docs
    from public.case_documents d where d.case_id = v_link.case_id;
  else
    v_docs := null;
  end if;

  return jsonb_build_object(
    'scope', v_link.scope,
    'expires_at', v_link.expires_at,
    'company_name', v_case.company_name,
    'org_number', v_case.org_number,
    'recommendation_type', v_case.recommendation_type,
    'recommendation_title', v_case.recommendation_title,
    'total_debt', v_case.total_debt,
    'quick_liquidation_value', v_case.quick_liquidation_value,
    'can_pay_salary', v_case.can_pay_salary,
    'can_pay_tax', v_case.can_pay_tax,
    'can_pay_rent', v_case.can_pay_rent,
    'can_pay_suppliers', v_case.can_pay_suppliers,
    'salary_amount', v_case.salary_amount, 'salary_day', v_case.salary_day,
    'tax_amount', v_case.tax_amount, 'tax_day', v_case.tax_day,
    'rent_amount', v_case.rent_amount, 'rent_day', v_case.rent_day,
    'closed_at', v_case.closed_at,
    'health_mode', v_case.health_mode,
    'updated_at', v_case.updated_at,
    'documents', v_docs
  );
end;
$$;

comment on function public.fetch_shared_case(uuid) is
  'Live ärendelänkens läsning: anonym men scopad, tidsprövad, återkallbar och ALLTID loggad. Data, aldrig bedömningar.';

revoke all on function public.fetch_shared_case(uuid) from public;
grant execute on function public.fetch_shared_case(uuid) to anon, authenticated;
