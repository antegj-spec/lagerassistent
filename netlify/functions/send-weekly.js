// ============================================================
// netlify/functions/send-weekly.js
// Skickar veckosammanfattning som mail. Hämtar data, kör Claude, mailar via Resend.
//
// Fas 1.7: Kräver antingen
//   (A) JWT med role=admin via Authorization: Bearer (manuell trigger), eller
//   (B) header x-cron-secret som matchar env CRON_SECRET (cron-trigger)
//
// Fas 1.8 (B17): byter materials → materials_v2 + counts/items
//
// Env-vars i Netlify:
//   ANTHROPIC_API_KEY
//   RESEND_API_KEY
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY  (för att läsa data trots RLS)
//   CRON_SECRET                 (random sträng — för cron-trigger)
//   WEEKLY_MAIL                 (mottagar-adress)
// ============================================================

const SB_URL = process.env.SUPABASE_URL || "https://tzidalknfoumoknhsetx.supabase.co";
const SB_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ALLOWED_ORIGINS = [
  "https://lagerassistent.netlify.app",
  "http://localhost:8000",
];

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, x-cron-secret",
  };
}

const CATS = {
  reparation: { label: "Reparation", emoji: "🔧" },
  tvätt:      { label: "Tvätt",      emoji: "🧼" },
  logistik:   { label: "Logistik",   emoji: "🚛" },
  idé:        { label: "Idé",        emoji: "💡" },
  material:   { label: "Material",   emoji: "📦" },
  övrigt:     { label: "Övrigt",     emoji: "📋" },
};
const PRIOS = { hög: "HÖG", medel: "MEDEL", låg: "LÅG" };

// Använder service-key så vi bypassar RLS för att läsa all data
async function sbFetch(path) {
  const r = await fetch(SB_URL + path, {
    headers: {
      "apikey": SB_SERVICE_KEY,
      "Authorization": "Bearer " + SB_SERVICE_KEY,
    },
  });
  return r.json();
}

async function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const r = await fetch(SB_URL + "/auth/v1/user", {
      headers: { "apikey": SB_ANON_KEY, "Authorization": "Bearer " + token },
    });
    if (!r.ok) return false;
    const u = await r.json();
    return u?.user_metadata?.role === "admin";
  } catch (e) {
    return false;
  }
}

exports.handler = async function (event) {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin) };
  }

  // Auth: antingen admin-JWT eller cron-secret
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const cronSecret = event.headers["x-cron-secret"];

  const isAdmin = await verifyAdminToken(token);
  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  if (!isAdmin && !isCron) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  try {
    // Hämta data (B17 — använd materials_v2)
    const notesAll = await sbFetch("/rest/v1/notes?order=created_at.desc") || [];
    const notes = notesAll.filter(n => !n.deleted_at);
    const active = notes.filter(n => n.status !== "klar");

    const materialsAll = await sbFetch("/rest/v1/materials_v2?order=name.asc") || [];
    const materials = materialsAll.filter(m => !m.deleted_at);

    const allItems = await sbFetch("/rest/v1/material_items") || [];
    const allCounts = await sbFetch("/rest/v1/material_counts") || [];

    // Bygg material-summary i samma format som B16
    const materialLines = materials.map(m => {
      if (m.is_article_based) {
        const items = allItems.filter(i => i.material_id === m.id);
        const tillg = items.filter(i => i.status === "tillgänglig").length;
        const issues = items.filter(i => i.status === "reparation" || i.status === "tvätt").length;
        return `- ${m.name}: ${tillg}/${items.length} tillgängliga${issues ? `, ${issues} i åtgärd` : ""}`;
      } else {
        const c = {};
        allCounts.filter(x => x.material_id === m.id).forEach(x => { c[x.status] = x.count; });
        const total = m.total_count || 0;
        return `- ${m.name}: ${c.tillgänglig || 0}/${total} ${m.unit || "st"} tillgängliga` +
               `${c.uthyrd ? `, ${c.uthyrd} uthyrt` : ""}` +
               `${c.reparation ? `, ${c.reparation} reparation` : ""}`;
      }
    });

    const prompt = `Du är assistent för en lagerchef på ett eventlager i Sverige. Skapa en strukturerad veckosammanfattning på svenska av dessa anteckningar och materialstatus, strukturerad per kategori. Avsluta med 3 konkreta åtgärdsförslag för veckan.

Aktiva anteckningar:
${active.map(n => `- [${CATS[n.category]?.label || n.category}][${PRIOS[n.priority] || n.priority}] ${n.text}${n.assigned_to ? ` → @${n.assigned_to}` : ""} (av ${n.created_by})`).join("\n") || "Inga aktiva anteckningar"}

Material:
${materialLines.join("\n") || "Inget materialregister"}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const summary = aiData.content?.[0]?.text || "Kunde inte generera sammanfattning.";

    const now = new Date().toLocaleDateString("sv-SE", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const htmlBody = `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><style>
body{font-family:monospace;background:#0D0F14;color:#F0EDE8;padding:30px;max-width:600px;margin:0 auto}
h1{color:#E8521A;font-size:28px;margin-bottom:4px}
.sub{color:#E8521A;font-size:11px;letter-spacing:3px;margin-bottom:24px}
.summary{background:#13161E;border:1px solid #252836;border-radius:10px;padding:20px;white-space:pre-wrap;line-height:1.8;font-size:13px}
.footer{color:#6B7280;font-size:11px;margin-top:20px}
</style></head>
<body>
<h1>LAGERASSISTENT</h1>
<div class="sub">VECKOSAMMANFATTNING — ${now.toUpperCase()}</div>
<div class="summary">${summary.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
<div class="footer">Skickat automatiskt från Lagerassistent varje måndag 07:00</div>
</body>
</html>`;

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Lagerassistent <onboarding@resend.dev>",
        to: [process.env.WEEKLY_MAIL || "andreas.glad@eps.net"],
        subject: `📋 Veckosammanfattning Lager — ${now}`,
        html: htmlBody,
      }),
    });

    const mailData = await mailRes.json();

    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, mail: mailData, preview: summary.substring(0, 200) }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
