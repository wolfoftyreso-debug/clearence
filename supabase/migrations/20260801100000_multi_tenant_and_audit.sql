-- Multi-party cases and an append-only audit trail.
--
-- Until now a case belonged to exactly one user and every policy scoped on
-- `auth.uid() = user_id`. A reconstruction has a company, a rekonstruktör, an
-- auditor, legal counsel, a board and creditors all working on the same case,
-- so ownership moves to a membership table and every policy is rewritten
-- against it.
--
-- THE RULE THAT MATTERS MOST: a creditor is not a case member in the ordinary
-- sense. They see their own claim and their own correspondence, never the
-- case. `case_wide_roles()` deliberately excludes them, so anything added
-- later is closed to creditors by default rather than open by accident.
--
-- Losing row scoping here fails open - queries keep working and start
-- returning other companies' insolvency data. Every policy in this file is
-- exercised by supabase/tests/rls.sql.

/* -------------------------------------------------------------------------- */
/* Membership                                                                 */
/* -------------------------------------------------------------------------- */

create type public.case_role as enum (
  'owner',          -- företrädare för bolaget
  'company_staff',  -- bolagets ekonomifunktion
  'reconstructor',  -- rekonstruktör, förordnad av tingsrätten
  'trustee',        -- konkursförvaltare
  'auditor',        -- revisor
  'legal_advisor',
  'board_member',
  'creditor',       -- isolerad; se noten ovan
  'observer'        -- läsåtkomst, t.ex. tillsyn
);

create table public.case_members (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.case_role not null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Access is withdrawn by setting this, never by deleting the row: who had
  -- access when has to remain answerable.
  revoked_at timestamptz
);

create unique index case_members_active_unique
  on public.case_members (case_id, user_id, role)
  where revoked_at is null;

create index case_members_user_idx on public.case_members (user_id) where revoked_at is null;
create index case_members_case_idx on public.case_members (case_id) where revoked_at is null;

/** Roles that may see the case as a whole. Creditors are excluded by design. */
create or replace function public.case_wide_roles()
returns public.case_role[]
language sql
immutable
as $$
  select array[
    'owner', 'company_staff', 'reconstructor', 'trustee',
    'auditor', 'legal_advisor', 'board_member', 'observer'
  ]::public.case_role[];
$$;

/** Roles that may change the case's data. */
create or replace function public.case_write_roles()
returns public.case_role[]
language sql
immutable
as $$
  select array['owner', 'company_staff', 'reconstructor', 'trustee']::public.case_role[];
$$;

-- SECURITY DEFINER so a policy on `cases` can consult `case_members` without
-- the membership table's own policy consulting `cases` and recursing.
create or replace function public.has_case_access(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.case_members m
    where m.case_id = p_case_id
      and m.user_id = auth.uid()
      and m.revoked_at is null
      and m.role = any (public.case_wide_roles())
  );
$$;

create or replace function public.can_write_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.case_members m
    where m.case_id = p_case_id
      and m.user_id = auth.uid()
      and m.revoked_at is null
      and m.role = any (public.case_write_roles())
  );
$$;

create or replace function public.has_case_role(p_case_id uuid, p_roles public.case_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.case_members m
    where m.case_id = p_case_id
      and m.user_id = auth.uid()
      and m.revoked_at is null
      and m.role = any (p_roles)
  );
$$;

-- Everyone who owned a case under the old model becomes its owner member.
insert into public.case_members (case_id, user_id, role)
select c.id, c.user_id, 'owner'::public.case_role
from public.cases c
on conflict do nothing;

alter table public.case_members enable row level security;

create policy "Members see the membership of cases they belong to"
  on public.case_members for select
  using (
    user_id = auth.uid()
    or public.has_case_access(case_id)
  );

create policy "Owners and reconstructors invite members"
  on public.case_members for insert
  with check (
    public.has_case_role(case_id, array['owner', 'reconstructor', 'trustee']::public.case_role[])
  );

create policy "Owners and reconstructors revoke members"
  on public.case_members for update
  using (
    public.has_case_role(case_id, array['owner', 'reconstructor', 'trustee']::public.case_role[])
  )
  with check (
    public.has_case_role(case_id, array['owner', 'reconstructor', 'trustee']::public.case_role[])
  );

-- No delete policy: membership is revoked, never erased.

/* -------------------------------------------------------------------------- */
/* Rewrite the existing policies against membership                           */
/* -------------------------------------------------------------------------- */

drop policy if exists "Users can view their own cases" on public.cases;
drop policy if exists "Users can create their own cases" on public.cases;
drop policy if exists "Users can update their own cases" on public.cases;
drop policy if exists "Users can delete their own cases" on public.cases;

create policy "Case members read the case"
  on public.cases for select
  using (public.has_case_access(id));

-- The creator is still the one who inserts; membership is created immediately
-- afterwards by the trigger below.
create policy "Users create cases they own"
  on public.cases for insert
  with check (auth.uid() = user_id);

create policy "Writers update the case"
  on public.cases for update
  using (public.can_write_case(id))
  with check (public.can_write_case(id));

create policy "Only the owner deletes the case"
  on public.cases for delete
  using (public.has_case_role(id, array['owner']::public.case_role[]));

