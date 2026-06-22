// ============================================================
// supabase/functions/verify-pin/index.ts
// Fas 1, steg 1.4 — säker PIN-verifiering med bcrypt + lockout
//
// Säkerhetshärdning (K1 + H3):
//  K1) Identiteten skrivs till APP_METADATA (service-role-only), inte bara
//      user_metadata. RLS-helpern current_user_name() läser app_metadata
//      (migration 032), vilket gör identiteten omöjlig att förfalska från
//      klienten. user_metadata sätts fortfarande parallellt under övergången
//      (bakåtkompatibilitet tills helpern flippats + alla loggat om).
//  H3) Per-IP rate limiting via login_attempts-tabellen (migration 033) —
//      stoppar brute-force som sprids över flera konton från samma IP.
//
// Endpoint: POST /functions/v1/verify-pin
// Body:    { user_name: string, pin: string }
// Returns:
//   200 { access_token, refresh_token, user_name, role, expires_at }
//   400 { error: "Missing fields" }
//   401 { error: "Invalid credentials" }
//   429 { error: "Account locked" | "Too many attempts", retry_after_seconds }
//   500 { error: "Server error" }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// bcryptjs är pure JS — kompatibel med PostgreSQL crypt(pwd, gen_salt('bf')).
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Service-role-klient (full DB-access — används bara i denna funktion)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const LOCKOUT_THRESHOLD = 5;     // antal fel innan konto-lås
const LOCKOUT_MINUTES = 5;        // hur länge konto låst

// Per-IP-throttling (H3)
const IP_THRESHOLD = 30;          // max försök per IP i fönstret
const IP_WINDOW_MIN = 15;         // fönsterlängd i minuter

// CORS — produktion + lokala dev-portar + Netlify deploy-previews
const ALLOWED_ORIGINS = [
  "https://lagerassistent.netlify.app",
  "http://localhost:5173",                // Vite (Fas 2)
  "http://localhost:8000",                // python -m http.server
  "http://localhost:3000",                // npx serve default
];
const PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+--lagerassistent\.netlify\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin) || PREVIEW_PATTERN.test(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey",
    "Access-Control-Max-Age": "3600",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

// Klient-IP ur x-forwarded-for (första hoppet). "unknown" om saknas.
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0]?.trim();
  return first || "unknown";
}

