import { supabaseServer } from "./supabase/server";
import { rowToCourt, COURT_SELECT } from "./repo";
import type { Court } from "./types";
import type { CourtRow } from "./supabase/types";

/**
 * Dane na stronę „Moje konto".
 *
 * Wszystko czytamy sesyjnym klientem, więc RLS pilnuje, że nikt nie zobaczy tu cudzych
 * podpaleń, ulubionych czy historii gry. Strona konta jest z natury prywatna, więc nie
 * podlega żadnemu cache'owaniu.
 */
export interface WizytaWHistorii {
  day: string;
  /** godziny jednej wizyty, po kolei - zapis na zakres to kilka wierszy w bazie */
  hours: number[];
  court: { name: string; slug: string; city: string } | null;
}

export interface DaneKonta {
  /** boiska dodane przez tę osobę i już opublikowane */
  dodane: Court[];
  /** zgłoszenia czekające w kolejce */
  wKolejce: number;
  /** zgłoszenia odrzucone */
  odrzucone: number;
  /** liczba podpaleń, które ta osoba rozdała */
  podpalenia: number;
  /** zebrane podpalenia na własnych boiskach */
  zebranePodpalenia: number;
  ulubione: Court[];
  historia: WizytaWHistorii[];
  /** kiedy ostatnio zmieniano nick (null = nigdy) */
  nickZmieniony: string | null;
}

const PUSTE: DaneKonta = {
  dodane: [],
  wKolejce: 0,
  odrzucone: 0,
  podpalenia: 0,
  zebranePodpalenia: 0,
  ulubione: [],
  historia: [],
  nickZmieniony: null,
};

export async function pobierzKonto(userId: string, nick: string): Promise<DaneKonta> {
  const supabase = await supabaseServer();
  if (!supabase) return PUSTE;

  /*
    Boiska szukamy dwoma drogami: po powiązaniu z kontem i po podpisie autora. Wpisy dodane
    ręcznie z panelu mają w bazie sam podpis, bez identyfikatora konta - a to wciąż te same
    boiska tej samej osoby (tak samo liczy je publiczny profil odkrywcy).
  */
  const [dodane, dodanePodpisem, kolejka, podpalenia, ulubione, historia, profil] =
    await Promise.all([
    supabase.from("courts").select(COURT_SELECT).eq("added_by", userId),
    supabase.from("courts").select(COURT_SELECT).eq("added_by_name", nick),
    supabase.from("submissions").select("status").eq("author_id", userId),
    supabase.from("likes").select("court_id"),
    supabase.from("favorites").select(`court_id, courts!inner(${COURT_SELECT})`),
    supabase
      .from("checkins")
      .select("day, hour, courts!inner(name, slug, city)")
      .order("day", { ascending: false })
      .limit(60),
    supabase.from("profiles").select("nick_changed_at").eq("id", userId).maybeSingle(),
  ]);

  const wiersze = [
    ...((dodane.data ?? []) as unknown as CourtRow[]),
    ...((dodanePodpisem.data ?? []) as unknown as CourtRow[]),
  ];
  const moje = [...new Map(wiersze.map((r) => [r.id, r])).values()].map(rowToCourt);
  const zgloszenia = (kolejka.data ?? []) as { status: string }[];

  return {
    dodane: moje,
    wKolejce: zgloszenia.filter((z) => z.status === "pending").length,
    odrzucone: zgloszenia.filter((z) => z.status === "rejected").length,
    podpalenia: (podpalenia.data ?? []).length,
    zebranePodpalenia: moje.reduce((suma, c) => suma + c.likes, 0),
    ulubione: ((ulubione.data ?? []) as unknown as { courts: CourtRow }[])
      .map((r) => r.courts)
      .filter(Boolean)
      .map(rowToCourt),
    historia: zwinHistorie(
      (historia.data ?? []) as unknown as {
        day: string;
        hour: number;
        courts: { name: string; slug: string; city: string } | null;
      }[]
    ),
    nickZmieniony: (profil.data as { nick_changed_at: string | null } | null)?.nick_changed_at ?? null,
  };
}

/**
 * Jedna wizyta zamiast wiersza na każdą godzinę.
 *
 * Zapis „idę od 18:00 do 21:00" to w bazie cztery wiersze - w historii ma być jedną
 * linią. Grupujemy po dniu i boisku, kolejność wejściowa (dzień malejąco) zostaje.
 */
function zwinHistorie(
  wiersze: { day: string; hour: number; courts: { name: string; slug: string; city: string } | null }[]
): WizytaWHistorii[] {
  const mapa = new Map<string, WizytaWHistorii>();

  for (const w of wiersze) {
    const klucz = `${w.day}|${w.courts?.slug ?? "-"}`;
    const wpis = mapa.get(klucz);
    if (wpis) {
      wpis.hours.push(w.hour);
    } else {
      mapa.set(klucz, { day: w.day, hours: [w.hour], court: w.courts });
    }
  }

  return [...mapa.values()].map((w) => ({ ...w, hours: [...w.hours].sort((a, b) => a - b) }));
}
