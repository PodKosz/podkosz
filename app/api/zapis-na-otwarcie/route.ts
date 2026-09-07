import { adresKlienta } from "@/lib/adres-ip";
import { przepustka, zaDuzo } from "@/lib/limity";
import { nadawca } from "@/lib/mail/nadawca";
import { supabaseServer } from "@/lib/supabase/server";
import {
  htmlPotwierdzenia,
  tekstPotwierdzenia,
  tematPotwierdzenia,
} from "@/lib/mail/potwierdzenie";

/**
 * Zapis na otwarcie serwisu ze strony „Już niedługo" plus krótkie potwierdzenie pocztą.
 *
 * Zapis idzie przez serwer, a nie wprost z przeglądarki, wyłącznie z powodu tego maila:
 * klucz do wysyłki nie ma prawa wyjść na front. Sam wpis i tak pilnuje baza (RLS pozwala
 * na `insert`, ale nie na odczyt listy), więc endpoint nie daje tu żadnej nowej władzy.
 *
 * Endpoint, który wysyła maila na dowolny podany adres, to maszynka do zasypywania cudzej
 * skrzynki - i tak właśnie było. Klucz główny tabeli chronił tylko przed POWTÓRZENIEM tego
 * samego adresu: list leci wyłącznie wtedy, gdy wiersz naprawdę powstał, więc jednego
 * człowieka nie da się zalać. Ale tysiąc RÓŻNYCH adresów to tysiąc listów z naszej domeny
 * do tysiąca obcych ludzi, bez żadnego licznika po drodze.
 *
 * Teraz zapis idzie przez funkcję `zapis_na_otwarcie`, która liczy adresy IP: pięć na
 * godzinę, dwadzieścia na dobę, sześćset na godzinę w całym serwisie. Licznik jest w bazie,
 * a nie tutaj, z dwóch powodów: instancji tej funkcji Vercel trzyma kilka naraz (każda
 * z własną pamięcią), a wpis do tabeli i tak dawał się zrobić kluczem publicznym wprost
 * z konsoli - więc jedyne miejsce, gdzie limit ma sens, jest przy samych danych.
 * Zablokowane adresy IP odsiewa wcześniej proxy (dawne middleware).
 */
export const dynamic = "force-dynamic";

const ADRES = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let email = "";
  try {
    const body = (await request.json()) as { email?: string };
    email = (body.email ?? "").trim().toLowerCase();
  } catch {
    return Response.json({ zapisany: false, powod: "zły format" }, { status: 400 });
  }

  if (!ADRES.test(email) || email.length > 200) {
    return Response.json({ zapisany: false, powod: "adres" }, { status: 400 });
  }

  /* pierwsze sito, darmowe: jedna instancja funkcji, jeden adres, pięć próśb na minutę */
  const ip = adresKlienta(request.headers);
  const przepust = przepustka("zapis", ip, 5, 60);
  if (!przepust.ok) return zaDuzo(przepust.poczekaj, "Za dużo prób. Spróbuj za chwilę.");

  const supabase = await supabaseServer();
  if (!supabase) {
    return Response.json({ zapisany: false, powod: "brak bazy" }, { status: 500 });
  }

  let { data, error } = await supabase.rpc("zapis_na_otwarcie", {
    p_email: email,
    p_ip: ip,
  });

  /*
    Funkcji nie ma w bazie, bo migracja `migration-tarcza.sql` jeszcze nie poszła.

    Wtedy zapisujemy po staremu, wprost do tabeli - bez licznika, ale działając. Kod
    wdraża się sam przy każdym pchnięciu do gałęzi, a migrację uruchamia człowiek ręcznie,
    więc między jednym i drugim zawsze jest okno. Formularz na zasłonie nie może w tym
    oknie przestać przyjmować adresów: to jedyna rzecz, którą gość może tam zrobić.
  */
  if (error && /Could not find the function|does not exist|PGRST202/i.test(error.message)) {
    const zapasowo = await supabase.from("launch_signups").insert({ email });
    error = zapasowo.error;
    data = error ? null : "nowy";
    if (error && /duplicate key/i.test(error.message)) {
      return Response.json({ zapisany: true, nowy: false });
    }
  }

  if (error) {
    /* powtórka to nie błąd - człowiek ma usłyszeć, że jest na liście */
    if (/duplicate key/i.test(error.message)) {
      return Response.json({ zapisany: true, nowy: false });
    }
    return Response.json(
      { zapisany: false, powod: /adres e-mail/i.test(error.message) ? "adres" : "baza" },
      { status: 400 }
    );
  }

  if (data === "limit") {
    return Response.json(
      { zapisany: false, powod: "Za dużo zapisów z tego miejsca. Spróbuj później." },
      { status: 429 }
    );
  }

  /* adres już był - żadnego listu, spokojna odpowiedź */
  if (data !== "nowy") {
    return Response.json({ zapisany: true, nowy: false });
  }

  /*
    Zapis już jest i to on się liczy. Gdy poczta nie zadziała, nie cofamy wpisu - lepiej
    mieć adres bez potwierdzenia niż stracić zapis przez awarię dostawcy.
  */
  const key = process.env.RESEND_API_KEY;
  const { from, awaryjny } = nadawca();
  const odpowiedzi = process.env.FEEDBACK_TO;

  /*
    Zapis do bazy już się udał, więc odpowiadamy sukcesem - brakuje tylko potwierdzenia
    na maila. `mail: false` mówi wprost, że listu nie było.
  */
  if (!key || awaryjny) return Response.json({ zapisany: true, nowy: true, mail: false });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      ...(odpowiedzi ? { reply_to: odpowiedzi } : {}),
      subject: tematPotwierdzenia(),
      html: htmlPotwierdzenia(),
      text: tekstPotwierdzenia(),
    }),
  });

  return Response.json({ zapisany: true, nowy: true, mail: res.ok });
}
