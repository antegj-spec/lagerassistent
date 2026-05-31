// ============================================================
// render/dashboard.ts — DASHBOARD (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// DASHBOARD-FLIKEN (admin-only) — Fas 6.9 + 6.7 + 6.13
// Data laddas in i `dashboard` (actions/dashboard.ts) via openDashboard().
// ============================================================
function rDashboard(): string {
  // Saknar laddat data → visa skelett + "laddar..."
  if (dashboard.loadedAt == null) {
    return `
<div class="lbl">DASHBOARD</div>
<div class="empty">Laddar dashboard...</div>`;
  }

  // ---- KPI-rad ----
  const activeNotes = notes.list.filter(n => n.status !== "klar").length;
  const activeTasks = tasks.list.filter(t => t.status !== "klar").length;
  const upcomingDeadlines = [
    ...notes.list.filter(n => n.status !== "klar" && n.deadline &&
      (deadlineStatus(n.deadline) === "urgent" || deadlineStatus(n.deadline) === "overdue" || deadlineStatus(n.deadline) === "soon")),
    ...tasks.list.filter(t => t.status !== "klar" && t.deadline &&
      (deadlineStatus(t.deadline) === "urgent" || deadlineStatus(t.deadline) === "overdue" || deadlineStatus(t.deadline) === "soon")),
  ].length;
  const problemCount = dashboard.problemArticles.reduce((s, p) => s + p.count, 0);

  const kpis = `
<div class="stats-grid" style="margin-bottom:14px">
  <div class="stat-card" style="border-left:3px solid #4CAF7D"><div style="font-size:18px;margin-bottom:3px">📝</div><div class="stat-num">${activeNotes}</div><div class="stat-lbl">AKTIVA ANTECKNINGAR</div></div>
  <div class="stat-card" style="border-left:3px solid #2E7DC4"><div style="font-size:18px;margin-bottom:3px">📋</div><div class="stat-num">${activeTasks}</div><div class="stat-lbl">AKTIVA UPPGIFTER</div></div>
  <div class="stat-card" style="border-left:3px solid #E8A81A"><div style="font-size:18px;margin-bottom:3px">⏰</div><div class="stat-num">${upcomingDeadlines}</div><div class="stat-lbl">KOMMANDE DEADLINES</div></div>
  <div class="stat-card" style="border-left:3px solid #E8521A"><div style="font-size:18px;margin-bottom:3px">🚨</div><div class="stat-num">${problemCount}</div><div class="stat-lbl">PROBLEM-ARTIKLAR</div></div>
</div>`;

  // ---- Problem-artiklar (6.7) ----
  const problems = dashboard.problemArticles.length === 0
    ? `<div class="empty">Inga problem-artiklar 🎉</div>`
    : dashboard.problemArticles.map(p => `
      <div class="task-row" onclick="gotoMaterial(${p.matId})" style="border-left:3px solid #E8521A;cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--display);font-weight:700;font-size:15px">${esc(p.matEmoji)} ${esc(p.matName)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px">${p.reasons.map(r => esc(r)).join(" · ")}</div>
          </div>
          <div style="font-family:var(--display);font-size:22px;font-weight:900;color:#E8521A">${p.count}</div>
        </div>
      </div>`).join("");

  // ---- Aktivitetsfeed (6.13) ----
  const feed = dashboard.activity.length === 0
    ? `<div class="empty">Ingen aktivitet senaste 14 dagarna</div>`
    : dashboard.activity.map(a => {
      const icon = a.kind === "task-status" ? "📋" : "📦";
      return `<div class="comment-item">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;font-size:12px;line-height:1.5">
            <span style="margin-right:4px">${icon}</span>
            <b>${esc(a.who)}</b> ${esc(a.text)}
          </div>
          <div style="font-size:10px;color:var(--muted);white-space:nowrap">${fmtD(a.at)}</div>
        </div>
      </div>`;
    }).join("");

  return `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
  <div class="lbl" style="margin:0">DASHBOARD</div>
  <button class="btn-ghost" onclick="openDashboard()" title="Ladda om">↻ Uppdatera</button>
</div>

${kpis}

<div class="card">
  <div class="lbl">🚨 TOPP 5 PROBLEM-ARTIKLAR</div>
  ${problems}
</div>

<div class="card">
  <div class="lbl">📜 SENASTE AKTIVITET (${dashboard.activity.length})</div>
  ${feed}
</div>`;
}
