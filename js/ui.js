// ============================================================
// ui.js — Hjälpfunktioner, modal, toast, init, tabbar
// Beror på: config.js, supabase.js
// ============================================================

// ---- XSS-SKYDD ----
// Används ALLTID när användardata skrivs ut i HTML
function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escAttr(s) {
  return esc(s).replace(/`/g, "&#96;");
}

// ---- DATUM-FORMATERING ----
function fmtD(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function fmtDateOnly(iso) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    day: "numeric", month: "short", year: "numeric"
  });
}

// ---- AUTO-KLASSIFICERING ----
function classifyCat(t) {
  const s = t.toLowerCase();
  if (s.match(/trasig|reparera|laga|skada|defekt|bruten|fix|sliten/)) return "reparation";
  if (s.match(/tvätt|smuts|rengör|disk|städ/)) return "tvätt";
  if (s.match(/kör|transport|leverans|hämta|lämna|order|kund/)) return "logistik";
  if (s.match(/material|golv|kravall|kabel|staket|platta|matta|skydd/)) return "material";
  if (s.match(/idé|förslag|borde|kanske|förbättr/)) return "idé";
  return "övrigt";
}

function classifyPrio(t) {
  const s = t.toLowerCase();
  if (s.match(/brådskande|akut|direkt|omgående|viktigt/)) return "hög";
  if (s.match(/snart|denna vecka|snabbt/)) return "medel";
  return "låg";
}

// ---- DEADLINE-HJÄLPARE ----
function deadlineStatus(deadline) {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl - now;
  const hours = diff / 3600000;
  if (diff < 0) return "overdue";
  if (hours < 24) return "urgent";
  if (hours < 72) return "soon";
  return "ok";
}

function deadlineLabel(deadline) {
  if (!deadline) return "";
  const dl = new Date(deadline);
  const now = new Date();
  const diff = dl - now;
  if (diff < 0) {
    const h = Math.abs(Math.round(diff / 3600000));
    if (h < 24) return `⏰ Förfallen för ${h}h sedan`;
    return `⏰ Förfallen ${dl.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}`;
  }
  const h = Math.round(diff / 3600000);
  if (h < 1) return "⚡ Förfaller inom 1h";
  if (h < 24) return `⚡ Förfaller om ${h}h`;
  const days = Math.round(diff / 86400000);
  if (days < 1) return "⚡ Förfaller idag";
  return `📅 Deadline ${dl.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}`;
}

function deadlineBadgeClass(status) {
  if (status === "overdue") return "deadline-badge deadline-overdue";
  if (status === "urgent")  return "deadline-badge deadline-urgent";
  if (status === "soon")    return "deadline-badge deadline-soon";
  return "deadline-badge deadline-ok";
}

function updDeadlineWarnings() {
  const urgent = notes.filter(n =>
    n.status !== "klar" && n.deadline &&
    (deadlineStatus(n.deadline) === "urgent" || deadlineStatus(n.deadline) === "overdue")
  );
  const el = document.getElementById("header-deadline-warn");
  if (!el) return;
  if (!urgent.length) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="hdr-deadline-warn hdr-deadline-urgent">⏰ ${urgent.length} anteckning${urgent.length > 1 ? "ar" : ""} med brådskande deadline!</div>`;
}

// ---- HEADER-META ----
function updMeta() {
  const a = notes.filter(n => n.status !== "klar").length;
  const at = tasks.filter(t => t.status !== "klar").length;
  document.getElementById("header-meta").textContent =
    `${notes.length} anteckningar · ${a} aktiva · ${materials.length} material · ${at} uppgifter`;
  updDeadlineWarnings();
}

// ---- TOAST (popup-meddelanden) ----
function toast(msg, err = 0, actionLabel = null, actionFn = null) {
  const el = document.getElementById("toast");
  const safeMsg = esc(msg);
  if (actionLabel && actionFn) {
    el.innerHTML = `<span>${safeMsg}</span><button id="toast-action">${esc(actionLabel)}</button>`;
    setTimeout(() => {
      const btn = document.getElementById("toast-action");
      if (btn) btn.onclick = () => { actionFn(); el.className = ""; };
    }, 20);
  } else {
    el.textContent = msg;
  }
  el.className = "show" + (err ? " err" : "");
  clearTimeout(window._tt);
  window._tt = setTimeout(() => el.className = "", actionLabel ? 5500 : 2200);
}

// ---- MODAL ----
function openModal(html) {
  document.getElementById("modal-container").innerHTML =
    `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
}
function closeModal() {
  document.getElementById("modal-container").innerHTML = "";
}

// ---- INIT & TABS ----
async function initApp() {
  document.getElementById("main").innerHTML =
    `<div class="empty"><div class="spinner"></div> Laddar...</div>`;
  await Promise.all([loadNotes(), loadMats(), loadReturns(), loadTasks(), loadInfoArticles(), loadActionComments()]);
  updMeta();
  render();
}

function showTab(t) {
  // Blockera AI-fliken för icke-admin
  if (t === "chat" && !isAdmin) {
    toast("AI-fliken är endast tillgänglig för Admin", 1);
    return;
  }
  tab = t;
  openId = null;
  openMatId = null;
  openTaskId = null;
  imgData = null;
  imgFile = null;
  searchQuery = "";
  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
  const tabs = ["hem", "anteckningar", "material", "plan", "info", "chat", "export", "trash"];
  document.querySelectorAll("nav button")[tabs.indexOf(t)]?.classList.add("active");
  render();
}

// ---- SUB-TABS för Material ----
async function setMatSubTab(t) {
  matSubTab = t;
  openMatId = null;
  openItemId = null;
  if (t === "åtgärder") await loadActionComments();
  render();
}

// ---- SUB-TABS för Plan ----
function setPlanSubTab(t) {
  planSubTab = t;
  openTaskId = null;
  render();
}

// ---- SÖK ----
function setSearch(v) {
  searchQuery = v;
  const m = document.getElementById("main");
  if (!m) return;
  const pos = document.activeElement === document.getElementById("search-input")
    ? document.getElementById("search-input").selectionStart
    : null;
  m.innerHTML = rNotes();
  if (pos !== null) {
    const inp = document.getElementById("search-input");
    if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
  }
  bindEvents();
}

function clearSearch() {
  searchQuery = "";
  render();
}

// ---- BIND EVENTS (körs efter varje render) ----
function bindEvents() {
  const ni = document.getElementById("note-input");
  if (ni) {
    ni.addEventListener("input", () => {
      const c = document.getElementById("note-cat");
      const p = document.getElementById("note-prio");
      if (c) c.value = classifyCat(ni.value);
      if (p) p.value = classifyPrio(ni.value);
    });
  }
}

// ---- BILDHANTERING ----
function handleImg(inp) {
  const f = inp.files[0];
  if (!f) return;
  imgFile = f;
  const fr = new FileReader();
  fr.onload = e => {
    imgData = e.target.result;
    const area = document.querySelector(".img-upload-area");
    if (area) area.innerHTML = `<img class="img-preview" src="${imgData}">`;
  };
  fr.readAsDataURL(f);
}

// ---- KOPIERA TEXT ----
function copyTxt(txt) {
  navigator.clipboard.writeText(txt).then(() => toast("✓ Kopierat!")).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast("✓ Kopierat!");
  });
}

function copyExport() {
  const txt = document.getElementById("export-text")?.textContent;
  copyTxt(txt);
}

// ---- FILTER ----
function setFC(c) { fCat = c; render(); }
function setFS(s) { fStat = s; render(); }
function setFA(a) { fAssigned = a; render(); }

// ---- VECKOSAMANFATTNING VIA MAIL ----
async function sendWeeklyNow() {
  const mailEl = document.getElementById("weekly-mail-input");
  const mail = mailEl?.value?.trim();
  if (!mail) { toast("Ange en e-postadress", 1); return; }
  toast("Skickar...");
  try {
    const r = await fetch("/.netlify/functions/send-weekly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: mail })
    });
    const d = await r.json();
    if (d.ok) toast("✓ Sammanfattning skickad till " + mail);
    else toast("Kunde inte skicka mail", 1);
  } catch (e) {
    toast("Kunde inte skicka mail", 1);
  }
}

// ---- AI-SAMMANFATTNING ----
async function aiSum() {
  const btn = document.getElementById("ai-sum-btn");
  if (btn) btn.disabled = true;
  const box = document.getElementById("ai-box");
  if (box) box.innerHTML = `<div class="card"><div class="spinner"></div> Genererar...</div>`;
  const active = notes.filter(n => n.status !== "klar");
  const prompt = `Du är assistent för en lagerchef på ett eventlager. Skapa en strukturerad sammanfattning på svenska per kategori av dessa anteckningar och materialstatus, redo att klistra in i OneNote. Avsluta med 3 konkreta åtgärdsförslag.\n\nAnteckningar:\n${
    active.map(n =>
      `- [${CATS[n.category]?.label}][${PRIOS[n.priority]?.label}] ${n.text}${n.assigned_to ? ` → @${n.assigned_to}` : ""} (${n.created_by})${n.deadline ? ` [Deadline: ${deadlineLabel(n.deadline)}]` : ""}`
    ).join("\n")
  }\n\nMaterial:\n${
    materials.map(m => `- ${m.name}: ${m.good} ok, ${m.defective} defekta av ${m.total}`).join("\n")
  }`;
  try {
    const r = await fetch("/.netlify/functions/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const d = await r.json();
    const reply = d.content?.[0]?.text || "Kunde inte generera.";
    if (box) {
      const safeReply = esc(reply);
      box.innerHTML = `<div class="card"><div class="lbl">AI-SAMMANFATTNING</div><div id="ai-text" style="font-size:12px;line-height:1.8;white-space:pre-wrap">${safeReply}</div><button class="btn btn-green mt" style="width:100%" onclick="copyTxt(document.getElementById('ai-text').textContent)">📋 KOPIERA</button></div>`;
    }
  } catch (e) {
    if (box) box.innerHTML = `<div class="card" style="color:var(--accent)">Kunde inte generera. Försök igen.</div>`;
  }
  if (btn) btn.disabled = false;
}

// ---- AI-CHATT ----
function setQ(q) {
  const el = document.getElementById("chat-input");
  if (el) el.value = q;
}

async function sendChat() {
  const inp = document.getElementById("chat-input");
  const text = inp?.value?.trim();
  if (!text || loading) return;
  inp.value = "";
  chat.push({ role: "user", content: text });
  loading = true;
  render();
  setTimeout(() => {
    const b = document.getElementById("chat-box");
    if (b) b.scrollTop = b.scrollHeight;
  }, 50);
  const active = notes.filter(n => n.status !== "klar");
  const sys = `Du är AI-assistent för en lagerchef på ett eventlager i Sverige. Lagret hyr ut golvplattor, kravallstaket och kabelskydd. Teamet är ${USERS.length - 1} personer (${USERS.filter(u => u !== "Admin").join(", ")}).\n\nAktiva anteckningar:\n${
    active.map(n =>
      `- [${CATS[n.category]?.label}][${PRIOS[n.priority]?.label}] ${n.text}${n.assigned_to ? ` → @${n.assigned_to}` : ""} (av ${n.created_by})${n.deadline ? ` [Deadline: ${deadlineLabel(n.deadline)}]` : ""}`
    ).join("\n") || "Inga"
  }\n\nMaterial:\n${
    materials.map(m => `- ${m.name}: ${m.good} ok, ${m.defective} defekta av ${m.total}`).join("\n") || "Inget register"
  }\n\nSvara på svenska. Var konkret och praktisk.`;
  try {
    const r = await fetch("/.netlify/functions/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: sys,
        messages: chat.map(m => ({ role: m.role, content: m.content }))
      })
    });
    const d = await r.json();
    chat.push({ role: "assistant", content: d.content?.[0]?.text || "Kunde inte svara." });
  } catch (e) {
    chat.push({ role: "assistant", content: "Något gick fel. Kontrollera anslutning." });
  }
  loading = false;
  render();
  setTimeout(() => {
    const b = document.getElementById("chat-box");
    if (b) b.scrollTop = b.scrollHeight;
  }, 50);
}
