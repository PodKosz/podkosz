-- =====================================================================
--  Wydarzenia na boiskach - turnieje, treningi otwarte, streetball.
--  Uruchom raz. Świeże projekty dostają to samo w schema.sql.
--
--  Wydarzenie zakłada administrator i to jedyna droga: to narzędzie promocyjne,
--  a nie treść od użytkowników. Pinezka wydarzenia jest biało-czerwona, kilka razy
--  większa od pozostałych i płonie - czyli krzyczy. Gdyby mógł ją postawić każdy,
--  mapa zamieniłaby się w tablicę ogłoszeń w ciągu tygodnia.
--
--  Osobna tabela, a nie kolumny w `courts`, z trzech powodów: jedno boisko może mieć
--  kilka wydarzeń (dziś trening, w sobotę turniej), wydarzenia mają się kończyć
--  i przestawać być widoczne bez ruszania boiska, a historia („co się tu działo")
--  to naturalne rozwinięcie, którego nie chcę sobie zamykać.
-- =====================================================================

create table if not exists public.wydarzenia (
  id          uuid primary key default gen_random_uuid(),
  court_id    uuid not null references public.courts(id) on delete cascade,
  nazwa       text not null check (length(btrim(nazwa)) between 2 and 90),
  opis        text not null default '' check (length(opis) <= 1500),
  poczatek    timestamptz not null,
  koniec      timestamptz not null,
  /* ścieżka w buckecie `court-photos`, katalog `wydarzenia/<id>/` */
  zdjecie     text,
  autor_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (koniec > poczatek)
);

/* zapytanie mapy brzmi „co jest jeszcze przed nami" - stąd indeks po końcu */
create index if not exists wydarzenia_okno_idx on public.wydarzenia (koniec, poczatek);
create index if not exists wydarzenia_boisko_idx on public.wydarzenia (court_id, poczatek desc);

alter table public.wydarzenia enable row level security;

/*
  Czyta każdy, także niezalogowany: wydarzenie ma być widoczne dla przechodnia, bo po to
  jest. Pisze wyłącznie administrator.
*/
drop policy if exists wydarzenia_select on public.wydarzenia;
create policy wydarzenia_select on public.wydarzenia for select using (true);

drop policy if exists wydarzenia_admin on public.wydarzenia;
create policy wydarzenia_admin on public.wydarzenia for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

grant select on table public.wydarzenia to anon, authenticated;
grant insert, update, delete on table public.wydarzenia to authenticated;

/* ---------- plakat wydarzenia w Storage ----------
   Zdjęcia boisk mają własną politykę (`court_photos_upload`), przypiętą do otwartego
   zgłoszenia - plakat wydarzenia nie ma zgłoszenia, więc potrzebuje własnej furtki.
   Wąskiej: tylko katalog `wydarzenia/` i tylko administrator.                        */
drop policy if exists wydarzenia_plakat_upload on storage.objects;
create policy wydarzenia_plakat_upload on storage.objects for insert
  with check (
    bucket_id = 'court-photos'
    and name like 'wydarzenia/%'
    and is_admin(auth.uid())
  );

drop policy if exists wydarzenia_plakat_update on storage.objects;
create policy wydarzenia_plakat_update on storage.objects for update
  using (bucket_id = 'court-photos' and name like 'wydarzenia/%' and is_admin(auth.uid()));

drop policy if exists wydarzenia_plakat_delete on storage.objects;
create policy wydarzenia_plakat_delete on storage.objects for delete
  using (bucket_id = 'court-photos' and name like 'wydarzenia/%' and is_admin(auth.uid()));

-- ============================================================ kontrola
select count(*) as wydarzen from public.wydarzenia;
