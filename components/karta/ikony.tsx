import type { SVGProps } from "react";

/**
 * Ikony karty boiska na telefonie - jedna kreska 1,7 w barwie tekstu, siatka 24 x 24.
 * Rysowane tu, a nie brane z `icons.tsx`, bo tamte są w stylu poprzedniej karty (wypełnione,
 * w barwie marki); na nowej karcie pomarańcz ma tylko „Idę zagrać" i polubione serce.
 */
type P = SVGProps<SVGSVGElement>;

const Ik = ({ children, ...p }: P) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...p}
  >
    {children}
  </svg>
);

export const IkMapa = (p: P) => (
  <Ik {...p}>
    <path d="M9 4.5 3.5 6.6v13l5.5-2.1 6 2.1 5.5-2.1v-13L15 6.6z" />
    <path d="M9 4.5v13M15 6.6v13" />
  </Ik>
);
export const IkZdjecia = (p: P) => (
  <Ik {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="3" />
    <circle cx="9" cy="10" r="1.7" />
    <path d="M21 15.5l-5-5-9.5 9" />
  </Ik>
);
export const IkProwadz = (p: P) => (
  <Ik {...p}>
    <path d="M3.8 11.1 20 4l-7.1 16.2-2.2-7.1-6.9-2z" />
  </Ik>
);
export const IkKosz = (p: P) => (
  <Ik {...p}>
    <rect x="4" y="3.5" width="16" height="10" rx="2" />
    <path d="M9.5 13.5v-3.5h5v3.5" />
    <path d="M8 13.5h8M8.6 13.5l1.6 7M15.4 13.5l-1.6 7M10.2 20.5h3.6" />
  </Ik>
);
export const IkNawierzchnia = (p: P) => (
  <Ik {...p}>
    <path d="M12 3.5 21 8l-9 4.5L3 8z" />
    <path d="M3 12.5l9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
  </Ik>
);
export const IkZegar = (p: P) => (
  <Ik {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Ik>
);
export const IkSiatka = (p: P) => (
  <Ik {...p}>
    <path d="M4.5 5h15" />
    <path d="M6 5l2.2 14.5h7.6L18 5" />
    <path d="M9.5 5l5 14.5M14.5 5l-5 14.5M6.7 10h10.6M7.4 15h9.2" />
  </Ik>
);
export const IkSwiatlo = (p: P) => (
  <Ik {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2V16h5v-.2c0-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z" />
  </Ik>
);
export const IkPlot = (p: P) => (
  <Ik {...p}>
    <path d="M4.5 20V7.5L6.5 5l2 2.5V20M10 20V7.5L12 5l2 2.5V20M15.5 20V7.5l2-2.5 2 2.5V20M3 10.5h18M3 16h18" />
  </Ik>
);
export const IkFlaga = (p: P) => (
  <Ik {...p}>
    <path d="M5.5 21V4M5.5 4.5h11.5l-2.2 4 2.2 4H5.5" />
  </Ik>
);
export const IkAparat = (p: P) => (
  <Ik {...p}>
    <path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5L16 6.5h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="12.5" r="3.4" />
  </Ik>
);
export const IkKodQr = (p: P) => (
  <Ik {...p}>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.4" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.4" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.4" />
    <path d="M14 14h2.5v2.5M20.5 14v.01M14 20.5h.01M17.5 18v2.5h3V17.5" />
  </Ik>
);
export const IkGwiazda = (p: P) => (
  <Ik {...p}>
    <path d="M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z" />
  </Ik>
);
export const IkPinezka = (p: P) => (
  <Ik {...p}>
    <path d="M9 3.5h6l-1 5.5 3.5 3.2v1.3h-11v-1.3L10 9z" />
    <path d="M12 13.5V20.5" />
  </Ik>
);
export const IkKciuk = (p: P) => (
  <Ik {...p}>
    <path d="M7.5 10.5V20h-3a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1zM7.5 10.5 11 3.6c1.4 0 2.5 1.1 2.5 2.5V9h5a2 2 0 0 1 2 2.3l-1.2 6.9a2 2 0 0 1-2 1.8H7.5" />
  </Ik>
);
export const IkStrzalka = (p: P) => (
  <Ik {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Ik>
);
export const IkDol = (p: P) => (
  <Ik {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Ik>
);
export const IkZamknij = (p: P) => (
  <Ik {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Ik>
);
export const IkOlowek = (p: P) => (
  <Ik {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Ik>
);
export const IkLudzie = (p: P) => (
  <Ik {...p}>
    <circle cx="9" cy="8.2" r="3.2" />
    <path d="M3.2 19.5c.6-3.2 2.9-5 5.8-5s5.2 1.8 5.8 5" />
    <path d="M15.6 5.1a3.2 3.2 0 0 1 0 6.2M17.6 14.8c1.8.6 2.9 2.2 3.3 4.7" />
  </Ik>
);
export const IkWiatr = (p: P) => (
  <Ik {...p}>
    <path d="M3 9h10.5a2.8 2.8 0 1 0-2.8-2.8M3 15h14.5a2.8 2.8 0 1 1-2.8 2.8M3 12h7" />
  </Ik>
);

/* ---------- niebo: do pogody ---------- */
const CHMURA = "M7.4 18.5h9.8a4 4 0 0 0 .5-7.97A5.6 5.6 0 0 0 6.7 9.2a4.7 4.7 0 0 0 .7 9.3z";
const CHMURA_WYZEJ = "M7.6 14.6h9.4a3.6 3.6 0 0 0 .4-7.18A5.1 5.1 0 0 0 7.5 6.3a4.2 4.2 0 0 0 .1 8.3z";

export function IkNiebo({ scena, dzien = true, ...p }: P & { scena: string; dzien?: boolean }) {
  switch (scena) {
    case "clear":
      return dzien ? (
        <Ik {...p}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.8v2.2M12 19v2.2M4.2 12H2M22 12h-2.2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </Ik>
      ) : (
        <Ik {...p}>
          <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
        </Ik>
      );
    case "partly":
      return (
        <Ik {...p}>
          {dzien ? <path d="M8.5 3.5v1.4M3.6 8.4H2.2M4.9 4.9l1 1M13.1 4.9l-1 1" /> : null}
          <path d={dzien ? "M5.6 10.9a3.4 3.4 0 0 1 6-2.6" : "M11 4.3a4.6 4.6 0 0 0-5.3 6.2"} />
          <path d="M9.4 19.5h8.6a3.5 3.5 0 0 0 .4-7 4.9 4.9 0 0 0-9.4-1.2 4.1 4.1 0 0 0 .4 8.2z" />
        </Ik>
      );
    case "fog":
      return (
        <Ik {...p}>
          <path d={CHMURA_WYZEJ} />
          <path d="M4 17.5h16M6.5 20.5h11" />
        </Ik>
      );
    case "rain":
      return (
        <Ik {...p}>
          <path d={CHMURA_WYZEJ} />
          <path d="M8.6 17.6 7.6 20M12.6 17.6l-1 2.4M16.6 17.6l-1 2.4" />
        </Ik>
      );
    case "snow":
      return (
        <Ik {...p}>
          <path d={CHMURA_WYZEJ} />
          <path d="M8 18.2v.01M12 19.6v.01M16 18.2v.01M10 21v.01M14 21v.01" strokeWidth={2.4} />
        </Ik>
      );
    case "storm":
      return (
        <Ik {...p}>
          <path d={CHMURA_WYZEJ} />
          <path d="M12.8 15.2 10.6 18.6h2.6l-1.8 3" />
        </Ik>
      );
    default:
      return (
        <Ik {...p}>
          <path d={CHMURA} />
        </Ik>
      );
  }
}
