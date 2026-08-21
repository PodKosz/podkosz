/**
 * Nagłówek sekcji: wersalik i krótka kreska gasnąca w prawo.
 *
 * Sam tekst w kolorze `faint` gubił się na stronie pełnej kart - kreska daje mu oparcie,
 * a jednocześnie nie jest kolejnym pudełkiem na ekranie. Na telefonie kreska znika, bo
 * przy wąskiej kolumnie zostawało z niej kilka pikseli.
 */
export function NaglowekSekcji({ tytul }: { tytul: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <h2 className="shrink-0 text-[13px] uppercase tracking-[0.18em] text-faint">{tytul}</h2>
      <span className="kreska-sekcji hidden flex-1 sm:block" />
    </div>
  );
}
