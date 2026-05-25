// ============================================================
// supabase/functions/get-vapid-public-key/index.ts  (Fas 6.1)
//
// Returnerar VAPID public key så frontend kan starta en push-
// subscription. Public key är inte hemlig (det är hela poängen),
// så ingen auth-krav.
//
// Endpoint: GET /functions/v1/get-vapid-public-key
// Returns: 200 { key: "BL..." }
//          500 { error: "VAPID_PUBLIC_KEY ej konfigurerad" }
// ============================================================

const KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://lagerassistent.netlify.app",
  "http://localhost:5173",
  "http://localhost:8000",
];

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.some((o) => origin === o || /^https:\/\/[a-z0-9-]+--lagerassistent\.netlify\.app$/.test(origin))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve((req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (!KEY) {
    return new Response(
      JSON.stringify({ error: "VAPID_PUBLIC_KEY ej konfigurerad" }),
      {
        status: 500,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ key: KEY }), {
    status: 200,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
});
