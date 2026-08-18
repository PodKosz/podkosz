"use client";

import { useEffect } from "react";
import { pingVisit } from "@/lib/stats";

/** Odnotowuje jedną wizytę na sesję przeglądarki — do statystyk w panelu. */
export function VisitPing() {
  useEffect(() => {
    void pingVisit();
  }, []);
  return null;
}
