// ============================================================
// render/trash.ts — PAPPERSKORG (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// PAPPERSKORG-FLIKEN
// ============================================================
function rTrash(): string {
  return `
<div class="lbl">PAPPERSKORG (${notes.trashed.length})</div>
<p style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.6">
  Raderade anteckningar sparas här i ${TRASH_DAYS} dagar innan de försvinner permanent.
</p>
${notes.trashed.length === 0
  ? `<div class="empty">Papperskorgen är tom</div>`
  : `<div class="row mb"><button class="btn btn-red" onclick="emptyTrash()" style="flex:1">🗑 TÖM PAPPERSKORG</button></div>
     <div class="note-list">${notes.trashed.map(n => rCard(n, true)).join("")}</div>`
}`;
}
