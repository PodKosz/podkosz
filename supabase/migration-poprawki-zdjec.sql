-- =====================================================================
--  Poprawki zdjęć: ktoś inny może podmienić albo dołożyć kadr do cudzego boiska
--
--  ------------------------------------------------------------------ po co
--
--  Boisko dodane w styczniu ma styczniowe zdjęcia: szaro, mokro, liście w kałuży.
--  W maju to samo boisko wygląda inaczej i lepiej. Dotąd nie było jak tego poprawić -
--  zdjęcia mógł zmienić wyłącznie administrator, a autor wpisu i tak nie wraca tam
--  z aparatem po pół roku.
--
--  Teraz każdy zalogowany może zaproponować LEPSZY KADR. Boisko zostaje przypisane
--  osobie, która je dodała - to się nie zmienia i nie ma się zmieniać. Zmienia się
--  jedno zdjęcie, a nie autorstwo wpisu.
--
--  ------------------------------------------------------------------ jeden kadr, jedno zgłoszenie
--
--  Zgłoszenie dotyczy DOKŁADNIE JEDNEGO kadru (`kind`), bo tak się je ogląda: obok
--  siebie zdjęcie, które jest, i zdjęcie, które ma je zastąpić. Gdyby jedno zgłoszenie
--  niosło pięć zdjęć naraz, przyjęcie go znaczyłoby „zgadzam się na wszystkie pięć",
--  a zwykle zgadza się na dwa z nich.
--
--  Kadr, którego boisko jeszcze nie ma, jest tym samym zgłoszeniem - po prostu nie ma
--  z czym porównywać. Stąd DOŁOŻENIE zdjęcia i PODMIANA zdjęcia to jedna ścieżka
--  w kodzie, a nie dwie: różni je tylko to, czy po drugiej stronie coś już wisi.
--
--  ------------------------------------------------------------------ znowu trzeba stać na boisku
--
--  Ten sam warunek co przy dodawaniu boiska (patrz `lib/obecnosc.ts`): odczyt GPS musi
--  być sensowny, a pinezka boiska nie dalej niż 25 m od niego. Bez tego „poprawka
--  zdjęcia" byłaby furtką do wrzucenia na cudze boisko czegokolwiek z internetu.
--
--  Tak samo jak tam, to jest PRÓG WYSIŁKU, nie dowód - pozycję z przeglądarki da się
--  podmienić. Dlatego zapisujemy zmierzoną odległość i pokazujemy ją w panelu, żeby
--  było widać, komu warto przyjrzeć się uważniej.
--
--  Uruchomienie: SQL Editor w Supabase, wklej całość, Run. Bezpieczne do powtórzenia.
-- =====================================================================

/* ---------- 1. kto dołożył które zdjęcie ---------- */
/*
  Do tej pory wszystkie zdjęcia boiska pochodziły z jednego zgłoszenia, więc autor
  zdjęcia i autor boiska to była ta sama osoba i nie było czego zapisywać. Od teraz
  mogą być różni - i warto wiedzieć, komu podziękować.

  NULL znaczy „ze zgłoszenia boiska", czyli autor wpisu. Tak zostają wszystkie
  dotychczasowe zdjęcia i to jest prawda o nich, a nie brak danych.
*/
alter table court_photos
  add column if not exists author_id uuid references profiles(id) on delete set null;

comment on column court_photos.author_id is
  'Kto dołożył to konkretne zdjęcie w poprawce. NULL = zdjęcie ze zgłoszenia boiska.';

