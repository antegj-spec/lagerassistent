// ============================================================
// supabase/functions/change-pin/index.ts
// Fas 1, steg 1.6 — säker PIN-byte med bcrypt
//
// Endpoint: POST /functions/v1/change-pin
// Headers:  Authorization: Bearer <jwt> (krävs)
// Body:     { current_pin: string, new_pin: string }
// Returns:
//   200 { ok: true }
//   400 { error: "Missing fields" }
//   401 { error: "Invalid current PIN" | "Unauthorized" }
//   500 { error: "Server error" }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// bcryptjs istället för deno.land/x/bcrypt — bättre PostgreSQL-kompatibilitet
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED_ORIGINS = [
  "https://lagerassistent.netlify.app",
  "http://localhost:5173",
  "http://localhost:8000",
  "http://localhost:3000",
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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" }, origin);
  }

  // 1. Verifiera JWT från klienten — vem är det som vill byta PIN?
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^bearer\s+/i, "").trim();
  if (!token) {
    return json(401, { error: "Unauthorized" }, origin);
  }

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) {
    return json(401, { error: "Unauthorized" }, origin);
  }

  const userName = (user.user_metadata?.user_name as string | undefined)?.trim();
  if (!userName) {
    return json(401, { error: "Unauthorized — no user_name claim" }, origin);
  }

  // 2. Parse body
  let body: { current_pin?: string; new_pin?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" }, origin);
  }

  const currentPin = (body.current_pin ?? "").trim();
  const newPin = (body.new_pin ?? "").trim();

  if (!currentPin || !newPin || !/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
    return json(400, { error: "PIN must be 4 digits" }, origin);
  }

  if (currentPin === newPin) {
    return json(400, { error: "New PIN must differ from current" }, origin);
  }

  try {
    // 3. Hämta nuvarande hash
    const { data: pinRow } = await supabaseAdmin
      .from("user_pins")
      .select("pin_hash")
      .eq("user_name", userName)
      .maybeSingle();

    if (!pinRow?.pin_hash) {
      return json(500, { error: "User not configured" }, origin);
    }

    // 4. Verifiera current PIN
    const valid = await bcrypt.compare(currentPin, pinRow.pin_hash);
    if (!valid) {
      return json(401, { error: "Invalid current PIN" }, origin);
    }

    // 5. Hasha + spara ny PIN
    const newHash = await bcrypt.hash(newPin, await bcrypt.genSalt(10));
    await supabaseAdmin
      .from("user_pins")
      .update({ pin_hash: newHash, pin_set: true, updated_at: new Date().toISOString() })
      .eq("user_name", userName);

    return json(200, { ok: true }, origin);

  } catch (e) {
    console.error("change-pin unexpected error:", e);
    return json(500, { error: "Server error" }, origin);
  }
});
