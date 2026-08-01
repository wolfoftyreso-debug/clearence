-- The single authorisation question the API asks before signing an S3 URL.
--
-- Lives in a migration rather than the bootstrap because it depends on tables
-- the migrations create.
--
-- Self-sufficient: the schema is created by db/bootstrap.sql when
-- self-hosting, but a migration must apply to any database that has the
-- earlier migrations, including one that never ran the bootstrap.
create schema if not exists app;

/* -------------------------------------------------------------------------- */
/* Object storage metadata                                                    */
/* -------------------------------------------------------------------------- */

-- Files live in S3, not in Postgres, so Supabase's storage.objects has no
-- equivalent here. `public.case_documents` remains the record of what exists
-- and who may see it; this function is the single question the API asks
-- before signing a URL.
create or replace function app.may_read_document(p_document_id uuid)
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
      and public.has_case_access(d.case_id)
  );
$$;

comment on function app.may_read_document(uuid) is
  'Enda stället API:et frågar innan det signerar en S3-URL. Signera aldrig utan att ha fått true här - en signerad URL kringgår all databasbehörighet.';
