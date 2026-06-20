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
  const items = returns.items[r.id] || [];
  const itemsHtml = items.length
    ? `<div class="ret-card-items">${items.map(it => `
        <div class="ret-card-item">
          ${it.quantity ? `<span class="ret-card-qty">${esc(it.quantity)}</span>` : `<span class="ret-card-qty ret-card-qty--empty">–</span>`}
          <div class="ret-card-main">
            <div class="ret-card-mat">${esc(it.material)}</div>
            ${it.comment ? `<div class="ret-card-cmt">${esc(it.comment)}</div>` : ""}
          </div>
        </div>`).join("")}</div>`
    // Bakåtkompatibel visning av gamla returer (fritext + ev. övergripande kommentar).
    : `${r.content ? `<div style="font-size:12px;line-height:1.6;white-space:pre-wrap;background:var(--bg);padding:8px 10px;border-radius:6px;margin-top:6px">${esc(r.content)}</div>` : ""}
       ${r.comment ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;font-style:italic">💬 ${esc(r.comment)}</div>` : ""}`;
  return `<div class="mat-card" style="${isArchived ? "opacity:.6;" : ""}">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="flex:1">
      <div class="mat-name">${esc(r.name)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${fmtDateOnly(r.return_date)}${r.received_by ? ` · mottagen av ${esc(r.received_by)}` : ""}</div>
    </div>
  </div>
  ${itemsHtml}
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
