import type { Metadata } from "next";
import { WejscieBeta } from "@/components/WejscieBeta";
import { ZapisNaOtwarcie } from "@/components/ZapisNaOtwarcie";
import { CourtOutline } from "@/components/CourtOutline";

export const metadata: Metadata = {
  title: "PodKosz - już niedługo",
  description: "Największa mapa boisk do koszykówki w Polsce. Otwieramy wkrótce.",
  robots: { index: false, follow: false },
  alternates: { canonical: undefined },
};

/**
 * Strona zasłony przed premierą - jedyne, co widać z zewnątrz.
 *
 * Nie ma tu nawigacji ani stopki (pomija je układ główny), żeby nic nie prowadziło dalej.
 * Tło: przekrzywiony kontur boiska rozciągnięty poza ekran, dwie dryfujące plamy światła
 * i ciepła poświata pod napisem.
 */
export default function Wkrotce() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 text-center">
      {/* płynne plamy światła - wygasają długo przed krawędzią, więc nigdzie nie ma twardej linii */}
      <span
        className="liquid-blob left-[6vw] top-[-8rem] h-[560px] w-[720px]"
        style={{
          background:
            "radial-gradient(circle, rgb(var(--rgb-flame) / .26) 0%, rgb(var(--rgb-ember) / .08) 46%, rgb(var(--rgb-ember) / .02) 68%, transparent 82%)",
        }}
      />
      <span
        className="liquid-blob bottom-[-10rem] right-[2vw] h-[520px] w-[620px]"
        style={{
          background:
            "radial-gradient(circle, rgb(var(--rgb-glow) / .18) 0%, rgb(var(--rgb-flame) / .05) 50%, transparent 78%)",
        }}
      />

      {/*
        Kontur boiska w tle: większy niż ekran i przekrzywiony, więc widać fragment płyty
        (pole podkoszowe z lewej, koło środkowe przy środku) zamiast całego rysunku. Linie są
        przygaszone, żeby nie konkurowały z napisem.
      */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[102vw] w-[190vw] opacity-[0.55] sm:h-[58vw] sm:w-[108vw]"
        style={{ translate: "calc(-50% + 9vw) calc(-50% - 2vh)", rotate: "-11deg" }}
      >
        <CourtOutline uid="zaslona" />
      </div>

      {/* ciepłe światło dokładnie pod napisem, żeby litery nie leżały na pustce */}
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[min(92vw,900px)] -translate-x-1/2 -translate-y-1/2 blur-[80px]"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--rgb-ember) / .30) 0%, rgb(var(--rgb-flame) / .12) 48%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* znak marki - boisko z góry z piłką w kole środkowym */}
        <svg
          viewBox="0 0 64 64"
          className="h-[96px] w-[96px] sm:h-[136px] sm:w-[136px]"
          fill="none"
          aria-hidden
          style={{ filter: "drop-shadow(0 10px 34px rgb(var(--rgb-ember) / .5))" }}
        >
          <defs>
            <linearGradient id="zaslona-logo" x1="0" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="var(--color-glow-soft)" />
              <stop offset="0.5" stopColor="var(--color-flame)" />
              <stop offset="1" stopColor="var(--color-ember-deep)" />
            </linearGradient>
          </defs>
          <g
            stroke="url(#zaslona-logo)"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4.5" y="12.5" width="55" height="39" rx="4.5" strokeWidth="2.4" />
            <path d="M32 12.5v39" strokeWidth="1.8" opacity=".9" />
            <path d="M4.5 23.5h10v17h-10" strokeWidth="1.8" />
            <path d="M59.5 23.5h-10v17h10" strokeWidth="1.8" />
            <path d="M14.5 27a7 7 0 0 1 0 10" strokeWidth="1.6" opacity=".85" />
            <path d="M49.5 27a7 7 0 0 0 0 10" strokeWidth="1.6" opacity=".85" />
            <circle cx="32" cy="32" r="7.5" strokeWidth="2.2" />
            <path d="M32 24.5v15M24.5 32h15" strokeWidth="1.3" opacity=".95" />
            <path
              d="M27.2 26c2.7 3.3 2.7 8.7 0 12M36.8 26c-2.7 3.3-2.7 8.7 0 12"
              strokeWidth="1.3"
              opacity=".95"
            />
          </g>
        </svg>

        <p className="mt-6 text-[28px] font-bold leading-none tracking-tight sm:text-[40px]">
          POD<span className="flame-text pr-[0.04em]">KOSZ</span>
        </p>

        {/*
          Gradient na literach kładzie background-clip: text, a ten maluje tylko pudełko
          wiersza - stąd luźniejszy leading i zapas z prawej, żeby nie ucinało ostatniej litery.
        */}
        <h1 className="mt-8 flame-text pr-[0.06em] text-[clamp(46px,12vw,116px)] font-bold leading-[1.1] tracking-[-0.035em]">
          Już niedługo
        </h1>

        {/* łamanie wpisane ręcznie: „w Polsce" ma zamykać pierwszy wiersz */}
        <p className="mt-6 flex max-w-[64ch] flex-col text-[15px] leading-relaxed text-muted sm:text-[16px]">
          <span>Chcemy zbudować największą mapę boisk do koszykówki w Polsce.</span>
          <span>Otwieramy wkrótce!</span>
        </p>

        {/* delikatna kreska w kolorach marki zamiast pustki pod tekstem */}
        <span
          className="mt-10 h-[3px] w-40 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgb(var(--rgb-flame) / .85) 50%, transparent 100%)",
          }}
        />

        {/*
          Zapis na otwarcie - dla wszystkich, którzy trafili tu przed premierą. Stoi wyżej
          niż wejście dla testerów, bo to jedyna rzecz, którą przeciętny gość może tu zrobić.
        */}
        <ZapisNaOtwarcie />

        {/* wejście dla zaproszonych do testów - reszta świata zostaje na tej stronie */}
        <WejscieBeta />
      </div>
    </main>
  );
}
