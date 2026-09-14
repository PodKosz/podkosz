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
 *   - wgrywanie do `zgloszenia/<id>/<plik>` wolno KAŻDEMU, także niezalogowanemu gościowi
 *     (tak jest dziś: polityka `court_photos_upload` jest nadana roli `anon`), ale tylko
 *     gdy zgłoszenie jest otwarte - o to pyta funkcja `submission_open` w bazie;
 *   - wszystko poza `zgloszenia/` - czyli katalog `boiska/` i `wydarzenia/` - wymaga
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

/** Ile plików wolno pod jednym zgłoszeniem. */
const MAKS_PLIKOW = 12;

/** Ścieżka: `zgloszenia/<uuid>/<nazwa>` albo `boiska/<uuid>/<nazwa>`, bez wyjścia w górę. */
const KSZTALT = /^(zgloszenia|boiska|wydarzenia)\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/i;

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
    if (wZgloszeniach) {
      /*
        Gość też może - i to nie jest luka, tylko świadoma decyzja produktowa: boisko
        wolno dodać bez zakładania konta. Bramą jest otwarte zgłoszenie, nie zalogowanie.
      */
      const otwarte = await pytajBaze(env, "submission_open", { sub: idZgloszenia }, token);
      if (otwarte !== true) {
        return odpowiedz({ ok: false, powod: "zgłoszenie zamknięte albo nie istnieje" }, 403);
      }

      /*
        Limit plików liczony na R2, bo w bazie nie ma już czego liczyć. `list` z prefiksem
        jest operacją klasy A - przy dwunastu plikach na zgłoszenie to nic, a bez tego
        limit zniknąłby po cichu razem z przeprowadzką.
      */
      const juzSa = await env.ZDJECIA.list({
        prefix: `zgloszenia/${idZgloszenia}/`,
        limit: MAKS_PLIKOW + 1,
      });
      if (juzSa.objects.length >= MAKS_PLIKOW) {
        return odpowiedz({ ok: false, powod: `najwyżej ${MAKS_PLIKOW} zdjęć na zgłoszenie` }, 429);
      }
    } else if (!(await czyAdmin(env, token))) {
      return odpowiedz({ ok: false, powod: "ten katalog wymaga administratora" }, 403);
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
