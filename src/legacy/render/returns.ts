// ============================================================
// render/returns.ts — RETURER (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// RETURER-FLIKEN
// ============================================================
function rReturer(): string {
  return `
<button class="btn mb" onclick="openAddReturn()" style="width:100%">+ NY RETUR</button>
<div class="lbl">AKTIVA RETURER (${returns.list.length})</div>
${returns.list.length === 0
  ? `<div class="empty">Inga returer ännu</div>`
  : returns.list.map(r => rReturCard(r)).join("")
}
${auth.isAdmin && returns.archived.length ? `
<div class="lbl mt">ARKIVERADE RETURER (${returns.archived.length})</div>
${returns.archived.map(r => rReturCard(r, true)).join("")}
` : ""}`;
}

function rReturCard(r: Return, isArchived: boolean = false): string {
  return `<div class="mat-card" style="${isArchived ? "opacity:.6;" : ""}">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="flex:1">
      <div class="mat-name">${esc(r.name)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${fmtDateOnly(r.return_date)}${r.received_by ? ` · mottagen av ${esc(r.received_by)}` : ""}</div>
    </div>
  </div>
  ${r.content ? `<div style="font-size:12px;line-height:1.6;white-space:pre-wrap;background:var(--bg);padding:8px 10px;border-radius:6px;margin-top:6px">${esc(r.content)}</div>` : ""}
  ${r.comment ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;font-style:italic">💬 ${esc(r.comment)}</div>` : ""}
  <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
    <button class="btn-ghost" onclick="openEditReturn(${r.id})">✎ Redigera</button>
    ${auth.isAdmin ? (isArchived
      ? `<button class="btn-ghost" onclick="toggleReturnArchive(${r.id},false)">↩ Aktivera</button>`
      : `<button class="btn-ghost" onclick="toggleReturnArchive(${r.id},true)">📁 Arkivera</button>`
    ) : ""}
    ${auth.isAdmin ? `<button class="btn-ghost danger ml-auto" onclick="doDelReturn(${r.id})">🗑</button>` : ""}
  </div>
</div>`;
}
