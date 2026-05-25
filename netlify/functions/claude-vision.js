// ============================================================
// netlify/functions/claude-vision.js
// Hårdlåst proxy för OCR-läsning via Claude Vision Haiku.
// Tillåter ALLA auth-users (inte bara admin) men begränsar:
//   - model = claude-haiku-4-5-20251001 (latest Haiku, hardcoded)
//   - max_tokens = 20 (siffran får vara ~6 tokens)
//   - prompt = hardcoded per "kind" (just nu bara "odometer")
//   - input = bara en bild (base64 ≤ 5 MB)
//
// Slipper därför ge alla användare tillgång till generella Claude-anrop
// (för kostnadskontroll). Vill man lägga till nya prompt-mallar
// (t.ex. kvitto-läsning) — lägg en ny kind här, INTE en parameter
// från klienten.
//
// Kräver miljövariabler i Netlify:
//   ANTHROPIC_API_KEY
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tzidalknfoumoknhsetx.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const ALLOWED_ORIGINS = [
  "https://lagerassistent.netlify.app",
  "http://localhost:5173",
  "http://localhost:8000",
];

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 20;
const MAX_IMG_BYTES = 5 * 1024 * 1024;     // 5 MB efter base64-decoding
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Prompt-mallar per kind. Lägg fler här när behov uppstår.
const PROMPTS = {
  odometer: "Detta är ett foto av en bils odometer/mätarställning. Returnera ENDAST hela kilometer-talet som visas, som ett rent heltal utan mellanslag, kommatecken eller enhet. Om bilden är oklar eller du inte ser ett tydligt nummer, svara exakt: OKLART",
};

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  };
}

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
  } catch {
    return null;
  }
}

exports.handler = async function (event) {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin) };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(origin), body: "Method Not Allowed" };
  }

  // Auth — vilken som helst inloggad användare räcker.
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "API-nyckel saknas" }),
    };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { kind, image_base64, media_type } = body || {};
  const prompt = PROMPTS[kind];
  if (!prompt) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Okänd 'kind': ${kind}` }),
    };
  }
  if (typeof image_base64 !== "string" || !image_base64.length) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "image_base64 saknas" }),
    };
  }
  if (!ALLOWED_MEDIA.includes(media_type)) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Otillåten media_type: ${media_type}` }),
    };
  }
  // Storleks-tak (base64 är ca 4/3 av binärt)
  if (image_base64.length * 0.75 > MAX_IMG_BYTES) {
    return {
      statusCode: 413,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Bilden är för stor (max 5 MB)" }),
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type, data: image_base64 } },
            { type: "text", text: prompt }
          ]
        }]
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        body: JSON.stringify({ error: data?.error?.message || "Claude-fel" }),
      };
    }
    const value = (data?.content?.[0]?.text || "").trim();
    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ value, kind }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Serverfel: " + err.message }),
    };
  }
};
