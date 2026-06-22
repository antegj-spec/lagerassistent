// ============================================================
// netlify/functions/claude.js
// Serverless function — hanterar Claude API-anrop säkert.
// API-nyckeln hålls på servern, aldrig synlig för användaren.
//
// Fas 1.7: kräver JWT med role=admin (verifieras via Supabase Auth)
// + CORS-check på Origin.
//
// Kräver miljövariabler i Netlify:
//   ANTHROPIC_API_KEY
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tzidalknfoumoknhsetx.supabase.co";
// Anon-key är avsiktligt publik (RLS skyddar data server-side).
// Hårdkodad fallback speglar config.ts — om env-var saknas i Netlify funkar auth ändå.
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6aWRhbGtuZm91bW9rbmhzZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTE1NjgsImV4cCI6MjA5Mjk2NzU2OH0.bqyMhiCK34gws-WKyYH0zBKAPPytywMJMuA9fL3-4cY";

const ALLOWED_ORIGINS = [
  "https://lagerassistent.netlify.app",
  "http://localhost:5173",
  "http://localhost:8000",
];

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  };
}

// Verifiera JWT mot Supabase. Returnerar user-object eller null.
async function verifyToken(token) {
  if (!token) return null;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + token,
      },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

exports.handler = async function (event) {
  const origin = event.headers.origin || event.headers.Origin;

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(origin), body: "Method Not Allowed" };
  }

  // Auth check — kräver JWT
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const userObj = await verifyToken(token);

  if (!userObj) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  // Bara admin får använda AI (för kostnad-kontroll).
  // Läs roll ur app_metadata (service-role-only), inte user_metadata
  // (användarskrivbar → annars trivial admin-eskalering). Säkerhetshärdning K1.
  const role = userObj?.app_metadata?.role;
  if (role !== "admin") {
    return {
      statusCode: 403,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Admin required for AI features" }),
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "API-nyckel saknas. Kontakta Admin." }),
    };
  }

  try {
    // H2-härdning: vidarebefordra INTE klientens body rakt av (det vore en
    // oavkortad proxy till Anthropic — obegränsad modell/kostnad om en
    // admin-JWT läcker). Bygg en saniterad förfrågan: tillåten modell-allowlist,
    // tak på max_tokens, och bara kända fält skickas vidare.
    const raw = JSON.parse(event.body) || {};

    const MODEL_ALLOWLIST = ["claude-sonnet-4-5"]; // lägg till nytt id vid modellbyte
    const MAX_TOKENS_CAP = 2000;

    const model = MODEL_ALLOWLIST.includes(raw.model) ? raw.model : MODEL_ALLOWLIST[0];
    const max_tokens = Math.min(
      Number.isFinite(raw.max_tokens) ? raw.max_tokens : MAX_TOKENS_CAP,
      MAX_TOKENS_CAP,
    );

    if (!Array.isArray(raw.messages) || raw.messages.length === 0) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        body: JSON.stringify({ error: "messages krävs" }),
      };
    }

    const payload = { model, max_tokens, messages: raw.messages };
    if (typeof raw.system === "string") payload.system = raw.system;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return {
      statusCode: response.status,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Serverfel: " + err.message }),
    };
  }
};
