/*
  Beta testerzy - lista adresów, które wchodzą na stronę przed premierą.

  Zasłona (patrz lib/zaslona.ts i middleware.ts) przepuszcza zalogowanego, jeśli funkcja
  `czy_wpuscic()` odpowie prawdą: administrator albo adres z tej tabeli. Sama tabela jest
  widoczna tylko dla administratora, ale funkcja jest SECURITY DEFINER, więc zwykły beta
  tester może sprawdzić samego siebie, nie widząc listy.
*/

create table if not exists public.beta_testers (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now(),
  added_by   uuid references auth.users(id) on delete set null
);

/* adresy trzymamy małymi literami, żeby porównanie nie zależało od wielkości znaków */
create or replace function public.beta_email_lower() returns trigger
language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists beta_testers_lower on public.beta_testers;
create trigger beta_testers_lower
  before insert or update on public.beta_testers
  for each row execute function public.beta_email_lower();

alter table public.beta_testers enable row level security;

/*
  Nowa tabela nie dostaje uprawnień automatycznie - bez tego zalogowany dostawał
  „permission denied for table beta_testers" jeszcze przed sprawdzeniem RLS.
  O to, że widzi ją tylko administrator, dba polityka poniżej.
*/
grant select, insert, update, delete on table public.beta_testers to authenticated;

drop policy if exists "beta_testers_admin" on public.beta_testers;
create policy "beta_testers_admin" on public.beta_testers
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

/*
  Czy zalogowanego wpuszczamy za zasłonę. Zwraca prawdę dla administratora i dla adresu
  z listy beta testerów - i nic więcej nie ujawnia.
*/
create or replace function public.czy_wpuscic() returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from beta_testers b
      where b.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

revoke all on function public.czy_wpuscic() from public;
grant execute on function public.czy_wpuscic() to authenticated;

/* ---------- kontrola ---------- */
select count(*) as beta_testerow from public.beta_testers;
