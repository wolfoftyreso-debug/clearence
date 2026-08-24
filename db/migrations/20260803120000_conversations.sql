-- Meddelanden 2.0: direkta trådar, namngivna grupper, bilagor, kvittenser
-- och taggning.
--
-- Beslutet bakom utbyggnaden: man ska kunna skicka direkt till en person
-- eller till en namngiven grupp, bifoga vilken fil som helst, slå ihop
-- grupper som råkat öppnas två gånger för samma sak, kvittera "uppfattat"
-- per meddelande, och tagga den man förväntar sig svar av - som då får en
-- egen notis.
--
-- Fyra regler som bär utformningen:
--
--  1. EN DIREKT TRÅD ÄR PRIVAT ÄVEN INOM ÄRENDET. Grundtråden ser alla
--     medlemmar (borgenärer aldrig - has_case_access), men en direkt- eller
--     grupptråd ser bara deltagarna. Styrelseledamoten ska kunna fråga
--     rekonstruktören något utan att hela ärendet läser det.
--
--  2. SKICKAT ÄR SKICKAT. Immutabiliteten från grundtråden gäller även här,
--     med två tillägg: kvittenser kan aldrig tas tillbaka (en "uppfattat"
--     som kan ångras är inget underlag), och en sammanslagning får flytta
--     ett meddelande mellan trådar men aldrig röra dess innehåll.
--
--  3. BILAGAN ÄR ETT ÄRENDEDOKUMENT. Filen laddas upp till ärendets
--     dokumentlager och meddelandet pekar på den. Ingen andra fillagring,
--     inga andra regler - och dokumentet måste tillhöra samma ärende som
--     meddelandet, annars vore bilagan en läcka mellan ärenden.
--
--  4. TAGGEN ÄR ETT LÖFTE OM SVAR, INTE EN PING. expects_reply_from måste
--     vara en medlem som faktiskt kan se meddelandet, och notisen släcks av
--     personens kvittens - inte av tid.

/* -------------------------------------------------------------------------- */
/* Trådar och deltagare                                                       */
/* -------------------------------------------------------------------------- */

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  kind text not null,
  -- Grupper namnges ("Bankfrågor"); en direkt tråd heter det motparten
  -- heter och lagrar därför inget namn.
  title text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  /** Satt när tråden slagits ihop in i en annan. Läses som en vidarepekare. */
  merged_into uuid references public.conversations (id) on delete set null,

  constraint conversations_kind_known check (kind in ('direct', 'group')),
  constraint conversations_group_named check ((kind = 'group') = (title is not null)),
  constraint conversations_title_length check (title is null or char_length(title) between 2 and 120),
  constraint conversations_no_self_merge check (merged_into is distinct from id)
);

comment on table public.conversations is
  'Direkta trådar och namngivna grupper i ärendet. Synliga endast för deltagarna - grundtråden (conversation_id null på meddelandet) ser alla medlemmar.';

create index conversations_case_idx on public.conversations (case_id, created_at desc);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

/**
 * SECURITY DEFINER av samma skäl som has_case_access: policyer på
 * conversations behöver fråga deltagartabellen utan att dess policy frågar
 * tillbaka och rekurserar.
 */
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = p_conversation_id
      and p.user_id = auth.uid()
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;

/**
 * SECURITY DEFINER: deltagarpolicyn nedan behöver veta vem som skapade
 * tråden utan att gå genom conversations egen select-policy - skaparen ska
 * kunna lägga till trådens FÖRSTA deltagare, innan någon deltagarlista
 * finns att synas i.
 */
create or replace function public.is_conversation_creator(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.created_by = auth.uid()
  );
$$;

-- Bara deltagare (och skaparen, som ännu inte hunnit lägga till sig själv)
-- ser tråden. Att man är medlem i ärendet räcker inte - det är hela
-- poängen med en direkt tråd.
create policy conversations_participants_read
  on public.conversations for select to authenticated
  using (public.is_conversation_participant(id) or created_by = auth.uid());

-- Vilken medlem som helst (utom borgenärer, via has_case_access) får starta
-- en tråd i sitt ärende.
create policy conversations_members_create
  on public.conversations for insert to authenticated
  with check (public.has_case_access(case_id) and created_by = auth.uid());

create policy conversation_participants_read
  on public.conversation_participants for select to authenticated
  using (public.is_conversation_participant(conversation_id));

