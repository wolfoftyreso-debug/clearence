-- Den självhostade rollmodellen, prövad. Förutsätter att
-- db/roles-selfhosted.sql redan körts (run.sh gör det före den här).
--
-- Två löften vaktas, och det andra är det som kostar mest om det bryts:
--  1. app_worker (den betrodda batch-rollen) KAN röra utkorgen och köra
--     arbetarfunktionerna - annars faller arbetaren på 42501 i drift.
--  2. authenticated (API-rollens grund) går ALDRIG förbi radskyddet. Samma
--     insert som app_worker får göra måste authenticated nekas.

-- 1. Attributen.
do $$
begin
  if (select rolbypassrls from pg_roles where rolname = 'app_worker') is distinct from true then
    raise exception 'app_worker saknar bypassrls - arbetaren kan inte röra utkorgen';
  end if;
  if (select coalesce(rolbypassrls, false) from pg_roles where rolname = 'authenticated') then
    raise exception 'authenticated har bypassrls - radskyddet är avstängt för API-rollen';
  end if;
end $$;

-- 2. app_worker rör utkorgen och kör en arbetarfunktion.
set role app_worker;
insert into public.outbound_emails (recipient, subject, body_text, body_html, kind)
  values ('roletest@x.se', 's', 't', 'h', 'worker-can');
select public.claim_outbound_emails(1) is not null as claimed;
reset role;

-- 3. authenticated nekas SAMMA insert av radskyddet (42501).
set role authenticated;
select set_config('app.user_id', gen_random_uuid()::text, true);
do $$
begin
  begin
    insert into public.outbound_emails (recipient, subject, body_text, body_html, kind)
      values ('x@x.se', 's', 't', 'h', 'should-fail');
    raise exception 'authenticated fick skriva i utkorgen - radskyddet gäller inte';
  exception
    when insufficient_privilege then null;  -- förväntat: RLS blockerar
  end;
end $$;
reset role;

do $$ begin raise notice 'ALL ROLE TESTS PASSED'; end $$;
