# Rankingi V1 — archiwum

Pierwsza warstwa wizualna obu rankingów, zanim rozdzieliliśmy je na dwie osobne strony.
Leży tu w całości, żeby dało się ją obejrzeć i porównać bez grzebania w historii.

- `RankingTabsV1.tsx` — przełącznik „gracze / boiska" plus obie listy w jednym komponencie:
  karuzela okładek dla boisk i lista wierszy pod nią.
- `OrbitaOdkrywcowV1.tsx` — konstelacja pięciu pierwszych odkrywców: avatar w środku,
  pierścień zdjęć jego boisk dookoła.

**Nic tego nie importuje.** To kod odłożony, nie martwy przez przeoczenie — gdyby kiedyś
miał zniknąć, decyzja należy do właściciela projektu, nie do sprzątania.

## Dlaczego odeszła

Dwa rankingi mieszkały pod jednym adresem i przełączały się zakładką, więc żadnego nie dało
się podlinkować osobno ani opisać własnym tytułem dla wyszukiwarki. Układ był wąską kolumną
pośrodku ekranu — na monitorze zostawało czarne pole po obu stronach. Karuzela okładek
wymagała gestu, żeby zobaczyć cokolwiek poza pierwszym miejscem, a konstelacja avatarów
czytała się jako ozdoba, nie jako kolejność.

## Jak wrócić

Stan sprzed przebudowy stoi pod znacznikiem `rankingi-v1`:

```bash
git checkout rankingi-v1 -- app/\(strona\)/ranking components/RankingTabs.tsx components/ranking/OrbitaOdkrywcow.tsx
```
