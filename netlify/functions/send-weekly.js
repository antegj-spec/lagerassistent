const SB_URL = "https://tzidalknfoumoknhsetx.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6aWRhbGtuZm91bW9rbmhzZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTE1NjgsImV4cCI6MjA5Mjk2NzU2OH0.bqyMhiCK34gws-WKyYH0zBKAPPytywMJMuA9fL3-4cY";

const CATS = {
  reparation: { label: "Reparation", emoji: "🔧" },
  tvätt: { label: "Tvätt", emoji: "🧼" },
  logistik: { label: "Logistik", emoji: "🚛" },
  idé: { label: "Idé", emoji: "💡" },
  material: { label: "Material", emoji: "📦" },
  övrigt: { label: "Övrigt", emoji: "📋" }
};

const PRIOS = { hög: "HÖG", medel: "MEDEL", låg: "LÅG" };

async function sbFetch(path) {
  const r = await fetch(SB_URL + path, {
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY
    }
  });
  return r.json();
}

exports.handler = async function(event) {
  // Allow manual trigger via POST or scheduled trigger
  try {
    const notes = (await sbFetch("/rest/v1/notes?order=created_at.desc") || []).filter(n => !n.deleted_at);
    const materials = (await sbFetch("/rest/v1/materials?order=name.asc") || []).filter(m => !m.deleted_at);
    const active = notes.filter(n => n.status !== "klar");

    // Build prompt for AI summary
    const prompt = `Du är assistent för en lagerchef på ett eventlager i Sverige. Skapa en strukturerad veckosammanfattning på svenska av dessa anteckningar och materialstatus, strukturerad per kategori. Avsluta med 3 konkreta åtgärdsförslag för veckan.\n\nAktiva anteckningar:\n${active.map(n => `- [${CATS[n.category]?.label || n.category}][${PRIOS[n.priority] || n.priority}] ${n.text}${n.assigned_to ? ` → @${n.assigned_to}` : ""} (av ${n.created_by})`).join("\n") || "Inga aktiva anteckningar"}\n\nMaterial:\n${materials.map(m => `- ${m.name}: ${m.good} ok, ${m.defective} defekta av ${m.total}`).join("\n") || "Inget materialregister"}`;

    // Get AI summary
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const aiData = await aiRes.json();
    const summary = aiData.content?.[0]?.text || "Kunde inte generera sammanfattning.";

    // Format as HTML email
    const now = new Date().toLocaleDateString("sv-SE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
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
<div class="summary">${summary.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
<div class="footer">Skickat automatiskt från Lagerassistent varje måndag 07:00</div>
</body>
</html>`;

    // Send via Resend
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from: "Lagerassistent <onboarding@resend.dev>",
        to: [process.env.WEEKLY_MAIL || "andreas.glad@eps.net"],
        subject: `📋 Veckosammanfattning Lager — ${now}`,
        html: htmlBody
      })
    });

    const mailData = await mailRes.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, mail: mailData, preview: summary.substring(0, 200) })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
