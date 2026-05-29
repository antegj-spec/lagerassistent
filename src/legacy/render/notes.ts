// ============================================================
// render/notes.ts — ANTECKNINGAR (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// ANTECKNINGAR-FLIKEN
// ============================================================
function rNotes(): string {
  const userOpts = USERS.filter(u => u !== "Admin");
  const filtered = notes.list.filter(n => {
    if (ui.fCat !== "alla" && n.category !== ui.fCat) return false;
    if (ui.fStat !== "alla" && n.status !== ui.fStat) return false;
    if (ui.fAssigned !== "alla") {
      if (ui.fAssigned === "ingen" && n.assigned_to) return false;
      if (ui.fAssigned !== "ingen" && n.assigned_to !== ui.fAssigned) return false;
    }
    if (ui.searchQuery && !n.text.toLowerCase().includes(ui.searchQuery.toLowerCase())) return false;
    return true;
  });

  return `
<div class="search-box">
  <input type="text" id="search-input" placeholder="Sök bland anteckningar..." value="${escAttr(ui.searchQuery)}" oninput="setSearch(this.value)">
  ${ui.searchQuery ? `<button class="search-clear" onclick="clearSearch()">×</button>` : ""}
</div>
<div class="lbl">KATEGORI</div>
<div class="filter-row">
  <button class="filter-btn ${ui.fCat === "alla" ? "active" : ""}" onclick="setFC('alla')">Alla</button>
  ${Object.entries(CATS).filter(([k]) => k !== "intern" || INTERN_USERS.includes(auth.user || "")).map(([k, v]) =>
    `<button class="filter-btn ${ui.fCat === k ? "active" : ""}" onclick="setFC('${k}')">${v.emoji} ${v.label}</button>`
  ).join("")}
</div>
<div class="lbl">STATUS</div>
<div class="filter-row">
  <button class="filter-btn ${ui.fStat === "alla" ? "active" : ""}" onclick="setFS('alla')">Alla</button>
  ${Object.entries(STATS).map(([k, v]) =>
    `<button class="filter-btn ${ui.fStat === k ? "active" : ""}" onclick="setFS('${k}')">${v}</button>`
  ).join("")}
</div>
<div class="lbl">TILLDELAD</div>
<div class="filter-row mb">
  <button class="filter-btn ${ui.fAssigned === "alla" ? "active" : ""}" onclick="setFA('alla')">Alla</button>
  <button class="filter-btn ${ui.fAssigned === "ingen" ? "active" : ""}" onclick="setFA('ingen')">Ingen</button>
  ${userOpts.map(u =>
    `<button class="filter-btn ${ui.fAssigned === u ? "active" : ""}" onclick="setFA('${esc(u)}')">@${esc(u)}</button>`
  ).join("")}
</div>
<div class="lbl">${filtered.length} ANTECKNINGAR ${ui.searchQuery ? `("${esc(ui.searchQuery)}")` : ""}</div>
<div class="note-list">
  ${filtered.length === 0
    ? `<div class="empty">Inga matchar filtret</div>`
    : filtered.map(n => rCard(n)).join("")
  }
</div>`;
}

