-- Egen signering: ett godkännande som lämnar bevis efter sig.
--
-- Beslut: BankID byggs INTE. Det kräver avtal, kostar per signering och
-- skulle blockera funktionen på obestämd tid. I stället byggs en enkel
-- elektronisk signatur (eIDAS art. 3.10) som är giltig som bevis vid fri
-- bevisprövning - och som gör det enda BankID egentligen köper oss:
-- kopplar en namngiven person till ett EXAKT innehåll vid en EXAKT
-- tidpunkt, på ett sätt som går att kontrollera i efterhand.
--
-- En signatur består av fyra delar. Var för sig svaga, tillsammans ett
-- användbart bevis:
--
--   VEM    kontot (adressen verifierad vid inloggning) plus det namn
--          personen själv skriver in i signeringsögonblicket
--   VAD    SHA-256 av innehållet vid signeringstillfället. Ändras filen
--          efteråt går det att SE det - signaturen blir inte ogiltig,
--          den blir "signerad, men innehållet har ändrats sedan dess"
--   NÄR    serverns tid. En tidsstämpel klienten kan sätta är inte bevis
--          på någonting
--   VAD MAN INTYGADE  den exakta texten, kopierad in i raden och
--          versionerad. "Jag godkände något" är värdelöst om ingen kan
--          visa vad som stod
--
-- Raderna är oföränderliga och raderas aldrig. En signatur som går att
-- ändra i efterhand är ingen signatur.

create table public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.case_documents(id) on delete cascade,
  signer_user_id uuid not null default auth.uid(),
  -- Namnet skrivs för hand vid signeringen. Att skriva sitt namn är den
  -- viljehandling som skiljer en signatur från ett klick.
  signer_name text not null check (char_length(trim(signer_name)) between 2 and 120),
  signer_email text not null,
  statement_version text not null,
  statement_text text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz not null default now()
);

comment on table public.document_signatures is
  'Enkel elektronisk signatur (eIDAS art. 3.10): vem, vilket innehall (SHA-256), nar, och exakt vad som intygades. Oforanderlig, raderas aldrig. INTE avancerad eller kvalificerad signatur.';

-- En person signerar ett dokument en gång. Vill man signera om måste
-- innehållet vara ett nytt dokument - annars vore "senaste signaturen"
-- ett sätt att skriva om historien.
create unique index document_signatures_one_per_signer
  on public.document_signatures (document_id, signer_user_id);

create index document_signatures_document_idx
  on public.document_signatures (document_id, signed_at desc);

alter table public.document_signatures enable row level security;

-- Kretsen ser signaturerna på ärendets handlingar. Borgenären, som inte
-- har ärendeåtkomst, ser dem aldrig.
create policy "Case participants read signatures"
  on public.document_signatures for select
  using (
    exists (
      select 1 from public.case_documents d
      where d.id = document_id and public.has_case_access(d.case_id)
    )
  );

-- Ingen insert-, update- eller delete-policy. Signering går ENBART genom
-- sign_document() nedan, som prövar behörighet och status i ett svep.
-- En klient som får välja hash själv utan den prövningen kan försegla
-- vad som helst i någon annans namn.

create or replace function public.guard_signature_immutability()
returns trigger
language plpgsql
as $$
begin
  raise exception 'En signatur kan varken ändras eller raderas';
end;
$$;

create trigger document_signatures_immutable
  before update or delete on public.document_signatures
  for each row execute function public.guard_signature_immutability();

/**
 * Signerar en handling.
 *
 * Prövar tre saker och gör sedan exakt en sak:
 *   1. Signeraren har ärendeåtkomst i en av kretsens roller. En borgenär
 *      kan aldrig signera bolagets handlingar.
 *   2. Handlingen är inte ett utkast. Man signerar inte ett utkast.
 *   3. Namnet är ifyllt på riktigt.
 *
 * Granskningsstatusen i övrigt spelar ingen roll: rådgivarens stämpel är
 * en kvalitetskontroll, signaturen är företrädarens egen viljehandling.
 * Att låta stämpeln vara ett villkor för signaturen vore att låta
 * rådgivaren grinda styrelsens egna beslut - tvärtemot löftet om att
 * viktiga affärsbeslut alltid är användarens.
 */
create or replace function public.sign_document(
  p_document_id uuid,
  p_signer_name text,
  p_content_sha256 text,
  p_statement_version text,
  p_statement_text text
)
returns public.document_signatures
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case_id uuid;
  v_status text;
  v_email text;
  v_row public.document_signatures;
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;

  select d.case_id, d.review_status into v_case_id, v_status
  from public.case_documents d
  where d.id = p_document_id;

  if v_case_id is null then
    raise exception 'Handlingen finns inte';
  end if;

  if not exists (
    select 1 from public.case_members m
    where m.case_id = v_case_id
      and m.user_id = auth.uid()
      and m.revoked_at is null
      and m.role = any (public.case_wide_roles())
  ) then
    raise exception 'Du har inte behörighet att signera i det här ärendet';
  end if;

  if v_status = 'draft' then
    raise exception 'Ett utkast kan inte signeras';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.document_signatures (
    document_id, signer_name, signer_email,
    statement_version, statement_text, content_sha256
  )
  values (
    p_document_id, trim(p_signer_name), coalesce(v_email, ''),
    p_statement_version, p_statement_text, lower(p_content_sha256)
  )
  returning * into v_row;

  -- Journalen är produktens gemensamma tidslinje. En signatur som inte
  -- syns där har inte hänt, ur användarens synvinkel.
  insert into public.audit_events (case_id, actor_user_id, action, object_type, object_id, after)
  values (
    v_case_id, auth.uid(), 'signed', 'case_documents', p_document_id::text,
    jsonb_build_object('signer_name', trim(p_signer_name), 'signed_at', v_row.signed_at)
  );

  return v_row;
end;
$$;

revoke all on function public.sign_document(uuid, text, text, text, text) from public;
grant execute on function public.sign_document(uuid, text, text, text, text) to authenticated;
