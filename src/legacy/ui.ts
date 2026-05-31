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
    // Fas 3.6 (B10): visa minuter under 1h sen istället för "0h sedan"
    const absMin = Math.abs(Math.round(diff / 60000));
    if (absMin < 60) return `⏰ Förfallen för ${absMin}m sedan`;
    const h = Math.round(absMin / 60);
    if (h < 24) return `⏰ Förfallen för ${h}h sedan`;
    return `⏰ Förfallen ${dl.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}`;
  }
  // Fas 3.6 (B10): visa minuter under 1h kvar istället för bara "inom 1h"
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `⚡ Förfaller om ${mins}m`;
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
  const urgent = notes.list.filter(n =>
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
  const a = notes.list.filter(n => n.status !== "klar").length;
  const at = tasks.list.filter(t => t.status !== "klar").length;
  const meta = document.getElementById("header-meta");
  if (meta) {
    meta.textContent =
      `${notes.list.length} anteckningar · ${a} aktiva · ${materials.list.length} material · ${at} uppgifter`;
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

// ---- LIGHTBOX ----
function openLightbox(url: string): void {
  const c = document.getElementById("modal-container");
  if (!c) return;
  c.innerHTML = `
    <div class="lightbox-overlay" onclick="closeLightbox()">
      <img class="lightbox-img" src="${escAttr(url)}" onclick="event.stopPropagation()" alt="">
      <button class="lightbox-close" onclick="closeLightbox()">×</button>
    </div>`;
}
function closeLightbox(): void {
  const c = document.getElementById("modal-container");
  if (c) c.innerHTML = "";
}

// Fas 3.7 (B20): Promise-baserad ersättare för window.confirm().
// Använder samma modal-overlay men returnerar true/false så att
// destruktiva action-funktioner kan await:a svaret. Ger tema-konsistent
// UI och tillåter dangerLabel för rödfärgad knapp.
//
// Användning:
//   if (!await confirmModal("Radera permanent?", { danger: true, confirmLabel: "Radera" })) return;
let _confirmResolve: ((v: boolean) => void) | null = null;

interface ConfirmModalOpts {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

function confirmModal(message: string, opts: ConfirmModalOpts = {}): Promise<boolean> {
  const title = opts.title ?? "Bekräfta";
  const confirmLabel = opts.confirmLabel ?? "OK";
  const cancelLabel = opts.cancelLabel ?? "Avbryt";
  const danger = opts.danger ?? false;
  return new Promise<boolean>((resolve) => {
    // Om förra modalen hängde kvar — resolva den som false innan ny öppnas.
    if (_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
    _confirmResolve = resolve;
    const c = document.getElementById("modal-container");
    if (!c) { resolve(false); _confirmResolve = null; return; }
    c.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)resolveConfirm(false)">
        <div class="modal">
          <div class="modal-title">${esc(title)}</div>
          <p style="margin:0 0 16px;line-height:1.5;white-space:pre-wrap">${esc(message)}</p>
          <div class="modal-actions">
            <button class="btn-ghost" onclick="resolveConfirm(false)" style="flex:1">${esc(cancelLabel)}</button>
            <button class="${danger ? 'btn btn-red' : 'btn'}" onclick="resolveConfirm(true)" style="flex:1">${esc(confirmLabel)}</button>
          </div>
        </div>
      </div>
    `;
  });
}

// Anropas från knapparna i confirmModal — global pga inline onclick.
function resolveConfirm(value: boolean): void {
  closeModal();
  const r = _confirmResolve;
  _confirmResolve = null;
  if (r) r(value);
}

// ---- BROWSER HISTORY (SPA-navigering) ----

interface NavState {
  mainTab: MainTabName;
  tab: TabName;
  notesId: number | null;
  matsId: number | null;
  tasksId: number | null;
  infoId: number | null;
  matSubTab: string;
  planSubTab: string;
}

function _navSnapshot(): NavState {
  return {
    mainTab: ui.mainTab,
    tab: ui.tab,
    notesId: notes.openId,
    matsId: materials.openId,
    tasksId: tasks.openId,
    infoId: info.openId,
    matSubTab: ui.matSubTab,
    planSubTab: ui.planSubTab,
  };
}

function _navPush(): void {
  history.pushState(_navSnapshot(), "");
}

function _navReplace(): void {
  history.replaceState(_navSnapshot(), "");
}

window.addEventListener("popstate", (e: PopStateEvent) => {
  if (!auth.user) return;
  const s: NavState | null = e.state;
  if (!s) return;
  ui.tab = s.tab ?? "hem";
  ui.mainTab = s.mainTab ?? TAB_TO_MAIN[ui.tab] ?? "hem";
  notes.openId = s.notesId ?? null;
  materials.openId = s.matsId ?? null;
  tasks.openId = s.tasksId ?? null;
  info.openId = s.infoId ?? null;
  info.editMode = null;
  ui.matSubTab = (s.matSubTab as "status" | "returer" | "åtgärder") ?? "status";
  ui.planSubTab = (s.planSubTab as "aktiva" | "arkiv") ?? "aktiva";
  _highlightMainNav();
  render();
});

// Markerar aktiv main-nav-knapp baserat på ui.mainTab.
function _highlightMainNav(): void {
  document.querySelectorAll("nav button[data-main-tab]").forEach(b => {
    const m = b.getAttribute("data-main-tab");
    b.classList.toggle("active", m === ui.mainTab);
  });
}

// ---- INIT & TABS ----
async function initApp(): Promise<void> {
  const main = document.getElementById("main");
  if (main) main.innerHTML = `<div class="empty"><div class="spinner"></div> Laddar...</div>`;
  const loaders: Array<Promise<void>> = [
    loadNotes(), loadMats(), loadReturns(), loadTasks(),
    loadInfoArticles(), loadActionComments(),
    loadCars(), loadCarTrips()
  ];
  // Ekonomi laddas bara för admin (RLS blockar ändå men vi sparar requests).
  if (auth.isAdmin) {
    loaders.push(loadEconomy());
    loaders.push(refreshEconomyYears());
  }
  await Promise.all(loaders);
  updMeta();
  render();
  _navReplace();
}

function showTab(t: TabName): void {
  // Blockera admin-only-flikar för icke-admin
  if (isTabAdminOnly(t) && !auth.isAdmin) {
    toast("Den här fliken är endast tillgänglig för Admin", 1);
    return;
  }
  ui.tab = t;
  ui.mainTab = TAB_TO_MAIN[t] ?? "hem";
  notes.openId = null;
  materials.openId = null;
  tasks.openId = null;
  ui.imgData = null;
  ui.imgFile = null;
  ui.searchQuery = "";
  ui.matSearch = "";
  // Fas 3.6 (B6): nollställ filter ihop med ui.searchQuery — annars hänger
  // en "Reparation"-status med från material-fliken in i anteckningar
  // (där status-domänen är en annan).
  ui.fCat = [];
  ui.fStat = [];
  ui.fAssigned = [];
  ui.planPersonFilter = "alla";
  // Fas 3.6 (B14): rensa även kommentar-bild-globals vid tab-byte
  ui.matCommentImgUrl = null;
  ui.itemCommentImgUrl = null;
  ui.infoCommentImgUrl = null;
  _highlightMainNav();
  // Fas 6.9: Dashboard laddar feed-data on-demand via openDashboard.
  if (t === "dashboard" && typeof openDashboard === "function") {
    _navPush();
    void openDashboard();
    return;
  }
  _navPush();
  render();
}

// Fas 7: klick på main-nav-knapp → navigera till första (synliga) sub-tab.
function setMainTab(m: MainTabName): void {
  const def = MAIN_TABS.find(x => x.id === m);
  if (!def) return;
  if (def.adminOnly && !auth.isAdmin) {
    toast("Den här gruppen är endast tillgänglig för Admin", 1);
    return;
  }
  // Välj första sub-tab som är tillgänglig för den här användaren.
  const firstAccessibleSub = def.subTabs.find(s => auth.isAdmin || !s.adminOnly);
  if (!firstAccessibleSub) return;
  showTab(firstAccessibleSub.id);
}

// ---- SUB-TABS för Material ----
// Fas 7: "returer" har lyfts ut till egen top-level sub-tab (Lager > Returer)
// men typunionen behåller den för bakåtkompatibilitet med popstate-state.
async function setMatSubTab(t: "status" | "returer" | "åtgärder"): Promise<void> {
  if (t === "returer") { showTab("returer"); return; }
  ui.matSubTab = t;
  materials.openId = null;
  materials.openItemId = null;
  if (t === "åtgärder") await loadActionComments();
  render();
}

// ---- SUB-TABS för Plan ----
function setPlanSubTab(t: "aktiva" | "arkiv"): void {
  ui.planSubTab = t;
  tasks.openId = null;
  ui.planPersonFilter = "alla";
  render();
}

// ---- SÖK ----
function setSearch(v: string): void {
  ui.searchQuery = v;
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
  ui.searchQuery = "";
  render();
}

// ---- BIND EVENTS (körs efter varje render) ----
function bindEvents(): void {
  const ni = document.getElementById("note-input") as HTMLInputElement | HTMLTextAreaElement | null;
  if (ni) {
    // Fas 5.8: pre-fill formulär-defaults från senaste anteckning (per användare).
    // Måste köras FÖRE input-listenern registreras så att första input override:ar
    // korrekt via classifyCat/classifyPrio när användaren börjar skriva.
    if (typeof applyNoteFormDefaults === "function") applyNoteFormDefaults();
    ni.addEventListener("input", () => {
      const c = document.getElementById("note-cat") as HTMLInputElement | HTMLSelectElement | null;
      const p = document.getElementById("note-prio") as HTMLInputElement | HTMLSelectElement | null;
      if (c) c.value = classifyCat(ni.value);
      if (p) p.value = classifyPrio(ni.value);
    });
  }
  // Fas 5.7: rendera mall-rad ovanför formuläret (om note-input finns på sidan)
  if (ni && typeof renderNoteTemplatesUI === "function") renderNoteTemplatesUI();
  // Fas 5.5: lägg till mic-knapp för voice input (om note-input finns)
  if (ni && typeof attachVoiceInput === "function") attachVoiceInput();
}

// ---- BILDHANTERING ----
function handleImg(inp: HTMLInputElement): void {
  const f = inp.files?.[0];
  if (!f) return;
  ui.imgFile = f;
  const fr = new FileReader();
  fr.onload = e => {
    ui.imgData = e.target!.result as string;
    const area = document.querySelector(".img-upload-area");
    if (area) area.innerHTML = `<img class="img-preview" src="${ui.imgData}">`;
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
// Not-filter (flerval): toggla värdet i respektive lista och patcha bara
// listan (applyNoteFilters) så öppna dropdowns inte stängs vid varje klick.
function _toggleNoteFilter(arr: string[], v: string): void {
  const i = arr.indexOf(v);
  if (i === -1) arr.push(v); else arr.splice(i, 1);
}
function setFC(c: string): void { _toggleNoteFilter(ui.fCat, c); applyNoteFilters(); }
function setFS(s: string): void { _toggleNoteFilter(ui.fStat, s); applyNoteFilters(); }
function setFA(a: string): void { _toggleNoteFilter(ui.fAssigned, a); applyNoteFilters(); }
function clearNoteFilter(key: "cat" | "stat" | "assigned"): void {
  if (key === "cat") ui.fCat = [];
  else if (key === "stat") ui.fStat = [];
  else ui.fAssigned = [];
  render();   // full render för att avmarkera kryssrutorna
}
function setPlanPersonFilter(v: string): void { ui.planPersonFilter = v; render(); }

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
    if (d.ok) {
      toast("✓ Sammanfattning skickad till " + (d.to || mail));
    } else {
      // Logga hela svaret för diagnostik (Resend-felmeddelande, status etc.)
      console.error("[send-weekly] Backend-svar:", d);
      const errMsg = d.error || d.resend_response?.message || "okänt fel";
      toast("Mail misslyckades: " + errMsg, 1);
    }
  } catch (e) {
    console.error("[send-weekly] Network/parse-fel:", e);
    toast("Mail misslyckades: " + (e as Error).message, 1);
  }
}

// ---- AI-SAMMANFATTNING ----
// Hjälpfunktion — bygger material-rad för AI-prompt baserat på faktiskt schema (B16/B17)
function materialSummaryLine(m: Material): string {
  if (m.is_article_based) {
    const items = materials.items[m.id] || [];
    const tillg = items.filter(i => i.status === "tillgänglig").length;
    const issues = items.filter(i => i.status === "reparation" || i.status === "tvätt").length;
    return `- ${m.name}: ${tillg}/${items.length} tillgängliga${issues ? `, ${issues} i åtgärd` : ""}`;
  }
  const c = materials.counts[m.id] || {};
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
  const active = notes.list.filter(n => n.status !== "klar");
  const prompt = `Du är assistent för en lagerchef på ett eventlager. Skapa en strukturerad sammanfattning på svenska per kategori av dessa anteckningar och materialstatus, redo att klistra in i OneNote. Avsluta med 3 konkreta åtgärdsförslag.\n\nAnteckningar:\n${
    active.map(n =>
      `- [${CATS[n.category]?.label}][${PRIOS[n.priority!]?.label}] ${n.text}${(n as any).assigned_to ? ` → @${(n as any).assigned_to}` : ""} (${n.created_by})${(n as any).deadline ? ` [Deadline: ${deadlineLabel((n as any).deadline)}]` : ""}`
    ).join("\n")
  }\n\nMaterial:\n${
    materials.list.map(materialSummaryLine).join("\n")
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
  if (!text || ui.loading) return;
  if (inp) inp.value = "";
  chat.list.push({ role: "user", content: text });
  ui.loading = true;
  render();
  setTimeout(() => {
    const b = document.getElementById("chat-box");
    if (b) b.scrollTop = b.scrollHeight;
  }, 50);
  const active = notes.list.filter(n => n.status !== "klar");
  const sys = `Du är AI-assistent för en lagerchef på ett eventlager i Sverige. Lagret hyr ut golvplattor, kravallstaket och kabelskydd. Teamet är ${USERS.length - 1} personer (${USERS.filter(u => u !== "Admin").join(", ")}).\n\nAktiva anteckningar:\n${
    active.map(n =>
      `- [${CATS[n.category]?.label}][${PRIOS[n.priority!]?.label}] ${n.text}${(n as any).assigned_to ? ` → @${(n as any).assigned_to}` : ""} (av ${n.created_by})${(n as any).deadline ? ` [Deadline: ${deadlineLabel((n as any).deadline)}]` : ""}`
    ).join("\n") || "Inga"
  }\n\nMaterial:\n${
    materials.list.map(materialSummaryLine).join("\n") || "Inget register"
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
        messages: chat.list.map(m => ({ role: m.role, content: m.content }))
      })
    });
    const d = await r.json();
    chat.list.push({ role: "assistant", content: d.content?.[0]?.text || "Kunde inte svara." });
  } catch (e) {
    chat.list.push({ role: "assistant", content: "Något gick fel. Kontrollera anslutning." });
  }
  ui.loading = false;
  render();
  setTimeout(() => {
    const b = document.getElementById("chat-box");
    if (b) b.scrollTop = b.scrollHeight;
  }, 50);
}
