-- Journal-endpointen: den första API-resursen bakom API-nyckel som blir
-- LIVE. Ett externt system (byråsystem, försäkringssystem, bank) läser
-- ärendets journal med sin nyckel - ingen session, ingen inloggning.
--
-- Reglerna, samma anda som live-länken:
--   * Nyckeln verifieras mot hashen; en okänd eller återkallad nyckel
--     får SAMMA TYSTNAD (null) som ett ärende nyckelns ägare inte har
--     åtkomst till - endpointen kan inte användas för att sondera
--     vilka nycklar eller ärenden som finns.
--   * Nyckeln ser exakt det ägarens konto ser: ägda ärenden och aktiva
--     medlemskap. Varken mer eller mindre.
--   * Varje lyckad verifiering stämplar last_used_at - ägaren ser i
--     Inställningar att nyckeln faktiskt används.
--   * Journalen levereras som DATA (händelserader) - aldrig
--     bedömningar, och utan before/after-ögonblicksbilderna: raden
--     säger VAD som hände, inte radinnehållet.

create or replace function public.api_journal(p_key text, p_case_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_key_id uuid;
  v_owner uuid;
begin
  select k.id, k.owner_user_id into v_key_id, v_owner
  from public.api_keys k
  where k.key_hash = encode(digest(p_key, 'sha256'), 'hex')
    and k.revoked_at is null;
  if v_owner is null then
    return null;
  end if;

  update public.api_keys set last_used_at = now() where id = v_key_id;

  if not exists (
    select 1 from public.cases c
    where c.id = p_case_id and c.user_id = v_owner
  ) and not exists (
    select 1 from public.case_members m
    where m.case_id = p_case_id
      and m.user_id = v_owner
      and m.revoked_at is null
      and m.role = any (public.case_wide_roles())
  ) then
    return null;
  end if;

  return jsonb_build_object(
    'case_id', p_case_id,
    'fetched_at', now(),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'action', e.action,
        'object_type', e.object_type,
        'object_id', e.object_id,
        'actor_role', e.actor_role,
        'occurred_at', e.occurred_at
      ) order by e.occurred_at desc)
      from public.audit_events e
      where e.case_id = p_case_id
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.api_journal(text, uuid) is
  'Journal-läsning med API-nyckel: samma tystnad för okänd/återkallad nyckel som för ärenden utan åtkomst. Data, aldrig bedömningar.';

revoke all on function public.api_journal(text, uuid) from public;
grant execute on function public.api_journal(text, uuid) to anon, authenticated;
