import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_URL } from "@/lib/site";
import { ZASLONA } from "@/lib/zaslona";
import { ZNAK, ZNAK_SLOWNY, napisSvg, znakSvg } from "@/lib/znak";

/**
 * Obrazek podglądu linków (Facebook, Messenger, WhatsApp, X, Discord).
 *
 * Leży w katalogu głównym `app`, więc obowiązuje na całej stronie - poza kartami boisk
 * i miast, które podstawiają własne zdjęcie boiska. Bez niego wrzucony link pokazywał
 * sam tekst.
 *
 * Rysunek składa satori, a ono nie zna znaczników SVG w drzewie, dlatego znak i napis PODKOSZ
 * (ten sam rysunek co na stronie, z lib/znak.ts) wchodzą jako obrazki z adresu `data:`. Pod
 * napisem - jak wszędzie, gdzie stoi logo - „Powered by” i logo Coconaut, dosunięte do prawej
 * krawędzi Z.
 *
 * Dopóki stoi zasłona, obrazek nie zdradza, czym jest serwis: zostaje znak, nazwa
 * i „Już niedługo" - tak samo jak na samej zasłonie (`app/(zaslona)/wkrotce`).
 */
export const alt = ZASLONA ? "PodKosz - już niedługo" : "PodKosz - największa mapa boisk do koszykówki w Polsce";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Znak marki: pinezka z planem boiska - te same ścieżki co w nawigacji (lib/znak.ts). */
const LOGO_W = 140;
const LOGO_H = Math.round(LOGO_W / ZNAK.proporcja);
const LOGO = znakSvg("og", { rozmiar: "duzy", szerokosc: LOGO_W });

/*
  Napis i wiersz „Powered by” w proporcjach ze strony (NapisZPartnerem): przy literach 50 px
  podpis ma 18,3 px, logo Coconaut 24,4 px, odstęp 17 px, a wiersz stoi 14,7 px pod napisem.
*/
const LITERY = 50;
const NAPIS = napisSvg("og-napis", LITERY);
const NAPIS_W = Math.round((LITERY * ZNAK_SLOWNY.szerokosc) / ZNAK_SLOWNY.wysokosc);
const COCONAUT_H = Math.round(LITERY * 0.488);
const COCONAUT_W = Math.round((COCONAUT_H * 330) / 64);

/*
  Krój serwisu (Instrument Sans) w trzech grubościach, jakich używa obrazek. Satori nie czyta
  plików zmiennych ani WOFF2, więc leżą tu statyczne TTF wycięte z tego samego pliku co na
  stronie (assets/fonts, robi je czcionki-strony.py w podkosz-brand). Bez nich satori brało
  wbudowany Geist Regular, a grubości 600 i 700 tylko udawało.
*/
const czcionka = (plik: string) => readFile(join(process.cwd(), "assets/fonts", plik));
const [REGULAR, SEMIBOLD, BOLD, COCONAUT] = await Promise.all([
  czcionka("InstrumentSans-Regular.ttf"),
  czcionka("InstrumentSans-SemiBold.ttf"),
  czcionka("InstrumentSans-Bold.ttf"),
  readFile(join(process.cwd(), "public/partnerzy/coconaut-logo-web.png")),
]);

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#07070a",
          backgroundImage:
            "radial-gradient(900px 520px at 12% -10%, rgba(255,122,24,.28), transparent 70%)," +
            "radial-gradient(760px 460px at 100% 112%, rgba(255,178,92,.18), transparent 72%)",
          color: "#fff",
          fontFamily: "Instrument Sans",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(LOGO)}`}
          width={LOGO_W}
          height={LOGO_H}
          alt=""
        />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(NAPIS)}`}
            width={NAPIS_W}
            height={LITERY}
            alt=""
          />
          <div style={{ display: "flex", alignItems: "center", marginTop: 15 }}>
            <span style={{ fontSize: 18.3, fontWeight: 600, letterSpacing: 3.66, lineHeight: 1 }}>
              POWERED BY
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${COCONAUT.toString("base64")}`}
              width={COCONAUT_W}
              height={COCONAUT_H}
              alt=""
              style={{ marginLeft: 17 }}
            />
          </div>
        </div>

        {/* łamanie wpisane na sztywno - inaczej satori zostawiało „w Polsce" samo w drugim wierszu */}
        <div
          style={{
            marginTop: 26,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: 46,
            fontWeight: 600,
            lineHeight: 1.25,
            color: "#ffb25c",
          }}
        >
          {/* bez fragmentów Reacta - satori składa tylko zwykłe elementy */}
          <span>{ZASLONA ? "Już niedługo" : "Największa mapa boisk"}</span>
          {ZASLONA ? null : <span>do koszykówki w Polsce</span>}
        </div>

        {ZASLONA ? null : (
          <div style={{ marginTop: 22, fontSize: 26, color: "rgba(255,255,255,.6)" }}>
            Zdjęcia · nawierzchnia · liczba koszy · godziny
          </div>
        )}

        <div
          style={{
            marginTop: 40,
            height: 4,
            width: 240,
            backgroundImage:
              "linear-gradient(90deg, rgba(255,122,24,0), rgba(255,122,24,.9), rgba(255,122,24,0))",
          }}
        />

        <div style={{ marginTop: 26, fontSize: 24, color: "rgba(255,255,255,.45)" }}>
          {SITE_URL.replace(/^https?:\/\//, "")}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Instrument Sans", data: REGULAR, weight: 400, style: "normal" },
        { name: "Instrument Sans", data: SEMIBOLD, weight: 600, style: "normal" },
        { name: "Instrument Sans", data: BOLD, weight: 700, style: "normal" },
      ],
    },
  );
}
