/**
 * Odznaki odkrywców - proste progi za liczbę dodanych boisk i zebranych lajków.
 * Nie ma tu żadnej logiki punktowej: chodzi o to, żeby dodanie kolejnego boiska
 * miało widoczny ślad na profilu.
 */
export interface Badge {
  name: string;
  desc: string;
  /** true = zdobyta */
  earned: boolean;
}

export function badgesFor(courts: number, likes: number): Badge[] {
  return [
    {
      name: "Pierwszy kadr",
      desc: "pierwsze boisko w bazie",
      earned: courts >= 1,
    },
    {
      name: "Zwiadowca",
      desc: "5 boisk",
      earned: courts >= 5,
    },
    {
      name: "Kartograf",
      desc: "10 boisk",
      earned: courts >= 10,
    },
    {
      name: "Legenda mapy",
      desc: "25 boisk",
      earned: courts >= 25,
    },
    {
      name: "Podpalacz",
      desc: "100 płonących piłek na swoich boiskach",
      earned: likes >= 100,
    },
  ];
}

/** Kolejna odznaka do zdobycia razem z brakującą liczbą boisk. */
export function nextBadge(courts: number): { name: string; brakuje: number } | null {
  const progi: [number, string][] = [
    [1, "Pierwszy kadr"],
    [5, "Zwiadowca"],
    [10, "Kartograf"],
    [25, "Legenda mapy"],
  ];
  const next = progi.find(([n]) => courts < n);
  return next ? { name: next[1], brakuje: next[0] - courts } : null;
}
