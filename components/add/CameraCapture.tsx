"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoKind } from "@/lib/types";
import { CameraIcon } from "../icons";
import { ShotDiagram } from "../ShotDiagram";

/** Podgląd z aparatu, schemat kadru na obrazie i podpowiedź pod nim. */
export function CameraCapture({
  kind,
  hint,
  onCapture,
}: {
  kind: PhotoKind;
  hint?: string;
  onCapture: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled)
          setError(
            "Brak dostępu do aparatu. Zezwól na kamerę w przeglądarce albo wgraj zdjęcie z galerii."
          );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

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
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px] border border-hairline bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0">
          <ShotDiagram kind={kind} mode="overlay" />
        </div>
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
