// ============================================================
// netlify/functions/geocode.js
// Reverse-geocoding proxy mot Google Maps Geocoding API.
// Tar lat/lng → returnerar formaterad adress.
//
// API-nyckeln hålls på servern. Alla auth-users får anropa.
//
// Kräver miljövariabler i Netlify:
//   GOOGLE_MAPS_API_KEY     — Geocoding API enabled, helst med HTTP
//                             referrer-restriktion till netlify-domänen
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

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "GOOGLE_MAPS_API_KEY saknas i Netlify env" }),
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

  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Ogiltiga koordinater" }),
    };
  }

  try {
    const url = "https://maps.googleapis.com/maps/api/geocode/json"
      + `?latlng=${lat},${lng}`
      + `&language=sv`
      + `&result_type=street_address|premise|route|locality`
      + `&key=${apiKey}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.status !== "OK" || !data.results?.length) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.error_message || data.status || "Ingen träff", address: null }),
      };
    }
    const first = data.results[0];
    // Försök plocka ut snyggare "kort" adress: gatan + ort.
    const components = first.address_components || [];
    const get = (type) => components.find(c => c.types.includes(type))?.long_name;
    const street = get("route");
    const num = get("street_number");
    const city = get("postal_town") || get("locality");
    let short = "";
    if (street) short = num ? `${street} ${num}` : street;
    if (city) short = short ? `${short}, ${city}` : city;

    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({
        address: short || first.formatted_address,
        full: first.formatted_address,
        city: city || null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Serverfel: " + err.message }),
    };
  }
};
