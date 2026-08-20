-- =====================================================================
--  Konto użytkownika i blokowanie kont
--
--  1. blokada konta          - profiles.banned_at / banned_reason + funkcja `zbanowany`
--  2. zablokowane nicki      - tabela słów, których nie wolno użyć jako nick
--  3. strażnik profilu       - walidacja nicku i ochrona pól blokady
--  4. zbanowany nie pisze    - polityki zapisu sprawdzają blokadę
--  5. usunięcie konta        - `usun_moje_konto()` na życzenie właściciela
--  6. lista kont             - `lista_uzytkownikow()` dla panelu administratora
-- =====================================================================

/* ---------- 1. blokada konta ---------- */
alter table profiles add column if not exists banned_at       timestamptz;
alter table profiles add column if not exists banned_reason   text;
/* kiedy ostatnio zmieniono nick - zmiana jest możliwa raz na 14 dni */
alter table profiles add column if not exists nick_changed_at timestamptz;

create or replace function zbanowany(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and banned_at is not null);
$$;

grant execute on function zbanowany(uuid) to authenticated, anon;

/* ---------- 2. zablokowane nicki ---------- */
create table if not exists blocked_nicks (
  word       text primary key,
  created_at timestamptz not null default now()
);

alter table blocked_nicks enable row level security;
grant select, insert, delete on blocked_nicks to authenticated;

/* listę widzi i zmienia tylko administrator - walidacja czyta ją funkcją SECURITY DEFINER */
drop policy if exists blocked_nicks_admin on blocked_nicks;
create policy blocked_nicks_admin on blocked_nicks for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

insert into blocked_nicks (word) values
  ('admin'), ('administrator'), ('moderator'), ('podkosz'), ('basket'), ('oficjalny'),
  ('kurwa'), ('kurw'), ('chuj'), ('huj'), ('cipa'), ('pizda'), ('jeb'), ('pierdol'),
  ('skurwy'), ('dziwka'), ('szmata'), ('debil'), ('idiota'), ('pedal'), ('pedał'),
  ('ciota'), ('murzyn'), ('nigger'), ('faggot'), ('hitler'), ('nazi'), ('swastyka'),
  ('fuck'), ('shit'), ('cunt'), ('bitch'), ('rape'), ('gwalt'), ('gwałt')
on conflict do nothing;

/* ---------- 3. strażnik profilu ---------- */
/*
  Nick sprawdzamy w bazie, a nie tylko w formularzu: klucz publiczny pozwala każdemu
  zalogowanemu wysłać własny update, więc reguły muszą siedzieć tam, gdzie nie da się ich
  ominąć. Administrator jest zwolniony z listy słów (jego nick to „Basket").
*/
create or replace function profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kandydat text;
  ja_admin boolean := is_admin(auth.uid());
begin
  /* pola blokady zmienia wyłącznie administrator */
  if (new.banned_at is distinct from old.banned_at
      or new.banned_reason is distinct from old.banned_reason)
     and not ja_admin then
    raise exception 'Blokadę konta zmienia tylko administrator.';
  end if;

  if new.display_name is distinct from old.display_name then
    if old.banned_at is not null and not ja_admin then
      raise exception 'Konto jest zablokowane - nie można zmienić nicku.';
    end if;

    /* jedna zmiana na 14 dni: nick jest podpisem pod zgłoszonymi boiskami */
    if not ja_admin
       and old.nick_changed_at is not null
       and old.nick_changed_at > now() - interval '14 days' then
      raise exception 'Nick można zmieniać raz na 14 dni. Następna zmiana od %.',
        to_char(old.nick_changed_at + interval '14 days', 'DD.MM.YYYY');
    end if;

    kandydat := regexp_replace(trim(coalesce(new.display_name, '')), '\s+', ' ', 'g');

    if length(kandydat) < 3 or length(kandydat) > 24 then
      raise exception 'Nick musi mieć od 3 do 24 znaków.';
    end if;

    if kandydat !~ '^[[:alnum:]ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ._-]+$' then
      raise exception 'Nick może zawierać tylko litery, cyfry, spację, kropkę, kreskę i podkreślnik.';
    end if;

    if not ja_admin and exists (
      select 1 from blocked_nicks b where lower(kandydat) like '%' || b.word || '%'
    ) then
      raise exception 'Ten nick jest zablokowany - wybierz inny.';
    end if;

    if exists (
      select 1 from profiles p
      where p.id <> new.id and lower(p.display_name) = lower(kandydat)
    ) then
      raise exception 'Ten nick jest już zajęty.';
    end if;

    new.display_name := kandydat;
    new.nick_changed_at := now();
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard_trg on profiles;
create trigger profiles_guard_trg
  before update on profiles
  for each row execute function profiles_guard();