-- Deltagare läggs till av trådens skapare eller en befintlig deltagare.
-- Valideringstriggern nedan kräver dessutom att den tillagda själv är
-- medlem i ärendet - en tråd kan aldrig ge någon utomstående åtkomst.
create policy conversation_participants_add
  on public.conversation_participants for insert to authenticated
  with check (
    public.is_conversation_participant(conversation_id)
    or public.is_conversation_creator(conversation_id)
  );

grant select, insert on public.conversations to authenticated;
grant select, insert on public.conversation_participants to authenticated;

/**
 * En deltagare måste vara medlem i trådens ärende, med ärendevid åtkomst.
 * Kontrollen bor i databasen: klienten väljer i en lista, men listan är
 * inte gränsen.
 */
create or replace function public.validate_conversation_participant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case_id uuid;
begin
  select case_id into v_case_id from public.conversations where id = new.conversation_id;
  if not exists (
    select 1 from public.case_members m
    where m.case_id = v_case_id
      and m.user_id = new.user_id
      and m.revoked_at is null
      and m.role = any (public.case_wide_roles())
  ) then
    raise exception 'Deltagaren måste vara medlem i ärendet';
  end if;
  return new;
end;
$$;

create trigger conversation_participants_validate
  before insert on public.conversation_participants
  for each row execute function public.validate_conversation_participant();

/* -------------------------------------------------------------------------- */
/* Meddelandena: tråd, bilaga, tagg                                           */
/* -------------------------------------------------------------------------- */

alter table public.case_messages
  add column conversation_id uuid references public.conversations (id) on delete cascade,
  add column attachment_document_id uuid references public.case_documents (id) on delete set null,
  add column expects_reply_from uuid references auth.users (id) on delete set null;

-- Synligheten smalnar: grundtrådens meddelanden (conversation_id null) ser
-- alla medlemmar som förut, men trådade meddelanden bara deltagarna.
drop policy case_messages_members_read on public.case_messages;
create policy case_messages_members_read
  on public.case_messages for select to authenticated
  using (
    public.has_case_access(case_id)
    and (conversation_id is null or public.is_conversation_participant(conversation_id))
  );

drop policy case_messages_members_write on public.case_messages;
create policy case_messages_members_write
  on public.case_messages for insert to authenticated
  with check (
    public.has_case_access(case_id)
    and author_user_id = auth.uid()
    and (conversation_id is null or public.is_conversation_participant(conversation_id))
  );

/**
 * Bilagan måste tillhöra samma ärende, och den taggade måste kunna se
 * meddelandet - annars är taggen ett löfte ingen kan infria.
 */
create or replace function public.validate_case_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.conversation_id is not null and not exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id and c.case_id = new.case_id
  ) then
    raise exception 'Tråden tillhör ett annat ärende';
  end if;

  if new.attachment_document_id is not null and not exists (
    select 1 from public.case_documents d
    where d.id = new.attachment_document_id and d.case_id = new.case_id
  ) then
    raise exception 'Bilagan måste vara ett dokument i samma ärende';
  end if;

  if new.expects_reply_from is not null then
    if new.conversation_id is not null then
      if not exists (
        select 1 from public.conversation_participants p
        where p.conversation_id = new.conversation_id
          and p.user_id = new.expects_reply_from
      ) then
        raise exception 'Den taggade måste vara deltagare i tråden';
      end if;
    elsif not exists (
      select 1 from public.case_members m
      where m.case_id = new.case_id
        and m.user_id = new.expects_reply_from
        and m.revoked_at is null
        and m.role = any (public.case_wide_roles())
    ) then
      raise exception 'Den taggade måste vara medlem i ärendet';
    end if;
  end if;

  return new;
end;
$$;

create trigger case_messages_validate
  before insert on public.case_messages
  for each row execute function public.validate_case_message();

-- Immutabiliteten uppdaterad: sammanslagning får flytta ett meddelande
-- mellan trådar (conversation_id), men bilaga och tagg är lika orörliga som
-- texten.
create or replace function public.case_messages_are_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body
     or new.author_user_id is distinct from old.author_user_id
     or new.case_id is distinct from old.case_id
     or new.created_at is distinct from old.created_at
     or new.attachment_document_id is distinct from old.attachment_document_id
     or new.expects_reply_from is distinct from old.expects_reply_from then
    raise exception 'Ett skickat meddelande kan inte ändras. Endast read_at får sättas.';
  end if;
  return new;
end;
$$;

/* -------------------------------------------------------------------------- */
/* Uppfattat-kvittensen                                                       */
/* -------------------------------------------------------------------------- */

