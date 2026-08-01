-- Inbjudningar till ärendet.
--
-- Medlemskapstabellen har funnits sedan multi-tenant-migrationen, men det
-- har inte funnits någon väg IN i den för en styrelsekollega, revisor eller
-- rådgivare som inte redan har konto. Det här är den vägen: en inbjudan
-- ställd till en e-postadress, med en roll, som blir medlemskap först när
-- någon inloggad med EXAKT den adressen tackar ja.
--
-- Säkerhetsmodellen i en mening: LÄNKEN ÄR INTE NYCKELN, ADRESSEN ÄR.
-- Inbjudans id ingår i länken, men accept kräver att den inloggades
-- e-postadress matchar inbjudans. En vidarebefordrad länk ger alltså
-- ingenting - fel adress, inget medlemskap. Därför är det ofarligt att
-- ärendets medlemmar ser inbjudningarna (de behöver kunna se vilka som
-- väntar och återkalla dem).
--
-- Två roller kan aldrig bjudas in denna väg:
--  - 'owner': företrädarskap delas inte ut per mejl.
--  - 'creditor': borgenärsvyn finns inte än, och en inbjudan till en vy som
--    inte finns är ett löfte som inte hålls. Dessutom är borgenärer
--    medvetet uteslutna ur has_case_access - de ska in genom en egen,
--    smalare dörr när den byggs.
--
-- Mejlet skickas av arbetaren (db/worker), inte av klienten: utkorgen har
-- ingen insert-policy för vanliga användare, och så ska det förbli - en
-- ägare som kan lägga fritt innehåll i utkorgen är en spamkanal med vårt
-- avsändarrykte. Arbetaren bygger innehållet ur samma mejlbyggare som allt
-- annat och bockar av email_enqueued_at i samma transaktion.

create table public.case_invitations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  email text not null,
  role public.case_role not null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- En inbjudan som ligger öppen i månader är en bortglömd dörr på glänt.
  expires_at timestamptz not null default now() + interval '30 days',
  /** Satt av arbetaren när mejlet lagts i utkorgen. Skyddet mot dubbelutskick. */
  email_enqueued_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  -- Återkallas, raderas aldrig: vem som bjöds in när ska förbli svarbart.
  revoked_at timestamptz,

  constraint case_invitations_email_shape
    check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- Lagras gemener: accept jämför adresser, och 'Anna@' mot 'anna@' får
  -- aldrig vara skillnaden mellan åtkomst och inte.
  constraint case_invitations_email_lowercase check (email = lower(email)),
  constraint case_invitations_role_invitable
    check (role not in ('owner', 'creditor')),
  constraint case_invitations_accepted_pair
    check ((accepted_at is null) = (accepted_by is null))
);

comment on table public.case_invitations is
  'Inbjudningar till ärendet. Accept kräver inloggning med inbjudans adress - länken ensam ger inget. Mejlas av arbetaren.';

-- Högst en öppen inbjudan per adress och ärende. Avgjorda (accepterade eller
-- återkallade) ligger kvar som historik.
create unique index case_invitations_open_unique
  on public.case_invitations (case_id, email)
  where accepted_at is null and revoked_at is null;

create index case_invitations_unmailed_idx
  on public.case_invitations (created_at)
  where email_enqueued_at is null and accepted_at is null and revoked_at is null;

alter table public.case_invitations enable row level security;

-- Medlemmarna ser ärendets inbjudningar (för att kunna återkalla och för att
-- slippa dubbelbjuda). Borgenärer utesluts som alltid via has_case_access.
-- All skrivning går genom funktionerna nedan - inga insert/update-policyer.
create policy case_invitations_members_read
  on public.case_invitations for select to authenticated
  using (public.has_case_access(case_id));

grant select on public.case_invitations to authenticated;

-- Revisionsloggas som allt annat i ärendet.
create trigger case_invitations_audit
  after insert or update or delete on public.case_invitations
  for each row execute function public.record_audit_event();

/**
 * Bjuder in en adress till ärendet. Samma roller som får lägga till
 * medlemmar direkt: ägare, rekonstruktör, förvaltare.
 */
