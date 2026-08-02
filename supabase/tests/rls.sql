-- Row-level security tests.
--
-- These are the tests that matter most in this project. A behaviour bug shows
-- up as a wrong number on a screen; an RLS bug shows one company's insolvency
-- data to another, and it fails open - the query still succeeds, it just
-- returns rows it should not.
--
-- Run with: npm run test:rls
--
-- Every assertion runs as the `authenticated` role with a request-scoped user
-- id, exactly as PostgREST sets it.

\set ON_ERROR_STOP on
\pset pager off

-- Everything runs in one transaction. Two reasons: `set local role` only
-- works inside one - without it the tests run as the table owner, which
-- bypasses RLS and makes every assertion pass for the wrong reason - and the
-- fixtures roll back at the end so the database is left clean.
begin;

create or replace function pg_temp.check(p_name text, p_actual anyelement, p_expected anyelement)
returns void language plpgsql as $$
begin
  if p_actual is not distinct from p_expected then
    raise notice 'ok    %', p_name;
  else
    raise exception 'FAIL  % : got %, expected %', p_name, p_actual, p_expected;
  end if;
end $$;

/* --- fixtures ------------------------------------------------------------ */

-- password_hash is a placeholder: these tests are about row scoping, not
-- authentication, and the self-hosted schema requires the column.
insert into auth.users (id, email, password_hash) values
  ('11111111-1111-1111-1111-111111111111', 'agnes@bolag-a.se',  'x'),  -- owner, case A
  ('22222222-2222-2222-2222-222222222222', 'bertil@bolag-b.se', 'x'),  -- owner, case B
  ('33333333-3333-3333-3333-333333333333', 'rekon@byra.se',     'x'),  -- reconstructor, case A
  ('44444444-4444-4444-4444-444444444444', 'revisor@byra.se',   'x'),  -- auditor, case A
  ('55555555-5555-5555-5555-555555555555', 'borgenar@lev.se',   'x'),  -- creditor, case A
  ('66666666-6666-6666-6666-666666666666', 'ingen@utanfor.se',  'x');  -- no membership

-- Cases are seeded as the table owner, bypassing RLS, so the fixtures do not
-- depend on the policies under test.
insert into public.cases (id, user_id, org_number, company_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '556000-0001', 'Bolag A AB'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '556000-0002', 'Bolag B AB');

insert into public.case_members (case_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'reconstructor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'auditor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'creditor');

insert into public.payments (id, case_id, user_id, label, amount, category, due_date) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Löner', 420000, 'salary', current_date + 10);

insert into public.case_documents (case_id, user_id, kind, file_name, file_size, mime_type, storage_path)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'bank_statement', 'kontoutdrag.csv', 1024, 'text/csv',
        'aaaaaaaa-0000-0000-0000-000000000001/kontoutdrag.csv');

-- Deliberately a blanket grant, the way a Supabase project routinely does it.
-- If the append-only guarantee depends on a REVOKE, this line undoes it and
-- the assertions below will catch that.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select, insert, delete on storage.objects to authenticated;

/* --- helper -------------------------------------------------------------- */

