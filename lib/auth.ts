"use client";

import { supabaseBrowser } from "./supabase/client";

/** Logowanie kontem Google. Po powrocie wracamy tam, skąd użytkownik wyszedł. */
export async function signInWithGoogle(next = "/") {
  const supabase = await supabaseBrowser();
  if (!supabase) {
    throw new Error(
      "Logowanie będzie dostępne po podpięciu projektu Supabase (brak kluczy w .env.local)."
    );
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = await supabaseBrowser();
  if (!supabase) return;
  await supabase.auth.signOut();
  location.reload();
}