create or replace function public.invite_to_case(
  p_case_id uuid,
  p_email text,
  p_role public.case_role
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.has_case_role(
    p_case_id, array['owner', 'reconstructor', 'trustee']::public.case_role[]
  ) then
    raise exception 'Kräver behörighet att bjuda in till ärendet';
  end if;

  insert into public.case_invitations (case_id, email, role, invited_by)
  values (p_case_id, lower(trim(p_email)), p_role, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

/** Återkallar en öppen inbjudan. Samma behörighet som att bjuda in. */
create or replace function public.revoke_case_invitation(p_invitation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_case_id uuid;
begin
  select case_id into v_case_id
  from public.case_invitations
  where id = p_invitation_id and accepted_at is null and revoked_at is null;

  if v_case_id is null then
    raise exception 'Inbjudan finns inte eller är redan avgjord';
  end if;

  if not public.has_case_role(
    v_case_id, array['owner', 'reconstructor', 'trustee']::public.case_role[]
  ) then
    raise exception 'Kräver behörighet att återkalla inbjudan';
  end if;

  update public.case_invitations
  set revoked_at = now()
  where id = p_invitation_id;
end;
$$;

/**
 * Vad den inbjudna får se INNAN accept: bolagsnamn, roll och vem som bjöd
 * in. Bara om den inloggades adress matchar - för alla andra finns inbjudan
 * inte, med samma neutrala tystnad som lösenordsåterställningen.
 */
create or replace function public.peek_case_invitation(p_invitation_id uuid)
returns table (
  id uuid,
  company_name text,
  org_number text,
  role public.case_role,
  inviter_name text,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, c.company_name, c.org_number, i.role,
         p.display_name, i.expires_at, i.accepted_at, i.revoked_at
  from public.case_invitations i
  join public.cases c on c.id = i.case_id
  left join public.user_profiles p on p.user_id = i.invited_by
  where i.id = p_invitation_id
    -- Adressen läses ur auth.users, inte ur JWT:n: den fungerar likadant i
    -- båda driftmiljöerna och kan inte vara inaktuell.
    and i.email = (select lower(u.email) from auth.users u where u.id = auth.uid());
$$;

/**
 * Accept: adressen avgör. Medlemskapet skapas med rollen ur inbjudan och
 * inbjudarens id, så revisionsloggen visar hela kedjan.
 */
create or replace function public.accept_case_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.case_invitations%rowtype;
begin
  select * into v_invitation
  from public.case_invitations
  where id = p_invitation_id
    and email = (select lower(u.email) from auth.users u where u.id = auth.uid())
  for update;

  if v_invitation.id is null then
    raise exception 'Inbjudan finns inte eller är ställd till en annan adress';
  end if;
  if v_invitation.revoked_at is not null then
    raise exception 'Inbjudan är återkallad';
  end if;
  if v_invitation.accepted_at is not null then
    raise exception 'Inbjudan är redan använd';
  end if;
  if v_invitation.expires_at < now() then
    raise exception 'Inbjudan har gått ut';
  end if;

  insert into public.case_members (case_id, user_id, role, invited_by)
  values (v_invitation.case_id, auth.uid(), v_invitation.role, v_invitation.invited_by)
  on conflict do nothing;

  update public.case_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = p_invitation_id;

  return v_invitation.case_id;
end;
$$;

/**
 * Medlemslistan med namn. Funktion i stället för join från klienten:
 * user_profiles låter var och en läsa bara sin egen rad, och det ska
 * fortsätta gälla - men i ett ärende man tillhör måste man kunna se VEM
 * de andra medlemmarna är. Namn och adress, inget mer ur profilen.
 */
create or replace function public.list_case_members(p_case_id uuid)
returns table (
  id uuid,
  user_id uuid,
  role public.case_role,
  display_name text,
  email text,
  created_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.user_id, m.role, p.display_name, u.email::text,
         m.created_at, m.revoked_at
  from public.case_members m
  left join public.user_profiles p on p.user_id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.case_id = p_case_id
    and public.has_case_access(p_case_id)
  order by m.created_at;
$$;
