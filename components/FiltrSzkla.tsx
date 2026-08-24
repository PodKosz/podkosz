/**
 * Filtr zaginający tło pod płynnym szkłem (klasa `.szklo-plynne` w globals.css).
 *
 * CSS sam z siebie nie umie przesunąć pikseli tła - `backdrop-filter` potrafi rozmyć
 * i podbić nasycenie, ale nie zniekształcić. Robi to dopiero filtr SVG: `feTurbulence`
 * rysuje miękki szum, a `feDisplacementMap` używa go jako mapy przesunięć, czyli
 * dosłownie rozjeżdża tło tak, jak robi to gruba szyba.
 *
 * Szum jest bardzo niskiej częstotliwości i dodatkowo rozmyty - inaczej krawędź szkła
 * wyglądałaby jak mróz na szybie, a nie jak zagięcie. Skala 24 jest dobrana pod
 * kilkunastopikselowy pasek przy brzegu wizytówki; przy większej tło zaczyna się „lać".
 *
 * Sam element nic nie rysuje. Musi tylko być w drzewie, żeby `url(#szklo-zagiecie)`
 * miało do czego się odwołać - dlatego wstawiamy go raz, obok mapy.
 */
export function FiltrSzkla() {
  return (
    <svg
      aria-hidden
      focusable="false"
      className="pointer-events-none absolute h-0 w-0"
      style={{ position: "absolute" }}
    >
      <defs>
        <filter
          id="szklo-zagiecie"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.011 0.019"
            numOctaves={2}
            seed={7}
            result="szum"
          />
          <feGaussianBlur in="szum" stdDeviation="2.4" result="szumMiekki" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="szumMiekki"
            scale={34}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
