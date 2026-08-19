-- Nawierzchnie: dochodzą płytki modułowe (te z boisk 3x3), tartan znika z interfejsu.
-- Wartość 'tartan' zostaje w enumie (Postgres nie usuwa wartości bez przebudowy typu),
-- ale nie ma jej już na żadnej liście w aplikacji, więc nie da się jej wybrać.

alter type surface_type add value if not exists 'plytki';

-- Boiska i zgłoszenia oznaczone tartanem przechodzą na poliuretan - w praktyce
-- to ta sama grupa nawierzchni syntetycznych i tak je teraz opisujemy.
update courts      set surface = 'poliuretan' where surface = 'tartan';
update submissions set surface = 'poliuretan' where surface = 'tartan';

-- kontrola
select surface, count(*) from courts group by surface order by surface;
