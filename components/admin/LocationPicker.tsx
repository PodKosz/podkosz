"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Map as MlMap, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { PlaceHit, searchPlace } from "@/lib/admin";
import { LatLng, formatLatLng, parseCoordinates } from "@/lib/coords";
import { SearchIcon } from "../icons";

const PICKER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#07070a" } },
    {
      id: "carto",
      type: "raster",
      source: "carto",
      paint: { "raster-saturation": -0.3, "raster-hue-rotate": -12, "raster-brightness-max": 0.95 },
    },
  ],
};

/** Klikasz na mapie albo przeciągasz pinezkę — współrzędne lecą do formularza. */
export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);

  useEffect(() => {
    if (!box.current || mapRef.current) return;

    const map = new MlMap({
      container: box.current,
      style: PICKER_STYLE,
      center: [lng || 19.4, lat || 52.0],
      zoom: lat && lng ? 15 : 5.2,
      attributionControl: { compact: true },
      dragRotate: false,
    });
    mapRef.current = map;

    const el = document.createElement("div");
    el.innerHTML = `<div style="width:26px;height:26px;border-radius:99px;background:linear-gradient(135deg,#ffc27a,#ff4106);box-shadow:0 0 0 3px rgba(255,255,255,.35),0 8px 20px -4px rgba(255,77,10,.9);cursor:grab"></div>`;
    const marker = new Marker({ element: el, draggable: true })
      .setLngLat([lng || 19.4, lat || 52.0])
      .addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLngLat();
      onChangeRef.current(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
    });
    markerRef.current = marker;

    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      onChangeRef.current(Number(e.lngLat.lat.toFixed(6)), Number(e.lngLat.lng.toFixed(6)));
    });

    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height) map.resize();
    });
    ro.observe(box.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* pinezka podąża za ręcznie wpisanymi współrzędnymi */
  useEffect(() => {
    if (!markerRef.current || !lat || !lng) return;
    const current = markerRef.current.getLngLat();
    if (Math.abs(current.lat - lat) < 1e-6 && Math.abs(current.lng - lng) < 1e-6) return;
    markerRef.current.setLngLat([lng, lat]);
  }, [lat, lng]);

  const flyTo = useCallback((hit: PlaceHit) => {
    onChangeRef.current(hit.lat, hit.lng);
    markerRef.current?.setLngLat([hit.lng, hit.lat]);
    mapRef.current?.flyTo({ center: [hit.lng, hit.lat], zoom: 16, duration: 700 });
    setHits([]);
    setQuery(hit.label.split(",").slice(0, 2).join(", "));
  }, []);

  /** Ustawia pinezkę wprost na współrzędnych — bez pytania geokodera. */
  const jumpTo = useCallback((point: LatLng) => {
    onChangeRef.current(
      Number(point.lat.toFixed(6)),
      Number(point.lng.toFixed(6))
    );
    markerRef.current?.setLngLat([point.lng, point.lat]);
    mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 17, duration: 700 });
    setHits([]);
    setPinned(formatLatLng(point));
  }, []);

  const run = async () => {
    if (!query.trim()) return;

    // wklejone współrzędne rozpoznajemy same, adres idzie do geokodera
    const point = parseCoordinates(query);
    if (point) {
      jumpTo(point);
      return;
    }

    setPinned(null);
    setSearching(true);
    try {
      setHits(await searchPlace(query));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="field flex items-center gap-2 py-1.5 pl-4 pr-1.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPaste={(e) => {
              // wklejone współrzędne przypinamy od razu, bez wciskania Enter
              const text = e.clipboardData.getData("text");
              const point = parseCoordinates(text);
              if (!point) return;
              e.preventDefault();
              setQuery(text.trim());
              jumpTo(point);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}
            placeholder={`Adres albo współrzędne, np. 50°01'01.9"N 19°52'21.4"E`}
            className="w-full bg-transparent py-1.5 text-[13px] outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={run}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full flame-gradient text-black"
            aria-label="Szukaj"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        </div>

        {searching && (
          <p className="absolute right-12 top-3.5 text-[11px] text-faint">szukam…</p>
        )}

        {hits.length > 0 && (
          <ul className="glass absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-56 overflow-y-auto rounded-2xl p-1.5">
            {hits.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => flyTo(h)}
                  className="w-full rounded-xl px-3 py-2 text-left text-[12px] leading-snug text-muted transition hover:bg-white/8 hover:text-ink"
                >
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        ref={box}
        className="h-[320px] w-full overflow-hidden rounded-[20px] border border-hairline"
      />
      {pinned ? (
        <p className="text-[11px] text-basket">
          Przypięto ze współrzędnych: {pinned} — możesz jeszcze doprecyzować przeciągnięciem.
        </p>
      ) : (
        <p className="text-[11px] text-faint">
          Kliknij na mapie, przeciągnij pinezkę albo wklej współrzędne z Map Google
          (DMS, minuty dziesiętne lub zapis dziesiętny).
        </p>
      )}
    </div>
  );
}
