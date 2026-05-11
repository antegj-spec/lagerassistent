// ============================================================
// netlify/functions/claude.js
// Serverless function — hanterar Claude API-anrop säkert.
// API-nyckeln hålls på servern, aldrig synlig för användaren.
//
// Kräver miljövariabel i Netlify:
//   ANTHROPIC_API_KEY = din Claude API-nyckel
// ============================================================

exports.handler = async function (event) {
  // Tillåt bara POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API-nyckel saknas. Kontakta Admin." })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Serverfel: " + err.message })
    };
  }
};
