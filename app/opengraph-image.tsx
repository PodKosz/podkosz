import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";
import { ZNAK, znakSvg } from "@/lib/znak";

/**
 * Obrazek podglądu linków (Facebook, Messenger, WhatsApp, X, Discord).
 *
 * Leży w katalogu głównym `app`, więc obowiązuje na całej stronie - poza kartami boisk
 * i miast, które podstawiają własne zdjęcie boiska. Bez niego wrzucony link pokazywał
 * sam tekst.
 *
 * Rysunek składa satori, a ono nie zna `background-clip: text` ani znaczników SVG w drzewie,
 * dlatego gradient na napisie zastępuje jednolity pomarańcz, a logo wchodzi jako obrazek
 * z adresu `data:`.
 */
export const alt = "PodKosz - największa mapa boisk do koszykówki w Polsce";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Znak marki: pinezka z planem boiska - te same ścieżki co w nawigacji (lib/znak.ts). */
const LOGO_W = 140;
const LOGO_H = Math.round(LOGO_W / ZNAK.proporcja);
const LOGO = znakSvg("og", { rozmiar: "duzy", szerokosc: LOGO_W });

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
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(LOGO)}`}
          width={LOGO_W}
          height={LOGO_H}
          alt=""
        />

        <div style={{ display: "flex", marginTop: 18, fontSize: 58, fontWeight: 700 }}>
          <span>POD</span>
          <span style={{ color: "#ff7a18" }}>KOSZ</span>
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
          <span>Największa mapa boisk</span>
          <span>do koszykówki w Polsce</span>
        </div>

        <div style={{ marginTop: 22, fontSize: 26, color: "rgba(255,255,255,.6)" }}>
          Zdjęcia · nawierzchnia · liczba koszy · godziny
        </div>

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
    size,
  );
}