// ---- ANTECKNINGSKORT ----
function rCard(n: Note, inTrash: boolean = false): string {
  const cat = CATS[n.category];
  const prio = PRIOS[n.priority || "medel"];
  const open = notes.openId === n.id;
  const linkedMat = n.material_id ? materials.list.find(m => m.id === n.material_id) : null;
  const dlStatus = n.deadline ? deadlineStatus(n.deadline) : null;
  const dlLabel  = n.deadline ? deadlineLabel(n.deadline) : "";
  const noteComments = notes.comments[n.id] || [];
  const commentCount = noteComments.length;

  return `<div class="note-card" data-note-id="${n.id}" onclick="toggleNote(${n.id})" style="border-left:3px solid ${cat?.color}${
    dlStatus === "overdue" ? ";border-top:2px solid #ff6b6b" :
    dlStatus === "urgent"  ? ";border-top:2px solid var(--accent)" : ""
  }">
  <div class="note-tags">
    <span class="tag" style="background:${cat?.color}22;color:${cat?.color}">${cat?.emoji} ${cat?.label?.toUpperCase()}</span>
    <span style="font-size:9px;color:${prio?.color};font-family:var(--display);font-weight:700">● ${prio?.label}</span>
    <button onclick="event.stopPropagation();cycleNoteStatus(${n.id})" title="Tryck för att cykla status" style="font-size:9px;color:${n.status === "klar" ? "#4CAF7D" : "var(--muted)"};font-family:var(--display);font-weight:700;background:transparent;border:1px solid currentColor;border-radius:10px;padding:1px 8px;cursor:pointer">${(STATS[n.status] || esc(n.status)).toUpperCase()}</button>
    ${n.assigned_to ? `<span class="note-assign">@${esc(n.assigned_to)}</span>` : ""}
    ${linkedMat ? `<span class="note-link">📦 ${esc(linkedMat.name)}</span>` : ""}
    ${dlStatus ? `<span class="${deadlineBadgeClass(dlStatus)}">${esc(dlLabel)}</span>` : ""}
    ${commentCount > 0 ? `<span style="font-size:9px;color:var(--muted)">💬 ${commentCount}</span>` : ""}
  </div>
  <div class="note-text ${n.status === "klar" ? "done" : ""}">${esc(n.text)}</div>
  ${n.image_url ? `<img class="note-img" src="${escAttr(n.image_url)}" loading="lazy">` : ""}
  <div class="note-meta">
    <span>${fmtD(n.created_at)}</span>
    <span>· ${esc(n.created_by || "")}</span>
    ${inTrash ? `<span style="color:var(--accent)">· raderad ${fmtDateOnly(n.deleted_at || "")}</span>` : ""}
  </div>
  ${open && !inTrash ? `
  <div class="note-actions" onclick="event.stopPropagation()">
    ${Object.entries(STATS).map(([k, v]) =>
      `<button class="status-btn ${n.status === k ? "active" : ""}" onclick="setStatus(${n.id},'${k}')">${v}</button>`
    ).join("")}
    <button class="btn-ghost" onclick="openEdit(${n.id})">✎ Redigera</button>
    <button class="btn-ghost" onclick="doDelete(${n.id})" style="margin-left:auto">🗑</button>
  </div>
  <div class="comments-section" onclick="event.stopPropagation()">
    <div class="comment-lbl">KOMMENTARER (${commentCount})</div>
    ${noteComments.map(c => {
      const canMod = auth.isAdmin || c.created_by === auth.user;
      return `<div class="comment-item">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
          <div class="comment-text" style="flex:1">${esc(c.text)}</div>
          ${canMod ? `<div style="display:flex;gap:4px;flex-shrink:0">
            <button class="cmt-act-btn" onclick="editNoteCommentAction(${n.id},${c.id},'${escAttr(c.text)}')">✎</button>
            <button class="cmt-act-btn cmt-act-del" onclick="delNoteCommentAction(${n.id},${c.id})">🗑</button>
          </div>` : ""}
        </div>
        <div class="comment-meta">${esc(c.created_by)} · ${fmtD(c.created_at)}</div>
      </div>`;
    }).join("")}
    <div class="comment-input-row">
      <input type="text" id="comment-input-${n.id}" placeholder="Skriv en kommentar..." onkeydown="if(event.key==='Enter')submitComment(${n.id})">
      <button class="btn-ghost" onclick="submitComment(${n.id})">Skicka</button>
    </div>
  </div>
  ` : ""}
  ${open && inTrash ? `
  <div class="note-actions" onclick="event.stopPropagation()">
    <button class="btn-ghost" onclick="restoreNote(${n.id})">↩ Återställ</button>
    <button class="btn-ghost danger ml-auto" onclick="permDelete(${n.id})">🗑 Radera permanent</button>
  </div>
  ` : ""}
</div>`;
}