create table public.message_acks (
  message_id uuid not null references public.case_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

comment on table public.message_acks is
  'Uppfattat-kvittenser. Kan aldrig tas tillbaka - en kvittens som går att ångra är inget underlag. Släcker även taggnotisen.';

alter table public.message_acks enable row level security;

/** Ser man meddelandet ser man vilka som kvitterat det. */
create or replace function public.can_see_message(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.case_messages m
    where m.id = p_message_id
      and public.has_case_access(m.case_id)
      and (m.conversation_id is null or public.is_conversation_participant(m.conversation_id))
  );
$$;

create policy message_acks_read
  on public.message_acks for select to authenticated
  using (public.can_see_message(message_id));

create policy message_acks_own_insert
  on public.message_acks for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_message(message_id));

-- Ingen update- eller delete-policy: kvittensen är slutgiltig.
grant select, insert on public.message_acks to authenticated;

create or replace function public.message_acks_are_final()
returns trigger
language plpgsql
as $$
begin
  raise exception 'En uppfattat-kvittens kan inte ändras eller tas tillbaka';
end;
$$;

create trigger message_acks_no_update
  before update on public.message_acks
  for each row execute function public.message_acks_are_final();
create trigger message_acks_no_delete
  before delete on public.message_acks
  for each row execute function public.message_acks_are_final();

/* -------------------------------------------------------------------------- */
/* Sammanslagning av dubblettgrupper                                          */
/* -------------------------------------------------------------------------- */

/**
 * Slår ihop två grupptrådar i samma ärende: meddelanden och deltagare
 * flyttas till måltråden, källan märks merged_into och lämnas kvar som
 * vidarepekare. Kräver deltagande i båda - man slår inte ihop andras
 * trådar.
 */
create or replace function public.merge_conversations(p_from uuid, p_to uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_from public.conversations%rowtype;
  v_to public.conversations%rowtype;
begin
  if p_from = p_to then
    raise exception 'En tråd kan inte slås ihop med sig själv';
  end if;

  select * into v_from from public.conversations where id = p_from for update;
  select * into v_to from public.conversations where id = p_to for update;

  if v_from.id is null or v_to.id is null then
    raise exception 'Tråden finns inte';
  end if;
  if v_from.kind <> 'group' or v_to.kind <> 'group' then
    raise exception 'Endast grupptrådar kan slås ihop';
  end if;
  if v_from.case_id <> v_to.case_id then
    raise exception 'Trådarna tillhör olika ärenden';
  end if;
  if v_from.merged_into is not null or v_to.merged_into is not null then
    raise exception 'Tråden är redan sammanslagen';
  end if;
  if not (public.is_conversation_participant(p_from) and public.is_conversation_participant(p_to)) then
    raise exception 'Kräver deltagande i båda trådarna';
  end if;

  -- Deltagare: unionen. Dubbletter ignoreras mot primärnyckeln.
  insert into public.conversation_participants (conversation_id, user_id, added_by)
  select p_to, p.user_id, auth.uid()
  from public.conversation_participants p
  where p.conversation_id = p_from
  on conflict do nothing;

  update public.case_messages set conversation_id = p_to where conversation_id = p_from;

  update public.conversations set merged_into = p_to where id = p_from;
end;
$$;

/* -------------------------------------------------------------------------- */
/* Notisen: taggade meddelanden utan kvittens                                 */
/* -------------------------------------------------------------------------- */

/**
 * Notiscentrets innehåll: meddelanden där DU förväntas svara och inte har
 * kvitterat. Släcks av din kvittens, inte av tid. Funktion i stället för
 * klientjoin så att avsändarens namn kan hämtas utan att öppna
 * user_profiles för läsning på tvären.
 */
create or replace function public.my_open_mentions()
returns table (
  message_id uuid,
  case_id uuid,
  conversation_id uuid,
  conversation_title text,
  author_name text,
  body text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.case_id, m.conversation_id,
         c.title, coalesce(p.display_name, u.email::text), m.body, m.created_at
  from public.case_messages m
  left join public.conversations c on c.id = m.conversation_id
  left join public.user_profiles p on p.user_id = m.author_user_id
  left join auth.users u on u.id = m.author_user_id
  where m.expects_reply_from = auth.uid()
    and not exists (
      select 1 from public.message_acks a
      where a.message_id = m.id and a.user_id = auth.uid()
    )
  order by m.created_at desc;
$$;
