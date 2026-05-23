// ============================================================
// ui.ts — Hjälpfunktioner, modal, toast, init, tabbar
// Beror på: config.ts, supabase.ts
// ============================================================

// ---- XSS-SKYDD ----
// Används ALLTID när användardata skrivs ut i HTML
function esc(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escAttr(s: unknown): string {
  return esc(s).replace(/`/g, "&#96;");
}

// ---- DATUM-FORMATERING ----
function fmtD(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function fmtDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", {
    day: "numeric", month: "short", year: "numeric"
  });
}

// ---- AUTO-KLASSIFICERING ----
function classifyCat(t: string): Category {
  const s = t.toLowerCase();
  if (s.match(/trasig|reparera|laga|skada|defekt|bruten|fix|sliten/)) return "reparation";
  if (s.match(/tvätt|smuts|rengör|disk|städ/)) return "tvätt";
  if (s.match(/kör|transport|leverans|hämta|lämna|order|kund/)) return "logistik";
  if (s.match(/material|golv|kravall|kabel|staket|platta|matta|skydd/)) return "material";
  if (s.match(/idé|förslag|borde|kanske|förbättr/)) return "idé";
  return "övrigt";
}

function classifyPrio(t: string): Priority {
  const s = t.toLowerCase();
  if (s.match(/brådskande|akut|direkt|omgående|viktigt/)) return "hög";
  if (s.match(/snart|denna vecka|snabbt/)) return "medel";
  return "låg";
}

// ---- DEADLINE-HJÄLPARE ----
type DeadlineSeverity = "overdue" | "urgent" | "soon" | "ok";

function deadlineStatus(deadline: string | null | undefined): DeadlineSeverity | null {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  const hours = diff / 3600000;
  if (diff < 0) return "overdue";
  if (hours < 24) return "urgent";
  if (hours < 72) return "soon";
  return "ok";
}

function deadlineLabel(deadline: string | null | undefined): string {
  if (!deadline) return "";
  const dl = new Date(deadline);
  const now = new Date();
  const diff = dl.getTime() - now.getTime();
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

function deadlineBadgeClass(status: DeadlineSeverity | null): string {
  if (status === "overdue") return "deadline-badge deadline-overdue";
  if (status === "urgent")  return "deadline-badge deadline-urgent";
  if (status === "soon")    return "deadline-badge deadline-soon";
  return "deadline-badge deadline-ok";
}

function updDeadlineWarnings(): void {
  const urgent = notes.filter(n =>
    n.status !== "klar" && (n as any).deadline &&
    (deadlineStatus((n as any).deadline) === "urgent" || deadlineStatus((n as any).deadline) === "overdue")
  );
  const el = document.getElementById("header-deadline-warn");
  if (!el) return;
  if (!urgent.length) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="hdr-deadline-warn hdr-deadline-urgent">⏰ ${urgent.length} anteckning${urgent.length > 1 ? "ar" : ""} med brådskande deadline!</div>`;
}

// ---- HEADER-META ----
function updMeta(): void {
  const a = notes.filter(n => n.status !== "klar").length;
  const at = tasks.filter(t => t.status !== "klar").length;
  const meta = document.getElementById("header-meta");
  if (meta) {
    meta.textContent =
      `${notes.length} anteckningar · ${a} aktiva · ${materials.length} material · ${at} uppgifter`;
  }
  updDeadlineWarnings();
}

// ---- TOAST (popup-meddelanden) ----
function toast(msg: string, err: number = 0, actionLabel: string | null = null, actionFn: (() => void) | null = null): void {
  const el = document.getElementById("toast");
  if (!el) return;
  const safeMsg = esc(msg);
  if (actionLabel && actionFn) {
    el.innerHTML = `<span>${safeMsg}</span><button id="toast-action">${esc(actionLabel)}</button>`;
    setTimeout(() => {
      const btn = document.getElementById("toast-action") as HTMLButtonElement | null;
      if (btn) btn.onclick = () => { actionFn(); el.className = ""; };
    }, 20);
  } else {
    el.textContent = msg;
  }
  el.className = "show" + (err ? " err" : "");
  clearTimeout((window as any)._tt);
  (window as any)._tt = setTimeout(() => el.className = "", actionLabel ? 5500 : 2200);
}

// ---- MODAL ----
function openModal(html: string): void {
  const c = document.getElementById("modal-container");
  if (c) c.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
}
function closeModal(): void {
  const c = document.getElementById("modal-container");
  if (c) c.innerHTML = "";
}

// ---- INIT & TABS ----
async function initApp(): Promise<void> {
  const main = document.getElementById("main");
  if (main) main.innerHTML = `<div class="empty"><div class="spinner"></div> Laddar...</div>`;
  await Promise.all([loadNotes(), loadMats(), loadReturns(), loadTasks(), loadInfoArticles(), loadActionComments()]);
  updMeta();
  render();
}

function showTab(t: TabName): void {
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
  const tabs: TabName[] = ["hem", "anteckningar", "material", "plan", "info", "chat", "export", "trash"];
  document.querySelectorAll("nav button")[tabs.indexOf(t)]?.classList.add("active");
  render();
}

// ---- SUB-TABS för Material ----
async function setMatSubTab(t: "status" | "returer" | "åtgärder"): Promise<void> {
  matSubTab = t;
  openMatId = null;
  openItemId = null;
  if (t === "åtgärder") await loadActionComments();
  render();
}

// ---- SUB-TABS för Plan ----
function setPlanSubTab(t: "aktiva" | "arkiv"): void {
  planSubTab = t;
  openTaskId = null;
  planPersonFilter = "alla";
  render();
}

// ---- SÖK ----
function setSearch(v: string): void {
  searchQuery = v;
  const m = document.getElementById("main");
  if (!m) return;
  const searchInp = document.getElementById("search-input") as HTMLInputElement | null;
  const pos = document.activeElement === searchInp && searchInp
    ? searchInp.selectionStart
    : null;
  m.innerHTML = rNotes();
  if (pos !== null) {
    const inp = document.getElementById("search-input") as HTMLInputElement | null;
    if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
  }
  bindEvents();
}

function clearSearch(): void {
  searchQuery = "";
  render();
}

// ---- BIND EVENTS (körs efter varje render) ----
function bindEvents(): void {
  const ni = document.getElementById("note-input") as HTMLInputElement | HTMLTextAreaElement | null;
  if (ni) {
    ni.addEventListener("input", () => {
      const c = document.getElementById("note-cat") as HTMLInputElement | HTMLSelectElement | null;
      const p = document.getElementById("note-prio") as HTMLInputElement | HTMLSelectElement | null;
      if (c) c.value = classifyCat(ni.value);
      if (p) p.value = classifyPrio(ni.value);
    });
  }
}

// ---- BILDHANTERING ----
function handleImg(inp: HTMLInputElement): void {
  const f = inp.files?.[0];
  if (!f) return;
  imgFile = f;
  const fr = new FileReader();
  fr.onload = e => {
    imgData = e.target!.result as string;
    const area = document.querySelector(".img-upload-area");
    if (area) area.innerHTML = `<img class="img-preview" src="${imgData}">`;
  };
  fr.readAsDataURL(f);
}

// ---- KOPIERA TEXT ----
function copyTxt(txt: string): void {
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

function copyExport(): void {
  const txt = document.getElementById("export-text")?.textContent;
  if (txt) copyTxt(txt);
}

// ---- KUGGHJULSMENY ----
function toggleGearMenu(e: Event): void {
  e.stopPropagation();
  const menu = document.getElementById("hdr-gear-menu");
  const btn  = document.querySelector(".hdr-gear-btn");
  if (!menu) return;
  const open = menu.classList.toggle("open");
  btn?.classList.toggle("open", open);
  if (open) {
    const handler = (): void => { menu.classList.remove("open"); btn?.classList.remove("open"); document.removeEventListener("click", handler); };
    setTimeout(() => document.addEventListener("click", handler), 0);
  }
}
function closeGearMenu(): void {
  document.getElementById("hdr-gear-menu")?.classList.remove("open");
  document.querySelector(".hdr-gear-btn")?.classList.remove("open");
}

// ---- FILTER ----
function setFC(c: string): void { fCat = c; render(); }
function setFS(s: string): void { fStat = s; render(); }
function setFA(a: string): void { fAssigned = a; render(); }
function setPlanPersonFilter(v: string): void { planPersonFilter = v; render(); }

// ---- VECKOSAMANFATTNING VIA MAIL ----
async function sendWeeklyNow(): Promise<void> {
  const mailEl = document.getElementById("weekly-mail-input") as HTMLInputElement | null;
  const mail = mailEl?.value?.trim();
  if (!mail) { toast("Ange en e-postadress", 1); return; }
  toast("Skickar...");
  try {
    const r = await fetch("/.netlify/functions/send-weekly", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (sessionStorage.getItem("lager-token") || ""),
      },
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
// Hjälpfunktion — bygger material-rad för AI-prompt baserat på faktiskt schema (B16/B17)
function materialSummaryLine(m: Material): string {
  if (m.is_article_based) {
    const items = materialItems[m.id] || [];
    const tillg = items.filter(i => i.status === "tillgänglig").length;
    const issues = items.filter(i => i.status === "reparation" || i.status === "tvätt").length;
    return `- ${m.name}: ${tillg}/${items.length} tillgängliga${issues ? `, ${issues} i åtgärd` : ""}`;
  }
  const c = materialCounts[m.id] || {};
  const total = (m as any).total_count || 0;
  return `- ${m.name}: ${c.tillgänglig || 0}/${total} ${(m as any).unit || "st"} tillgängliga` +
         `${c.uthyrd ? `, ${c.uthyrd} uthyrt` : ""}` +
         `${c.reparation ? `, ${c.reparation} reparation` : ""}`;
}

async function aiSum(): Promise<void> {
  const btn = document.getElementById("ai-sum-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  const box = document.getElementById("ai-box");
  if (box) box.innerHTML = `<div class="card"><div class="spinner"></div> Genererar...</div>`;
  const active = notes.filter(n => n.status !== "klar");
  const prompt = `Du är assistent för en lagerchef på ett eventlager. Skapa en strukturerad sammanfattning på svenska per kategori av dessa anteckningar och materialstatus, redo att klistra in i OneNote. Avsluta med 3 konkreta åtgärdsförslag.\n\nAnteckningar:\n${
    active.map(n =>
      `- [${CATS[n.category]?.label}][${PRIOS[n.priority!]?.label}] ${n.text}${(n as any).assigned_to ? ` → @${(n as any).assigned_to}` : ""} (${n.created_by})${(n as any).deadline ? ` [Deadline: ${deadlineLabel((n as any).deadline)}]` : ""}`
    ).join("\n")
  }\n\nMaterial:\n${
    materials.map(materialSummaryLine).join("\n")
  }`;
  try {
    const r = await fetch("/.netlify/functions/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (sessionStorage.getItem("lager-token") || ""),
      },
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
function setQ(q: string): void {
  const el = document.getElementById("chat-input") as HTMLInputElement | HTMLTextAreaElement | null;
  if (el) el.value = q;
}

async function sendChat(): Promise<void> {
  const inp = document.getElementById("chat-input") as HTMLInputElement | HTMLTextAreaElement | null;
  const text = inp?.value?.trim();
  if (!text || loading) return;
  if (inp) inp.value = "";
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
      `- [${CATS[n.category]?.label}][${PRIOS[n.priority!]?.label}] ${n.text}${(n as any).assigned_to ? ` → @${(n as any).assigned_to}` : ""} (av ${n.created_by})${(n as any).deadline ? ` [Deadline: ${deadlineLabel((n as any).deadline)}]` : ""}`
    ).join("\n") || "Inga"
  }\n\nMaterial:\n${
    materials.map(materialSummaryLine).join("\n") || "Inget register"
  }\n\nSvara på svenska. Var konkret och praktisk.`;
  try {
    const r = await fetch("/.netlify/functions/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (sessionStorage.getItem("lager-token") || ""),
      },
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
