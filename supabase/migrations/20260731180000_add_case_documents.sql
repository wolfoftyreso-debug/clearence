-- Documents attached to a case: bank statements, balance sheets, tax account
-- extracts and whatever else the user wants to keep with the assessment.
--
-- Two things are being protected here and both need their own policy: the
-- metadata row in public.case_documents, and the object itself in storage.
-- Securing only the table would leave the files reachable by anyone who can
-- guess a path.

create type public.document_kind as enum (
  'bank_statement',
  'balance_sheet',
  'income_statement',
  'annual_report',
  'tax_account',
  'debt_overview',
  'agreement',
  'correspondence',
  'other'
);

create type public.document_source as enum ('manual', 'fortnox', 'visma');

create table public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.document_kind not null default 'other',
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  -- Object key inside the storage bucket. Always prefixed with the owning
  -- user id; the storage policies below depend on that prefix.
  storage_path text not null unique,
  source public.document_source not null default 'manual',
  note text,
  created_at timestamptz not null default now(),

  constraint case_documents_file_name_not_blank check (length(btrim(file_name)) > 0),
  -- 25 MB. Large enough for a scanned annual report, small enough that a
  -- runaway upload cannot fill the bucket.
  constraint case_documents_file_size_sane check (file_size > 0 and file_size <= 26214400),
  constraint case_documents_storage_path_owned check (storage_path like user_id::text || '/%')
);

create index case_documents_case_id_created_at_idx
  on public.case_documents (case_id, created_at desc);

alter table public.case_documents enable row level security;

create policy "Users read their own documents"
  on public.case_documents for select
  using (auth.uid() = user_id);

create policy "Users attach documents to their own cases"
  on public.case_documents for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.cases c
      where c.id = case_id and c.user_id = auth.uid()
    )
  );

create policy "Users update their own documents"
  on public.case_documents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete their own documents"
  on public.case_documents for delete
  using (auth.uid() = user_id);

-- Private bucket. `public = false` is the whole point: these files must only
-- ever be reachable through a signed, expiring URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-documents',
  'case-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do nothing;

-- Object-level policies. storage.foldername(name) returns the path segments,
-- so [1] is the owning user id that the table constraint above enforces.
create policy "Users read their own case documents"
  on storage.objects for select
  using (
    bucket_id = 'case-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users upload their own case documents"
  on storage.objects for insert
  with check (
    bucket_id = 'case-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete their own case documents"
  on storage.objects for delete
  using (
    bucket_id = 'case-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
