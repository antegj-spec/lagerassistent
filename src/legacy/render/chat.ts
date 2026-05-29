// ============================================================
// render/chat.ts — AI-CHAT (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// CHATT-FLIKEN
// ============================================================
function rChat(): string {
  const msgs = chat.list.map(m =>
    `<div class="chat-msg ${m.role}">
      <div class="chat-bubble ${m.role === "user" ? "user" : "ai"}">${esc(m.content)}</div>
    </div>`
  ).join("");

  return `
<div class="chat-box" id="chat-box">
  ${chat.list.length === 0
    ? `<div class="chat-empty">Ställ en fråga om lagret, materialet eller arbetet.<br><br><span style="color:var(--dim)">T.ex. "Vad ska jag prioritera idag?" eller "Tips för kravallstaket?"</span></div>`
    : msgs + (ui.loading ? `<div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>` : "")
  }
</div>
<div class="chat-row">
  <input type="text" id="chat-input" placeholder="Skriv en fråga..." onkeydown="if(event.key==='Enter')sendChat()">
  <button class="btn" onclick="sendChat()" ${ui.loading ? "disabled" : ""}>→</button>
</div>
<div class="quick-qs">
  <div class="lbl" style="margin-top:12px">SNABBFRÅGOR</div>
  ${[
    "Vad bör jag prioritera idag?",
    "Tips för reparation av kravallstaket",
    "Hur lagrar man golvplattor rätt?",
    "Ge mig en veckosammanfattning",
    "Hur rengör man kabelskydd effektivt?"
  ].map(q => `<button class="quick-q" onclick="setQ('${escAttr(q)}')">${esc(q)}</button>`).join("")}
</div>`;
}
