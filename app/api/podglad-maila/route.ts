import {
  htmlOdmowy,
  htmlPublikacji,
  tekstOdmowy,
  tekstPublikacji,
  tematOdmowy,
  tematPublikacji,
} from "@/lib/mail/zgloszenie";
import { htmlOtwarcia, tekstOtwarcia, tematOtwarcia } from "@/lib/mail/otwarcie";
import { htmlPotwierdzenia, tekstPotwierdzenia, tematPotwierdzenia } from "@/lib/mail/potwierdzenie";
import { htmlPowitania, tekstPowitania, tematPowitania } from "@/lib/mail/powitanie";

/**
 * Podgląd listów w przeglądarce - narzędzie robocze, nie funkcja serwisu.
 *
 * Do tej pory jedynym sposobem, żeby zobaczyć maila, było wywołanie zdarzenia, które go
 * wysyła: opublikowanie zgłoszenia, założenie konta, zapis na otwarcie. Każda poprawka
 * w treści oznaczała więc albo grzebanie w bazie, albo wysyłkę do siebie i czekanie.
 *
 * Trasa działa TYLKO w trybie deweloperskim. Na produkcji oddaje 404 - nie dlatego, że
 * treść jest tajna, ale bo publiczny adres zwracający cudzą korespondencję w szablonie
 * to dokładnie ten rodzaj furtki, o którym się zapomina.
 *
 * Użycie:
 *   /api/podglad-maila                       - spis wszystkich listów
 *   /api/podglad-maila?rodzaj=publikacja     - podgląd HTML
 *   /api/podglad-maila?rodzaj=publikacja&tekst=1  - wersja tekstowa (ta z klientów bez HTML)
 */

const PRZYKLAD = {
  nazwa: "Boisko Kobe Bryant",
  miasto: "Warszawa",
  slug: "warszawa-boisko-kobe-bryant",
};

interface Wpis {
  nazwa: string;
  opis: string;
  temat: () => string;
  html: () => string;
  tekst: () => string;
}

const LISTY: Record<string, Wpis> = {
  publikacja: {
    nazwa: "Zgłoszenie opublikowane",
    opis: "Idzie do autora, gdy jego boisko przejdzie moderację.",
    temat: () => tematPublikacji(PRZYKLAD),
    html: () => htmlPublikacji(PRZYKLAD),
    tekst: () => tekstPublikacji(PRZYKLAD),
  },
  odmowa: {
    nazwa: "Zgłoszenie odrzucone",
    opis: "Idzie do autora razem z powodem odrzucenia.",
    temat: () => tematOdmowy(),
    html: () =>
      htmlOdmowy({ ...PRZYKLAD, powod: "Zdjęcia są zbyt ciemne, nie widać nawierzchni ani koszy." }),
    tekst: () =>
      tekstOdmowy({ ...PRZYKLAD, powod: "Zdjęcia są zbyt ciemne, nie widać nawierzchni ani koszy." }),
  },
  "powitanie-gracz": {
    nazwa: "Powitanie gracza",
    opis: "Pierwsze wejście na stronę po założeniu konta.",
    temat: () => tematPowitania({ rodzaj: "gracz", nick: "Jakub Cichy", numer: 137, pionier: false }),
    html: () => htmlPowitania({ rodzaj: "gracz", nick: "Jakub Cichy", numer: 137, pionier: false }),
    tekst: () => tekstPowitania({ rodzaj: "gracz", nick: "Jakub Cichy", numer: 137, pionier: false }),
  },
  "powitanie-beta": {
    nazwa: "Powitanie beta testera",
    opis: "To samo, ale dla adresów z listy beta testerów - z wyróżnieniem Pioniera.",
    temat: () => tematPowitania({ rodzaj: "beta", nick: "Jakub Cichy", numer: 12, pionier: true }),
    html: () => htmlPowitania({ rodzaj: "beta", nick: "Jakub Cichy", numer: 12, pionier: true }),
    tekst: () => tekstPowitania({ rodzaj: "beta", nick: "Jakub Cichy", numer: 12, pionier: true }),
  },
  "zapis-potwierdzenie": {
    nazwa: "Potwierdzenie zapisu na otwarcie",
    opis: "Krótkie „mam Twój adres” po zapisie za zasłoną.",
    temat: () => tematPotwierdzenia(),
    html: () => htmlPotwierdzenia(),
    tekst: () => tekstPotwierdzenia(),
  },
  otwarcie: {
    nazwa: "Serwis otwarty",
    opis: "Jednorazowa wiadomość do zapisanych, w dniu premiery.",
    temat: () => tematOtwarcia(),
    html: () => htmlOtwarcia(),
    tekst: () => tekstOtwarcia(),
  },
};

function spis() {
  const wiersze = Object.entries(LISTY)
    .map(
      ([klucz, wpis]) => `
        <li>
          <a href="?rodzaj=${klucz}">${wpis.nazwa}</a>
          <span>${wpis.opis}</span>
          <a class="txt" href="?rodzaj=${klucz}&amp;tekst=1">wersja tekstowa</a>
        </li>`
    )
    .join("");

  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>Podgląd listów - PodKosz</title>
<style>
  body{margin:0;padding:48px 24px;background:#07070a;color:#f5f5f7;
    font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}
  main{max-width:680px;margin:0 auto;}
  h1{font-size:26px;letter-spacing:-.5px;margin:0 0 6px;}
  p.wstep{color:#a7a6ad;margin:0 0 32px;}
  ul{list-style:none;margin:0;padding:0;}
  li{padding:16px 0;border-top:1px solid #241a13;display:flex;flex-direction:column;gap:4px;}
  a{color:#ff7a18;text-decoration:none;font-weight:600;}
  a:hover{text-decoration:underline;}
  li span{color:#a7a6ad;font-size:14px;}
  a.txt{color:#77767d;font-size:12px;font-weight:400;text-transform:uppercase;letter-spacing:1.5px;}
</style></head>
<body><main>
  <h1>Podgląd listów</h1>
  <p class="wstep">Narzędzie robocze, dostępne tylko w trybie deweloperskim.</p>
  <ul>${wiersze}</ul>
</main></body></html>`;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Nie ma takiej strony.", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const rodzaj = searchParams.get("rodzaj");

  if (!rodzaj) {
    return new Response(spis(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const wpis = LISTY[rodzaj];
  if (!wpis) {
    return new Response(`Nie znam listu „${rodzaj}”. Spis: /api/podglad-maila`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (searchParams.get("tekst")) {
    return new Response(`Temat: ${wpis.temat()}\n\n${"-".repeat(60)}\n\n${wpis.tekst()}`, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(wpis.html(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
