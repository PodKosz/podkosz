import { notFound } from "next/navigation";
import { ZrzutMapy } from "@/components/ZrzutMapy";

/**
 * Mapa do zrzutu kadru startowego - odpala ją `scripts/kadr-startowy.mjs`.
 *
 * Tylko w trybie deweloperskim. Na produkcji to 404: strona niczego nie ujawnia, ale nie
 * ma powodu, żeby wisiała pod publicznym adresem i trafiała do czyjegoś indeksu.
 */
export default function ZrzutMapyPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ZrzutMapy />;
}
