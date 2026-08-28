-- =====================================================================
--  Usuwanie kont przez administratora z archiwum na 180 dni
--
--  Blokada (ban) zostawia konto na miejscu - osoba dalej istnieje, tylko baza odrzuca jej
--  zapisy. Do testowania ścieżki dołączania to za mało: żeby przejść proces „na świeżo",
--  konto musi zniknąć razem z wpisem w auth.users, bo inaczej to samo konto Google wraca
--  z tym samym identyfikatorem i tym samym profilem.
--
--  Usunięcie jest więc prawdziwe, ale nie bezpowrotne: przed skasowaniem robimy zdjęcie
--  konta i trzymamy je 180 dni. W archiwum siedzi to, czego nie da się odtworzyć z niczego
--  innego - kim była ta osoba, które boiska dodała, co polubiła i jakie miała odznaczenia.
--
--  Przywracanie nie odtwarza wiersza w auth.users. Tamtej tożsamości nie da się uczciwie
--  sfabrykować (hasła, tokeny, identyfikatory dostawcy), a i nie ma po co: liczy się adres
--  e-mail. „Przywróć" doczepia archiwum do konta o tym samym adresie - od razu, jeśli ono
--  już istnieje, albo przy najbliższym logowaniu, jeśli osoba jeszcze nie wróciła.
-- =====================================================================

/* ---------- 1. archiwum ---------- */

create table if not exists konta_usuniete (
  id             uuid primary key,
  email          text,
  display_name   text,
  avatar_url     text,
  role           text not null default 'user',
  konto_od       timestamptz,
  usuniete_at    timestamptz not null default now(),
  usuniete_przez uuid,
  /* po tej dacie zdjęcie konta znika bezpowrotnie */
  wygasa_at      timestamptz not null default now() + interval '180 days',
  /* administrator kliknął „przywróć", ale nikt jeszcze nie zalogował się tym adresem */
  oczekuje       boolean not null default false,
  przywrocone_at timestamptz,
  /* konto, do którego archiwum ostatecznie wróciło (nowy identyfikator z auth.users) */
  nowe_id        uuid,
  /* zdjęcie konta: boiska, polubienia, ulubione, statystyki i odznaczenia */
  dane           jsonb not null default '{}'::jsonb
);

create index if not exists konta_usuniete_email_idx on konta_usuniete (lower(email));

alter table konta_usuniete enable row level security;

drop policy if exists konta_usuniete_admin on konta_usuniete;
create policy konta_usuniete_admin on konta_usuniete for select
  using (is_admin(auth.uid()));

grant select on konta_usuniete to authenticated;

/* ---------- 2. sprzątanie po 180 dniach ---------- */

create or replace function sprzataj_usuniete_konta()
returns integer language plpgsql security definer set search_path = public as $$
declare ile integer;
begin
  delete from konta_usuniete
   where wygasa_at < now()
     and przywrocone_at is null;
  get diagnostics ile = row_count;
  return ile;
end $$;

/* ---------- 3. usunięcie konta ---------- */

