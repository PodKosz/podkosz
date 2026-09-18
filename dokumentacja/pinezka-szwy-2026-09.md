# Szwy piłki - wersja sprzed 18 września 2026

Zapis poprzedniego układu szwów, na wypadek gdybyśmy chcieli do niego wrócić. Wszystko,
co potrzebne do powrotu, jest w tym pliku - nie trzeba szukać w historii repozytorium.

## Co się zmieniło i dlaczego

**Było:** dwa łuki **pionowe**, wygięte na zewnątrz, biegnące wzdłuż lewej i prawej
krawędzi kuli, równolegle do szwu pionowego.

**Jest:** dwa łuki **poziome**, po obu stronach szwu poziomego. Górny zwisa ku środkowi
(dolina), dolny wypina się ku środkowi (garb), oba dotykają obwodu z lewej i z prawej.

Powód: stary układ czytał się jak celownik, a nie jak piłka. Cztery linie w kształcie
krzyża plus dwa łuki przy samej krawędzi dają wrażenie płaskiego symbolu. Dopiero łuki
biegnące **w poprzek** budują kulę - to one są tym, po czym oko rozpoznaje piłkę do
kosza. Układ jest przerysowany z rysunku odniesienia, nie dobrany na oko.

## Jak wrócić

Cała zmiana siedzi w jednej funkcji: `szwyPilki` w [`lib/pilka.ts`](../lib/pilka.ts).
Wystarczy podmienić jej zawartość na poniższą i **nie trzeba ruszać niczego więcej** -
wszystkie sześć miejsc, które rysują piłkę, biorą ścieżkę stamtąd.

```ts
export function szwyPilki(cx: number, cy: number, r: number): string {
  /*
    Stary układ, przepisany z ręcznych ścieżek sprzed ujednolicenia. Proporcje są
    odtworzone z wartości dla r = 9.2 (pinezka i ikona) i r = 7.2 (pinezka minigry),
    bo oryginał nie był liczony - był rysowany osobno dla każdego rozmiaru.
  */
  const k = z(r * 1.0);          // pion i poziom szły przez pełną średnicę
  const bx = z(r * 0.72);        // odsunięcie łuków od osi pionowej
  const by = z(r * 0.72);        // ...i wysokość ich końców
  return [
    `M${z(cx)} ${z(cy - k)}V${z(cy + k)}`,
    `M${z(cx - k)} ${z(cy)}H${z(cx + k)}`,
    `M${z(cx - bx)} ${z(cy - by)}A${bx} ${bx} 0 0 1 ${z(cx - bx)} ${z(cy + by)}`,
    `M${z(cx + bx)} ${z(cy - by)}A${bx} ${bx} 0 0 0 ${z(cx + bx)} ${z(cy + by)}`,
  ].join("");
}
```

Jeśli zależy Ci na odtworzeniu **co do piksela**, a nie na przybliżeniu - użyj
oryginalnych ścieżek z tabeli niżej. Są to dokładne wartości, które stały w kodzie.

## Oryginalne ścieżki, miejsce po miejscu

Wszystkie rysowane jako dwa osobne `<path>` obok `<circle>` kuli.

| plik | co to jest | promień |
|---|---|---|
| `components/MapView.tsx` | pinezka boiska | 9.2 |
| `components/MapView.tsx` | pinezka nieodkrytego boiska | 9.2 |
| `components/MapView.tsx` | pinezka minigry | 7.2 |
| `components/icons.tsx` | `BallIcon` | 9.2 |
| `app/(strona)/nieodkryte/[id]/page.tsx` | duża piłka na stronie nieodkrytego | 9.2 |
| `components/Brand.tsx` | piłka w kole środkowym logo | 7.5 |

### Promień 9.2 (kadr 24 x 24) - pinezki, ikona, strona nieodkrytego

```html
<circle cx="12" cy="12" r="9.2"/>
<path d="M12 2.8v18.4M2.8 12h18.4"/>
<path d="M5.4 5.4c3.9 3.9 3.9 9.3 0 13.2M18.6 5.4c-3.9 3.9-3.9 9.3 0 13.2"/>
```

### Promień 7.2 (kadr 24 x 24) - pinezka minigry

```html
<circle cx="12" cy="12" r="7.2"/>
<path d="M4.8 12h14.4M12 4.8v14.4"/>
<path d="M7 6.4c2.6 3.2 2.6 8 0 11.2M17 6.4c-2.6 3.2-2.6 8 0 11.2"/>
```

### Promień 7.5 (kadr 64 x 64) - logo

```html
<circle cx="32" cy="32" r="7.5" strokeWidth="2.2"/>
<path d="M32 24.5v15M24.5 32h15" strokeWidth="1.3" opacity=".95"/>
<path d="M27.2 26c2.7 3.3 2.7 8.7 0 12M36.8 26c-2.7 3.3-2.7 8.7 0 12" strokeWidth="1.3" opacity=".95"/>
```

## Czego ta zmiana NIE ruszyła

- **Kształt pinezki.** Wybrany wariant („Kula na nóżce”, numer 1 w galerii propozycji)
  to dokładnie to, co było: kula na nóżce z kropką oparcia. Zmieniły się wyłącznie szwy.
- **Barwy, poświata, ogień zapisów, powiększenie przy najechaniu, skalowanie od liczby
  zapisanych i od przybliżenia.** Wszystko działa tak samo.
- **`FireBallIcon`.** Ta piłka ma tylko okrąg i krzyż, bez łuków bocznych - nie było
  czego zmieniać.

## Gdzie obejrzeć pozostałe propozycje

Galeria czterdziestu wariantów: <https://claude.ai/artifact/KXxautLgLJS9oShtjAQWou>

Dowolny z nich można obejrzeć wprost na mapie, bez przebudowy serwisu -
`localhost:3000/?pinezka=<numer>`. Obsługuje to `lib/pinezka-podglad.ts`; bez parametru
w adresie ta gałąź w ogóle nie działa.