/* administrator może zmieniać profile (blokada konta) */
drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles for update
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

/* ---------- 4. zbanowany nie pisze ---------- */
drop policy if exists submissions_insert on submissions;
create policy submissions_insert on submissions for insert
  with check ((author_id is null or author_id = auth.uid()) and not zbanowany(auth.uid()));

drop policy if exists likes_insert on likes;
create policy likes_insert on likes for insert
  with check (user_id = auth.uid() and not zbanowany(auth.uid()));

drop policy if exists favorites_all on favorites;
create policy favorites_all on favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not zbanowany(auth.uid()));

drop policy if exists reports_insert on reports;
create policy reports_insert on reports for insert
  with check ((reporter_id is null or reporter_id = auth.uid()) and not zbanowany(auth.uid()));

drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback for insert
  with check ((author_id is null or author_id = auth.uid()) and not zbanowany(auth.uid()));

drop policy if exists checkins_insert on checkins;
create policy checkins_insert on checkins for insert
  with check (
    user_id = auth.uid()
    and day between current_date and current_date + 7
    and not zbanowany(auth.uid())
  );

/* ---------- 5. usunięcie własnego konta ---------- */
/*
  Konto usuwa sam właściciel. Boiska, które dodał, zostają na mapie (są już publiczną
  treścią serwisu), ale tracą powiązanie z kontem - w podpisie zostaje sama nazwa autora.
*/
create or replace function usun_moje_konto()
returns void language plpgsql security definer set search_path = public as $$
declare ja uuid := auth.uid();
begin
  if ja is null then
    raise exception 'Brak sesji.';
  end if;

  delete from likes     where user_id = ja;
  delete from favorites where user_id = ja;
  delete from checkins  where user_id = ja;

  update submissions set author_id = null where author_id = ja;
  update courts      set added_by  = null where added_by  = ja;

  delete from profiles where id = ja;
  delete from auth.users where id = ja;
end $$;

grant execute on function usun_moje_konto() to authenticated;

/* ---------- 6. lista kont dla administratora ---------- */
/*
  Adresy e-mail siedzą w schemacie auth, do którego Data API nie zagląda - dlatego lista
  idzie funkcją. Środek pilnuje, żeby zajrzał tylko administrator.
*/
create or replace function lista_uzytkownikow()
returns table (
  id            uuid,
  display_name  text,
  email         text,
  role          text,
  banned_at     timestamptz,
  banned_reason text,
  created_at    timestamptz,
  courts        bigint,
  likes         bigint
)
language sql security definer set search_path = public, auth stable as $$
  select
    p.id,
    p.display_name,
    u.email::text,
    p.role,
    p.banned_at,
    p.banned_reason,
    p.created_at,
    (select count(*) from courts c where c.added_by = p.id)                    as courts,
    (select coalesce(sum(c.likes_count), 0) from courts c where c.added_by = p.id) as likes
  from profiles p
  join auth.users u on u.id = p.id
  where is_admin(auth.uid())
  order by p.created_at desc;
$$;

grant execute on function lista_uzytkownikow() to authenticated;

/* ---------- kontrola ---------- */
select count(*) as zablokowanych_slow from blocked_nicks;