-- A case must never exist without a member, or its creator loses access to it
-- the moment the insert commits.
create or replace function public.add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.case_members (case_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger cases_add_creator_as_owner
  after insert on public.cases
  for each row execute function public.add_creator_as_owner();

-- Child tables follow the case rather than carrying their own owner check.
do $$
declare
  t text;
begin
  foreach t in array array['kbr_assessments', 'payments', 'invoices', 'case_documents']
  loop
    execute format('drop policy if exists %I on public.%I', 'Users can view their own ' || t, t);
    execute format($f$
      do $inner$
      declare p record;
      begin
        for p in select policyname from pg_policies
                 where schemaname = 'public' and tablename = %L
        loop
          execute format('drop policy %%I on public.%%I', p.policyname, %L);
        end loop;
      end $inner$;
    $f$, t, t);

    execute format(
      'create policy "Case members read" on public.%I for select using (public.has_case_access(case_id))', t);
    execute format(
      'create policy "Writers insert" on public.%I for insert with check (public.can_write_case(case_id))', t);
    execute format(
      'create policy "Writers update" on public.%I for update using (public.can_write_case(case_id)) with check (public.can_write_case(case_id))', t);
    execute format(
      'create policy "Writers delete" on public.%I for delete using (public.can_write_case(case_id))', t);
  end loop;
end $$;

/* -------------------------------------------------------------------------- */
/* Documents move from user-scoped paths to case-scoped paths                 */
/* -------------------------------------------------------------------------- */

-- The old convention prefixed every object key with the uploader's user id,
-- which makes a document unreachable for every other party on the case. Keys
-- are now prefixed with the case id, and the storage policies check
-- membership in that case.

alter table public.case_documents
  drop constraint if exists case_documents_storage_path_owned;

alter table public.case_documents
  add constraint case_documents_storage_path_scoped
  check (storage_path like case_id::text || '/%');

drop policy if exists "Users read their own case documents" on storage.objects;
drop policy if exists "Users upload their own case documents" on storage.objects;
drop policy if exists "Users delete their own case documents" on storage.objects;

create policy "Case members read case documents"
  on storage.objects for select
  using (
    bucket_id = 'case-documents'
    and public.has_case_access(((storage.foldername(name))[1])::uuid)
  );

create policy "Writers upload case documents"
  on storage.objects for insert
  with check (
    bucket_id = 'case-documents'
    and public.can_write_case(((storage.foldername(name))[1])::uuid)
  );

create policy "Writers delete case documents"
  on storage.objects for delete
  using (
    bucket_id = 'case-documents'
    and public.can_write_case(((storage.foldername(name))[1])::uuid)
  );

/* -------------------------------------------------------------------------- */
/* Audit trail                                                                */
/* -------------------------------------------------------------------------- */

create table public.audit_events (
  id bigint generated always as identity primary key,
  case_id uuid references public.cases (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_role public.case_role,
  action text not null,
  object_type text not null,
  object_id text,
  before jsonb,
  after jsonb,
  -- Server time, never supplied by the client. A timestamp a client can set
  -- is not evidence of anything.
  occurred_at timestamptz not null default now()
);

create index audit_events_case_idx on public.audit_events (case_id, occurred_at desc);

alter table public.audit_events enable row level security;

create policy "Case members read the audit trail"
  on public.audit_events for select
  using (public.has_case_access(case_id));

-- Rows arrive through the trigger below, which is SECURITY DEFINER. There is
-- deliberately no INSERT policy for clients, and no UPDATE or DELETE policy at
-- all: an audit trail that can be edited is not an audit trail.
revoke update, delete on public.audit_events from anon, authenticated;

-- The REVOKE above is not sufficient on its own. A routine
-- `grant ... on all tables in schema public` - which Supabase projects run
-- regularly - silently hands the privilege back, and RLS alone would let an
-- UPDATE through as a no-op rather than an error, so tampering would look
-- like it worked. This trigger is the actual guarantee: it refuses the
-- operation for every role including the table owner.
create or replace function public.audit_events_are_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'audit_events is append-only: % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_events_no_update
  before update on public.audit_events
  for each row execute function public.audit_events_are_append_only();

create trigger audit_events_no_delete
  before delete on public.audit_events
  for each row execute function public.audit_events_are_append_only();

create or replace function public.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case_id uuid;
  v_role public.case_role;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old);
    v_after := null;
  elsif tg_op = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(new);
  else
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  end if;

  v_case_id := coalesce(
    (v_after ->> 'case_id')::uuid,
    (v_before ->> 'case_id')::uuid,
    (v_after ->> 'id')::uuid,
    (v_before ->> 'id')::uuid
  );

  select m.role into v_role
  from public.case_members m
  where m.case_id = v_case_id
    and m.user_id = auth.uid()
    and m.revoked_at is null
  limit 1;

  insert into public.audit_events (
    case_id, actor_user_id, actor_role, action, object_type, object_id, before, after
  )
  values (
    v_case_id,
    auth.uid(),
    v_role,
    lower(tg_op),
    tg_table_name,
    coalesce(v_after ->> 'id', v_before ->> 'id'),
    v_before,
    v_after
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['cases', 'case_members', 'payments', 'invoices', 'case_documents', 'kbr_assessments']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.record_audit_event()',
      t || '_audit', t);
  end loop;
end $$;

grant select on public.audit_events to authenticated;
grant select, insert, update on public.case_members to authenticated;
