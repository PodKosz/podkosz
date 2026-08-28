"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoKind } from "@/lib/types";
import { CameraIcon } from "../icons";
import { ShotDiagram } from "../ShotDiagram";

/**
 * Obiektyw do wyboru.
 *
 * Telefony wystawiają szeroki kąt na dwa różne sposoby i oba trzeba obsłużyć:
 *   - jako OSOBNE urządzenie (iOS: „Back Ultra Wide Camera") - przełączenie to nowy strumień,
 *   - jako ZAKRES ZOOMU na jednej kamerze logicznej (część Androidów) - przełączenie to
 *     `applyConstraints` z mnożnikiem poniżej jedynki.
 */
interface Obiektyw {
  id: "0.5" | "1";
  deviceId?: string;
  zoom?: number;
}

/** Etykiety kamer tylnych - iOS je tłumaczy, więc łapiemy też polskie warianty. */
const TYLNE = /back|rear|tyl|tył|environment/i;
const ULTRA = /ultra.?wide|ultra.?szerok|ultraszerok/i;

/** Podgląd z aparatu, schemat kadru na obrazie i podpowiedź pod nim. */
export function CameraCapture({
  kind,
  hint,
  szeroki = false,
  onCapture,
}: {
  kind: PhotoKind;
  hint?: string;
  /** ten kadr wolno zrobić szerokim kątem - przełącznik 0,5x / 1x nad przyciskiem migawki */
  szeroki?: boolean;
  onCapture: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  /** pusta lista = telefon nie ma czym zrobić szerokiego kadru, więc przełącznika nie ma */
  const [obiektywy, setObiektywy] = useState<Obiektyw[]>([]);
  const [aktywny, setAktywny] = useState<"0.5" | "1">("1");
  const [przelacza, setPrzelacza] = useState(false);

  /** Otwiera strumień i podpina go do podglądu. Zwraca ścieżkę wideo do dalszych pytań. */
  const otworz = useCallback(async (ob?: Obiektyw) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const video: MediaTrackConstraints = ob?.deviceId
      ? { deviceId: { exact: ob.deviceId }, width: { ideal: 1920 } }
      : { facingMode: { ideal: "environment" }, width: { ideal: 1920 } };

    const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    const track = stream.getVideoTracks()[0];
    if (ob?.zoom !== undefined && track) {
      // `zoom` nie ma jeszcze w typach DOM, choć przeglądarki mobilne go znają
      await track
        .applyConstraints({ advanced: [{ zoom: ob.zoom }] } as unknown as MediaTrackConstraints)
        .catch(() => {});
    }
    return track;
  }, []);

  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const track = await otworz();
        if (anulowane) {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          return;
        }
        if (!szeroki) return;

        /*
          Wykrywanie obiektywu szerokokątnego robimy DOPIERO po zgodzie na kamerę: bez niej
          `enumerateDevices` oddaje urządzenia bez etykiet, a po nazwie właśnie poznajemy,
          który obiektyw jest który. Przełącznik pokazujemy tylko wtedy, gdy naprawdę mamy
          co przełączyć - lepiej go nie mieć, niż mieć guzik, który nic nie robi.
        */
        const urzadzenia = await navigator.mediaDevices.enumerateDevices();
        const wejscia = urzadzenia.filter((d) => d.kind === "videoinput");
        const tylne = wejscia.filter((d) => TYLNE.test(d.label));
        const kandydaci = tylne.length ? tylne : wejscia;

        const ultra = kandydaci.find((d) => ULTRA.test(d.label));
        if (ultra) {
          const zwykla = kandydaci.find((d) => !ULTRA.test(d.label) && !/tele/i.test(d.label));
          if (!anulowane) {
            setObiektywy([
              { id: "1", deviceId: zwykla?.deviceId },
              { id: "0.5", deviceId: ultra.deviceId },
            ]);
          }
          return;
        }

        const zakres = (
          track?.getCapabilities?.() as (MediaTrackCapabilities & { zoom?: { min: number } }) | undefined
        )?.zoom;
        if (zakres && zakres.min < 1 && !anulowane) {
          setObiektywy([
            { id: "1", zoom: 1 },
            { id: "0.5", zoom: Math.max(zakres.min, 0.5) },
          ]);
        }
      } catch {
        if (!anulowane)
          setError(
            "Brak dostępu do aparatu. Zezwól na kamerę w przeglądarce albo wgraj zdjęcie z galerii."
          );
      }
    })();

    return () => {
      anulowane = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [otworz, szeroki]);

  const przelacz = useCallback(
    async (id: "0.5" | "1") => {
      const ob = obiektywy.find((o) => o.id === id);
      if (!ob || id === aktywny || przelacza) return;
      setPrzelacza(true);
      try {
        await otworz(ob);
        setAktywny(id);
      } catch {
        // nie udało się przełączyć - zostajemy przy tym, co działa
        await otworz(obiektywy.find((o) => o.id === aktywny)).catch(() => {});
      } finally {
        setPrzelacza(false);
      }
    },
    [aktywny, obiektywy, otworz, przelacza]
  );

  const shoot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const max = 2048;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    onCapture(canvas.toDataURL("image/jpeg", 0.75));
  }, [onCapture]);

  const fromFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 2048;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        onCapture(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {/*
        Podgląd pionowy i możliwie duży. Poziomy kadr 4:3 na telefonie schodził do paska
        wysokiego na jedną trzecią ekranu - nie dało się na nim ocenić, czy boisko w ogóle
        mieści się w kadrze. Szerokość ogranicza `54svh`, więc okno zostaje pionowe także
        na monitorze, gdzie inaczej rozlałoby się na całą kolumnę.
      */}
      <div
        className="relative mx-auto w-full overflow-hidden rounded-[24px] border border-hairline bg-black"
        style={{ aspectRatio: "3 / 4", maxWidth: "min(100%, 54svh)" }}
      >
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0">
          <ShotDiagram kind={kind} mode="overlay" />
        </div>

        {szeroki && obiektywy.length > 1 && (
          <div
            className={`absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 p-1 backdrop-blur-md ${
              hint ? "bottom-16" : "bottom-4"
            }`}
          >
            {(["0.5", "1"] as const).map((id) => (
              <button
                key={id}
                onClick={() => void przelacz(id)}
                disabled={przelacza}
                className={`h-9 w-9 rounded-full text-[12px] font-bold transition ${
                  aktywny === id ? "bg-white text-black" : "text-glow hover:bg-white/12"
                }`}
              >
                {id}×
              </button>
            ))}
          </div>
        )}

        {hint && (
          <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-black/70 px-3 py-2 text-center text-[12px] leading-snug text-glow">
            {hint}
          </p>
        )}
        {flash && <div className="absolute inset-0 bg-white/70" />}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center text-[13px] text-muted">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        <label className="glass cursor-pointer rounded-full px-4 py-2.5 text-[12px] uppercase tracking-[0.12em] text-muted transition hover:text-ink">
          z galerii
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => fromFile(e.target.files?.[0])}
          />
        </label>

        <button
          onClick={shoot}
          disabled={!!error}
          className="grid place-items-center rounded-full flame-gradient text-black transition active:scale-95 disabled:opacity-40"
          style={{ width: 72, height: 72 }}
          aria-label="Zrób zdjęcie"
        >
          <CameraIcon className="h-8 w-8" />
        </button>

        <span className="w-[92px]" />
      </div>
    </div>
  );
}
