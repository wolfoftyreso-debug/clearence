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

reset role;
select 'ALL RLS TESTS PASSED' as result;

rollback;
