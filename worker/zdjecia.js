/**
 * Worker zdjęć: wgrywanie i kasowanie plików w Cloudflare R2.
 *
 * ------------------------------------------------------------------ po co w ogóle
 *
 * Zdjęcia leżały w magazynie Supabase. Darmowy plan daje tam 1 GB, a jedno boisko to
 * siedem zdjęć po ~600 kB, czyli 4,2 MB - wychodzi jakieś 240 boisk i koniec. R2 daje
 * 10 GB za darmo, potem 1,5 centa za gigabajt i ZERO opłat za transfer wychodzący.
 * Przy dziesięciu tysiącach boisk (42 GB) to jakieś 63 centy miesięcznie.
 *
 * ------------------------------------------------------------------ dlaczego Worker, a nie klucze S3
 *
 * R2 da się obsługiwać kluczami S3, ale wtedy trzeba je gdzieś trzymać: w Vercelu, w moim
 * terminalu, w GitHubie. Każde z tych miejsc to kolejna kopia sekretu, który może wyciec.
 * Worker dostaje kubełek przez POWIĄZANIE (`binding`) - nie ma żadnego klucza do wykradzenia,
 * bo nie ma klucza w ogóle.
 *
 * ------------------------------------------------------------------ czego ten Worker NIE robi
 *
 * Nie obsługuje odczytu. Zdjęcia czyta się wprost z `zdjecia.podkosz.pl`, czyli z własnej
 * domeny kubełka - bez Workera. To nie jest przeoczenie, tylko cały sens: darmowe Workers
 * mają sufit 100 tys. wywołań dziennie, a odczytów zdjęć są setki tysięcy. Przepuszczanie
 * ich przez Worker zamieniłoby darmowy odczyt w policzalny.
 *
 * ------------------------------------------------------------------ kto może co
 *
 * Reguły są DOKŁADNIE te, co w bazie - i nie są tu przepisane z pamięci, tylko dalej
 * pyta się o nie bazy:
 *
 *   - wgrywanie do `zgloszenia/<id>/<plik>` wymaga ZALOGOWANIA i otwartego zgłoszenia;
 *     do 18 września 2026 wolno było też gościowi - zmienione świadomie, patrz
 *     `supabase/migration-zgloszenia-tylko-zalogowani.sql`;
 *   - wgrywanie do `poprawki/<id>/<plik>` wymaga ZALOGOWANIA i otwartej poprawki
 *     NALEŻĄCEJ DO TEJ OSOBY; o to pyta funkcja `poprawka_otwarta`, patrz
 *     `supabase/migration-poprawki-zdjec.sql`;
 *   - wszystko poza nimi - czyli katalog `boiska/` i `wydarzenia/` - wymaga
 *     administratora; o to pyta funkcja `is_admin`;
 *   - kasowanie wymaga administratora.
 *
 * Limit dwunastu plików na zgłoszenie liczymy TUTAJ, na R2. W bazie liczyła go ta sama
 * funkcja, ale po przeprowadzce nie ma już czego liczyć - pliki nie trafiają do
 * `storage.objects`. Gdyby zostawić to bez zmian, limit przestałby istnieć po cichu.
 */

/** Największy plik: zdjęcie z telefonu to ~0,6 MB, więc 4 MB to duży zapas. */
const MAKS_BAJTOW = 4 * 1024 * 1024;

/** Dozwolone rodzaje plików - te same, co miał kubełek w Supabase. */
const RODZAJE = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Ile plików wolno pod jednym zgłoszeniem boiska. */
const MAKS_PLIKOW = 12;

/** Poprawka zdjęcia to jeden kadr, więc jeden plik. Dwa znaczą, że ktoś próbuje dosypać. */
const MAKS_PLIKOW_POPRAWKI = 1;

/** Ścieżka: `zgloszenia/<uuid>/<nazwa>` albo `boiska/<uuid>/<nazwa>`, bez wyjścia w górę. */
const KSZTALT = /^(zgloszenia|poprawki|boiska|wydarzenia)\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/i;