/* ---------- 2. zgłoszenia poprawek ---------- */
create table if not exists photo_swaps (
  id           uuid primary key default gen_random_uuid(),
  court_id     uuid not null references courts on delete cascade,
  /*
    Kadr, którego dotyczy poprawka. Tekst, nie enum, bo `court_photos.kind` też jest
    tekstem - dwa różne typy na to samo pole prosiłyby się o rozjazd przy następnym
    dołożeniu rodzaju zdjęcia.
  */
  kind         text not null,
  /* nowe zdjęcie, już wgrane do R2 pod `poprawki/<id zgłoszenia>/...` */
  storage_path text not null,
  author_id    uuid not null references profiles(id) on delete cascade,
  /* odległość pinezki boiska od odczytu GPS w chwili robienia zdjęcia, w metrach */
  gps_odleglosc_m integer,
  status       text not null default 'open'
                 check (status in ('open', 'accepted', 'rejected')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references profiles(id) on delete set null
);

create index if not exists photo_swaps_otwarte_idx
  on photo_swaps (status, created_at desc);
create index if not exists photo_swaps_court_idx
  on photo_swaps (court_id, status);

/*
  Zakres taki sam jak przy zgłoszeniu boiska: hojny, bo ma odsiewać bzdury wysłane
  wprost do API, a nie dublować regułę z przeglądarki.
*/
do $$ begin
  alter table photo_swaps add constraint photo_swaps_gps_zakres check (
    gps_odleglosc_m is null or (gps_odleglosc_m >= 0 and gps_odleglosc_m <= 100)
  );
exception when duplicate_object then null; end $$;

alter table photo_swaps enable row level security;

/*
  ---------- 3. kto co może ----------

  Zakładać może zalogowany i niezbanowany, wyłącznie we własnym imieniu. Gość nie -
  dokładnie z tego samego powodu, dla którego nie może dodać boiska: nie ma z kim
  rozmawiać, gdy zdjęcie budzi wątpliwości, i nie ma czego zablokować przy nadużyciu.
*/
drop policy if exists photo_swaps_insert on photo_swaps;
create policy photo_swaps_insert on photo_swaps for insert
  with check (
    auth.uid() is not null
    and author_id = auth.uid()
    and not zbanowany(auth.uid())
  );

/* czyta administrator; autor widzi własne, żeby wiedzieć, co się z nimi stało */
drop policy if exists photo_swaps_select on photo_swaps;
create policy photo_swaps_select on photo_swaps for select
  using (is_admin(auth.uid()) or author_id = auth.uid());

drop policy if exists photo_swaps_admin_write on photo_swaps;
create policy photo_swaps_admin_write on photo_swaps for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

revoke all on photo_swaps from anon;
grant select, insert on photo_swaps to authenticated;
grant update, delete on photo_swaps to authenticated;   -- RLS przepuści tylko admina

/*
  ---------- 4. limit ----------

  Pięć poprawek na dobę na osobę. Próg jest wysoki z rozmysłem: ktoś, kto obszedł
  boisko i zrobił sześć ładnych zdjęć, ma prawo wysłać je wszystkie za jednym razem.
  Chodzi o zatrzymanie maszyny, nie zapaleńca.
*/
create or replace function photo_swaps_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ile integer;
begin
  select count(*) into ile
    from photo_swaps s
   where s.author_id = new.author_id
     and s.created_at > now() - interval '24 hours';

  if ile >= 5 then
    raise exception 'Dzienny limit poprawek zdjęć (5) wyczerpany. Wróć jutro.'
      using errcode = 'check_violation';
  end if;

  /*
    Druga poprawka tego samego kadru, gdy pierwsza jeszcze czeka, nie ma sensu: w panelu
    stanęłyby obok siebie dwa zgłoszenia o to samo i trzeba by zgadywać, które jest
    nowsze. Zamiast tego mówimy wprost, że poprzednie czeka.
  */
  if exists (
    select 1 from photo_swaps s
     where s.court_id = new.court_id
       and s.kind = new.kind
       and s.author_id = new.author_id
       and s.status = 'open'
  ) then
    raise exception 'Twoja poprzednia poprawka tego kadru czeka jeszcze na sprawdzenie.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists photo_swaps_rate_limit_trigger on photo_swaps;
create trigger photo_swaps_rate_limit_trigger
  before insert on photo_swaps
  for each row execute function photo_swaps_rate_limit();

/*
  ---------- 5. pytanie Workera ----------

  Worker zdjęć nie zna naszych reguł i nie ma ich znać - pyta o nie bazę (patrz
  `worker/zdjecia.js`). Przed wgraniem pliku pod `poprawki/<id>/...` pyta, czy takie
  zgłoszenie istnieje, jest otwarte i należy do tego, kto właśnie wgrywa.

  `security definer`, bo Worker pyta tokenem autora, a ten przez RLS widzi tylko własne
  wiersze - co akurat tutaj wystarcza, ale funkcja ma odpowiadać na pytanie „czy wolno",
  a nie „czy widzisz". Zwraca fałsz zamiast rzucać błędem, bo dla Workera „nie wolno"
  to zwykła odpowiedź.
*/
create or replace function poprawka_otwarta(sub uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from photo_swaps s
     where s.id = sub
       and s.status = 'open'
       and s.author_id = auth.uid()
  );
$$;

grant execute on function poprawka_otwarta(uuid) to authenticated;
revoke execute on function poprawka_otwarta(uuid) from anon;

/*
  ---------- 6. przyjęcie poprawki ----------

  Jedna operacja, nie trzy zapytania z panelu. Powód jest prosty: podmiana zdjęcia i
  zamknięcie zgłoszenia muszą się udać albo nie udać RAZEM. Gdyby panel robił to
  osobno, awaria między jednym a drugim zostawiłaby zgłoszenie otwarte przy już
  podmienionym zdjęciu - i ktoś zatwierdziłby je drugi raz.

  Zwraca ścieżkę zdjęcia, które właśnie przestało być używane (albo NULL, gdy kadru
  wcześniej nie było). Panel kasuje ten plik z R2 - baza nie ma jak tego zrobić.
*/
create or replace function przyjmij_poprawke(sub uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  z        photo_swaps%rowtype;
  stara    text;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator może przyjąć poprawkę.';
  end if;

  select * into z from photo_swaps where id = sub and status = 'open' for update;
  if not found then
    raise exception 'Nie ma takiej otwartej poprawki.';
  end if;

  select storage_path into stara
    from court_photos
   where court_id = z.court_id and kind = z.kind
   limit 1;

  if stara is null then
    /*
      Kadru jeszcze nie było - dokładamy go na koniec galerii. `sort` liczony z
      największego, a nie z liczby zdjęć: przy dziurach w numeracji (skasowany kadr)
      liczba zdjęć dałaby numer, który już istnieje.
    */
    insert into court_photos (court_id, kind, storage_path, sort, author_id)
    select z.court_id, z.kind, z.storage_path,
           coalesce(max(sort), -1) + 1, z.author_id
      from court_photos where court_id = z.court_id;
  else
    update court_photos
       set storage_path = z.storage_path,
           author_id    = z.author_id
     where court_id = z.court_id and kind = z.kind;
  end if;

  update photo_swaps
     set status = 'accepted', resolved_at = now(), resolved_by = auth.uid()
   where id = sub;

  return stara;
end $$;

grant execute on function przyjmij_poprawke(uuid) to authenticated;
revoke execute on function przyjmij_poprawke(uuid) from anon;

-- ============================================================ kontrola

-- 1. Tabela i kolumna stoją.
select
  (select count(*) from information_schema.columns
    where table_name = 'court_photos' and column_name = 'author_id') as kolumna_autora,
  (select count(*) from information_schema.tables
    where table_name = 'photo_swaps') as tabela_poprawek;

-- 2. Gość nie ma żadnych nadań do poprawek - ma wyjść zero wierszy.
select privilege_type
  from information_schema.role_table_grants
 where grantee = 'anon' and table_name = 'photo_swaps';

-- 3. Obie funkcje istnieją.
select proname from pg_proc
 where proname in ('poprawka_otwarta', 'przyjmij_poprawke');

/*
  ---------- 7. wycofanie własnej poprawki ----------

  Dopisane po uruchomieniu części pierwszej - plik jest idempotentny, więc całość
  puszcza się ponownie.

  Powód jest w kolejności zapisu. Wiersz musi powstać PRZED wgraniem pliku, bo Worker
  pyta o niego `poprawka_otwarta` - inaczej nie wiedziałby, komu ten katalog wolno
  otworzyć. Gdy więc wgrywanie padnie (zerwane LTE przy boisku to nie brzeg możliwości,
  tylko codzienność), zostaje wiersz wskazujący na plik, którego nie ma, a autor nie ma
  jak po sobie posprzątać: `photo_swaps_admin_write` przepuszcza kasowanie wyłącznie
  administratorowi. Efekt byłby taki, że w panelu stoi zgłoszenie z rozbitym kadrem,
  a jedyną osobą, która może je zdjąć, jestem ja.

  Tylko WŁASNE i tylko OTWARTE. Po przyjęciu status to `accepted`, więc ta polityka
  już nie sięga - historia przyjętej poprawki zostaje i nie da się jej wymazać.
*/
drop policy if exists photo_swaps_delete_wlasne on photo_swaps;
create policy photo_swaps_delete_wlasne on photo_swaps for delete
  using (author_id = auth.uid() and status = 'open');
