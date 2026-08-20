import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";

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

/** Znak marki: boisko z góry z piłką w kole środkowym - ten sam rysunek co w nawigacji. */
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="150" height="150" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#ffc47d"/>
      <stop offset="0.5" stop-color="#ff7a18"/>
      <stop offset="1" stop-color="#ff3d00"/>
    </linearGradient>
  </defs>
  <g stroke="url(#g)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4.5" y="12.5" width="55" height="39" rx="4.5" stroke-width="2.4"/>
    <path d="M32 12.5v39" stroke-width="1.8" opacity=".9"/>
    <path d="M4.5 23.5h10v17h-10" stroke-width="1.8"/>
    <path d="M59.5 23.5h-10v17h10" stroke-width="1.8"/>
    <path d="M14.5 27a7 7 0 0 1 0 10" stroke-width="1.6" opacity=".85"/>
    <path d="M49.5 27a7 7 0 0 0 0 10" stroke-width="1.6" opacity=".85"/>
    <circle cx="32" cy="32" r="7.5" stroke-width="2.2"/>
    <path d="M32 24.5v15M24.5 32h15" stroke-width="1.3" opacity=".95"/>
    <path d="M27.2 26c2.7 3.3 2.7 8.7 0 12M36.8 26c-2.7 3.3-2.7 8.7 0 12" stroke-width="1.3" opacity=".95"/>
  </g>
</svg>`;

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
          width={150}
          height={150}
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
