"use client";

/**
 * Konwertuje zdjęcie z dysku na JPEG. Zostawiamy pełny kadr i dużą krawędź (2560 px),
 * a wagę zbijamy kompresją — nic nie jest obcinane.
 */
export async function fileToJpeg(file: File, max = 2560, quality = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", quality)
  );
  if (!blob) throw new Error("Nie udało się przetworzyć zdjęcia");
  return blob;
}