-- Sets both identity sources so this one suite is the shared contract for
-- both deployments: `request.jwt.claim.sub` is what Supabase's auth.uid()
-- reads, `app.user_id` is what the self-hosted app.current_user_id() reads.
-- The suite must pass identically against both, since a difference in row
-- scoping between them would fail open and be invisible at runtime.
create or replace function pg_temp.as_user(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('app.user_id', p_user::text, true);
end $$;

/* ========================================================================== */
/* Guard: prove the tests are actually subject to RLS                         */
/* ========================================================================== */

-- The table owner bypasses row-level security. If these tests ever run as the
-- owner, every isolation assertion passes for the wrong reason and the suite
-- becomes worse than useless. Fail loudly instead.

set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

do $$
begin
  if current_user <> 'authenticated' then
    raise exception 'FAIL  tests are running as % - RLS would be bypassed', current_user;
  end if;
  if auth.uid() is null then
    raise exception 'FAIL  auth.uid() is null - the request user was not set';
  end if;
  raise notice 'ok    running as authenticated with a request user, RLS in force';
end $$;

/* ========================================================================== */
/* The owner sees their own case                                              */
/* ========================================================================== */

select pg_temp.check('owner reads own case',
  (select count(*)::int from public.cases where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1);
select pg_temp.check('owner does NOT read the other company''s case',
  (select count(*)::int from public.cases where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0);
select pg_temp.check('owner sees exactly one case in total',
  (select count(*)::int from public.cases), 1);
select pg_temp.check('owner reads own payments',
  (select count(*)::int from public.payments), 1);
select pg_temp.check('owner reads own documents',
  (select count(*)::int from public.case_documents), 1);

/* ========================================================================== */
/* A second company is fully isolated                                         */
/* ========================================================================== */

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select pg_temp.check('other owner sees only their own case',
  (select count(*)::int from public.cases), 1);
select pg_temp.check('other owner reads no foreign payments',
  (select count(*)::int from public.payments), 0);
select pg_temp.check('other owner reads no foreign documents',
  (select count(*)::int from public.case_documents), 0);
select pg_temp.check('other owner reads no foreign audit events',
  (select count(*)::int from public.audit_events
   where case_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0);

/* ========================================================================== */
/* The reconstructor sees the case they are appointed to, and only that       */
/* ========================================================================== */

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');

select pg_temp.check('reconstructor reads the case',
  (select count(*)::int from public.cases), 1);
select pg_temp.check('reconstructor reads payments',
  (select count(*)::int from public.payments), 1);
select pg_temp.check('reconstructor may write',
  (select public.can_write_case('aaaaaaaa-0000-0000-0000-000000000001')), true);

update public.payments set status = 'postponed'
where id = 'cccccccc-0000-0000-0000-000000000001';
select pg_temp.check('reconstructor update took effect',
  (select status::text from public.payments where id = 'cccccccc-0000-0000-0000-000000000001'), 'postponed');

/* ========================================================================== */
/* The auditor reads but cannot write                                         */
/* ========================================================================== */

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');

select pg_temp.check('auditor reads the case',
  (select count(*)::int from public.cases), 1);
select pg_temp.check('auditor may not write',
  (select public.can_write_case('aaaaaaaa-0000-0000-0000-000000000001')), false);

do $$
begin
  update public.payments set status = 'paid'
  where id = 'cccccccc-0000-0000-0000-000000000001';
  -- An UPDATE blocked by RLS affects zero rows rather than raising.
  if found then
    raise exception 'FAIL  auditor was able to update a payment';
  end if;
  raise notice 'ok    auditor cannot update a payment';
end $$;

/* ========================================================================== */
/* CREDITOR ISOLATION - the policy this product depends on                    */
/* ========================================================================== */

select pg_temp.as_user('55555555-5555-5555-5555-555555555555');

select pg_temp.check('creditor does NOT read the case',
  (select count(*)::int from public.cases), 0);
select pg_temp.check('creditor does NOT read payments',
  (select count(*)::int from public.payments), 0);
select pg_temp.check('creditor does NOT read documents',
  (select count(*)::int from public.case_documents), 0);
select pg_temp.check('creditor does NOT read the audit trail',
  (select count(*)::int from public.audit_events), 0);
select pg_temp.check('creditor has no case-wide access',
  (select public.has_case_access('aaaaaaaa-0000-0000-0000-000000000001')), false);
select pg_temp.check('creditor cannot write',
  (select public.can_write_case('aaaaaaaa-0000-0000-0000-000000000001')), false);
select pg_temp.check('creditor sees their own membership row',
  (select count(*)::int from public.case_members), 1);

/* ========================================================================== */
/* A stranger sees nothing                                                    */
/* ========================================================================== */

select pg_temp.as_user('66666666-6666-6666-6666-666666666666');

select pg_temp.check('stranger reads no cases',
  (select count(*)::int from public.cases), 0);
select pg_temp.check('stranger reads no payments',
  (select count(*)::int from public.payments), 0);
select pg_temp.check('stranger reads no documents',
  (select count(*)::int from public.case_documents), 0);
select pg_temp.check('stranger reads no memberships',
  (select count(*)::int from public.case_members), 0);
select pg_temp.check('stranger reads no audit events',
  (select count(*)::int from public.audit_events), 0);

/* ========================================================================== */
/* Revoking access takes effect immediately                                   */
/* ========================================================================== */

reset role;
update public.case_members set revoked_at = now()
where case_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and user_id = '33333333-3333-3333-3333-333333333333';

set local role authenticated;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check('revoked reconstructor loses case access',
  (select count(*)::int from public.cases), 0);
select pg_temp.check('revoked reconstructor loses write access',
  (select public.can_write_case('aaaaaaaa-0000-0000-0000-000000000001')), false);

/* ========================================================================== */
/* The audit trail is append-only and records the actor                       */
/* ========================================================================== */

reset role;
select pg_temp.check('audit captured the payment update',
  (select count(*)::int from public.audit_events
   where object_type = 'payments' and action = 'update'), 1);
select pg_temp.check('audit recorded who did it',
  (select actor_user_id from public.audit_events
   where object_type = 'payments' and action = 'update' limit 1),
  '33333333-3333-3333-3333-333333333333'::uuid);
select pg_temp.check('audit recorded the role they acted in',
  (select actor_role::text from public.audit_events
   where object_type = 'payments' and action = 'update' limit 1), 'reconstructor');
select pg_temp.check('audit kept the before image',
  (select before ->> 'status' from public.audit_events
   where object_type = 'payments' and action = 'update' limit 1), 'pending');
select pg_temp.check('audit kept the after image',
  (select after ->> 'status' from public.audit_events
   where object_type = 'payments' and action = 'update' limit 1), 'postponed');
select pg_temp.check('creating a case is audited',
  (select count(*)::int from public.audit_events
   where object_type = 'cases' and action = 'insert'), 2);

set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

-- Two different mechanisms protect the trail, and they fail differently.
--
-- For a client role, RLS filters the row out before any trigger can fire, so
-- the UPDATE is not refused - it simply matches nothing. Asserting on an
-- exception here would be asserting on the wrong mechanism, so assert on what
-- actually matters: nothing changed.
do $$
declare
  v_before text;
  v_after text;
  v_count int;
begin
  select action into v_before from public.audit_events order by id limit 1;

  update public.audit_events set action = 'tampered';
  get diagnostics v_count = row_count;

  select action into v_after from public.audit_events order by id limit 1;

  if v_count <> 0 then
    raise exception 'FAIL  client updated % audit rows', v_count;
  end if;
  if v_before is distinct from v_after then
    raise exception 'FAIL  audit content changed from % to %', v_before, v_after;
  end if;
  raise notice 'ok    client cannot change the audit trail (0 rows, content intact)';
end $$;

do $$
declare v_count int;
begin
  delete from public.audit_events;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL  client deleted % audit rows', v_count;
  end if;
  raise notice 'ok    client cannot delete from the audit trail';
end $$;

-- The table owner bypasses RLS, so for them the trigger is the only thing
-- standing in the way. This is the case a blanket GRANT would otherwise
-- reopen, and it is why the guarantee is a trigger rather than a REVOKE.
reset role;
do $$
begin
  begin
    update public.audit_events set action = 'tampered' where id = (select min(id) from public.audit_events);
    raise exception 'FAIL  the table owner could edit the audit trail';
  exception
    when insufficient_privilege then raise notice 'ok    the table owner cannot edit the audit trail';
  end;
end $$;

do $$
begin
  begin
    delete from public.audit_events where id = (select min(id) from public.audit_events);
    raise exception 'FAIL  the table owner could delete from the audit trail';
  exception
    when insufficient_privilege then raise notice 'ok    the table owner cannot delete from the audit trail';
  end;
end $$;

set local role authenticated;

/* ========================================================================== */
/* Storage objects follow case membership, not the uploader                   */
/* ========================================================================== */

reset role;
insert into storage.objects (bucket_id, name, owner)
values ('case-documents',
        'aaaaaaaa-0000-0000-0000-000000000001/kontoutdrag.csv',
        '11111111-1111-1111-1111-111111111111');

set local role authenticated;

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.check('auditor reads a document uploaded by the company',
  (select count(*)::int from storage.objects), 1);

select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select pg_temp.check('creditor reads no storage objects',
  (select count(*)::int from storage.objects), 0);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check('other company reads no storage objects',
  (select count(*)::int from storage.objects), 0);

/* ========================================================================== */
/* Handlingsplanens uppgifter följer ärendets gränser                         */
/* ========================================================================== */

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

insert into public.case_tasks (case_id, label, source)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Kontakta rekonstruktör', 'recommendation');

select pg_temp.check('owner reads own tasks',
  (select count(*)::int from public.case_tasks), 1);

-- Avbockningen sparar vem och när.
update public.case_tasks
set done_at = now(), done_by = auth.uid()
where label = 'Kontakta rekonstruktör';
select pg_temp.check('task completion records who',
  (select count(*)::int from public.case_tasks where done_by = auth.uid()), 1);

-- Revisorn, inte rekonstruktören: rekonstruktörens medlemskap återkallas i
-- revokeringstestet längre upp, så 0 rader är RÄTT svar för hen här.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.check('auditor reads the task list',
  (select count(*)::int from public.case_tasks), 1);

select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select pg_temp.check('creditor reads no tasks',
  (select count(*)::int from public.case_tasks), 0);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check('other company reads no tasks',
  (select count(*)::int from public.case_tasks), 0);

do $$
begin
  begin
    insert into public.case_tasks (case_id, label)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Smyginlagd uppgift');
    raise exception 'FAIL  other company inserted a task into a foreign case';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok    other company cannot write tasks into a foreign case';
  end;
end $$;

/* ========================================================================== */
/* The audit trail outlives the case                                          */
/* ========================================================================== */

-- Found in the audit on 2026-08-01: audit_events cascaded from cases, so
-- deleting a case destroyed its trail - and because the trail refuses DELETE,
-- the cascade failed and the case could not be deleted at all.

reset role;
do $$
declare
  v_before int;
  v_after int;
begin
  select count(*) into v_before from public.audit_events
  where case_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  if v_before = 0 then
    raise exception 'FAIL  fixture produced no audit rows to test with';
  end if;

  delete from public.cases where id = 'bbbbbbbb-0000-0000-0000-000000000002';

  select count(*) into v_after from public.audit_events
  where case_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  if v_after < v_before then
    raise exception 'FAIL  deleting the case destroyed % audit rows', v_before - v_after;
  end if;
  raise notice 'ok    a case can be deleted and its audit trail survives';
end $$;

/* ========================================================================== */
/* Inbjudningar: länken är inte nyckeln, adressen är                          */
/* ========================================================================== */

-- Ny mottagare utan konto i fixturen: 'styrelse@bolag-a.se'.
reset role;
insert into auth.users (id, email, password_hash) values
  ('77777777-7777-7777-7777-777777777777', 'styrelse@bolag-a.se', 'x');

-- Ägaren bjuder in en styrelseledamot till ärende A.
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

do $$
declare
  v_id uuid;
begin
  v_id := public.invite_to_case(
    'aaaaaaaa-0000-0000-0000-000000000001', 'Styrelse@Bolag-A.se', 'board_member');
  if v_id is null then
    raise exception 'FAIL  invite_to_case returned null';
  end if;
  perform set_config('test.invitation_id', v_id::text, false);
  raise notice 'ok    the owner can invite a board member';
end $$;

-- Adressen normaliseras till gemener redan vid inbjudan.
do $$
declare
  v_email text;
begin
  select email into v_email from public.case_invitations
  where id = current_setting('test.invitation_id')::uuid;
  if v_email <> 'styrelse@bolag-a.se' then
    raise exception 'FAIL  email stored as %, not lowercased', v_email;
  end if;
  raise notice 'ok    the invited address is stored lowercased';
end $$;

-- Utomstående kan varken bjuda in eller se inbjudningar.
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
do $$
begin
  begin
    perform public.invite_to_case(
      'aaaaaaaa-0000-0000-0000-000000000001', 'nagon@annan.se', 'observer');
    raise exception 'FAIL  an outsider could invite into a foreign case';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
      raise notice 'ok    an outsider cannot invite into a foreign case';
  end;
end $$;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.case_invitations;
  if v_count <> 0 then
    raise exception 'FAIL  an outsider sees % invitations', v_count;
  end if;
  raise notice 'ok    an outsider sees no invitations';
end $$;

-- Revisorn (medlem) ser ärendets inbjudan.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare v_count int;
begin
  select count(*) into v_count from public.case_invitations
  where case_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_count <> 1 then
    raise exception 'FAIL  a member sees % invitations, expected 1', v_count;
  end if;
  raise notice 'ok    case members see the case''s invitations';
end $$;

-- Men revisorn (läsroll) kan inte bjuda in.
do $$
begin
  begin
    perform public.invite_to_case(
      'aaaaaaaa-0000-0000-0000-000000000001', 'fler@personer.se', 'observer');
    raise exception 'FAIL  a read-only member could invite';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a read-only member cannot invite';
  end;
end $$;

-- Fel adress: inbjudan är osynlig och accept nekas, trots känd länk.
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
do $$
declare v_count int;
begin
  select count(*) into v_count from public.peek_case_invitation(
    current_setting('test.invitation_id')::uuid);
  if v_count <> 0 then
    raise exception 'FAIL  peek leaked an invitation to the wrong address';
  end if;
  raise notice 'ok    peek is silent for the wrong address';
end $$;
do $$
begin
  begin
    perform public.accept_case_invitation(current_setting('test.invitation_id')::uuid);
    raise exception 'FAIL  the wrong address could accept the invitation';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    the link alone does not grant membership';
  end;
end $$;

-- Rätt adress: peek visar bolaget, accept ger medlemskap.
select pg_temp.as_user('77777777-7777-7777-7777-777777777777');
do $$
declare v_company text;
begin
  select company_name into v_company from public.peek_case_invitation(
    current_setting('test.invitation_id')::uuid);
  if v_company is distinct from 'Bolag A AB' then
    raise exception 'FAIL  peek returned %, expected Bolag A AB', v_company;
  end if;
  raise notice 'ok    the invited address sees what it is invited to';
end $$;
do $$
declare v_case uuid;
begin
  v_case := public.accept_case_invitation(current_setting('test.invitation_id')::uuid);
  if v_case <> 'aaaaaaaa-0000-0000-0000-000000000001' then
    raise exception 'FAIL  accept returned wrong case %', v_case;
  end if;
  if not public.has_case_access('aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'FAIL  accept did not grant case access';
  end if;
  raise notice 'ok    accepting with the right address grants membership';
end $$;

-- En inbjudan är engångs: andra accepten nekas.
do $$
begin
  begin
    perform public.accept_case_invitation(current_setting('test.invitation_id')::uuid);
    raise exception 'FAIL  an invitation could be accepted twice';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    an invitation can only be used once';
  end;
end $$;

-- Återkallad inbjudan kan inte användas.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
declare v_id uuid;
begin
  v_id := public.invite_to_case(
    'aaaaaaaa-0000-0000-0000-000000000001', 'aterkallad@test.se', 'observer');
  perform public.revoke_case_invitation(v_id);
  perform set_config('test.revoked_id', v_id::text, false);
  raise notice 'ok    the owner can revoke an open invitation';
end $$;
reset role;
insert into auth.users (id, email, password_hash) values
  ('88888888-8888-8888-8888-888888888888', 'aterkallad@test.se', 'x');
set local role authenticated;
select pg_temp.as_user('88888888-8888-8888-8888-888888888888');
do $$
begin
  begin
    perform public.accept_case_invitation(current_setting('test.revoked_id')::uuid);
    raise exception 'FAIL  a revoked invitation could be accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a revoked invitation cannot be accepted';
  end;
end $$;

-- Borgenärer och ägare kan inte bjudas in: databasens spärr, inte menyns.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
begin
  begin
    perform public.invite_to_case(
      'aaaaaaaa-0000-0000-0000-000000000001', 'borgenar2@lev.se', 'creditor');
    raise exception 'FAIL  a creditor could be invited into the case';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    creditors cannot be invited into the case';
  end;
  begin
    perform public.invite_to_case(
      'aaaaaaaa-0000-0000-0000-000000000001', 'kupp@test.se', 'owner');
    raise exception 'FAIL  ownership could be handed out by mail';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    ownership cannot be handed out by mail';
  end;
end $$;

-- Medlemslistan visar namn för ärendets medlemmar men inget för utomstående.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare v_count int;
begin
  select count(*) into v_count from public.list_case_members(
    'aaaaaaaa-0000-0000-0000-000000000001');
  if v_count < 4 then
    raise exception 'FAIL  member list returned % rows', v_count;
  end if;
  raise notice 'ok    members can list who is on the case';
end $$;
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
do $$
declare v_count int;
begin
  select count(*) into v_count from public.list_case_members(
    'aaaaaaaa-0000-0000-0000-000000000001');
  if v_count <> 0 then
    raise exception 'FAIL  an outsider listed % members', v_count;
  end if;
  raise notice 'ok    outsiders cannot list the members';
end $$;

/* ========================================================================== */
/* Trådar: en direkt tråd är privat även inom ärendet                          */
/* ========================================================================== */

-- Ägaren (1111) startar en direkt tråd med styrelseledamoten (7777, medlem
-- sedan inbjudningstesterna) och skickar ett taggat meddelande.
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

do $$
declare
  v_conv uuid;
  v_msg uuid;
begin
  insert into public.conversations (case_id, kind, created_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'direct',
          '11111111-1111-1111-1111-111111111111')
  returning id into v_conv;
  insert into public.conversation_participants (conversation_id, user_id, added_by) values
    (v_conv, '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
    (v_conv, '77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111');
  insert into public.case_messages
    (case_id, conversation_id, author_user_id, body, expects_reply_from)
  values ('aaaaaaaa-0000-0000-0000-000000000001', v_conv,
          '11111111-1111-1111-1111-111111111111',
          'Kan du bekräfta styrelsens beslut?',
          '77777777-7777-7777-7777-777777777777')
  returning id into v_msg;
  perform set_config('test.conv_id', v_conv::text, false);
  perform set_config('test.msg_id', v_msg::text, false);
  raise notice 'ok    a member can open a direct thread and tag a participant';
end $$;

-- Revisorn är medlem i ärendet men INTE deltagare: tråden är osynlig.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare v_count int;
begin
  select count(*) into v_count from public.conversations
  where id = current_setting('test.conv_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL  a non-participant member sees the direct thread';
  end if;
  select count(*) into v_count from public.case_messages
  where conversation_id = current_setting('test.conv_id')::uuid;
  if v_count <> 0 then
    raise exception 'FAIL  a non-participant member reads the direct messages';
  end if;
  raise notice 'ok    a direct thread is invisible to other case members';
end $$;

-- Och revisorn kan inte kvittera ett meddelande hen inte ser.
do $$
begin
  begin
    insert into public.message_acks (message_id, user_id)
    values (current_setting('test.msg_id')::uuid, '44444444-4444-4444-4444-444444444444');
    raise exception 'FAIL  a non-participant could ack an invisible message';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    acks require being able to see the message';
  end;
end $$;

-- Den taggade ser notisen, kvitterar, och notisen släcks.
select pg_temp.as_user('77777777-7777-7777-7777-777777777777');
do $$
declare v_count int;
begin
  select count(*) into v_count from public.my_open_mentions();
  if v_count <> 1 then
    raise exception 'FAIL  the tagged member has % open mentions, expected 1', v_count;
  end if;
  insert into public.message_acks (message_id, user_id)
  values (current_setting('test.msg_id')::uuid, '77777777-7777-7777-7777-777777777777');
  select count(*) into v_count from public.my_open_mentions();
  if v_count <> 0 then
    raise exception 'FAIL  the mention survived the ack';
  end if;
  raise notice 'ok    the tag shows as a mention and the ack clears it';
end $$;

-- Kvittensen är slutgiltig: utan delete-policy raderas noll rader, och
-- skulle någon policy senare öppna vägen stoppar triggern med ett fel.
do $$
declare v_count int;
begin
  begin
    delete from public.message_acks
    where message_id = current_setting('test.msg_id')::uuid;
  exception when others then
    null; -- triggerns fel är också ett godkänt utfall
  end;
  select count(*) into v_count from public.message_acks
  where message_id = current_setting('test.msg_id')::uuid;
  if v_count <> 1 then
    raise exception 'FAIL  the ack was deleted';
  end if;
  raise notice 'ok    an ack cannot be taken back';
end $$;

-- En utomstående kan inte tagga in sig eller läggas till i en tråd.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
begin
  begin
    insert into public.conversation_participants (conversation_id, user_id, added_by)
    values (current_setting('test.conv_id')::uuid,
            '66666666-6666-6666-6666-666666666666',
            '11111111-1111-1111-1111-111111111111');
    raise exception 'FAIL  a non-member was added to a thread';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    only case members can be thread participants';
  end;
end $$;

/* ========================================================================== */
/* Sammanslagning av dubblettgrupper                                          */
/* ========================================================================== */

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
declare
  v_g1 uuid;
  v_g2 uuid;
  v_count int;
begin
  -- Samma grupp öppnad två gånger.
  insert into public.conversations (case_id, kind, title, created_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'group', 'Bankfrågor',
          '11111111-1111-1111-1111-111111111111')
  returning id into v_g1;
  insert into public.conversation_participants (conversation_id, user_id) values
    (v_g1, '11111111-1111-1111-1111-111111111111'),
    (v_g1, '77777777-7777-7777-7777-777777777777');
  insert into public.conversations (case_id, kind, title, created_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'group', 'Bankfrågor',
          '11111111-1111-1111-1111-111111111111')
  returning id into v_g2;
  insert into public.conversation_participants (conversation_id, user_id) values
    (v_g2, '11111111-1111-1111-1111-111111111111'),
    (v_g2, '44444444-4444-4444-4444-444444444444');

  insert into public.case_messages (case_id, conversation_id, author_user_id, body)
  values ('aaaaaaaa-0000-0000-0000-000000000001', v_g1,
          '11111111-1111-1111-1111-111111111111', 'Meddelande i första gruppen');
  insert into public.case_messages (case_id, conversation_id, author_user_id, body)
  values ('aaaaaaaa-0000-0000-0000-000000000001', v_g2,
          '11111111-1111-1111-1111-111111111111', 'Meddelande i dubbletten');

  perform public.merge_conversations(v_g2, v_g1);

  select count(*) into v_count from public.case_messages
  where conversation_id = v_g1;
  if v_count <> 2 then
    raise exception 'FAIL  the merge left % messages in the target, expected 2', v_count;
  end if;
  select count(*) into v_count from public.conversation_participants
  where conversation_id = v_g1;
  if v_count <> 3 then
    raise exception 'FAIL  the merge left % participants, expected 3', v_count;
  end if;
  if (select merged_into from public.conversations where id = v_g2) <> v_g1 then
    raise exception 'FAIL  the source was not marked merged';
  end if;
  raise notice 'ok    duplicate groups merge: messages moved, participants united';
end $$;

-- Innehållet i ett skickat meddelande är orörligt även efter utbyggnaden.
do $$
begin
  begin
    update public.case_messages set body = 'Omskrivet'
    where body = 'Meddelande i dubbletten';
    raise exception 'FAIL  a sent message body could be rewritten';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a sent message still cannot be rewritten';
  end;
end $$;

/* ========================================================================== */
/* Utkorgen: omskick är driftens knapp, och bara för misslyckade rader        */
/* ========================================================================== */

reset role;
-- Ägaren 1111 blir driftadministratör; en misslyckad och en skickad rad.
insert into public.platform_admins (user_id) values ('11111111-1111-1111-1111-111111111111');
insert into public.outbound_emails (id, recipient, subject, body_text, body_html, kind, status, attempts, last_error)
values ('e1111111-0000-0000-0000-000000000001', 'studs@test.se', 'Faktura', 'x', '<p>x</p>', 'invoice', 'failed', 5, 'Mailbox unavailable');
insert into public.outbound_emails (id, recipient, subject, body_text, body_html, kind, status, attempts, sent_at)
values ('e2222222-0000-0000-0000-000000000002', 'ok@test.se', 'Kvitto', 'x', '<p>x</p>', 'receipt', 'sent', 1, now());

set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
declare v_row record;
begin
  perform public.retry_outbound_email('e1111111-0000-0000-0000-000000000001');
  select status, attempts, last_error into v_row
  from public.outbound_emails where id = 'e1111111-0000-0000-0000-000000000001';
  if v_row.status <> 'pending' or v_row.attempts <> 0 then
    raise exception 'FAIL  retry gav status % med % försök', v_row.status, v_row.attempts;
  end if;
  if v_row.last_error is null then
    raise exception 'FAIL  retry raderade felhistoriken';
  end if;
  raise notice 'ok    a failed email can be requeued; the error stays visible';
end $$;

do $$
begin
  begin
    perform public.retry_outbound_email('e2222222-0000-0000-0000-000000000002');
    raise exception 'FAIL  a sent email could be requeued';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a sent email can never be requeued';
  end;
end $$;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$
begin
  begin
    perform public.retry_outbound_email('e1111111-0000-0000-0000-000000000001');
    raise exception 'FAIL  a non-admin could requeue outbox rows';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    requeueing requires drift privileges';
  end;
end $$;

/* ========================================================================== */
/* Profilanspråk: "Är detta din profil?" och driftens granskning              */
/* ========================================================================== */

reset role;
-- En förifylld, overifierad profil att göra anspråk på (motsvarar
-- public_register-posterna som migrationen seedar).
insert into public.professionals (id, name, category, verified, source)
values ('f0000000-0000-0000-0000-000000000001', 'Testbyrån Anspråk', 'rekonstruktor', false, 'public_register');

set local role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$
declare v_id uuid;
begin
  v_id := public.claim_professional_profile(
    'f0000000-0000-0000-0000-000000000001', 'Jag driver byrån.', 'bertil@bolag-b.se');
  if v_id is null then raise exception 'FAIL  anspråket gav inget id'; end if;
  raise notice 'ok    an unverified profile can be claimed';
end $$;

do $$
begin
  begin
    perform public.claim_professional_profile(
      'f0000000-0000-0000-0000-000000000001', 'Igen.', 'bertil@bolag-b.se');
    raise exception 'FAIL  dubbla väntande anspråk accepterades';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a second pending claim by the same user is refused';
  end;
end $$;

do $$
begin
  begin
    insert into public.profile_claims (professional_id, user_id, motivation, contact)
    values ('f0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'råinsert', 'x');
    raise exception 'FAIL  rå insert i profile_claims gick igenom';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    claims can only be written through the function';
  end;
end $$;

select pg_temp.check('the claimant follows their own claim',
  (select count(*) from public.profile_claims where professional_id = 'f0000000-0000-0000-0000-000000000001'), 1::bigint);
select pg_temp.check('non-admins see an empty claims list',
  (select count(*) from public.list_profile_claims()), 0::bigint);

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.check('other users do not see the claim',
  (select count(*) from public.profile_claims where professional_id = 'f0000000-0000-0000-0000-000000000001'), 0::bigint);
-- Ett konkurrerande anspråk från revisorn, för godkännandetestet nedan.
do $$
begin
  perform public.claim_professional_profile(
    'f0000000-0000-0000-0000-000000000001', 'Det är min byrå.', 'revisor@byra.se');
  raise notice 'ok    a competing claim can be filed';
end $$;

do $$
begin
  begin
    perform public.review_profile_claim(
      (select id from public.list_profile_claims() limit 1), true, null);
    raise exception 'FAIL  en icke-administratör kunde granska anspråk';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    reviewing claims requires drift privileges';
  end;
end $$;

-- Driften (1111 är administratör sedan utkorgstesterna) avgör.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check('the admin sees both claims with claimant emails',
  (select count(*) from public.list_profile_claims()
   where professional_id = 'f0000000-0000-0000-0000-000000000001'
     and claimant_email in ('bertil@bolag-b.se', 'revisor@byra.se')), 2::bigint);

do $$
begin
  begin
    perform public.review_profile_claim(
      (select id from public.profile_claims
       where user_id = '44444444-4444-4444-4444-444444444444'
         and professional_id = 'f0000000-0000-0000-0000-000000000001'), false, '  ');
    raise exception 'FAIL  avslag utan motivering accepterades';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a rejection requires a written reason';
  end;
end $$;

do $$
declare v_pro record; v_other record;
begin
  perform public.review_profile_claim(
    (select id from public.profile_claims
     where user_id = '22222222-2222-2222-2222-222222222222'
       and professional_id = 'f0000000-0000-0000-0000-000000000001'), true, null);

  select user_id, verified into v_pro from public.professionals
  where id = 'f0000000-0000-0000-0000-000000000001';
  if v_pro.user_id <> '22222222-2222-2222-2222-222222222222' or not v_pro.verified then
    raise exception 'FAIL  godkännandet kopplade inte profilen (user %, verified %)', v_pro.user_id, v_pro.verified;
  end if;

  select status, review_note into v_other from public.profile_claims
  where user_id = '44444444-4444-4444-4444-444444444444'
    and professional_id = 'f0000000-0000-0000-0000-000000000001';
  if v_other.status <> 'rejected' or v_other.review_note is null then
    raise exception 'FAIL  det konkurrerande anspråket fick inget besked (%, %)', v_other.status, v_other.review_note;
  end if;
  raise notice 'ok    approval links the profile, sets verified and answers the rival claim';
end $$;

set local role authenticated;
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
do $$
begin
  begin
    perform public.claim_professional_profile(
      'f0000000-0000-0000-0000-000000000001', 'Min!', 'ingen@utanfor.se');
    raise exception 'FAIL  en redan kopplad profil kunde beslagtas';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a linked profile can never be claimed again';
  end;
end $$;

/* ========================================================================== */
/* Kontaktförfrågan, förhandsvisning och "Lås upp ärendet"                    */
/* ========================================================================== */

reset role;
-- Rådgivarprofil kopplad till användare 4444, med per-ärende-plan.
insert into public.professionals (id, name, category, verified, user_id)
values ('f0000000-0000-0000-0000-000000000002', 'Upplåsningsbyrån', 'rekonstruktor', true,
        '44444444-4444-4444-4444-444444444444');
insert into public.billing_plans (professional_id, plan_kind, unlock_fee_sek)
values ('f0000000-0000-0000-0000-000000000002', 'per_case', 995);

set local role authenticated;

-- Företrädaren för ärende A skickar förfrågan; borgenären 5555 kan inte.
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
do $$
begin
  begin
    perform public.create_contact_request(
      'aaaaaaaa-0000-0000-0000-000000000001',
      'f0000000-0000-0000-0000-000000000002',
      '{"problemType": "likviditet"}'::jsonb, '{"companyName": "Bolag A AB"}'::jsonb);
    raise exception 'FAIL  en borgenär kunde dela ärendet';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    sharing a case requires representative write access';
  end;
end $$;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
declare v_id uuid;
begin
  v_id := public.create_contact_request(
    'aaaaaaaa-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    '{"problemType": "likviditet", "sizeBand": "6-10"}'::jsonb,
    '{"companyName": "Bolag A AB", "orgNumber": "556000-0001", "contactEmail": "agnes@bolag-a.se"}'::jsonb);
  if v_id is null then raise exception 'FAIL  förfrågan gav inget id'; end if;
  raise notice 'ok    a representative can send a contact request with consent';
end $$;

do $$
begin
  begin
    perform public.create_contact_request(
      'aaaaaaaa-0000-0000-0000-000000000001',
      'f0000000-0000-0000-0000-000000000002',
      '{}'::jsonb, '{}'::jsonb);
    raise exception 'FAIL  dubbel förfrågan till samma rådgivare accepterades';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    the same advisor cannot be contacted twice for one case';
  end;
end $$;

select pg_temp.check('the company follows its own requests',
  (select count(*) from public.contact_requests where case_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint);

-- Rådgivaren (4444) ser förhandsvisningen med pris, men aldrig tabellraden.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare v_row record;
begin
  select * into v_row from public.list_lead_previews() limit 1;
  if v_row.id is null then raise exception 'FAIL  förhandsvisningen är tom'; end if;
  if v_row.preview->>'problemType' <> 'likviditet' then
    raise exception 'FAIL  förhandsvisningen saknar innehållet';
  end if;
  if v_row.unlock_fee_sek <> 995 then
    raise exception 'FAIL  avgiften följer inte med förhandsvisningen (%)', v_row.unlock_fee_sek;
  end if;
  if v_row.preview::text like '%Bolag A%' or v_row.preview::text like '%556000%' then
    raise exception 'FAIL  förhandsvisningen läcker identiteten';
  end if;
  raise notice 'ok    the advisor sees an anonymised preview with the fee';
end $$;

-- 4444 har ärendeåtkomst som revisor i ärende A, men tabellens summary får
-- ändå inte läsas i förväg av NÅGON annan väg än upplåsningen; en
-- utomstående (6666) ser ingenting alls.
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
select pg_temp.check('outsiders see no contact requests',
  (select count(*) from public.contact_requests), 0::bigint);
select pg_temp.check('outsiders see no lead previews',
  (select count(*) from public.list_lead_previews()), 0::bigint);

-- Upplåsningen: fel användare nekas, rätt användare får sammanfattningen
-- och avgiften registreras.
do $$
begin
  begin
    perform public.unlock_case_lead(
      (select id from public.contact_requests limit 1), 'v1');
    raise exception 'FAIL  fel användare kunde låsa upp';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    only the targeted advisor can unlock';
  end;
end $$;

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare v_summary jsonb; v_id uuid;
begin
  select id into v_id from public.list_lead_previews() limit 1;
  begin
    perform public.unlock_case_lead(v_id, '  ');
    raise exception 'FAIL  upplåsning utan villkorsaccept gick igenom';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    unlocking requires accepting the terms';
  end;
  v_summary := public.unlock_case_lead(v_id, 'v1-2026');
  if v_summary->>'companyName' <> 'Bolag A AB' then
    raise exception 'FAIL  upplåsningen gav inte sammanfattningen';
  end if;
  if public.get_unlocked_lead(v_id)->>'contactEmail' <> 'agnes@bolag-a.se' then
    raise exception 'FAIL  den upplåsta sammanfattningen kan inte återbesökas';
  end if;
  raise notice 'ok    unlocking reveals the full summary against terms';
end $$;

do $$
declare v_charge record;
begin
  select service_code, amount_ore, company_name, org_number, invoice_id
  into v_charge from public.usage_charges where user_id = auth.uid();
  if v_charge.service_code <> 'case_unlock' or v_charge.amount_ore <> 99500 then
    raise exception 'FAIL  avgiften registrerades fel (% öre)', v_charge.amount_ore;
  end if;
  if v_charge.company_name <> 'Bolag A AB' or v_charge.org_number <> '556000-0001' then
    raise exception 'FAIL  fakturaraden saknar sammanhanget';
  end if;
  if v_charge.invoice_id is not null then
    raise exception 'FAIL  avgiften är redan fakturerad';
  end if;
  raise notice 'ok    the unlock charge lands in the running statement';
end $$;

do $$
begin
  begin
    perform public.unlock_case_lead(
      (select id from public.contact_requests limit 1), 'v1');
    raise exception 'FAIL  samma förfrågan kunde låsas upp två gånger';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a lead can only be unlocked once';
  end;
end $$;

select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
select pg_temp.check('charges are invisible to other users',
  (select count(*) from public.usage_charges), 0::bigint);

-- Spärrlagret: byggt men avstängt. Aktiveras det stoppas nästa köp.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
begin
  perform public.set_billing_hold('f0000000-0000-0000-0000-000000000002', true, 'Upprepade sena betalningar');
  raise notice 'ok    drift can arm the credit hold';
end $$;
do $$
declare v_id uuid;
begin
  v_id := public.create_contact_request(
    'aaaaaaaa-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    '{"problemType": "skatt"}'::jsonb, '{"companyName": "Bolag A AB"}'::jsonb);
  raise notice 'ok    a second advisor can be contacted for the same case';
end $$;

-- Spärren prövas med en ny förfrågan till den spärrade byrån. Ett färskt
-- ärende seedas som tabellägare (bolag B raderades i GDPR-testet ovan).
reset role;
insert into public.cases (id, user_id, org_number, company_name) values
  ('cccccccc-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '556000-0003', 'Bolag C AB');
insert into public.contact_requests (case_id, professional_id, created_by, preview, summary)
values ('cccccccc-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002',
        '22222222-2222-2222-2222-222222222222', '{"problemType": "skuld"}'::jsonb, '{"companyName": "Bolag C AB"}'::jsonb);
set local role authenticated;
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
begin
  begin
    perform public.unlock_case_lead(
      (select l.id from public.list_lead_previews() l where l.status = 'sent' limit 1), 'v1');
    raise exception 'FAIL  en spärrad byrå kunde låsa upp';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    the armed credit hold blocks new purchases';
  end;
end $$;

/* ========================================================================== */
/* Byråprofilens självadministration                                          */
/* ========================================================================== */

-- 4444 äger Upplåsningsbyrån (f0..2) sedan lead-testerna; 2222 äger
-- Testbyrån Anspråk (f0..1) sedan anspråkstesterna.
set local role authenticated;
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare v_row record;
begin
  select * into v_row from public.get_my_professional_profile();
  if v_row.name <> 'Upplåsningsbyrån' or not v_row.verified then
    raise exception 'FAIL  innehavaren ser inte sin egen profil (%)', v_row.name;
  end if;
  raise notice 'ok    the owner sees their own profile incl billing address';
end $$;

do $$
declare v_pro record;
begin
  perform public.update_my_professional_profile(
    'Uppdaterad beskrivning från byrån.', 'Uppsala', 'ny@byra.se', '018-111 222',
    'https://byra.se', array['Rekonstruktion', 'Ackord'],
    '[{"service": "Inledande genomgång", "price": 0}]'::jsonb, 'faktura@byra.se');
  select description, location, verified, name into v_pro
  from public.professionals where id = 'f0000000-0000-0000-0000-000000000002';
  if v_pro.description <> 'Uppdaterad beskrivning från byrån.' or v_pro.location <> 'Uppsala' then
    raise exception 'FAIL  uppdateringen slog inte igenom (%)', v_pro.description;
  end if;
  if not v_pro.verified or v_pro.name <> 'Upplåsningsbyrån' then
    raise exception 'FAIL  identitet eller verifiering rördes av självbetjäningen';
  end if;
  raise notice 'ok    the owner updates service fields; identity and verification stay';
end $$;

do $$
begin
  begin
    perform public.update_my_professional_profile(
      'x', null, null, null, 'ftp://fel', null, null, null);
    raise exception 'FAIL  ogiltig webbadress accepterades';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a malformed website address is refused';
  end;
  begin
    perform public.update_my_professional_profile(
      'x', null, null, null, null, null, '[{"service": "", "price": 100}]'::jsonb, null);
    raise exception 'FAIL  fast pris utan tjänst accepterades';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a fixed price without a service name is refused';
  end;
end $$;

-- 2222:s uppdatering träffar bara den egna profilen, aldrig 4444:s.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$
declare v_other text;
begin
  perform public.update_my_professional_profile(
    'Bertils byrå.', null, null, null, null, null, null, null);
  select description into v_other
  from public.professionals where id = 'f0000000-0000-0000-0000-000000000002';
  if v_other <> 'Uppdaterad beskrivning från byrån.' then
    raise exception 'FAIL  en annan byrås profil ändrades (%)', v_other;
  end if;
  raise notice 'ok    an update can never touch another firm''s profile';
end $$;

-- Konto utan profil får besked, inte tystnad.
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
select pg_temp.check('no profile -> empty result',
  (select count(*) from public.get_my_professional_profile()), 0::bigint);
do $$
begin
  begin
    perform public.update_my_professional_profile('x', null, null, null, null, null, null, null);
    raise exception 'FAIL  uppdatering utan profil gick igenom';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    an account without a profile gets a clear error';
  end;
end $$;

/* ========================================================================== */
/* Exitorsak och hälsoläget                                                   */
/* ========================================================================== */

set local role authenticated;

-- Borgenären kan inte avsluta ärendet.
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
do $$
begin
  begin
    perform public.close_case('aaaaaaaa-0000-0000-0000-000000000001', 'stabilized');
    raise exception 'FAIL  en borgenär kunde avsluta ärendet';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    closing a case requires representative write access';
  end;
end $$;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
begin
  begin
    perform public.close_case('aaaaaaaa-0000-0000-0000-000000000001', 'felorsak');
    raise exception 'FAIL  ogiltig orsak accepterades';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    an invalid exit reason is refused';
  end;
  begin
    perform public.close_case('aaaaaaaa-0000-0000-0000-000000000001', 'bankruptcy', null, true);
    raise exception 'FAIL  konkurs kunde gå till hälsoläget';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    only successful outcomes may enter health mode';
  end;
end $$;

do $$
declare v_case record;
begin
  perform public.close_case('aaaaaaaa-0000-0000-0000-000000000001', 'stabilized', 'Lönerna betalas igen.', true);
  select closed_at, exit_reason, health_mode into v_case
  from public.cases where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_case.closed_at is null or v_case.exit_reason <> 'stabilized' or not v_case.health_mode then
    raise exception 'FAIL  avslutet stämplades fel (%, %)', v_case.exit_reason, v_case.health_mode;
  end if;
  raise notice 'ok    a successful close stamps reason and enters health mode';
  begin
    perform public.close_case('aaaaaaaa-0000-0000-0000-000000000001', 'stabilized');
    raise exception 'FAIL  ett avslutat ärende kunde avslutas igen';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a closed case cannot be closed twice';
  end;
end $$;

do $$
declare v_case record;
begin
  perform public.reopen_case('aaaaaaaa-0000-0000-0000-000000000001');
  select closed_at, exit_reason, health_mode into v_case
  from public.cases where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_case.closed_at is not null or v_case.exit_reason is not null or v_case.health_mode then
    raise exception 'FAIL  återupptagandet nollade inte läget';
  end if;
  raise notice 'ok    reopening returns the case to crisis mode';
end $$;

-- North Star-räkningen: nollor utan drift, riktiga tal med.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check('north star is zeroed for non-admins',
  (select recovered from public.north_star_counts()), 0::bigint);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
declare v_row record;
begin
  perform public.close_case('aaaaaaaa-0000-0000-0000-000000000001', 'reconstruction_completed', null, false);
  select * into v_row from public.north_star_counts();
  if v_row.recovered < 1 then
    raise exception 'FAIL  North Star räknar inte det återhämtade bolaget (%)', v_row.recovered;
  end if;
  raise notice 'ok    the north star counts recovered companies for drift';
end $$;

/* ========================================================================== */
/* Klientverktygen: interna anteckningar och tidsrapportering                 */
/* ========================================================================== */

set local role authenticated;

-- Revisorn (4444) skriver en intern anteckning i ärende A. (3333:s
-- medlemskap är revokerat sedan revokeringstestet längre upp.)
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
insert into public.case_notes (case_id, body)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Företrädaren lovade balansrapport på fredag.');
select pg_temp.check('the author sees their own note',
  (select count(*) from public.case_notes), 1::bigint);

-- Anteckningen är byråns egen: varken ägaren eller en annan rådgivare ser den.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check('the case owner cannot see an advisor''s internal notes',
  (select count(*) from public.case_notes), 0::bigint);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check('a user outside the case cannot see them either',
  (select count(*) from public.case_notes), 0::bigint);

-- Borgenären (5555) får inte lägga arbetsmaterial i akten.
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
do $$
begin
  begin
    insert into public.case_notes (case_id, body)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'smyganteckning');
    raise exception 'FAIL  en borgenär kunde skriva interna anteckningar';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a creditor cannot write internal notes';
  end;
end $$;

-- Utanförstående (6666) får inte heller, ens i ett ärende som finns.
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
do $$
begin
  begin
    insert into public.case_notes (case_id, body)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'insmugen');
    raise exception 'FAIL  en utomstående kunde skriva interna anteckningar';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a non-member cannot write internal notes';
  end;
end $$;

-- Tidsposter: revisorn (4444) är deltagare och loggar sin tid.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
insert into public.time_entries (case_id, minutes, note)
values ('aaaaaaaa-0000-0000-0000-000000000001', 90, 'Granskning av kontrollbalansräkning');
select pg_temp.check('a participant logs and sees their own time',
  (select sum(minutes) from public.time_entries), 90::bigint);

-- Noll minuter är ingen tidpost.
do $$
begin
  begin
    insert into public.time_entries (case_id, minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 0);
    raise exception 'FAIL  en tidpost på noll minuter accepterades';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a zero-minute entry is refused';
  end;
end $$;

-- Ägaren ser inte revisorns tid - var och en rår över sin egen.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check('time entries are private to their owner',
  (select count(*) from public.time_entries), 0::bigint);

-- Borgenären kan inte tidrapportera.
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
do $$
begin
  begin
    insert into public.time_entries (case_id, minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 30);
    raise exception 'FAIL  en borgenär kunde tidrapportera i ärendet';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a creditor cannot log time on the case';
  end;
end $$;

-- Författaren tar bort sin egen anteckning; ingen annan kunde.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
delete from public.case_notes;
select pg_temp.check('the author can delete their own note',
  (select count(*) from public.case_notes), 0::bigint);

/* ========================================================================== */
/* Delegering och godkännande av handlingsplanen                              */
/* ========================================================================== */

set local role authenticated;

-- Ägaren (skrivroll) skapar en uppgift och delegerar den till revisorn.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.case_tasks (case_id, label)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Delegeringstest: granska balansrapport');
update public.case_tasks
set assigned_to = '44444444-4444-4444-4444-444444444444'
where label = 'Delegeringstest: granska balansrapport';
select pg_temp.check('a write role can delegate a task',
  (select count(*) from public.case_tasks
   where label = 'Delegeringstest: granska balansrapport'
     and assigned_to = '44444444-4444-4444-4444-444444444444'), 1::bigint);

-- Den tilldelade ser sin uppgift (medlemsläsning).
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.check('the assignee sees the delegated task',
  (select count(*) from public.case_tasks
   where assigned_to = '44444444-4444-4444-4444-444444444444'), 1::bigint);

-- Företrädaren kan INTE godkänna sin egen handlingsplan.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
begin
  begin
    perform public.set_plan_approval('aaaaaaaa-0000-0000-0000-000000000001', true);
    raise exception 'FAIL  företrädaren kunde godkänna sin egen plan';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    the owner cannot approve their own action plan';
  end;
end $$;

-- Borgenären kan inte heller.
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
do $$
begin
  begin
    perform public.set_plan_approval('aaaaaaaa-0000-0000-0000-000000000001', true);
    raise exception 'FAIL  en borgenär kunde godkänna planen';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a creditor cannot approve the action plan';
  end;
end $$;

-- Revisorn (rådgivarroll) godkänner: vem och när stämplas ihop.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare v_case record;
begin
  perform public.set_plan_approval('aaaaaaaa-0000-0000-0000-000000000001', true);
  select plan_approved_at, plan_approved_by into v_case
  from public.cases where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_case.plan_approved_at is null
     or v_case.plan_approved_by <> '44444444-4444-4444-4444-444444444444' then
    raise exception 'FAIL  godkännandet stämplades fel';
  end if;
  raise notice 'ok    an advisor role approves and the stamp records who and when';
  perform public.set_plan_approval('aaaaaaaa-0000-0000-0000-000000000001', false);
  select plan_approved_at, plan_approved_by into v_case
  from public.cases where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_case.plan_approved_at is not null or v_case.plan_approved_by is not null then
    raise exception 'FAIL  återtaget godkännande nollades inte';
  end if;
  raise notice 'ok    withdrawing the approval clears both fields together';
end $$;

/* ========================================================================== */
/* Byråteamet: flera inloggningar per byrå                                    */
/* ========================================================================== */

reset role;
-- En byrå med 4444 som kopplad administratör (som efter ett godkänt anspråk).
insert into public.professionals (id, name, category, verified, source, user_id)
values ('f0000000-0000-0000-0000-000000000099', 'Teambyrån Demo', 'affarsjurist', true,
        'application', '44444444-4444-4444-4444-444444444444');
set local role authenticated;

-- Administratören ser sitt team: en rad, hen själv.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.check('the linked account is the implicit admin',
  (select count(*) from public.list_firm_team('f0000000-0000-0000-0000-000000000099')), 1::bigint);

-- Utanförstående ser ingenting och kan inte bjuda in.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check('an outsider sees no team',
  (select count(*) from public.list_firm_team('f0000000-0000-0000-0000-000000000099')), 0::bigint);
do $$
begin
  begin
    perform public.invite_firm_member('f0000000-0000-0000-0000-000000000099', 'ingen@utanfor.se');
    raise exception 'FAIL  en utomstående kunde bjuda in till byrån';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    only the firm admin can invite colleagues';
  end;
  begin
    insert into public.professional_members (professional_id, user_id)
    values ('f0000000-0000-0000-0000-000000000099', '22222222-2222-2222-2222-222222222222');
    raise exception 'FAIL  rå insert i teamet gick igenom';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    team rows cannot be written directly';
  end;
end $$;

-- Administratören bjuder in; dubblettinbjudan avvisas.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.invite_firm_member('f0000000-0000-0000-0000-000000000099', 'Ingen@Utanfor.se');
do $$
begin
  begin
    perform public.invite_firm_member('f0000000-0000-0000-0000-000000000099', 'ingen@utanfor.se');
    raise exception 'FAIL  en dubblettinbjudan accepterades';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a duplicate open invitation is refused';
  end;
end $$;

-- Bara adressaten ser inbjudan.
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select pg_temp.check('other users see no firm invitations',
  (select count(*) from public.my_firm_invitations()), 0::bigint);
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
select pg_temp.check('the invitee sees their invitation',
  (select count(*) from public.my_firm_invitations()), 1::bigint);

-- Accept: medlem i teamet; dubbelaccept avvisas.
do $$
declare v_id uuid;
begin
  select id into v_id from public.my_firm_invitations() limit 1;
  perform public.accept_firm_invitation(v_id);
  raise notice 'ok    the invitee joins the team';
  begin
    perform public.accept_firm_invitation(v_id);
    raise exception 'FAIL  inbjudan kunde användas två gånger';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    an invitation can only be used once';
  end;
end $$;
select pg_temp.check('the team now has two active members',
  (select count(*) from public.list_firm_team('f0000000-0000-0000-0000-000000000099')), 2::bigint);

-- En vanlig medlem kan inte bjuda in.
do $$
begin
  begin
    perform public.invite_firm_member('f0000000-0000-0000-0000-000000000099', 'agnes@bolag-a.se');
    raise exception 'FAIL  en medlem utan adminroll kunde bjuda in';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a plain member cannot invite';
  end;
end $$;

-- Teammedlemskap ger INTE ärendeåtkomst: 6666 är nu med i byrån men ser
-- fortfarande inga ärenden. Detta är hela poängen med gränsen.
select pg_temp.check('firm membership grants NO case access',
  (select count(*) from public.cases), 0::bigint);

-- Administratören tar bort medlemmen.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare v_member uuid;
begin
  select id into v_member from public.professional_members
  where professional_id = 'f0000000-0000-0000-0000-000000000099'
    and user_id = '66666666-6666-6666-6666-666666666666';
  perform public.remove_firm_member(v_member);
end $$;
select pg_temp.check('a removed member leaves the team',
  (select count(*) from public.list_firm_team('f0000000-0000-0000-0000-000000000099')), 1::bigint);

/* ========================================================================== */
/* Skuggdebiteringen: driftens växel, aldrig byråns                           */
/* ========================================================================== */

set local role authenticated;

-- En vanlig användare kan inte slå på skuggläget.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$
begin
  begin
    perform public.set_billing_shadow('f0000000-0000-0000-0000-000000000099', true);
    raise exception 'FAIL  en icke-administratör kunde sätta skuggläget';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    shadow mode requires platform admin';
  end;
end $$;

-- Driften (1111) slår på skuggläget; planraden skapas vid behov.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.set_billing_shadow('f0000000-0000-0000-0000-000000000099', true);
select pg_temp.check('the admin can enable shadow mode',
  (select count(*) from public.billing_plans
   where professional_id = 'f0000000-0000-0000-0000-000000000099' and shadow), 1::bigint);

/* ========================================================================== */
/* Krisrådgivarens journal och beslutsminnet                                  */
/* ========================================================================== */

set local role authenticated;

-- Ägaren (1111, skrivroll) journalför ett samtal i ärende A.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.advisor_sessions (id, case_id, flow_id, flow_title, entries)
values ('d1a10000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'skatt', 'Skatten kan inte betalas',
        '[{"at":"2026-08-02T09:12:00Z","who":"user","text":"Jag kan inte betala momsen"}]'::jsonb);
select pg_temp.check('a write role journals an advisor session',
  (select count(*) from public.advisor_sessions), 1::bigint);

-- Revisorn (4444, deltagare) läser journalen - samtalen är ärendets berättelse.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.check('a case participant reads the session journal',
  (select count(*) from public.advisor_sessions), 1::bigint);

-- Borgenären (5555) ser ingenting - ärendeåtkomsten utesluter borgenärer.
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select pg_temp.check('a creditor sees no advisor sessions',
  (select count(*) from public.advisor_sessions), 0::bigint);
do $$
begin
  begin
    insert into public.advisor_sessions (case_id, flow_id, flow_title)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'skatt', 'smygsamtal');
    raise exception 'FAIL  en borgenär kunde journalföra samtal';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a creditor cannot write to the journal';
  end;
end $$;

-- Utanförstående (6666) ser inte heller något.
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
select pg_temp.check('a non-member sees no advisor sessions',
  (select count(*) from public.advisor_sessions), 0::bigint);

-- Beslutet protokollförs med premiss av en skrivroll.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.case_decisions (id, case_id, title, rationale, premise)
values ('d1a20000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'Hantera skattebristen före förfallodagen',
        'Beslut efter samtal med rådgivaren.',
        'Vilar på att 150 000 kr saknas och att inga kundinbetalningar väntas.');
select pg_temp.check('a write role records a decision',
  (select count(*) from public.case_decisions), 1::bigint);

-- Deltagaren läser besluten; borgenären gör det inte.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.check('a participant reads the decision log',
  (select count(*) from public.case_decisions), 1::bigint);
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select pg_temp.check('a creditor sees no decisions',
  (select count(*) from public.case_decisions), 0::bigint);

-- Beslutets innehåll är fryst: en "rättelse" av titeln avvisas av triggern.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
begin
  begin
    update public.case_decisions
    set title = 'Omskrivet i efterhand', status = 'reconsidered'
    where id = 'd1a20000-0000-0000-0000-000000000001';
    raise exception 'FAIL  ett fattat beslut kunde skrivas om';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a recorded decision cannot be rewritten';
  end;
end $$;

-- Omprövningen är den enda tillåtna övergången, och den stämplas.
update public.case_decisions
set status = 'reconsidered', reconsidered_at = now(),
    reconsider_note = 'Kunden betalade - premissen håller inte längre.'
where id = 'd1a20000-0000-0000-0000-000000000001';
select pg_temp.check('reconsideration is stamped with time and note',
  (select count(*) from public.case_decisions
   where id = 'd1a20000-0000-0000-0000-000000000001'
     and status = 'reconsidered' and reconsidered_at is not null), 1::bigint);

-- Ett omprövat beslut är slutgiltigt omprövat: andra varvet avvisas.
do $$
begin
  begin
    update public.case_decisions
    set reconsider_note = 'ändrar noten i efterhand'
    where id = 'd1a20000-0000-0000-0000-000000000001';
    raise exception 'FAIL  ett omprövat beslut kunde ändras igen';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a reconsidered decision is final';
  end;
end $$;

-- Radering är inte en operation som finns: journal och beslut står kvar.
delete from public.case_decisions where id = 'd1a20000-0000-0000-0000-000000000001';
select pg_temp.check('decisions cannot be deleted',
  (select count(*) from public.case_decisions), 1::bigint);
delete from public.advisor_sessions where id = 'd1a10000-0000-0000-0000-000000000001';
select pg_temp.check('journal sessions cannot be deleted',
  (select count(*) from public.advisor_sessions), 1::bigint);

/* ========================================================================== */
/* Driftparametrarna: företagsplanens pris                                    */
/* ========================================================================== */

set local role authenticated;

-- Driften (1111) sätter företagsplanens månadsavgift.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.app_settings (key, value)
values ('company_plan', '{"monthly_ex_vat_sek": 985}'::jsonb);
select pg_temp.check('the admin sets the company plan',
  (select count(*) from public.app_settings where key = 'company_plan'), 1::bigint);

-- Alla inloggade läser priset - det står på startsidan.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check('any user reads the plan price',
  (select (value->>'monthly_ex_vat_sek')::int from public.app_settings where key = 'company_plan'), 985);

-- Men bara driften skriver.
do $$
begin
  begin
    update public.app_settings
    set value = '{"monthly_ex_vat_sek": 1}'::jsonb
    where key = 'company_plan';
    if (select (value->>'monthly_ex_vat_sek')::int from public.app_settings where key = 'company_plan') = 1 then
      raise exception 'FAIL  en vanlig användare kunde ändra priset';
    end if;
    raise notice 'ok    a non-admin cannot change the price';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok    a non-admin cannot change the price';
  end;
end $$;

-- Driften ändrar parametern; ändringen gäller omedelbart.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.app_settings
set value = '{"monthly_ex_vat_sek": 1200}'::jsonb, updated_at = now()
where key = 'company_plan';
select pg_temp.check('the admin updates the plan and it takes effect',
  (select (value->>'monthly_ex_vat_sek')::int from public.app_settings where key = 'company_plan'), 1200);

reset role;
select 'ALL RLS TESTS PASSED' as result;

rollback;
