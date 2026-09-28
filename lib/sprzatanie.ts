"use client";

import { supabaseBrowser } from "./supabase/client";
import { usunZdjecia } from "./zdjecia";

/**
 * Odrzucone zgłoszenia boisk i poprawki zdjęć starsze niż 12 miesięcy - razem z plikami.
 *
 * Termin obiecuje polityka prywatności. Resztę terminów pilnuje nocne zadanie w bazie
 * (`sprzataj_dane_osobowe`), ale tu są jeszcze zdjęcia w R2, a te kasuje wyłącznie
 * administrator - Worker sprawdza jego sesję. Dlatego to sprzątanie chodzi przy wejściu
 * do panelu: jest wtedy i sesja, i ktoś, kto na nią patrzy.
 *
 * Kolejność ma znaczenie: najpierw pliki, potem wiersze. Odwrotnie, przy zerwanym
 * połączeniu zostałyby pliki bez wiersza, czyli zdjęcia, o których nikt już nie wie.
 * Wiersz bez pliku jest nieszkodliwy - następne wejście spróbuje jeszcze raz.
 */

let juzBylo = false;

export async function sprzatajOdrzucone(): Promise<number> {
  if (juzBylo) return 0;
  juzBylo = true;

  const supabase = await supabaseBrowser();
  if (!supabase) return 0;

  /* przed migracją RODO funkcji nie ma - wtedy po cichu nic nie robimy */
  const { data, error } = await supabase.rpc("odrzucone_do_usuniecia");
  if (error || !data?.length) return 0;

  const wiersze = data as { rodzaj: "zgloszenie" | "poprawka"; id: string; sciezki: string[] }[];
  const sciezki = wiersze.flatMap((w) => w.sciezki ?? []);
  const zniknelo = await usunZdjecia(sciezki);
  if (zniknelo < sciezki.length) return 0;

  const { data: ile } = await supabase.rpc("usun_odrzucone", {
    p_zgloszenia: wiersze.filter((w) => w.rodzaj === "zgloszenie").map((w) => w.id),
    p_poprawki: wiersze.filter((w) => w.rodzaj === "poprawka").map((w) => w.id),
  });
  return (ile as number | null) ?? 0;
}
