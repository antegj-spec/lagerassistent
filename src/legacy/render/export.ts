// ============================================================
// render/export.ts — EXPORT (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// EXPORT-FLIKEN
// ============================================================
function rExport(): string {
  const now = new Date().toLocaleDateString("sv-SE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const active = notes.list.filter(n => n.status !== "klar");
  let out = `LAGERRAPPORT — ${now}\nInloggad: ${auth.user}\n${"═".repeat(40)}\n\n`;

  const hp = active.filter(n => n.priority === "hög");
  if (hp.length) {
    out += `🔴 HÖG PRIORITET (${hp.length} st)\n`;
    hp.forEach(n => out += `  • [${CATS[n.category]?.label}] ${n.text}${n.assigned_to ? ` → @${n.assigned_to}` : ""} (${n.created_by})\n`);
    out += "\n";
  }

  const dlUrgent = active.filter(n =>
    n.deadline && (deadlineStatus(n.deadline) === "urgent" || deadlineStatus(n.deadline) === "overdue")
  );
  if (dlUrgent.length) {
    out += `⏰ BRÅDSKANDE DEADLINES (${dlUrgent.length} st)\n`;
    dlUrgent.forEach(n => out += `  • ${n.text} — ${deadlineLabel(n.deadline)}\n`);
    out += "\n";
  }

  Object.entries(CATS).forEach(([k, v]) => {
    const cn = active.filter(n => n.category === k);
    if (!cn.length) return;
    out += `${v.emoji} ${v.label.toUpperCase()} (${cn.length} st)\n`;
    cn.forEach(n => {
      const linkedMat = n.material_id ? materials.list.find(m => m.id === n.material_id) : null;
      out += `  ${n.status === "pågår" ? "⏳" : "○"} ${n.text} [${PRIOS[n.priority || "medel"]?.label}]${
        n.assigned_to ? ` → @${n.assigned_to}` : ""
      }${linkedMat ? ` (📦 ${linkedMat.name})` : ""} (${n.created_by}, ${fmtD(n.created_at)})${
        n.deadline ? ` [${deadlineLabel(n.deadline)}]` : ""
      }\n`;
    });
    out += "\n";
  });

  if (materials.list.length) {
    out += "📦 MATERIALSTATUS\n";
    materials.list.forEach(m => {
      if (m.is_article_based) {
        const items = materials.items[m.id] || [];
        const counts: Record<string, number> = {};
        Object.keys(MAT_STATS).forEach(s => counts[s] = 0);
        items.forEach(it => { if (counts[it.status] !== undefined) counts[it.status]++; });
        out += `  ${m.emoji || "📦"} ${m.name} (${items.length} artiklar): ${Object.entries(counts).filter(([_, n]) => n > 0).map(([s, n]) => `${n} ${MAT_STATS[s as MaterialStatus]?.label || s}`).join(", ")}\n`;
      } else {
        const counts = materials.counts[m.id] || {};
        const borrowed = (materials.borrowed[m.id] || []).reduce((s, b) => s + (b.quantity || 0), 0);
        const total = (m.total_count || 0) + borrowed;
        out += `  ${m.emoji || "📦"} ${m.name}: ${total} ${m.unit || "st"} totalt — ${Object.entries(counts).filter(([_, n]) => (n as number) > 0).map(([s, n]) => `${n} ${MAT_STATS[s as MaterialStatus]?.label || s}`).join(", ")}\n`;
      }
    });
    out += "\n";
  }

  if (tasks.list.length) {
    out += "📋 ARBETSPLANERING\n";
    tasks.list.forEach(t => {
      out += `  ${t.status === "klar" ? "✓" : t.status === "pågår" ? "⏳" : "○"} ${t.title} [${PRIOS[t.priority || "medel"]?.label}]${t.responsible ? ` ⭐ ${t.responsible}` : ""}${(t.assigned_to || []).length ? ` (${(t.assigned_to || []).join(", ")})` : ""}${(t.extra_staff || 0) > 0 ? ` +${t.extra_staff} extra` : ""}${t.deadline ? ` [${deadlineLabel(t.deadline)}]` : ""}\n`;
    });
  }

  return `
<div class="lbl">SAMMANFATTNING & EXPORT</div>
<p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
  Kopia av alla aktiva anteckningar och materialstatus — klistra in direkt i OneNote eller Teams.
</p>
<div class="export-box" id="export-text">${esc(out)}</div>
<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">
  <button class="btn btn-green" style="flex:1" onclick="copyExport()">📋 KOPIERA ALLT</button>
  <button class="btn" style="flex:1" onclick="aiSum()" id="ai-sum-btn">🤖 AI-SAMMANFATTNING</button>
</div>

<!-- Fas 6.10: CSV-export per dataset. UTF-8 BOM så Excel öppnar åäö korrekt. -->
<div class="lbl mt">CSV-EXPORT (öppnas i Excel)</div>
<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">
  <button class="btn-ghost" style="flex:1;min-width:140px" onclick="exportNotesCsv()">📝 Anteckningar</button>
  <button class="btn-ghost" style="flex:1;min-width:140px" onclick="exportTasksCsv()">📋 Uppgifter</button>
  <button class="btn-ghost" style="flex:1;min-width:140px" onclick="exportMaterialsCsv()">📦 Material</button>
  <button class="btn-ghost" style="flex:1;min-width:140px" onclick="exportReturnsCsv()">↩ Returer</button>
</div>

<div class="lbl mt">SKICKA SAMMANFATTNING SOM MAIL</div>
<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
  <input type="email" id="weekly-mail-input" placeholder="E-postadress" value="ante.g.j@gmail.com" style="flex:1">
  <button class="btn btn-blue" onclick="sendWeeklyNow()">📧 SKICKA</button>
</div>
<div id="ai-box"></div>`;
}
