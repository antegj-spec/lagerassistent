// ============================================================
// supabase/functions/verify-pin/index.ts
// Fas 1, steg 1.4 — säker PIN-verifiering med bcrypt + lockout
//
// Endpoint: POST /functions/v1/verify-pin
// Body:    { user_name: string, pin: string }
// Returns:
//   200 { access_token, refresh_token, user_name, role, expires_at }
//   400 { error: "Missing fields" }
//   401 { error: "Invalid credentials" }
//   429 { error: "Account locked", retry_after_seconds }
//   500 { error: "Server error" }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// bcryptjs är pure JS — kompatibel med PostgreSQL crypt(pwd, gen_salt('bf')).
// Tidigare deno.land/x/bcrypt hade kompatibilitetsbuggar.
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

// Service-role-klient (har full DB-access — används bara i denna funktion)
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const LOCKOUT_THRESHOLD = 5;     // antal fel innan lås
const LOCKOUT_MINUTES = 5;        // hur länge låst
const JWT_TTL_HOURS = 12;         // sessionens livslängd

// CORS — bara vår Netlify-domän
const ALLOWED_ORIGINS = [
  "https://lagerassistent.netlify.app",  // TODO: justera om din domän är annorlunda
  "http://localhost:5173",                // Vite dev (för Fas 2)
  "http://localhost:8000",                // Python http.server (nuvarande dev)
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Max-Age": "3600",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
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

  try {
    // 1. Slå upp användaren
    const { data: pinRow, error: pinErr } = await supabaseAdmin
      .from("user_pins")
      .select("user_name, pin_hash, failed_attempts, locked_until, migrated")
      .eq("user_name", userName)
      .maybeSingle();

    // Returnera ALLTID samma fel-svar för "okänd användare" och "fel PIN"
    // (förhindrar att angripare räkna ut giltiga användarnamn)
    if (pinErr || !pinRow) {
      // Sleep 200ms för att matcha bcrypt-tiden (timing-attack)
      await new Promise(r => setTimeout(r, 200));
      return json(401, { error: "Invalid credentials" }, origin);
    }

    // 2. Kolla lockout
    if (pinRow.locked_until && new Date(pinRow.locked_until) > new Date()) {
      const retryAfter = Math.ceil((new Date(pinRow.locked_until).getTime() - Date.now()) / 1000);
      return json(429, { error: "Account locked", retry_after_seconds: retryAfter }, origin);
    }

    // 3. Kolla att migration är gjord (om inte — något är fel)
    if (!pinRow.migrated || !pinRow.pin_hash) {
      console.error(`User ${userName} not migrated — kör migration 003_migrate_pins.sql`);
      return json(500, { error: "Server configuration error" }, origin);
    }

    // 4. bcrypt-jämför
    const valid = await bcrypt.compare(pin, pinRow.pin_hash);

    if (!valid) {
      // Räkna upp felförsök
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

      if (shouldLock) {
        return json(429, {
          error: "Account locked",
          retry_after_seconds: LOCKOUT_MINUTES * 60,
        }, origin);
      }
      return json(401, { error: "Invalid credentials" }, origin);
    }

    // 5. Slå upp role
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

    // 7. Skapa Supabase Auth session med user_metadata
    // Vi använder admin.createUser/signInWithPassword skulle kräva email/password.
    // Bättre: skapa eller hämta en deterministisk "pseudo-user" per user_name
    // och utfärda en session via admin.generateLink eller admin.createUser.
    //
    // SIMPLAST: signInAnonymously() + uppdatera user_metadata.
    // Anonymous users ger oss en auth.uid() vi kan bygga RLS på,
    // och user_metadata.user_name läses av current_user_name() i SQL.

    const { data: signInData, error: signInErr } = await supabaseAdmin.auth.signInAnonymously({
      options: {
        data: {
          user_name: userName,
          role: role,  // notera: source-of-truth är user_roles-tabellen, detta är cache
        }
      }
    });

    if (signInErr || !signInData?.session) {
      console.error("Anonymous signin failed:", signInErr);
      return json(500, { error: "Could not create session" }, origin);
    }

    return json(200, {
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_at: signInData.session.expires_at,
      user_name: userName,
      role: role,
    }, origin);

  } catch (e) {
    console.error("verify-pin unexpected error:", e);
    return json(500, { error: "Server error" }, origin);
  }
});
