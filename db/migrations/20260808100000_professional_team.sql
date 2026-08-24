-- Byråteamet: flera inloggningar per byrå.
--
-- En byrå (professionals-raden) har hittills haft EN kopplad inloggning -
-- den som gjorde anspråket. Teamet lägger kollegor bredvid: den kopplade
-- inloggningen är byråns administratör (implicit, ur professionals.user_id
-- - ingen dubbellagring), och administratören bjuder in kollegor per
-- e-postadress med samma säkerhetsmodell som ärendeinbjudningarna: länken
-- är inte nyckeln, adressen är.
--
-- Viktig gräns: teammedlemskap ger INGEN automatisk åtkomst till klienters
-- ärenden. Ärendeåtkomst är per ärende, via case_members, alltid - ett
-- bolags insolvensdata följer inte med på köpet för att byrån anställer.
-- Teamet är identitet ("vi hör till samma byrå") och grunden för
-- kollega-genvägar i inbjudningsflödet, inget mer.

create table public.professional_members (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (professional_id, user_id)
);

comment on table public.professional_members is
  'Byråns team utöver den kopplade administratören. Ger INTE ärendeåtkomst - den är per ärende via case_members.';

create table public.professional_invitations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz
);

alter table public.professional_members enable row level security;
alter table public.professional_invitations enable row level security;

/** Aktiv i byråns team: den kopplade administratören eller en aktiv medlem. */
create or replace function public.is_firm_member(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.professionals p
    where p.id = p_professional_id and p.user_id = auth.uid()
  ) or exists (
    select 1 from public.professional_members m
    where m.professional_id = p_professional_id
      and m.user_id = auth.uid()
      and m.revoked_at is null
  );
$$;

create or replace function public.is_firm_admin(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.professionals p
    where p.id = p_professional_id and p.user_id = auth.uid()
  ) or exists (
    select 1 from public.professional_members m
    where m.professional_id = p_professional_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
      and m.revoked_at is null
  );
$$;

-- Läsning för teamet och drift; ALLA skrivningar går genom funktionerna
-- nedan (inga insert/update/delete-policyer = radskyddet nekar).
create policy "Team members read the team"
  on public.professional_members for select
  using (public.is_firm_member(professional_id) or public.is_platform_admin());

create policy "Team members read the invitations"
  on public.professional_invitations for select
  using (public.is_firm_member(professional_id) or public.is_platform_admin());

/** Administratören bjuder in en kollega per e-postadress. */
create or replace function public.invite_firm_member(
  p_professional_id uuid,
  p_email text,
  p_role text default 'member'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  if not public.is_firm_admin(p_professional_id) then
    raise exception 'Endast byråns administratör kan bjuda in kollegor';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Ogiltig roll';
  end if;
  if exists (
    select 1 from public.professional_members m
    join auth.users u on u.id = m.user_id
    where m.professional_id = p_professional_id
      and lower(u.email) = v_email
      and m.revoked_at is null
  ) then
    raise exception 'Adressen är redan med i teamet';
  end if;
  if exists (
    select 1 from public.professional_invitations i
    where i.professional_id = p_professional_id
      and i.email = v_email
      and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  ) then
    raise exception 'Adressen har redan en öppen inbjudan';
  end if;

  insert into public.professional_invitations (professional_id, email, role)
  values (p_professional_id, v_email, p_role)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.revoke_firm_invitation(p_invitation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_professional uuid;
begin
  select professional_id into v_professional
  from public.professional_invitations where id = p_invitation_id;
  if v_professional is null or not public.is_firm_admin(v_professional) then
    raise exception 'Endast byråns administratör kan återkalla inbjudningar';
  end if;
  update public.professional_invitations
  set revoked_at = now()
  where id = p_invitation_id and accepted_at is null and revoked_at is null;
end;
$$;

/**
 * Inbjudningar ställda till den inloggades adress. Samma neutrala tystnad
 * som ärendeinbjudningarna: andras inbjudningar syns aldrig här.
 */
create or replace function public.my_firm_invitations()
returns table (
  id uuid,
  professional_id uuid,
  firm_name text,
  role text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, i.professional_id, coalesce(p.company, p.name), i.role, i.created_at
  from public.professional_invitations i
  join public.professionals p on p.id = i.professional_id
  where i.email = (select lower(u.email) from auth.users u where u.id = auth.uid())
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now();
$$;

create or replace function public.accept_firm_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.professional_invitations%rowtype;
begin
  select * into v_invitation
  from public.professional_invitations
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

  insert into public.professional_members (professional_id, user_id, role)
  values (v_invitation.professional_id, auth.uid(), v_invitation.role)
  on conflict (professional_id, user_id)
  do update set revoked_at = null, role = excluded.role;

  update public.professional_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = p_invitation_id;

  return v_invitation.professional_id;
end;
$$;

create or replace function public.remove_firm_member(p_member_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.professional_members%rowtype;
begin
  select * into v_member from public.professional_members where id = p_member_id;
  if v_member.id is null or not public.is_firm_admin(v_member.professional_id) then
    raise exception 'Endast byråns administratör kan ta bort teammedlemmar';
  end if;
  update public.professional_members
  set revoked_at = now()
  where id = p_member_id and revoked_at is null;
end;
$$;

/**
 * Teamet med namn och adress. Funktion av samma skäl som ärendets
 * medlemslista: profiltabellen är privat per rad, men i sitt eget team
 * måste man kunna se vem kollegorna är. Den kopplade administratören
 * redovisas med null-id - den raden kan inte tas bort, byrån utan
 * administratör vore ett låst skåp.
 */
create or replace function public.list_firm_team(p_professional_id uuid)
returns table (
  id uuid,
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select null::uuid, p.user_id, lower(u.email), 'admin'::text, p.updated_at
  from public.professionals p
  join auth.users u on u.id = p.user_id
  where p.id = p_professional_id
    and p.user_id is not null
    and public.is_firm_member(p_professional_id)
  union all
  select m.id, m.user_id, lower(u.email), m.role, m.created_at
  from public.professional_members m
  join auth.users u on u.id = m.user_id
  where m.professional_id = p_professional_id
    and m.revoked_at is null
    and public.is_firm_member(p_professional_id);
$$;

revoke all on function public.is_firm_member(uuid) from public;
revoke all on function public.is_firm_admin(uuid) from public;
revoke all on function public.invite_firm_member(uuid, text, text) from public;
revoke all on function public.revoke_firm_invitation(uuid) from public;
revoke all on function public.my_firm_invitations() from public;
revoke all on function public.accept_firm_invitation(uuid) from public;
revoke all on function public.remove_firm_member(uuid) from public;
revoke all on function public.list_firm_team(uuid) from public;
grant execute on function public.is_firm_member(uuid) to authenticated;
grant execute on function public.is_firm_admin(uuid) to authenticated;
grant execute on function public.invite_firm_member(uuid, text, text) to authenticated;
grant execute on function public.revoke_firm_invitation(uuid) to authenticated;
grant execute on function public.my_firm_invitations() to authenticated;
grant execute on function public.accept_firm_invitation(uuid) to authenticated;
grant execute on function public.remove_firm_member(uuid) to authenticated;
grant execute on function public.list_firm_team(uuid) to authenticated;
