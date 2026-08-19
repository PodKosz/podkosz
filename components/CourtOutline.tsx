/**
 * Kontur boiska do koszykówki widzianego z góry - cienkie linie w gradiencie marki.
 *
 * Rysunek jest ozdobą, nie ilustracją: ma dawać tło, które od razu mówi „koszykówka",
 * bez konkurowania z treścią. Dlatego linie są włosowe, gradient wygasza je po bokach,
 * a maska rozpuszcza dolną krawędź w tle karty.
 *
 * `uid` musi być inny dla każdego wystąpienia na stronie - identyfikatory gradientów
 * w SVG są globalne i przy powtórzeniu przeglądarka bierze pierwszy z dokumentu
 * (na tym potknęło się już logo w nagłówku).
 */
export function CourtOutline({
  uid = "court-outline",
  className = "",
}: {
  uid?: string;
  className?: string;
}) {
  const linia = `url(#line-${uid})`;

  /*
    preserveAspectRatio="none" rozciąga rysunek dokładnie na blok, w którym siedzi.
    Proporcje boiska (1,83) i karty różnią się o kilka procent, więc zniekształcenie jest
    niewidoczne, a linie dochodzą do wszystkich krawędzi zamiast kończyć się w powietrzu.
  */
  return (
    <svg
      viewBox="0 0 840 460"
      preserveAspectRatio="none"
      className={`h-full w-full ${className}`}
      fill="none"
      aria-hidden
      style={{ filter: "drop-shadow(0 0 18px rgba(255,122,24,.28))" }}
    >
      <defs>
        {/*
          Linie najmocniejsze w środku, gasną przy bokach - kadr nie ma twardych końców.
          gradientUnits="userSpaceOnUse" jest tu konieczne: domyślny objectBoundingBox liczy
          gradient osobno dla każdego elementu, a pionowa linia ma zerową szerokość pudełka,
          więc znikała (widać to było w wyeksportowanym PNG).
        */}
        <linearGradient
          id={`line-${uid}`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="840"
          y2="0"
        >
          <stop offset="0" stopColor="rgba(255,122,24,0)" />
          <stop offset="0.18" stopColor="rgba(255,150,60,0.65)" />
          <stop offset="0.5" stopColor="rgba(255,186,110,1)" />
          <stop offset="0.82" stopColor="rgba(255,150,60,0.65)" />
          <stop offset="1" stopColor="rgba(255,122,24,0)" />
        </linearGradient>

      </defs>

      <g stroke={linia} strokeLinecap="round" strokeLinejoin="round">
        {/* płyta boiska */}
        <rect x="40" y="40" width="760" height="380" rx="6" strokeWidth="2.4" />

        {/* linia środkowa i koło środkowe */}
        <path d="M420 40v380" strokeWidth="1.6" />
        <circle cx="420" cy="230" r="62" strokeWidth="1.8" />

        {/* pola podkoszowe z półkolami rzutów wolnych */}
        <path d="M40 140h150v180H40" strokeWidth="1.8" />
        <path d="M190 170a60 60 0 0 1 0 120" strokeWidth="1.6" />
        <path d="M800 140h-150v180h150" strokeWidth="1.8" />
        <path d="M650 170a60 60 0 0 0 0 120" strokeWidth="1.6" />

        {/* łuki za trzy punkty */}
        <path d="M40 92h34a186 186 0 0 1 0 276H40" strokeWidth="1.6" />
        <path d="M800 92h-34a186 186 0 0 0 0 276h34" strokeWidth="1.6" />

        {/* tablice i obręcze */}
        <g strokeWidth="2.6">
          <path d="M62 196v68M778 196v68" />
          <circle cx="76" cy="230" r="9" strokeWidth="1.8" />
          <circle cx="764" cy="230" r="9" strokeWidth="1.8" />
        </g>
      </g>
    </svg>
  );
}
