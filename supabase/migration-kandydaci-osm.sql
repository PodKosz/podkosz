-- Kandydaci na boiska: punkty zaciągnięte z OpenStreetMap (leisure=pitch + sport=basketball).
-- Widzi je wyłącznie administrator - na mapie jako szare pinezki po włączeniu przycisku.
-- Dane pochodzą z OSM (licencja ODbL), więc przy publikacji boiska i tak wpisujemy własne
-- zdjęcia i opis, a punkt służy tylko jako podpowiedź „tu jest boisko, sprawdź je”.

create table if not exists court_leads (
  id           uuid primary key default gen_random_uuid(),
  osm_type     text not null,
  osm_id       bigint not null,
  name         text not null default '',
  lat          double precision not null,
  lng          double precision not null,
  -- podpowiedzi z tagów OSM, przemapowane na nasze słowniki (mogą być puste)
  surface      text,
  hoops        int,
  lit          boolean,
  access_hint  text,
  tags         jsonb not null default '{}'::jsonb,
  status       text not null default 'new' check (status in ('new', 'added', 'rejected')),
  court_id     uuid references courts(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (osm_type, osm_id)
);

create index if not exists court_leads_status_idx on court_leads (status);

alter table court_leads enable row level security;

drop policy if exists court_leads_admin on court_leads;
create policy court_leads_admin on court_leads for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

grant select, insert, update, delete on court_leads to authenticated;

-- kontrola
select count(*) as kandydatow from court_leads;
