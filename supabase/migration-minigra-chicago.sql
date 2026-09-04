/*
  Trzecie miejsce minigry: Chicago.

  Tabela wyników od początku ograniczała `miejsce` do dwóch wartości - i dobrze, bo to
  jedyna kolumna, którą przeglądarka podaje wprost. Dochodzi trzecia, z inną grą pod
  spodem: zamiast rzutów liczba kozłowań w minucie. Kształt wyniku jest ten sam (liczba
  całkowita, wyżej znaczy lepiej), więc funkcje rankingu i zapisu zostają bez zmian -
  wystarczy poszerzyć ograniczenie.

  Górna granica 500 zostaje: nawet przy trzech kozłowaniach na sekundę minuta daje 180.

  Uruchomienie: SQL Editor w Supabase, wklej całość, Run. Bezpieczne do powtórzenia.
  Do czasu uruchomienia gra w Chicago działa, ale wyniki z niej nie wchodzą do rankingu -
  baza odrzuca wiersz, a zapis nie jest w grze niczym, co może ją zatrzymać.
*/

alter table public.minigra_wyniki
  drop constraint if exists minigra_wyniki_miejsce_check;

alter table public.minigra_wyniki
  add constraint minigra_wyniki_miejsce_check
  check (miejsce in ('venice', 'manhattan', 'chicago'));

/* ---------- kontrola ---------- */
select miejsce, count(*) as wyniki, max(seria) as najlepszy
from public.minigra_wyniki
group by miejsce
order by miejsce;
