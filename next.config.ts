import type { NextConfig } from "next";

/**
 * Nagłówki bezpieczeństwa dla całego serwisu.
 * Nagłówki dobrane tak, żeby nic nie psuły działania aplikacji - pełne CSP ze
 * `script-src` wymagałoby nonce'ów generowanych w proxy.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // geolokalizacja i aparat są potrzebne w kreatorze zgłoszeń - tylko dla nas
    value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    // Bez `default-src` i `script-src`: Next wstrzykuje skrypty inline do hydratacji,
    // a polityka bez nonce po prostu je blokuje i strona przestaje reagować
    // (sprawdzone - przyciski przestały działać). Zostawiamy reguły, które nic nie psują,
    // a zamykają realne wektory: osadzanie w cudzej ramce, wtyczki, podmianę <base>
    // i wysyłkę formularza na obcy adres.
    value: [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  /*
    Zdjęcia boisk leżą w Supabase Storage jako pełnowymiarowe JPEG-i (300-600 kB każdy,
    do 2500 px szerokości). Puszczamy je przez optymalizator Next: dostawca przycina je
    do potrzebnej szerokości i podaje w AVIF/WebP, co przy galerii boiska oznacza
    kilkadziesiąt razy mniej bajtów niż surowe pliki.
  */
  images: {
    /*
      Nazwę hosta bierzemy ze zmiennej środowiskowej, a nie z wpisanego na sztywno adresu.
      Wcześniej stał tu identyfikator konkretnego projektu Supabase - przy przeniesieniu
      bazy (albo osobnym projekcie na testy) zdjęcia przestawały się wyświetlać z błędem
      o niedozwolonej domenie, a poprawka wymagała zmiany w kodzie zamiast w ustawieniach.
    */
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://localhost"
        ).hostname,
        pathname: "/storage/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    /*
      Domyślnie Next dopuszcza tylko jakość 75 i każdą inną odrzuca błędem 400.
      55 jest dla miniatur w wizytówce nad pinezką - przy 200-320 px różnicy nie widać,
      a plik jest wyraźnie mniejszy (rozgrzewamy ich kilkadziesiąt z góry).
    */
    qualities: [55, 75],
    // szerokości dobrane pod nasze kadry: miniatury w liście, kafelki galerii, zdjęcie tytułowe
    imageSizes: [96, 200, 320, 480],
    deviceSizes: [640, 828, 1080, 1440, 1920, 2560],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