create or replace function usun_konto(in_user uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  ja      uuid := auth.uid();
  mail    text;
  profil  profiles%rowtype;
  zdjecie jsonb;
begin
  if not is_admin(ja) then
    raise exception 'Tylko administrator może usuwać konta';
  end if;

  /*
    Na własnym koncie się nie da. Usunięcie siebie kasuje jedyną rolę administratora w
    tabeli profiles i panel przestaje się otwierać - a odzyskać go można już tylko z
    konsoli bazy.
  */
  if in_user = ja then
    raise exception 'Nie można usunąć konta, na którym jesteś zalogowany';
  end if;

  select * into profil from profiles where id = in_user;
  if not found then
    raise exception 'Nie ma takiego konta';
  end if;

  select u.email::text into mail from auth.users u where u.id = in_user;

  /*
    Zdjęcie konta. Boiska zapisujemy z identyfikatorem, nazwą i liczbą podpaleń: przy
    przywracaniu potrzebny jest sam identyfikator, ale administrator w liście chce
    zobaczyć, CO to było konto - „siedem boisk, w tym Kobe Bryant" mówi więcej niż
    siedem identyfikatorów.
  */
  select jsonb_build_object(
    'boiska', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'name', c.name, 'likes', c.likes_count
      ) order by c.likes_count desc)
      from courts c where c.added_by = in_user
    ), '[]'::jsonb),
    'zgloszenia', coalesce((
      select jsonb_agg(s.id) from submissions s where s.author_id = in_user
    ), '[]'::jsonb),
    'polubienia', coalesce((
      select jsonb_agg(l.court_id) from likes l where l.user_id = in_user
    ), '[]'::jsonb),
    'ulubione', coalesce((
      select jsonb_agg(f.court_id) from favorites f where f.user_id = in_user
    ), '[]'::jsonb),
    'checkinow', (select count(*) from checkins ch where ch.user_id = in_user),
    'statystyki', (
      select to_jsonb(g) from statystyki_gracza(profil.display_name) g limit 1
    )
  ) into zdjecie;

  insert into konta_usuniete (
    id, email, display_name, avatar_url, role, konto_od, usuniete_przez, dane
  )
  values (
    in_user, mail, profil.display_name, profil.avatar_url, profil.role,
    profil.created_at, ja, coalesce(zdjecie, '{}'::jsonb)
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    role = excluded.role,
    konto_od = excluded.konto_od,
    usuniete_at = now(),
    usuniete_przez = excluded.usuniete_przez,
    wygasa_at = now() + interval '180 days',
    oczekuje = false,
    przywrocone_at = null,
    nowe_id = null,
    dane = excluded.dane;

  /*
    Boiska zostają na mapie - są już publiczną treścią serwisu i nie znikają razem z
    kontem. Tracą tylko powiązanie z kontem; w podpisie zostaje sama nazwa autora,
    a `added_by` wróci przy przywracaniu.
  */
  delete from likes     where user_id = in_user;
  delete from favorites where user_id = in_user;
  delete from checkins  where user_id = in_user;

  update submissions set author_id = null where author_id = in_user;
  update courts      set added_by  = null where added_by  = in_user;

  delete from profiles where id = in_user;
  delete from auth.users where id = in_user;

  perform sprzataj_usuniete_konta();
end $$;

grant execute on function usun_konto(uuid) to authenticated;

/* ---------- 4. doczepienie archiwum do konta ---------- */

/*
  Wspólny środek dla obu dróg powrotu: kliknięcia „przywróć" na istniejącym koncie i
  automatu przy zakładaniu konta tym samym adresem. Bez `security definer` nie zadziała
  ta druga droga - wyzwalacz przy rejestracji nie ma jeszcze żadnej sesji.
*/
create or replace function przywroc_dane_konta(in_archiwum uuid, in_nowy uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a konta_usuniete%rowtype;
begin
  select * into a from konta_usuniete where id = in_archiwum;
  if not found then return; end if;

  update profiles set
    display_name = coalesce(a.display_name, display_name),
    avatar_url   = coalesce(a.avatar_url, avatar_url),
    role         = a.role
  where id = in_nowy;

  update courts set added_by = in_nowy
   where id in (
     select (b->>'id')::uuid from jsonb_array_elements(a.dane->'boiska') b
   );

  update submissions set author_id = in_nowy
   where id in (
     select value::uuid from jsonb_array_elements_text(a.dane->'zgloszenia')
   );

  /* polubienia i ulubione wracają tylko dla boisk, które nadal są w bazie */
  insert into likes (user_id, court_id)
  select in_nowy, c.id
    from jsonb_array_elements_text(a.dane->'polubienia') v
    join courts c on c.id = v.value::uuid
  on conflict do nothing;

  insert into favorites (user_id, court_id)
  select in_nowy, c.id
    from jsonb_array_elements_text(a.dane->'ulubione') v
    join courts c on c.id = v.value::uuid
  on conflict do nothing;

  update konta_usuniete
     set przywrocone_at = now(), oczekuje = false, nowe_id = in_nowy
   where id = in_archiwum;
end $$;

/* ---------- 5. „przywróć" z panelu ---------- */

create or replace function przywroc_konto(in_user uuid)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  a    konta_usuniete%rowtype;
  cel  uuid;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator może przywracać konta';
  end if;

  select * into a from konta_usuniete where id = in_user;
  if not found then
    raise exception 'Nie ma takiego konta w archiwum';
  end if;
  if a.przywrocone_at is not null then
    return 'To konto zostało już przywrócone.';
  end if;
  if a.email is null then
    raise exception 'Konto nie ma zapisanego adresu - nie ma do czego doczepić danych';
  end if;

  select u.id into cel from auth.users u where lower(u.email) = lower(a.email) limit 1;

  if cel is null then
    /* nikt jeszcze nie wrócił tym adresem - dane doczepi wyzwalacz przy rejestracji */
    update konta_usuniete set oczekuje = true where id = in_user;
    perform sprzataj_usuniete_konta();
    return 'Konto czeka na powrót. Dane wrócą same, gdy ktoś zaloguje się adresem '
           || a.email || '.';
  end if;

  perform przywroc_dane_konta(in_user, cel);
  perform sprzataj_usuniete_konta();
  return 'Przywrócono dane do konta ' || a.email || '.';
end $$;

grant execute on function przywroc_konto(uuid) to authenticated;

/* ---------- 6. automatyczny powrót przy rejestracji ---------- */

/*
  Rozszerzenie wyzwalacza zakładającego profil. Jeżeli ktoś loguje się adresem, dla
  którego administrator zaznaczył powrót, dane doczepiają się same - bez tego trzeba by
  pilnować, kiedy dokładnie ta osoba wróci, i klikać „przywróć" po raz drugi.
*/
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare archiwum uuid;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             split_part(coalesce(new.email,'gracz@boiska'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  select k.id into archiwum
    from public.konta_usuniete k
   where k.oczekuje
     and k.przywrocone_at is null
     and lower(k.email) = lower(new.email)
   order by k.usuniete_at desc
   limit 1;

  if archiwum is not null then
    perform public.przywroc_dane_konta(archiwum, new.id);
  end if;

  return new;
end $$;

/* ---------- 7. lista archiwum dla panelu ---------- */

create or replace function lista_usunietych_kont()
returns table (
  id             uuid,
  email          text,
  display_name   text,
  avatar_url     text,
  usuniete_at    timestamptz,
  wygasa_at      timestamptz,
  oczekuje       boolean,
  przywrocone_at timestamptz,
  dane           jsonb
)
language sql security definer set search_path = public stable as $$
  select k.id, k.email, k.display_name, k.avatar_url, k.usuniete_at, k.wygasa_at,
         k.oczekuje, k.przywrocone_at, k.dane
    from konta_usuniete k
   where is_admin(auth.uid())
   order by k.usuniete_at desc;
$$;

grant execute on function lista_usunietych_kont() to authenticated;
grant execute on function sprzataj_usuniete_konta() to authenticated;
