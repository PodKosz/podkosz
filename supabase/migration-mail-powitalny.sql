-- =====================================================================
--  Mail powitalny po pierwszym logowaniu
--
--  Dwie wersje wiadomości: dla beta testera (adres z listy `beta_testers`) i dla
--  zwykłego gracza. Kto trafił do pierwszej setki kont, dostaje w mailu dodatkowy
--  akapit o wyróżnieniu „Pionier" - tym samym, które widzi potem na profilu.
--
--  Mail ma wyjść RAZ na konto, a logowanie zdarza się przy każdym powrocie na stronę,
--  więc decyzję podejmuje baza, nie kod strony: `powitanie_zaklep()` wstawia wiersz do
--  `welcome_mails` i tylko wtedy zwraca dane do wysyłki. Drugie i każde następne
--  wywołanie nie zwraca nic, więc endpoint po prostu nic nie robi.
--
--  Uwaga na zasłonę przed premierą: samo zalogowanie NIE znaczy, że ktoś wszedł na
--  stronę. Kto nie jest na liście beta testerów, dostaje konto (zakłada je trigger na
--  auth.users), ale zasłona odbija go z powrotem na „Już niedługo" - i takiej osobie
--  powitanie byłoby kłamstwem. Dlatego kod strony podaje `p_wpuszczony`: prawdę tylko
--  wtedy, gdy zasłona jest zdjęta, gość ma przepustkę albo `czy_wpuscic()` go przepuściło.
--
--  Gdy dostawca poczty odmówi, strona woła `powitanie_zwolnij()` - zaklepanie znika
--  i przy kolejnym logowaniu próba pójdzie jeszcze raz. Bez tego jedna awaria Resenda
--  kasowałaby powitanie na zawsze.
-- =====================================================================

/* ---------- 1. ślad po wysłanych powitaniach ---------- */
create table if not exists public.welcome_mails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email   text not null,
  /* 'beta' - adres z listy beta testerów, 'gracz' - zwykłe konto */
  rodzaj  text not null check (rodzaj in ('beta', 'gracz')),
  /* który to numer konta w serwisie - żeby dało się sprawdzić, komu poszła setka */
  numer   integer not null,
  sent_at timestamptz not null default now()
);

alter table public.welcome_mails enable row level security;

/*
  Tabelę czyta wyłącznie administrator. Sama wysyłka idzie funkcją SECURITY DEFINER,
  więc zalogowany nie potrzebuje tu żadnych praw - ale bez GRANT-a Postgres odrzuciłby
  odczyt z panelu jeszcze przed sprawdzeniem RLS.
*/
grant select on table public.welcome_mails to authenticated;

drop policy if exists welcome_mails_admin on public.welcome_mails;
create policy welcome_mails_admin on public.welcome_mails
  for select using (is_admin(auth.uid()));

/* ---------- 2. zaklepanie powitania ---------- */
create or replace function public.powitanie_zaklep(p_wpuszczony boolean default true)
returns table (adres text, nick text, rodzaj text, numer integer, pionier boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  l_adres    text;
  l_nick     text;
  l_rodzaj   text;
  l_numer    integer;
  l_zalozone timestamptz;
begin
  if uid is null or not coalesce(p_wpuszczony, false) then
    return;
  end if;

  /* adres bierzemy z konta Google, a nie z formularza - tam go nikt nie wpisywał */
  select lower(btrim(coalesce(u.email, ''))) into l_adres
    from auth.users u
   where u.id = uid;

  if coalesce(l_adres, '') = '' then
    return;
  end if;

  select nullif(btrim(p.display_name), ''), p.created_at
    into l_nick, l_zalozone
    from profiles p
   where p.id = uid;

  /* numer konta liczony po dacie założenia - tak samo jak wyróżnienie „Pionier" */
  select count(*)::integer into l_numer
    from profiles p2
   where p2.created_at <= coalesce(l_zalozone, now());

  l_rodzaj := case
    when exists (select 1 from beta_testers b where b.email = l_adres) then 'beta'
    else 'gracz'
  end;

  insert into welcome_mails (user_id, email, rodzaj, numer)
  values (uid, l_adres, l_rodzaj, l_numer)
  on conflict (user_id) do nothing;

  /* nic nie wstawiliśmy = powitanie już poszło */
  if not found then
    return;
  end if;

  return query select l_adres, l_nick, l_rodzaj, l_numer, (l_numer <= 100);
end
$$;

/* stara sygnatura bez argumentu - zostawiona po pierwszym wgraniu migracji */
drop function if exists public.powitanie_zaklep();

revoke all on function public.powitanie_zaklep(boolean) from public;
grant execute on function public.powitanie_zaklep(boolean) to authenticated;

/* ---------- 3. zwolnienie po nieudanej wysyłce ---------- */
create or replace function public.powitanie_zwolnij()
returns void
language sql
security definer
set search_path = public
as $$
  delete from welcome_mails where user_id = auth.uid();
$$;

revoke all on function public.powitanie_zwolnij() from public;
grant execute on function public.powitanie_zwolnij() to authenticated;

/* ---------- kontrola ---------- */
select count(*) as wyslane_powitania from public.welcome_mails;
