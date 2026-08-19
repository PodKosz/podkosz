import { revalidateTag } from "next/cache";
import { getSessionUser } from "@/lib/supabase/server";
import { COURTS_TAG } from "@/lib/repo";

/**
 * Unieważnia pamięć podręczną boisk. Odczyty z bazy trzymamy przez kilka minut, więc bez
 * tego opublikowane boisko pojawiałoby się na mapie z opóźnieniem. Panel administratora
 * uderza tutaj po każdej zmianie w bazie boisk.
 *
 * Wywołanie jest tylko dla administratora: to nie wyciek danych, ale bez ochrony każdy
 * mógłby czyścić cache w pętli i zamienić go w nieustanne odpytywanie Supabase.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return Response.json({ ok: false, error: "Tylko administrator" }, { status: 403 });
  }

  // dwuargumentowa postać jest w tej wersji Next obowiązkowa; "max" daje zachowanie
  // stale-while-revalidate: pierwszy po unieważnieniu dostaje stare dane, świeże lecą w tle
  revalidateTag(COURTS_TAG, "max");
  return Response.json({ ok: true });
}
