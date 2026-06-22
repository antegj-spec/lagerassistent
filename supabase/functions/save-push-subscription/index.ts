// ============================================================
// supabase/functions/save-push-subscription/index.ts  (Fas 6.1)
//
// Lagrar/raderar en push-subscription för inloggad användare.
// Validerar JWT via /auth/v1/user (samma mönster som send-weekly).
//
// Endpoint:
//   POST   /functions/v1/save-push-subscription
//     Body: { endpoint, p256dh, auth, user_agent? }
//     Returns: 200 { ok: true, id }
//
//   DELETE /functions/v1/save-push-subscription
//     Body: { endpoint }
//     Returns: 200 { ok: true }
//
//   401 { error: "Unauthorized" }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabase = createClient(SB_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ALLOWED_ORIGINS = [
  "https://lagerassistent.netlify.app",
  "http://localhost:5173",
  "http://localhost:8000",
];

function corsHeaders(origin: string | null) {
  const allow = origin && (ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+--lagerassistent\.netlify\.app$/.test(origin))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

async function getUserNameFromJwt(authHeader: string): Promise<string | null> {
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const r = await fetch(SB_URL + "/auth/v1/user", {
      headers: { apikey: ANON_KEY, Authorization: "Bearer " + token },
    });
    if (!r.ok) return null;
    const u = await r.json();
    // app_metadata (service-role-only), inte user_metadata (användarskrivbar). K1.
    return u?.app_metadata?.user_name || null;
  } catch (e) {
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const authHeader = req.headers.get("authorization") || "";
  const userName = await getUserNameFromJwt(authHeader);
  if (!userName) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const endpoint = String(body.endpoint || "");
  if (!endpoint) {
    return new Response(JSON.stringify({ error: "Missing endpoint" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  try {
    if (req.method === "DELETE") {
      await supabase
        .from("user_push_subscriptions")
        .delete()
        .eq("endpoint", endpoint)
        .eq("user_name", userName);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    // POST: upsert (endpoint är unique)
    const p256dh = String(body.p256dh || "");
    const auth = String(body.auth || "");
    const user_agent = body.user_agent ? String(body.user_agent) : null;

    if (!p256dh || !auth) {
      return new Response(JSON.stringify({ error: "Missing keys" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("user_push_subscriptions")
      .upsert(
        {
          user_name: userName,
          endpoint,
          p256dh,
          auth,
          user_agent,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      )
      .select("id")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      status: 200,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Server error" }),
      {
        status: 500,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      }
    );
  }
});