// Loggar ett inloggningsförsök (best-effort — får aldrig blocka login-flödet).
async function recordAttempt(ip: string, userName: string, success: boolean): Promise<void> {
  try {
    await supabaseAdmin.from("login_attempts").insert({ ip, user_name: userName, success });
  } catch (_) { /* swallow */ }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" }, origin);
  }

  let body: { user_name?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" }, origin);
  }

  const userName = (body.user_name ?? "").trim();
  const pin = (body.pin ?? "").trim();

  if (!userName || !pin || !/^\d{4}$/.test(pin)) {
    return json(400, { error: "Missing or invalid fields" }, origin);
  }

  const ip = clientIp(req);

  try {
    // 0. Per-IP throttling (H3) — räkna försök i fönstret, blocka om för många.
    const windowStart = new Date(Date.now() - IP_WINDOW_MIN * 60_000).toISOString();
    const { count: ipCount } = await supabaseAdmin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("attempted_at", windowStart);

    if ((ipCount ?? 0) >= IP_THRESHOLD) {
      return json(429, {
        error: "Too many attempts",
        retry_after_seconds: IP_WINDOW_MIN * 60,
      }, origin);
    }

    // Best-effort: städa rader äldre än 1h (håller tabellen liten).
    supabaseAdmin
      .from("login_attempts")
      .delete()
      .lt("attempted_at", new Date(Date.now() - 3_600_000).toISOString())
      .then(() => {}, () => {});

    // 1. Slå upp användaren
    const { data: pinRow, error: pinErr } = await supabaseAdmin
      .from("user_pins")
      .select("user_name, pin_hash, failed_attempts, locked_until, migrated")
      .eq("user_name", userName)
      .maybeSingle();

    // Returnera ALLTID samma fel-svar för "okänd användare" och "fel PIN"
    // (förhindrar att angripare räknar ut giltiga användarnamn)
    if (pinErr || !pinRow) {
      await new Promise(r => setTimeout(r, 200)); // matcha bcrypt-tiden (timing)
      await recordAttempt(ip, userName, false);
      return json(401, { error: "Invalid credentials" }, origin);
    }

    // 2. Kolla konto-lockout
    if (pinRow.locked_until && new Date(pinRow.locked_until) > new Date()) {
      const retryAfter = Math.ceil((new Date(pinRow.locked_until).getTime() - Date.now()) / 1000);
      await recordAttempt(ip, userName, false);
      return json(429, { error: "Account locked", retry_after_seconds: retryAfter }, origin);
    }

    // 3. Kolla att migration är gjord
    if (!pinRow.migrated || !pinRow.pin_hash) {
      console.error(`User ${userName} not migrated — kör migration 003_migrate_pins.sql`);
      return json(500, { error: "Server configuration error" }, origin);
    }

    // 4. bcrypt-jämför
    const valid = await bcrypt.compare(pin, pinRow.pin_hash);

    if (!valid) {
      const newAttempts = pinRow.failed_attempts + 1;
      const shouldLock = newAttempts >= LOCKOUT_THRESHOLD;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
        : null;

      await supabaseAdmin
        .from("user_pins")
        .update({
          failed_attempts: shouldLock ? 0 : newAttempts,  // reset vid lås
          locked_until: lockedUntil,
        })
        .eq("user_name", userName);

      await recordAttempt(ip, userName, false);

      if (shouldLock) {
        return json(429, {
          error: "Account locked",
          retry_after_seconds: LOCKOUT_MINUTES * 60,
        }, origin);
      }
      return json(401, { error: "Invalid credentials" }, origin);
    }

    // 5. Slå upp role (source-of-truth = user_roles-tabellen)
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_name", userName)
      .maybeSingle();
    const role = roleRow?.role ?? "user";

    // 6. Reset failed_attempts + locked_until
    await supabaseAdmin
      .from("user_pins")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("user_name", userName);

    // 7. Skapa anonym session. user_metadata sätts för bakåtkompatibilitet
    //    under övergången; den AUKTORITATIVA identiteten skrivs i steg 8.
    const { data: signInData, error: signInErr } = await supabaseAdmin.auth.signInAnonymously({
      options: { data: { user_name: userName, role } },
    });

    if (signInErr || !signInData?.session?.user) {
      console.error("Anonymous signin failed:", signInErr);
      return json(500, { error: "Could not create session" }, origin);
    }

    // 8. Skriv identiteten till APP_METADATA (kan ej ändras av användaren).
    //    Detta är källan current_user_name() läser efter migration 032.
    const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(
      signInData.session.user.id,
      { app_metadata: { user_name: userName, role } },
    );
    if (metaErr) {
      console.error("Could not set app_metadata:", metaErr);
      return json(500, { error: "Could not finalize session" }, origin);
    }

    // 9. Den token som signInAnonymously gav saknar fortfarande app_metadata
    //    (mintades innan steg 8). Växla refresh_token mot en FÄRSK token som
    //    bär app_metadata-claimen.
    const refRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "content-type": "application/json", "apikey": ANON_KEY },
      body: JSON.stringify({ refresh_token: signInData.session.refresh_token }),
    });
    const refreshed = await refRes.json().catch(() => null);

    if (!refRes.ok || !refreshed?.access_token) {
      console.error("Token refresh failed:", refreshed);
      return json(500, { error: "Could not finalize session" }, origin);
    }

    await recordAttempt(ip, userName, true);

    return json(200, {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
      user_name: userName,
      role: role,
    }, origin);

  } catch (e) {
    console.error("verify-pin unexpected error:", e);
    return json(500, { error: "Server error" }, origin);
  }
});
