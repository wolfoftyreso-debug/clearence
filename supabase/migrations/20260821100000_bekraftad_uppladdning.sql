-- UPPLADDNINGEN BEKRÄFTAS AV SERVERN, INTE AV KLIENTEN.
--
-- En uppladdning bär tre påståenden från avsändaren: filnamnet, ändelsen
-- och Content-Type. Alla tre är fritext hen väljer själv. En Linux-binär
-- som heter "arsredovisning.pdf" ser i alla tre likadan ut som en
-- årsredovisning.
--
-- Därför sker uppladdningen i två steg (api/server/index.ts):
--
--   1. Servern väljer sökvägen och signerar en kortlivad PUT-URL. Raden
--      skapas med confirmed_at = null.
--   2. Servern LÄSER TILLBAKA filens första bytes ur lagringen och prövar
--      signaturen mot den utlovade typen (api/server/filtyper.ts). Först
--      då sätts confirmed_at.
--
-- Kolumnen nedan är vad som gör steg 2 meningsfullt: utan den fanns ingen
-- skillnad mellan "uppladdad" och "prövad", och en fil som aldrig
-- bekräftades hade sett ut precis som en godkänd.
--
-- BEFINTLIGA RADER RÄKNAS SOM BEKRÄFTADE. De laddades upp genom den gamla
-- vägen, och att i efterhand dölja hela arkivet för alla kunder vore att
-- byta ett säkerhetsproblem mot ett driftavbrott. Nya rader måste passera
-- prövningen.

alter table public.case_documents
  add column if not exists confirmed_at timestamptz;

update public.case_documents set confirmed_at = created_at where confirmed_at is null;

comment on column public.case_documents.confirmed_at is
  'Satt när SERVERN läst tillbaka filens bytes och prövat dem mot utlovad typ. Null = uppladdningen är påbörjad men inte prövad; raden ska inte visas.';

create index if not exists case_documents_obekraftade_idx
  on public.case_documents (case_id)
  where confirmed_at is null;

/* -------------------------------------------------------------------------- */
/* En obekräftad fil får inte gå att läsa                                     */
/* -------------------------------------------------------------------------- */

-- app.may_read_document() är den enda fråga API:t ställer innan en signerad
-- nedladdnings-URL skapas. Den måste därför säga nej till en fil som ännu
-- inte prövats - annars kunde en angripare ladda upp vad som helst, hoppa
-- över bekräftelsen och ändå få ut en signerad URL till innehållet.
--
-- Bekräftelserutten läser raden genom samma funktion, så den behöver kunna
-- se en obekräftad rad. Den skillnaden bärs av p_aven_obekraftad, som bara
-- servern sätter - och bara i det steget.
--
-- DEN GAMLA ENARGSFUNKTIONEN MÅSTE BORT FÖRST. "create or replace" med en ny
-- signatur ersätter ingenting - den skapar en ANDRA funktion, och då blir
-- anropet med ett argument tvetydigt (42725). Fyra rutter slutade fungera
-- på just det innan den här raden fanns.
drop function if exists app.may_read_document(uuid);

create or replace function app.may_read_document(
  p_document_id uuid,
  p_aven_obekraftad boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select exists (
    select 1
    from public.case_documents d
    where d.id = p_document_id
      and (p_aven_obekraftad or d.confirmed_at is not null)
      and public.has_case_access(d.case_id)
  );
$$;

comment on function app.may_read_document(uuid, boolean) is
  'Den enda behörighetsfrågan före en signerad dokument-URL. En obekräftad fil är osynlig om inte anroparen uttryckligen ber om den (bekräftelsesteget).';
