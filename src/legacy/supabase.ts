// ============================================================
// supabase.ts — Core fetch-wrapper för Supabase REST + JWT.
// Per-aggregate load/save-funktioner ligger i services/.
// Beror på: config.ts (SB_URL, SB_KEY)
// ============================================================

interface SbOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: string;
  headers?: Record<string, string>;
  prefer?: string;
}

// Fas 1: skickar JWT från sessionStorage istället för anon-key (SB_KEY används bara
// som apikey-header för att passera Supabase Gateway). Vid 401 auto-logout.
function getAuthToken(): string {
  return sessionStorage.getItem("lager-token") || SB_KEY;
}

// Fas 3.4 (B9): Paginerad GET via PostgREST Range-headers.
// PostgREST default-limit är 1000 rader per request. För kollektioner
// som kan växa förbi det (material_items, material_history, ...) måste
// vi iterera. Stannar när sidan är mindre än pageSize ELLER när
// Content-Range visar att vi har alla rader. 416 = Range past end =
// inga fler rader (tyst exit).
async function sbPaged<T = unknown>(path: string, pageSize = 1000): Promise<T[]> {
  const token = getAuthToken();
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const end = offset + pageSize - 1;
    const r = await fetch(SB_URL + path, {
      headers: {
        "apikey": SB_KEY,
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "Range-Unit": "items",
        "Range": offset + "-" + end
      }
    });
    if (r.status === 401 && token !== SB_KEY && typeof logout === "function") {
      console.warn("Got 401 — session expired, logging out");
      logout();
      throw new Error("Session expired");
    }
    if (r.status === 416) return all; // past end — done
    if (!r.ok) throw new Error(await r.text());

    const text = await r.text();
    const page = (text ? JSON.parse(text) : []) as T[];
    all.push(...page);
    if (page.length < pageSize) return all;

    // Belt-and-suspenders: Content-Range tells us total
    const cr = r.headers.get("Content-Range"); // "0-999/15234" eller "0-999/*"
    if (cr) {
      const m = cr.match(/\/(\d+)$/);
      if (m && offset + page.length >= parseInt(m[1], 10)) return all;
    }
    offset += pageSize;
  }
}

async function sb<T = unknown>(path: string, opts: SbOptions = {}): Promise<T | null> {
  const token = getAuthToken();
  const r = await fetch(SB_URL + path, {
    ...opts,
    headers: {
      "apikey": SB_KEY,                       // alltid anon-key — krävs av Supabase Gateway
      "Authorization": "Bearer " + token,    // JWT om inloggad, annars anon-key
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "",
      ...(opts.headers || {})
    }
  });
  // Auto-logout vid 401 (utom på själva login-flödet)
  if (r.status === 401 && token !== SB_KEY && typeof logout === "function") {
    console.warn("Got 401 — session expired, logging out");
    logout();
    throw new Error("Session expired");
  }
  if (!r.ok && r.status !== 204) {
    const e = await r.text();
    throw new Error(e);
  }
  if (r.status === 204) return null;
  const text = await r.text();
  return text ? JSON.parse(text) as T : null;
}
