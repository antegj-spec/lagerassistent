// ============================================================
// render.js — Dispatcher + delad sub-tab-bar.
// De vy-specifika r*-funktionerna ligger i render/<flik>.ts
// (hem, notes, materials, returns, tasks, trash, chat, export,
//  dashboard, info, cars, economy) och delar global scope
// (module:"none"), så render() når dem direkt vid runtime.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ---- HUVUD-RENDER ----
function render(): void {
  const m = document.getElementById("main");
  if (!m) return;

  // SÄKERHET (defense in depth): blockera admin-only tabs för icke-admin.
  // Förhindrar att ett tab-state från tidigare session leder till
  // rendering av admin-data (t.ex. AI-sammanfattning som genererats av Admin).
  if (!auth.isAdmin && isTabAdminOnly(ui.tab)) {
    ui.tab = "hem";
    ui.mainTab = "hem";
  }
  // Synka mainTab med tab (skydd mot stale state).
  ui.mainTab = TAB_TO_MAIN[ui.tab] ?? "hem";

  const subTabBar = rMainSubTabs();

  if (ui.tab === "hem")               m.innerHTML = rHem();
  else if (ui.tab === "anteckningar") m.innerHTML = subTabBar + rNotes();
  else if (ui.tab === "material")     m.innerHTML = subTabBar + rMat();
  else if (ui.tab === "returer")      m.innerHTML = subTabBar + rReturer();
  else if (ui.tab === "plan")         m.innerHTML = subTabBar + rPlan();
  else if (ui.tab === "körjournal")   m.innerHTML = subTabBar + rCarJournal();
  else if (ui.tab === "info")         m.innerHTML = subTabBar + rInfo();
  else if (ui.tab === "chat")         m.innerHTML = subTabBar + rChat();
  else if (ui.tab === "export")       m.innerHTML = subTabBar + rExport();
  else if (ui.tab === "ekonomi")      m.innerHTML = subTabBar + rEkonomi();
  else if (ui.tab === "trash")        m.innerHTML = subTabBar + rTrash();
  else if (ui.tab === "dashboard")    m.innerHTML = subTabBar + rDashboard();
  else                                m.innerHTML = rHem();  // fallback
  bindEvents();
}

// Fas 7: top-level sub-tab-chips för aktuell main-grupp.
// Tom string om gruppen bara har 1 sub-tab (Hem).
function rMainSubTabs(): string {
  const def = MAIN_TABS.find(m => m.id === ui.mainTab);
  if (!def) return "";
  const visible = def.subTabs.filter(s => auth.isAdmin || !s.adminOnly);
  if (visible.length <= 1) return "";
  return `
<div class="main-subtabs">
  ${visible.map(s => `<button class="subtab-btn ${ui.tab === s.id ? "active" : ""}" onclick="showTab('${s.id}')">${s.emoji} ${esc(s.label)}</button>`).join("")}
</div>`;
}