const odpowiedz = (dane, status = 200) =>
  new Response(JSON.stringify(dane), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/**
 * Pyta bazę, nie siebie.
 *
 * Worker nie sprawdza podpisu tokenu i nie musi: przekazuje go do Supabase, a ten
 * weryfikuje go tak samo jak przy każdym innym zapytaniu. Token podrobiony nie przejdzie
 * tam, więc nie ma sensu powtarzać tej samej kryptografii drugi raz w drugim miejscu.
 */
async function pytajBaze(env, funkcja, ciało, token) {
  const odp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${funkcja}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: token || `Bearer ${env.SUPABASE_ANON_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(ciało),
  });
  if (!odp.ok) return null;
  return odp.json().catch(() => null);
}

/**
 * Czy to administrator - w dwóch krokach, bo `is_admin` bierze identyfikator, a Worker
 * ma tylko token. Najpierw Supabase zamienia token na konto (i przy okazji sprawdza jego
 * podpis - token podrobiony poleci tu na 401), potem baza odpowiada, czy to admin.
 */
async function czyAdmin(env, token) {
  if (!token) return false;

  const odp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: token },
  });
  if (!odp.ok) return false;

  const uzytkownik = await odp.json().catch(() => null);
  if (!uzytkownik?.id) return false;

  return (await pytajBaze(env, "is_admin", { uid: uzytkownik.id }, token)) === true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* Odczyt tu nie zagląda - patrz nota na górze pliku. */
    if (url.pathname !== "/zdjecia/wgraj") {
      return odpowiedz({ ok: false, powod: "nieznana ścieżka" }, 404);
    }

    const sciezka = url.searchParams.get("sciezka") || "";
    if (!KSZTALT.test(sciezka) || sciezka.includes("..")) {
      return odpowiedz({ ok: false, powod: "niedozwolona ścieżka" }, 400);
    }

    const token = request.headers.get("authorization");
    const wZgloszeniach = sciezka.startsWith("zgloszenia/");
    const wPoprawkach = sciezka.startsWith("poprawki/");
    const idZgloszenia = sciezka.split("/")[1];

    /* ---------------------------------------------------------------- kasowanie */
    if (request.method === "DELETE") {
      if (!(await czyAdmin(env, token))) {
        return odpowiedz({ ok: false, powod: "kasowanie wymaga administratora" }, 403);
      }
      await env.ZDJECIA.delete(sciezka);
      return odpowiedz({ ok: true });
    }

    if (request.method !== "PUT" && request.method !== "POST") {
      return odpowiedz({ ok: false, powod: "tylko PUT, POST albo DELETE" }, 405);
    }

    /* ---------------------------------------------------------------- kto może wgrywać */
    /*
      Kolejność sprawdzeń ma znaczenie dla kosztu: najpierw tańsza ścieżka zwykłego
      zgłoszenia (jedno pytanie do bazy), a dopiero gdy ta odmówi - droższe sprawdzenie
      administratora (dwa pytania: token na konto, konto na uprawnienie).
    */
    let wolno = false;
    let jakoAdmin = false;

    if (wPoprawkach) {
      /*
        Poprawka zdjęcia do CUDZEGO boiska - patrz `supabase/migration-poprawki-zdjec.sql`.

        Reguła jest węższa niż przy zgłoszeniu boiska i to jest celowe: tam wiersz
        w bazie powstaje NA KOŃCU, więc katalog musi być otwarty wcześniej; tutaj
        zgłoszenie zakłada się NAJPIERW i dopiero pod jego identyfikator wgrywa się
        plik. Dzięki temu baza zna już autora i może odpowiedzieć na pytanie „czy to
        jego zgłoszenie i czy jeszcze czeka".

        Bez tokenu nie ma o czym mówić: `poprawka_otwarta` pyta o `auth.uid()`, a przy
        kluczu anonimowym to NULL - odpowiedź byłaby zawsze przecząca, tylko po jednym
        zapytaniu więcej.
      */
      wolno =
        Boolean(token) &&
        (await pytajBaze(env, "poprawka_otwarta", { sub: idZgloszenia }, token)) === true;
    } else if (wZgloszeniach) {
      /*
        Dwie bramy naraz, i obie są konieczne.

        TOKEN: bez niego `pytajBaze` poleciałoby kluczem anonimowym, a `submission_open`
        jest nadane roli `anon` - czyli gość przechodziłby, mimo że baza już go nie
        wpuszcza do samego zgłoszenia. Sprawdzenie tokenu tutaj domyka tę szparę.

        ZGŁOSZENIE OTWARTE: token nie wystarcza, bo zalogowany też nie ma prawa dosypywać
        zdjęć do zgłoszenia sprzed miesiąca. Podrobiony token nie przejdzie - Supabase
        odpowie na niego 401, a `pytajBaze` odda wtedy `null`.
      */
      wolno =
        Boolean(token) &&
        (await pytajBaze(env, "submission_open", { sub: idZgloszenia }, token)) === true;
    }

    /*
      Administrator wchodzi wszędzie, także do katalogu ZAMKNIĘTEGO zgłoszenia. To nie jest
      wygoda, tylko konieczność: część zdjęć zatwierdzonych boisk została pod ścieżkami
      `zgloszenia/...`, bo panel przy zatwierdzaniu ponownie używa ścieżki ze zgłoszenia
      zamiast wgrywać plik drugi raz. Bez tego wyjątku nie dałoby się ich ani przenieść,
      ani nigdy więcej podmienić.
    */
    if (!wolno) {
      jakoAdmin = await czyAdmin(env, token);
      wolno = jakoAdmin;
    }

    if (!wolno) {
      return odpowiedz(
        {
          ok: false,
          powod: wPoprawkach
            ? token
              ? "poprawka zamknięta, nie istnieje albo należy do kogoś innego"
              : "poprawka zdjęcia wymaga zalogowania"
            : wZgloszeniach
              ? token
                ? "zgłoszenie zamknięte albo nie istnieje"
                : "dodawanie boisk wymaga zalogowania"
              : "ten katalog wymaga administratora",
        },
        403
      );
    }

    /*
      Limit plików liczony na R2, bo w bazie nie ma już czego liczyć. `list` z prefiksem
      jest operacją klasy A - przy dwunastu plikach na zgłoszenie to nic, a bez tego
      limit zniknąłby po cichu razem z przeprowadzką.

      Administratora nie dotyczy: on podmienia i przenosi istniejące pliki, a nie zapycha
      dysk nowym zgłoszeniem. Limit jest po to, żeby obcy nie wrzucił tysiąca zdjęć pod
      jedno zgłoszenie - nie po to, żeby blokować własne porządki.
    */
    if ((wZgloszeniach || wPoprawkach) && !jakoAdmin) {
      /*
        Poprawka niesie JEDEN kadr, więc liczy się ją inaczej niż zgłoszenie boiska:
        tam dwanaście plików to komplet zdjęć, tutaj drugi plik pod tym samym
        identyfikatorem znaczy, że ktoś próbuje dosypać do zatwierdzonego już
        katalogu albo strzela do endpointu w pętli.
      */
      const katalog = wPoprawkach ? "poprawki" : "zgloszenia";
      const sufit = wPoprawkach ? MAKS_PLIKOW_POPRAWKI : MAKS_PLIKOW;
      const juzSa = await env.ZDJECIA.list({
        prefix: `${katalog}/${idZgloszenia}/`,
        limit: sufit + 1,
      });
      if (juzSa.objects.length >= sufit) {
        return odpowiedz(
          { ok: false, powod: `najwyżej ${sufit} zdjęć na to zgłoszenie` },
          429
        );
      }
    }

    /* ---------------------------------------------------------------- sam plik */
    const rodzaj = (request.headers.get("content-type") || "").split(";")[0].trim();
    if (!RODZAJE.has(rodzaj)) {
      return odpowiedz({ ok: false, powod: `niedozwolony rodzaj pliku: ${rodzaj}` }, 415);
    }

    const dlugosc = Number(request.headers.get("content-length") || 0);
    if (dlugosc > MAKS_BAJTOW) {
      return odpowiedz({ ok: false, powod: "plik większy niż 4 MB" }, 413);
    }

    /*
      Czytamy całość do pamięci zamiast przepuszczać strumieniem, bo przy strumieniu
      nie da się sprawdzić rozmiaru, gdy nadawca nie poda `content-length` albo skłamie.
      Cztery megabajty mieszczą się w limicie pamięci Workera z dużym zapasem.
    */
    const dane = await request.arrayBuffer();
    if (dane.byteLength > MAKS_BAJTOW) {
      return odpowiedz({ ok: false, powod: "plik większy niż 4 MB" }, 413);
    }
    if (dane.byteLength === 0) {
      return odpowiedz({ ok: false, powod: "pusty plik" }, 400);
    }

    await env.ZDJECIA.put(sciezka, dane, {
      httpMetadata: {
        contentType: rodzaj,
        /*
          Rok w pamięci podręcznej. Nazwa pliku niesie znacznik czasu i nigdy nie jest
          używana powtórnie, więc podmiana treści pod tym samym adresem się nie zdarza -
          a to jedyny powód, dla którego trzymałoby się krótsze wygasanie.
        */
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    return odpowiedz({ ok: true, sciezka, bajtow: dane.byteLength });
  },
};
