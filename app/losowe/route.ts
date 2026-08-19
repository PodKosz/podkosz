import { NextResponse, type NextRequest } from "next/server";
import { randomCourtSlug } from "@/lib/repo";

/**
 * „Pokaż losowe boisko” - przerzuca prosto na kartę losowego boiska.
 * Parametr `dziwne=1` zawęża losowanie do boisk z limonkową plakietką.
 * Do adresu docelowego dokładamy `losowe=1`, bo po tym karta boiska wie,
 * że ma pokazać przycisk „losuj dalej”.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const onlyFunny = searchParams.get("dziwne") === "1";
  // `omin` to boisko, które użytkownik właśnie widzi - nie chcemy wylosować go ponownie
  const skip = searchParams.get("omin") ?? undefined;

  const slug =
    (await randomCourtSlug(onlyFunny, skip)) ??
    (await randomCourtSlug(onlyFunny)) ??
    (onlyFunny ? await randomCourtSlug(false) : null);
  if (!slug) return NextResponse.redirect(`${origin}/`);

  const target = new URL(`/boisko/${slug}`, origin);
  target.searchParams.set("losowe", "1");
  if (onlyFunny) target.searchParams.set("dziwne", "1");

  // bez cache: każde kliknięcie ma dać inne boisko
  return NextResponse.redirect(target, { headers: { "Cache-Control": "no-store" } });
}
