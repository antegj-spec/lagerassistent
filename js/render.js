// ============================================================
// render.js — Alla funktioner som bygger HTML för varje vy
// Beror på: config.js, ui.js
// ============================================================

// ---- HUVUD-RENDER ----
function render() {
  const m = document.getElementById("main");
  if (tab === "hem")               m.innerHTML = rHem();
  else if (tab === "anteckningar") m.innerHTML = rNotes();
  else if (tab === "material")     m.innerHTML = rMat();
  else if (tab === "plan")         m.innerHTML = rPlan();
  else if (tab === "info")         m.innerHTML = rInfo();
  else if (tab === "chat")         m.innerHTML = rChat();
  else if (tab === "export")       m.innerHTML = rExport();
  else if (tab === "trash")        m.innerHTML = rTrash();
  bindEvents();
}

// ============================================================
// HEM-FLIKEN
// ============================================================
function rHem() {
  const hp = notes.filter(n => n.priority === "hög" && n.status !== "klar");
  const today = notes.filter(n =>
    new Date(n.created_at).toDateString() === new Date().toDateString()
  );
  const deadlineUrgent = notes.filter(n =>
    n.status !== "klar" && n.deadline &&
    (deadlineStatus(n.deadline) === "urgent" ||
     deadlineStatus(n.deadline) === "overdue" ||
     deadlineStatus(n.deadline) === "soon")
  );
  const cs = Object.entries(CATS).map(([k, v]) => ({
    k, v,
    a: notes.filter(n => n.category === k && n.status !== "klar").length,
    t: notes.filter(n => n.category === k).length
  })).filter(s => s.t > 0);

  // Mina uppgifter (om jag är tilldelad eller huvudansvarig)
  const myTasks = tasks.filter(t =>
    t.status !== "klar" &&
    (t.responsible === user || (t.assigned_to || []).includes(user))
  );

  const matOpts  = materials.map(m => `<option value="${m.id}">${esc(m.emoji || "📦")} ${esc(m.name)}</option>`).join("");
  const userOpts = USERS.filter(u => u !== "Admin").map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join("");

  return `
<div class="desktop-grid">
  <div class="card">
    <div class="lbl">NY ANTECKNING</div>
    <textarea id="note-input" rows="3" placeholder="Beskriv vad du observerat... (t.ex. 'Kravallstaket rad 3 trasig fot, brådskande')"></textarea>
    <label class="field-label">KATEGORI (auto)</label>
    <select id="note-cat">${Object.entries(CATS).filter(([k]) => k !== "intern" || INTERN_USERS.includes(user)).map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join("")}</select>
    <label class="field-label">PRIORITET (auto)</label>
    <select id="note-prio">${Object.entries(PRIOS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select>
    <label class="field-label">TILLDELA TILL (valfritt)</label>
    <select id="note-assign"><option value="">— Ingen —</option>${userOpts}</select>
    ${materials.length ? `<label class="field-label">KOPPLA TILL MATERIAL (valfritt)</label>
    <select id="note-material"><option value="">— Inget —</option>${matOpts}</select>` : ""}
    <label class="field-label">DEADLINE (valfritt)</label>
    <input type="datetime-local" id="note-deadline">
    <div class="img-upload-area" onclick="document.getElementById('img-file').click()">
      ${imgData
        ? `<img class="img-preview" src="${imgData}">`
        : `<div style="color:var(--muted);font-size:12px">📸 Lägg till foto<br><span style="font-size:10px;color:var(--dim)">Öppnar kameran direkt</span></div>`
      }
    </div>
    <input type="file" id="img-file" accept="image/*" capture="environment" style="display:none" onchange="handleImg(this)">
    <button class="btn mt" style="width:100%" onclick="addNote()" id="add-btn">LÄGG TILL →</button>
  </div>
  <div>
    ${hp.length ? `<div class="alert"><div class="alert-title">🔴 HÖG PRIORITET (${hp.length})</div>${
      hp.slice(0, 4).map(n =>
        `<div class="alert-item">${CATS[n.category]?.emoji} ${esc(n.text.substring(0, 80))}${n.text.length > 80 ? "..." : ""}</div>`
      ).join("")
    }</div>` : ""}
    ${deadlineUrgent.length ? `<div class="deadline-alert"><div class="alert-title">⏰ KOMMANDE DEADLINES (${deadlineUrgent.length})</div>${
      deadlineUrgent.slice(0, 4).map(n =>
        `<div class="alert-item">${esc(n.text.substring(0, 60))}${n.text.length > 60 ? "..." : ""} — ${esc(deadlineLabel(n.deadline))}</div>`
      ).join("")
    }</div>` : ""}
    ${myTasks.length ? `<div class="alert" style="background:#0E1A1E;border-color:var(--blue)"><div class="alert-title" style="color:var(--blue)">📋 MINA UPPGIFTER (${myTasks.length})</div>${
      myTasks.slice(0, 4).map(t =>
        `<div class="alert-item" style="border-left-color:var(--blue)">${esc(t.title)}${t.responsible === user ? " (huvudansvarig)" : ""}</div>`
      ).join("")
    }</div>` : ""}
    <div class="lbl">ÖVERSIKT</div>
    <div class="stats-grid">${
      cs.map(s => `<div class="stat-card" style="border-left:3px solid ${s.v.color}">
        <div style="font-size:18px;margin-bottom:3px">${s.v.emoji}</div>
        <div class="stat-num" style="color:${s.v.color}">${s.a}</div>
        <div class="stat-lbl">${s.v.label.toUpperCase()} · ${s.t} TOTALT</div>
      </div>`).join("")
    }</div>
  </div>
</div>
<div class="lbl mt">IDAG (${today.length})</div>
<div class="note-list">
  ${today.length === 0
    ? `<div class="empty">Inga anteckningar idag</div>`
    : today.slice(0, 8).map(n => rCard(n)).join("")
  }
</div>`;
}

// ============================================================
// ANTECKNINGAR-FLIKEN
// ============================================================
function rNotes() {
  const userOpts = USERS.filter(u => u !== "Admin");
  const filtered = notes.filter(n => {
    if (fCat !== "alla" && n.category !== fCat) return false;
    if (fStat !== "alla" && n.status !== fStat) return false;
    if (fAssigned !== "alla") {
      if (fAssigned === "ingen" && n.assigned_to) return false;
      if (fAssigned !== "ingen" && n.assigned_to !== fAssigned) return false;
    }
    if (searchQuery && !n.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return `
<div class="search-box">
  <input type="text" id="search-input" placeholder="Sök bland anteckningar..." value="${escAttr(searchQuery)}" oninput="setSearch(this.value)">
  ${searchQuery ? `<button class="search-clear" onclick="clearSearch()">×</button>` : ""}
</div>
<div class="lbl">KATEGORI</div>
<div class="filter-row">
  <button class="filter-btn ${fCat === "alla" ? "active" : ""}" onclick="setFC('alla')">Alla</button>
  ${Object.entries(CATS).filter(([k]) => k !== "intern" || INTERN_USERS.includes(user)).map(([k, v]) =>
    `<button class="filter-btn ${fCat === k ? "active" : ""}" onclick="setFC('${k}')">${v.emoji} ${v.label}</button>`
  ).join("")}
</div>
<div class="lbl">STATUS</div>
<div class="filter-row">
  <button class="filter-btn ${fStat === "alla" ? "active" : ""}" onclick="setFS('alla')">Alla</button>
  ${Object.entries(STATS).map(([k, v]) =>
    `<button class="filter-btn ${fStat === k ? "active" : ""}" onclick="setFS('${k}')">${v}</button>`
  ).join("")}
</div>
<div class="lbl">TILLDELAD</div>
<div class="filter-row mb">
  <button class="filter-btn ${fAssigned === "alla" ? "active" : ""}" onclick="setFA('alla')">Alla</button>
  <button class="filter-btn ${fAssigned === "ingen" ? "active" : ""}" onclick="setFA('ingen')">Ingen</button>
  ${userOpts.map(u =>
    `<button class="filter-btn ${fAssigned === u ? "active" : ""}" onclick="setFA('${esc(u)}')">@${esc(u)}</button>`
  ).join("")}
</div>
<div class="lbl">${filtered.length} ANTECKNINGAR ${searchQuery ? `("${esc(searchQuery)}")` : ""}</div>
<div class="note-list">
  ${filtered.length === 0
    ? `<div class="empty">Inga matchar filtret</div>`
    : filtered.map(n => rCard(n)).join("")
  }
</div>`;
}

// ---- ANTECKNINGSKORT ----
function rCard(n, inTrash = false) {
  const cat = CATS[n.category];
  const prio = PRIOS[n.priority];
  const open = openId === n.id;
  const linkedMat = n.material_id ? materials.find(m => m.id === n.material_id) : null;
  const dlStatus = n.deadline ? deadlineStatus(n.deadline) : null;
  const dlLabel  = n.deadline ? deadlineLabel(n.deadline) : "";
  const noteComments = comments[n.id] || [];
  const commentCount = noteComments.length;

  return `<div class="note-card" onclick="toggleNote(${n.id})" style="border-left:3px solid ${cat?.color}${
    dlStatus === "overdue" ? ";border-top:2px solid #ff6b6b" :
    dlStatus === "urgent"  ? ";border-top:2px solid var(--accent)" : ""
  }">
  <div class="note-tags">
    <span class="tag" style="background:${cat?.color}22;color:${cat?.color}">${cat?.emoji} ${cat?.label?.toUpperCase()}</span>
    <span style="font-size:9px;color:${prio?.color};font-family:var(--display);font-weight:700">● ${prio?.label}</span>
    <span style="font-size:9px;color:${n.status === "klar" ? "#4CAF7D" : "var(--muted)"}">${STATS[n.status] || esc(n.status)}</span>
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
    ${inTrash ? `<span style="color:var(--accent)">· raderad ${fmtDateOnly(n.deleted_at)}</span>` : ""}
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
      const canMod = isAdmin || c.created_by === user;
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
    <button class="btn-ghost" onclick="permDelete(${n.id})" style="margin-left:auto;color:var(--accent);border-color:var(--accent)">🗑 Radera permanent</button>
  </div>
  ` : ""}
</div>`;
}

// ============================================================
// MATERIAL-FLIKEN — med sub-tabs (Status / Åtgärder / Returer)
// ============================================================
function rMat() {
  const actionCount = actionComments.length;
  const subTabs = `
<div class="filter-row mb" style="border-bottom:1px solid var(--border);padding-bottom:8px">
  <button class="filter-btn ${matSubTab === "status" ? "active" : ""}" onclick="setMatSubTab('status')">📦 MATERIAL STATUS</button>
  <button class="filter-btn ${matSubTab === "åtgärder" ? "active" : ""}" onclick="setMatSubTab('åtgärder')" style="${actionCount > 0 ? "border-color:#E8521A;color:#E8521A" : ""}">🚨 ÅTGÄRDER${actionCount > 0 ? ` (${actionCount})` : ""}</button>
  <button class="filter-btn ${matSubTab === "returer" ? "active" : ""}" onclick="setMatSubTab('returer')">↩ RETURER (${returnsList.length})</button>
</div>`;

  if (matSubTab === "returer") return subTabs + rReturer();
  if (matSubTab === "åtgärder") return subTabs + rMatActions();
  return subTabs + rMatStatus();
}

// ---- KOMMENTARSKORT MED STATUS ----
function rMatCommentCard(c, matId) {
  const isUrgent = c.status === "åtgärd_krävs";
  const isNeeded = c.status === "åtgärd_behövs";
  const isAction = isUrgent || isNeeded;
  const itemId = c.item_id ?? "null";
  const accentColor = isUrgent ? "#E8521A" : isNeeded ? "#E8A81A" : "#4CAF7D";
  const accentLabel = isUrgent ? "⚠ Åtgärd krävs" : isNeeded ? "⚠ Åtgärd behövs" : "✅ Klart";
  const canMod = isAdmin || c.created_by === user;

  return `<div class="comment-item" style="${isAction ? `border-left:2px solid ${accentColor};padding-left:10px;` : ""}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      ${c.text ? `<div class="comment-text" style="white-space:pre-wrap;flex:1">${esc(c.text)}</div>` : `<div style="flex:1"></div>`}
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0">
        <button onclick="cycleCommentStatus(${c.id},${matId},${itemId},'${esc(c.status || "klart")}')"
          style="font-size:10px;padding:3px 8px;border-radius:12px;border:1px solid ${accentColor};color:${accentColor};background:transparent;cursor:pointer;white-space:nowrap">
          ${accentLabel}
        </button>
        ${canMod ? `<div style="display:flex;gap:4px">
          <button class="cmt-act-btn" onclick="editMatCommentAction(${c.id},${matId},${itemId})">✎</button>
          <button class="cmt-act-btn cmt-act-del" onclick="delMatCommentAction(${c.id},${matId})">🗑</button>
        </div>` : ""}
      </div>
    </div>
    ${c.image_url ? `<img class="info-cmt-img" src="${escAttr(c.image_url)}" loading="lazy" onclick="window.open('${escAttr(c.image_url)}','_blank')">` : ""}
    <div class="comment-meta">${esc(c.created_by)} · ${fmtD(c.created_at)}</div>
  </div>`;
}

// ---- ÅTGÄRDER-VYN ----
function rMatActions() {
  const grouped = {};
  actionComments.forEach(c => {
    const mat = materials.find(m => m.id === c.material_id);
    if (!mat) return;
    if (!grouped[c.material_id]) grouped[c.material_id] = { mat, items: [] };
    grouped[c.material_id].items.push(c);
  });
  const groups = Object.values(grouped);

  return `
<div class="lbl">⚠ KRÄVER ÅTGÄRD (${actionComments.length})</div>
${groups.length === 0
  ? `<div class="empty">Inga öppna åtgärder 🎉</div>`
  : groups.map(g => {
    const matItems = materialItems[g.mat.id] || [];
    return `<div class="card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <span style="font-size:18px">${esc(g.mat.emoji || "📦")}</span>
          <span style="font-family:var(--display);font-weight:700;margin-left:6px">${esc(g.mat.name)}</span>
        </div>
        <button class="btn-ghost" onclick="openMat(${g.mat.id})">Öppna →</button>
      </div>
      ${g.items.map(c => {
        const it = c.item_id ? matItems.find(i => i.id === c.item_id) : null;
        return `<div style="margin-bottom:8px">
          ${it ? `<div style="font-size:10px;color:var(--muted);margin-bottom:3px">📎 ${esc(it.article_id)}</div>` : ""}
          ${rMatCommentCard(c, g.mat.id)}
        </div>`;
      }).join("")}
    </div>`;
  }).join("")}`;
}

// ---- ARTIKELDETALJVY (full sida) ----
function rItemDetail(it, m) {
  const stat = MAT_STATS[it.status] || MAT_STATS.tillgänglig;
  const images = materialItemImages[it.id] || [];
  const cmts = (materialComments[m.id] || []).filter(c => c.item_id === it.id);
  const history = (materialHistory[m.id] || []).filter(h => h.article_id === it.article_id);

  return `
<button class="btn-ghost mb" onclick="closeItem()">← Tillbaka till ${esc(m.name)}</button>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
    <div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${esc(m.emoji || "📦")} ${esc(m.name)}</div>
      <div style="font-family:var(--display);font-size:26px;font-weight:900">${esc(it.article_id)}</div>
      ${it.last_washed ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">🧼 Senast tvättat: ${fmtDateOnly(it.last_washed)}</div>` : ""}
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
      <span class="tag" style="background:${stat.color}22;color:${stat.color};font-size:12px;padding:4px 10px">${stat.emoji} ${stat.label.toUpperCase()}</span>
      <button class="btn-ghost" onclick="openChangeItemStatus(${it.id},${m.id})">✎ Ändra status</button>
      ${isAdmin ? `<button class="btn-ghost" onclick="doDelItem(${it.id},${m.id})" style="color:var(--accent);border-color:var(--accent)">🗑 Radera</button>` : ""}
    </div>
  </div>
</div>

<div class="card">
  <div class="lbl">BILDER (${images.length})</div>
  <div class="info-images">
    ${images.map(img =>
      `<div class="info-img-wrap">
        <img src="${escAttr(img.image_url)}" loading="lazy" onclick="window.open('${escAttr(img.image_url)}','_blank')">
        ${isAdmin ? `<button class="info-img-del" onclick="doDelItemImg(${img.id},${it.id})">×</button>` : ""}
      </div>`
    ).join("")}
    <label class="info-img-add">
      📷 Lägg till bild
      <input type="file" accept="image/*" capture="environment" style="display:none" onchange="handleItemImg(${it.id},${m.id},this)">
    </label>
  </div>
</div>

<div class="card">
  <div class="lbl">STATUSUPPDATERINGAR (${cmts.length})</div>
  ${cmts.map(c => rMatCommentCard(c, m.id)).join("")}
  <div style="margin-top:10px">
    <textarea id="item-comment-input-${it.id}" rows="2"
      placeholder="Skriv en uppdatering om ${escAttr(it.article_id)}..."
      style="width:100%;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--fg);font-size:12px;resize:vertical;font-family:inherit"
      onkeydown="if(event.ctrlKey&&event.key==='Enter')submitMatComment(${m.id},${it.id})"></textarea>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px">
      <label class="field-label" style="margin:0;font-size:10px">STATUS:</label>
      <select id="item-comment-status-${it.id}"
        style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--fg)">
        <option value="klart">✅ Klart</option>
        <option value="åtgärd_behövs">⚠ Åtgärd behövs</option>
        <option value="åtgärd_krävs">🚨 Åtgärd krävs</option>
      </select>
      <label class="btn-ghost" style="cursor:pointer;font-size:11px">
        📷 Bifoga bild
        <input type="file" accept="image/*" style="display:none" onchange="handleItemCommentImg(this)">
      </label>
      ${_itemCommentImgUrl ? `<span style="font-size:11px;color:var(--blue)">✓ Bild redo</span>` : ""}
      <button class="btn-ghost" style="margin-left:auto" onclick="submitMatComment(${m.id},${it.id})">Skicka</button>
    </div>
  </div>
</div>

${history.length > 0 ? `<div class="card">
  <div class="lbl">STATUSHISTORIK</div>
  ${history.slice(0, 10).map(h => {
    const oldS = h.old_status ? MAT_STATS[h.old_status]?.label || h.old_status : "";
    const newS = h.new_status ? MAT_STATS[h.new_status]?.label || h.new_status : "";
    return `<div style="background:var(--bg);border-left:2px solid var(--border);padding:8px 10px;margin-bottom:4px;border-radius:0 6px 6px 0">
      <div style="font-size:12px">${oldS ? esc(oldS) + " → " : ""}<b>${esc(newS)}</b></div>
      ${h.comment ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(h.comment)}</div>` : ""}
      <div style="font-size:10px;color:var(--dim);margin-top:3px">${esc(h.changed_by)} · ${fmtD(h.created_at)}</div>
    </div>`;
  }).join("")}
</div>` : ""}`;
}

// ---- MATERIAL STATUS-VYN ----
function rMatStatus() {
  // Om ett material är öppet — visa detaljvyn
  if (openMatId) {
    const m = materials.find(m => m.id === openMatId);
    if (m) return rMatDetail(m);
  }

  return `
${isAdmin ? `<button class="btn mb" onclick="openAddMat()" style="width:100%">+ LÄGG TILL MATERIALTYP</button>` : ""}
<div class="lbl">MATERIALREGISTER (${materials.length})</div>
<div class="mat-list">
${materials.length === 0
  ? `<div class="empty">Inga material tillagda ännu</div>`
  : materials.map(m => rMatCardSummary(m)).join("")
}
</div>`;
}

// ---- KORT FÖR MATERIAL-LISTAN ----
function rMatCardSummary(m) {
  if (m.is_article_based) {
    const items = materialItems[m.id] || [];
    const counts = {};
    Object.keys(MAT_STATS).forEach(s => counts[s] = 0);
    items.forEach(it => { if (counts[it.status] !== undefined) counts[it.status]++; });

    return `<div class="mat-card" onclick="openMat(${m.id})" style="cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div>
      <div style="font-size:20px">${esc(m.emoji || "📦")}</div>
      <div class="mat-name">${esc(m.name)}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${items.length} artiklar · klicka för detaljer</div>
    </div>
    <div style="text-align:right;font-size:11px">
      ${Object.entries(MAT_STATS).map(([k, v]) =>
        counts[k] > 0 ? `<span style="color:${v.color};margin-left:8px">${v.emoji} ${counts[k]}</span>` : ""
      ).join("")}
    </div>
  </div>
</div>`;
  } else {
    // Lagerräknande
    const counts = materialCounts[m.id] || {};
    const borrowed = (borrowedMaterial[m.id] || []).reduce((sum, b) => sum + (b.quantity || 0), 0);
    const total = (m.total_count || 0) + borrowed;
    const tillgVal = counts.tillgänglig || 0;
    const pct = total > 0 ? Math.round(tillgVal / total * 100) : 0;
    const col = pct > 75 ? "#4CAF7D" : pct > 40 ? "#E8A81A" : "#E8521A";

    return `<div class="mat-card" onclick="openMat(${m.id})" style="cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div>
      <div style="font-size:20px">${esc(m.emoji || "📦")}</div>
      <div class="mat-name">${esc(m.name)}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${total} ${esc(m.unit || "st")} totalt${borrowed > 0 ? ` (${borrowed} inhyrt)` : ""} · klicka för detaljer</div>
    </div>
  </div>
  <div class="mat-bar"><div class="mat-fill" style="width:${pct}%;background:${col}"></div></div>
  <div class="mat-stats">
    ${Object.entries(MAT_STATS).map(([k, v]) =>
      counts[k] > 0 ? `<div class="mat-stat"><span style="color:${v.color}">${counts[k]}</span>${v.label.toUpperCase()}</div>` : ""
    ).join("")}
  </div>
</div>`;
  }
}

// ---- DETALJVY FÖR ETT MATERIAL ----
function rMatDetail(m) {
  // Om en artikel är öppen — visa full artikelvy
  if (openItemId && m.is_article_based) {
    const items = materialItems[m.id] || [];
    const it = items.find(i => i.id === openItemId);
    if (it) return rItemDetail(it, m);
  }

  const history = materialHistory[m.id] || [];
  const borrowed = borrowedMaterial[m.id] || [];
  const matImages = materialImages[m.id] || [];
  const matLevelComments = (materialComments[m.id] || []).filter(c => !c.item_id);

  let body = m.is_article_based ? rMatItemsView(m) : rMatCountsView(m);

  return `
<button class="btn-ghost mb" onclick="closeMat()">← Tillbaka till lista</button>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
    <div>
      <div style="font-size:32px">${esc(m.emoji || "📦")}</div>
      <div style="font-family:var(--display);font-size:24px;font-weight:900">${esc(m.name)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${m.is_article_based ? "Artikelbaserat" : "Lagerräknande"}</div>
    </div>
    ${isAdmin ? `<div style="display:flex;gap:6px">
      <button class="btn-ghost" onclick="openEditMat(${m.id})">✎ Redigera</button>
      <button class="btn-ghost" onclick="doDelMat(${m.id})" style="color:var(--accent);border-color:var(--accent)">🗑</button>
    </div>` : ""}
  </div>
</div>

<!-- BILDER PÅ MATERIAL -->
<div class="card">
  <div class="lbl">BILDER (${matImages.length})</div>
  <div class="info-images">
    ${matImages.map(img =>
      `<div class="info-img-wrap">
        <img src="${escAttr(img.image_url)}" loading="lazy" onclick="window.open('${escAttr(img.image_url)}','_blank')">
        ${isAdmin ? `<button class="info-img-del" onclick="doDelMatImg(${img.id},${m.id})">×</button>` : ""}
      </div>`
    ).join("")}
    <label class="info-img-add">
      📷 Lägg till bild
      <input type="file" accept="image/*" capture="environment" style="display:none" onchange="handleMatImg(${m.id},this)">
    </label>
  </div>
</div>

${body}

<!-- INHYRT MATERIAL (lagerräknande) -->
${!m.is_article_based ? `
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div class="lbl" style="margin:0">INHYRT MATERIAL (${borrowed.length})</div>
    ${isAdmin ? `<button class="btn-ghost" onclick="openAddBorrowed(${m.id})">+ LÄGG TILL</button>` : ""}
  </div>
  ${borrowed.length === 0
    ? `<div style="font-size:12px;color:var(--muted)">Inget inhyrt material för tillfället</div>`
    : borrowed.map(b => `<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:6px">
        <div style="font-family:var(--display);font-weight:700">${b.quantity} ${esc(m.unit || "st")} från ${esc(b.supplier || "okänd")}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">${fmtDateOnly(b.start_date)}${b.end_date ? ` → ${fmtDateOnly(b.end_date)}` : " — pågående"}</div>
        ${b.reason ? `<div style="font-size:11px;margin-top:4px">${esc(b.reason)}</div>` : ""}
        ${b.comment ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">${esc(b.comment)}</div>` : ""}
        ${isAdmin ? `<div style="margin-top:8px"><button class="btn-ghost" onclick="doDelBorrowed(${b.id},${m.id})" style="font-size:10px">🗑 Ta bort</button></div>` : ""}
      </div>`).join("")
  }
</div>` : ""}

<!-- INFO-TEXT -->
${m.info_text ? `<div class="card">
  <div class="lbl">INFO</div>
  <div style="font-size:12px;line-height:1.7;white-space:pre-wrap">${esc(m.info_text)}</div>
</div>` : ""}

<!-- KOMMENTARER PÅ MATERIAL -->
<div class="card">
  <div class="lbl">KOMMENTARER (${matLevelComments.length})</div>
  ${matLevelComments.map(c => rMatCommentCard(c, m.id)).join("")}
  <div style="margin-top:10px">
    <textarea id="mat-comment-input-${m.id}" rows="2"
      placeholder="Skriv en kommentar om ${escAttr(m.name)}..."
      style="width:100%;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--fg);font-size:12px;resize:vertical;font-family:inherit"
      onkeydown="if(event.ctrlKey&&event.key==='Enter')submitMatComment(${m.id},null)"></textarea>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px">
      <label class="field-label" style="margin:0;font-size:10px">STATUS:</label>
      <select id="mat-comment-status-${m.id}"
        style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--fg)">
        <option value="klart">✅ Klart</option>
        <option value="åtgärd_behövs">⚠ Åtgärd behövs</option>
        <option value="åtgärd_krävs">🚨 Åtgärd krävs</option>
      </select>
      <label class="btn-ghost" style="cursor:pointer;font-size:11px">
        📷 Bifoga bild
        <input type="file" accept="image/*" style="display:none" onchange="handleMatCommentImg(this)">
      </label>
      ${_matCommentImgUrl ? `<span style="font-size:11px;color:var(--blue)">✓ Bild redo</span>` : ""}
      <button class="btn-ghost" style="margin-left:auto" onclick="submitMatComment(${m.id},null)">Skicka</button>
    </div>
  </div>
</div>

<!-- HISTORIK -->
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div class="lbl" style="margin:0">SENASTE UPPDATERINGAR</div>
    <button class="btn-ghost" onclick="reloadMatHistory(${m.id})">↻ Uppdatera</button>
  </div>
  ${history.length === 0
    ? `<div style="font-size:12px;color:var(--muted)">Ingen historik än</div>`
    : history.slice(0, 15).map(h => {
        const oldS = h.old_status ? MAT_STATS[h.old_status]?.label || h.old_status : "";
        const newS = h.new_status ? MAT_STATS[h.new_status]?.label || h.new_status : "";
        return `<div style="background:var(--bg);border-left:2px solid var(--border);padding:8px 10px;margin-bottom:4px;border-radius:0 6px 6px 0">
          <div style="font-size:12px">${h.article_id ? `<b>${esc(h.article_id)}</b>: ` : ""}${oldS ? esc(oldS) + " → " : ""}<b>${esc(newS)}</b>${h.count_change ? ` (${h.count_change > 0 ? "+" : ""}${h.count_change})` : ""}</div>
          ${h.comment ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(h.comment)}</div>` : ""}
          <div style="font-size:10px;color:var(--dim);margin-top:3px">${esc(h.changed_by)} · ${fmtD(h.created_at)}</div>
        </div>`;
      }).join("")
  }
</div>`;
}

// ---- ARTIKELBASERAD VY (lista över artiklar) ----
function rMatItemsView(m) {
  const items = materialItems[m.id] || [];
  const sortedItems = [...items].sort((a, b) =>
    (a.article_id || "").localeCompare(b.article_id || "", "sv", { numeric: true })
  );

  return `
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div class="lbl" style="margin:0">ARTIKLAR (${items.length})</div>
    ${isAdmin ? `<button class="btn-ghost" onclick="openAddItem(${m.id})">+ NY ARTIKEL</button>` : ""}
  </div>
  ${sortedItems.length === 0
    ? `<div style="font-size:12px;color:var(--muted)">Inga artiklar tillagda</div>`
    : sortedItems.map(it => {
        const stat = MAT_STATS[it.status] || MAT_STATS.tillgänglig;
        const itComments = (materialComments[m.id] || []).filter(c => c.item_id === it.id);
        const cmtCount = itComments.length;
        const actionCount = itComments.filter(c => c.status === "åtgärd_krävs").length;
        return `<div style="background:var(--bg);border:1px solid var(--border);border-left:3px solid ${stat.color};border-radius:8px;margin-bottom:8px;cursor:pointer" onclick="openItem(${it.id})">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px">
            <div>
              <div style="font-family:var(--display);font-weight:700;font-size:15px">${esc(it.article_id)}</div>
              <div style="display:flex;gap:10px;margin-top:3px;flex-wrap:wrap">
                ${it.last_washed ? `<span style="font-size:10px;color:var(--muted)">🧼 ${fmtDateOnly(it.last_washed)}</span>` : ""}
                ${cmtCount ? `<span style="font-size:10px;color:var(--muted)">💬 ${cmtCount}</span>` : ""}
                ${actionCount ? `<span style="font-size:10px;color:#E8521A;font-weight:700">⚠ ${actionCount} åtgärd${actionCount > 1 ? "er" : ""}</span>` : ""}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">
              <span class="tag" style="background:${stat.color}22;color:${stat.color}">${stat.emoji} ${stat.label.toUpperCase()}</span>
              <button class="btn-ghost" onclick="openChangeItemStatus(${it.id},${m.id})">Ändra</button>
              ${isAdmin ? `<button class="btn-ghost" onclick="doDelItem(${it.id},${m.id})" style="color:var(--accent)">🗑</button>` : ""}
            </div>
          </div>
        </div>`;
      }).join("")
  }
</div>`;
}

// ---- LAGERRÄKNANDE VY (status-räkning) ----
function rMatCountsView(m) {
  const counts = materialCounts[m.id] || {};
  const borrowed = (borrowedMaterial[m.id] || []).reduce((sum, b) => sum + (b.quantity || 0), 0);
  const own = m.total_count || 0;
  const total = own + borrowed;

  return `
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div>
      <div class="lbl" style="margin-bottom:4px">TOTALT ANTAL</div>
      <div style="font-family:var(--display);font-size:30px;font-weight:900">${total} ${esc(m.unit || "st")}</div>
      ${borrowed > 0 ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${own} eget + <span style="color:var(--blue)">${borrowed} inhyrt</span></div>` : ""}
    </div>
    ${isAdmin ? `<button class="btn-ghost" onclick="openSetTotal(${m.id})">✎ Ändra total</button>` : ""}
  </div>

  <div class="lbl">STATUS-FÖRDELNING</div>
  ${Object.entries(MAT_STATS).map(([k, v]) => {
    const count = counts[k] || 0;
    const pct = total > 0 ? Math.round(count / total * 100) : 0;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="color:${v.color};font-family:var(--display);font-weight:700;font-size:13px">${v.emoji} ${v.label.toUpperCase()}</span>
        <span style="font-family:var(--display);font-size:16px;font-weight:700">${count} ${esc(m.unit || "st")} (${pct}%)</span>
      </div>
      <div class="mat-bar"><div class="mat-fill" style="width:${pct}%;background:${v.color}"></div></div>
    </div>`;
  }).join("")}

  <button class="btn mt" style="width:100%" onclick="openMoveCount(${m.id})">⇄ FLYTTA ANTAL MELLAN STATUSAR</button>
</div>`;
}

// ============================================================
// RETURER-FLIKEN
// ============================================================
function rReturer() {
  return `
<button class="btn mb" onclick="openAddReturn()" style="width:100%">+ NY RETUR</button>
<div class="lbl">AKTIVA RETURER (${returnsList.length})</div>
${returnsList.length === 0
  ? `<div class="empty">Inga returer ännu</div>`
  : returnsList.map(r => rReturCard(r)).join("")
}
${isAdmin && archivedReturns.length ? `
<div class="lbl mt">ARKIVERADE RETURER (${archivedReturns.length})</div>
${archivedReturns.map(r => rReturCard(r, true)).join("")}
` : ""}`;
}

function rReturCard(r, isArchived = false) {
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
    ${isAdmin ? (isArchived
      ? `<button class="btn-ghost" onclick="toggleReturnArchive(${r.id},false)">↩ Aktivera</button>`
      : `<button class="btn-ghost" onclick="toggleReturnArchive(${r.id},true)">📁 Arkivera</button>`
    ) : ""}
    ${isAdmin ? `<button class="btn-ghost" onclick="doDelReturn(${r.id})" style="margin-left:auto;color:var(--accent);border-color:var(--accent)">🗑</button>` : ""}
  </div>
</div>`;
}

// ============================================================
// PLAN-FLIKEN (Arbetsplanering)
// ============================================================
function rPlan() {
  // Detaljvy
  if (openTaskId) {
    const t = [...tasks, ...archivedTasks].find(t => t.id === openTaskId);
    if (t) return rTaskDetail(t);
  }

  const subTabs = `
<div class="filter-row mb" style="border-bottom:1px solid var(--border);padding-bottom:8px">
  <button class="filter-btn ${planSubTab === "aktiva" ? "active" : ""}" onclick="setPlanSubTab('aktiva')">📋 AKTIVA (${tasks.length})</button>
  ${isAdmin ? `<button class="filter-btn ${planSubTab === "arkiv" ? "active" : ""}" onclick="setPlanSubTab('arkiv')">📁 ARKIV (${archivedTasks.length})</button>` : ""}
</div>`;

  if (planSubTab === "arkiv" && isAdmin) return subTabs + rPlanArchive();
  return subTabs + rPlanActive();
}

function rPlanActive() {
  const allUsers = USERS.filter(u => u !== "Admin");
  const filtered = tasks.filter(t => {
    if (planPersonFilter === "alla") return true;
    if (planPersonFilter === "ingen") return !t.responsible && !(t.assigned_to || []).length;
    return t.responsible === planPersonFilter || (t.assigned_to || []).includes(planPersonFilter);
  });

  return `
${isAdmin ? `<button class="btn mb" onclick="openAddTask()" style="width:100%">+ NY UPPGIFT</button>` : ""}
<div class="lbl">FILTRERA PÅ PERSON</div>
<div class="filter-row mb">
  <button class="filter-btn ${planPersonFilter === "alla" ? "active" : ""}" onclick="setPlanPersonFilter('alla')">Alla</button>
  <button class="filter-btn ${planPersonFilter === "ingen" ? "active" : ""}" onclick="setPlanPersonFilter('ingen')">Ej tilldelat</button>
  ${allUsers.map(u => `<button class="filter-btn ${planPersonFilter === u ? "active" : ""}" onclick="setPlanPersonFilter('${esc(u)}')">${esc(u)}</button>`).join("")}
</div>
<div class="lbl">${filtered.length} UPPGIFTER</div>
${filtered.length === 0
  ? `<div class="empty">Inga uppgifter matchar filtret</div>`
  : filtered.map(t => rTaskListRow(t)).join("")
}`;
}

function rPlanArchive() {
  return `
${archivedTasks.length === 0
  ? `<div class="empty">Inget arkiverat</div>`
  : archivedTasks.map(t => rTaskListRow(t, true)).join("")
}`;
}

// ---- KOMPAKT UPPGIFTSRAD I LISTAN ----
function rTaskListRow(t, isArchived = false) {
  const prio = PRIOS[t.priority] || PRIOS.medel;
  const stat = TASK_STATS[t.status] || TASK_STATS.ny;
  const dlStatus = t.deadline ? deadlineStatus(t.deadline) : null;
  const dlLabel  = t.deadline ? deadlineLabel(t.deadline) : "";
  const isDone = t.status === "klar";
  const cmtCount = (taskComments[t.id] || []).length;
  const checkItems = taskChecklists[t.id] || [];
  const doneItems = checkItems.filter(i => i.done).length;

  const lastUpdate = cmtCount
    ? fmtD((taskComments[t.id] || []).at(-1)?.created_at)
    : fmtD(t.updated_at || t.created_at);

  return `<div class="task-row" onclick="openTaskDetail(${t.id})" style="border-left:3px solid ${prio.color};${isDone ? "opacity:.55;" : ""}${
    dlStatus === "overdue" ? "border-top:2px solid #ff6b6b;" :
    dlStatus === "urgent"  ? "border-top:2px solid var(--accent);" : ""
  }">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
    <div style="flex:1;min-width:0">
      <div style="font-family:var(--display);font-weight:700;font-size:15px;${isDone ? "text-decoration:line-through;color:var(--muted);" : ""}">${esc(t.title)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;align-items:center">
        <span style="font-size:9px;color:${prio.color};font-family:var(--display);font-weight:700">● ${prio.label}</span>
        <span style="font-size:9px;color:${stat.color};font-family:var(--display);font-weight:700">${stat.label.toUpperCase()}</span>
        ${t.responsible ? `<span class="note-assign">⭐ ${esc(t.responsible)}</span>` : ""}
        ${(t.assigned_to || []).filter(u => u !== t.responsible).map(u => `<span class="note-assign">@${esc(u)}</span>`).join("")}
        ${dlStatus ? `<span class="${deadlineBadgeClass(dlStatus)}">${esc(dlLabel)}</span>` : ""}
        ${checkItems.length ? `<span style="font-size:9px;color:var(--muted)">✓ ${doneItems}/${checkItems.length}</span>` : ""}
        ${cmtCount ? `<span style="font-size:9px;color:var(--muted)">💬 ${cmtCount}</span>` : ""}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:10px;color:var(--dim)">Uppdaterat</div>
      <div style="font-size:10px;color:var(--muted)">${lastUpdate}</div>
    </div>
  </div>
  <div class="note-meta" style="margin-top:4px">
    <span>Skapad ${fmtD(t.created_at)} av ${esc(t.created_by || "")}</span>
    ${t.start_date ? `<span>· start ${fmtDateOnly(t.start_date)}</span>` : ""}
  </div>
</div>`;
}

// ---- FULL DETALJSIDA FÖR UPPGIFT ----
function rTaskDetail(t) {
  const prio = PRIOS[t.priority] || PRIOS.medel;
  const stat = TASK_STATS[t.status] || TASK_STATS.ny;
  const dlStatus = t.deadline ? deadlineStatus(t.deadline) : null;
  const dlLabel  = t.deadline ? deadlineLabel(t.deadline) : "";
  const isDone = t.status === "klar";
  const log = taskStatusLogs[t.id] || [];
  const cmts = taskComments[t.id] || [];
  const checkItems = taskChecklists[t.id] || [];
  const isArchived = archivedTasks.some(a => a.id === t.id);

  return `
<button class="btn-ghost mb" onclick="closeTaskDetail()">← Tillbaka till planering</button>

<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
    <div style="flex:1;min-width:0">
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
        <span style="font-size:9px;color:${prio.color};font-family:var(--display);font-weight:700">● ${prio.label}</span>
        <span style="font-size:9px;color:${stat.color};font-family:var(--display);font-weight:700">${stat.label.toUpperCase()}</span>
        ${dlStatus ? `<span class="${deadlineBadgeClass(dlStatus)}">${esc(dlLabel)}</span>` : ""}
      </div>
      <div style="font-family:var(--display);font-size:24px;font-weight:900;${isDone ? "text-decoration:line-through;color:var(--muted);" : ""}">${esc(t.title)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px">
        Skapad ${fmtD(t.created_at)} av ${esc(t.created_by || "")}
        ${t.start_date ? `· start ${fmtDateOnly(t.start_date)}` : ""}
      </div>
    </div>
    ${isAdmin || t.responsible === user ? `<div style="display:flex;flex-direction:column;gap:6px">
      <button class="btn-ghost" onclick="openEditTask(${t.id})">✎ Redigera</button>
      ${isAdmin ? `<button class="btn-ghost" onclick="doDelTask(${t.id})" style="color:var(--accent);border-color:var(--accent)">🗑</button>` : ""}
    </div>` : ""}
  </div>

  <div class="lbl">PERSONAL</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${t.responsible ? `<span class="note-assign" style="font-size:12px;padding:4px 10px">⭐ ${esc(t.responsible)}</span>` : ""}
    ${(t.assigned_to || []).filter(u => u !== t.responsible).map(u => `<span class="note-assign" style="font-size:12px;padding:4px 10px">@${esc(u)}</span>`).join("")}
    ${t.extra_staff > 0 ? `<span class="note-assign" style="font-size:12px;padding:4px 10px">+${t.extra_staff} extra inhyrd</span>` : ""}
    ${!t.responsible && !(t.assigned_to || []).length ? `<span style="font-size:12px;color:var(--muted)">Ingen tilldelad</span>` : ""}
  </div>

  <div class="lbl">STATUS</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${Object.entries(TASK_STATS).map(([k, v]) =>
      `<button class="status-btn ${t.status === k ? "active" : ""}" onclick="setTaskStatus(${t.id},'${k}')">${v.label}</button>`
    ).join("")}
    ${isAdmin && !isArchived && t.status === "klar" ? `<button class="btn-ghost" onclick="archiveTask(${t.id},true)">📁 Arkivera</button>` : ""}
    ${isAdmin && isArchived ? `<button class="btn-ghost" onclick="archiveTask(${t.id},false)">↩ Aktivera</button>` : ""}
  </div>
</div>

${t.description ? `<div class="card">
  <div class="lbl">BESKRIVNING</div>
  <div style="font-size:13px;line-height:1.7;white-space:pre-wrap">${esc(t.description)}</div>
</div>` : ""}

<!-- CHECKLISTA -->
<div class="card">
  <div class="lbl">CHECKLISTA (${checkItems.filter(i=>i.done).length}/${checkItems.length})</div>
  ${checkItems.length === 0 ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Inga punkter ännu — lägg till nedan</div>` : ""}
  ${checkItems.map(item => `
    <div class="checklist-item">
      <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;flex:1">
        <input type="checkbox" ${item.done ? "checked" : ""} onchange="toggleChecklist(${t.id},${item.id},this.checked)"
          style="width:18px;height:18px;margin-top:1px;flex-shrink:0;accent-color:var(--accent)">
        <span style="font-size:13px;${item.done ? "text-decoration:line-through;color:var(--muted);" : ""}">${esc(item.text)}</span>
      </label>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <span style="font-size:10px;color:var(--dim)">${esc(item.created_by)}</span>
        <button class="cmt-act-btn cmt-act-del" onclick="delChecklistAction(${t.id},${item.id})">🗑</button>
      </div>
    </div>
  `).join("")}
  <div style="display:flex;gap:6px;margin-top:10px">
    <input type="text" id="checklist-new-${t.id}" placeholder="Ny checklistpunkt..." style="flex:1"
      onkeydown="if(event.key==='Enter')addChecklistAction(${t.id})">
    <button class="btn-ghost" onclick="addChecklistAction(${t.id})">+ Lägg till</button>
  </div>
</div>

<!-- DAGLIGA UPPDATERINGAR -->
<div class="card">
  <div class="lbl">DAGLIGA UPPDATERINGAR (${cmts.length})</div>
  ${cmts.map(c => {
    const canMod = isAdmin || c.created_by === user;
    return `<div class="comment-item">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
        <div class="comment-text" style="white-space:pre-wrap;flex:1">${esc(c.text)}</div>
        ${canMod ? `<div style="display:flex;gap:4px;flex-shrink:0">
          <button class="cmt-act-btn" onclick="editTaskCommentAction(${t.id},${c.id},'${escAttr(c.text)}')">✎</button>
          <button class="cmt-act-btn cmt-act-del" onclick="delTaskCommentAction(${t.id},${c.id})">🗑</button>
        </div>` : ""}
      </div>
      <div class="comment-meta">${esc(c.created_by)} · ${fmtD(c.created_at)}</div>
    </div>`;
  }).join("")}
  <div class="comment-input-row" style="margin-top:10px">
    <input type="text" id="task-comment-input-${t.id}" placeholder="Lägg till daglig uppdatering..."
      onkeydown="if(event.key==='Enter')submitTaskComment(${t.id})">
    <button class="btn-ghost" onclick="submitTaskComment(${t.id})">Skicka</button>
  </div>
</div>

${log.length > 0 ? `<div class="card">
  <div class="lbl">STATUSHISTORIK (${log.length})</div>
  ${log.slice(0, 10).map(l =>
    `<div class="comment-item">
      <div class="comment-text">${esc(l.old_status ? TASK_STATS[l.old_status]?.label || l.old_status : "skapad")} → <b>${esc(TASK_STATS[l.new_status]?.label || l.new_status)}</b></div>
      <div class="comment-meta">${esc(l.changed_by)} · ${fmtD(l.created_at)}</div>
    </div>`
  ).join("")}
</div>` : ""}`;
}

// ============================================================
// PAPPERSKORG-FLIKEN
// ============================================================
function rTrash() {
  return `
<div class="lbl">PAPPERSKORG (${trashedNotes.length})</div>
<p style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.6">
  Raderade anteckningar sparas här i ${TRASH_DAYS} dagar innan de försvinner permanent.
</p>
${trashedNotes.length === 0
  ? `<div class="empty">Papperskorgen är tom</div>`
  : `<div class="row mb"><button class="btn btn-red" onclick="emptyTrash()" style="flex:1">🗑 TÖM PAPPERSKORG</button></div>
     <div class="note-list">${trashedNotes.map(n => rCard(n, true)).join("")}</div>`
}`;
}

// ============================================================
// CHATT-FLIKEN
// ============================================================
function rChat() {
  const msgs = chat.map(m =>
    `<div class="chat-msg ${m.role}">
      <div class="chat-bubble ${m.role === "user" ? "user" : "ai"}">${esc(m.content)}</div>
    </div>`
  ).join("");

  return `
<div class="chat-box" id="chat-box">
  ${chat.length === 0
    ? `<div class="chat-empty">Ställ en fråga om lagret, materialet eller arbetet.<br><br><span style="color:var(--dim)">T.ex. "Vad ska jag prioritera idag?" eller "Tips för kravallstaket?"</span></div>`
    : msgs + (loading ? `<div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>` : "")
  }
</div>
<div class="chat-row">
  <input type="text" id="chat-input" placeholder="Skriv en fråga..." onkeydown="if(event.key==='Enter')sendChat()">
  <button class="btn" onclick="sendChat()" ${loading ? "disabled" : ""}>→</button>
</div>
<div class="quick-qs">
  <div class="lbl" style="margin-top:12px">SNABBFRÅGOR</div>
  ${[
    "Vad bör jag prioritera idag?",
    "Tips för reparation av kravallstaket",
    "Hur lagrar man golvplattor rätt?",
    "Ge mig en veckosammanfattning",
    "Hur rengör man kabelskydd effektivt?"
  ].map(q => `<button class="quick-q" onclick="setQ('${escAttr(q)}')">${esc(q)}</button>`).join("")}
</div>`;
}

// ============================================================
// EXPORT-FLIKEN
// ============================================================
function rExport() {
  const now = new Date().toLocaleDateString("sv-SE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const active = notes.filter(n => n.status !== "klar");
  let out = `LAGERRAPPORT — ${now}\nInloggad: ${user}\n${"═".repeat(40)}\n\n`;

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
      const linkedMat = n.material_id ? materials.find(m => m.id === n.material_id) : null;
      out += `  ${n.status === "pågår" ? "⏳" : "○"} ${n.text} [${PRIOS[n.priority]?.label}]${
        n.assigned_to ? ` → @${n.assigned_to}` : ""
      }${linkedMat ? ` (📦 ${linkedMat.name})` : ""} (${n.created_by}, ${fmtD(n.created_at)})${
        n.deadline ? ` [${deadlineLabel(n.deadline)}]` : ""
      }\n`;
    });
    out += "\n";
  });

  if (materials.length) {
    out += "📦 MATERIALSTATUS\n";
    materials.forEach(m => {
      if (m.is_article_based) {
        const items = materialItems[m.id] || [];
        const counts = {};
        Object.keys(MAT_STATS).forEach(s => counts[s] = 0);
        items.forEach(it => { if (counts[it.status] !== undefined) counts[it.status]++; });
        out += `  ${m.emoji || "📦"} ${m.name} (${items.length} artiklar): ${Object.entries(counts).filter(([_, n]) => n > 0).map(([s, n]) => `${n} ${MAT_STATS[s]?.label || s}`).join(", ")}\n`;
      } else {
        const counts = materialCounts[m.id] || {};
        const borrowed = (borrowedMaterial[m.id] || []).reduce((s, b) => s + (b.quantity || 0), 0);
        const total = (m.total_count || 0) + borrowed;
        out += `  ${m.emoji || "📦"} ${m.name}: ${total} ${m.unit || "st"} totalt — ${Object.entries(counts).filter(([_, n]) => n > 0).map(([s, n]) => `${n} ${MAT_STATS[s]?.label || s}`).join(", ")}\n`;
      }
    });
    out += "\n";
  }

  if (tasks.length) {
    out += "📋 ARBETSPLANERING\n";
    tasks.forEach(t => {
      out += `  ${t.status === "klar" ? "✓" : t.status === "pågår" ? "⏳" : "○"} ${t.title} [${PRIOS[t.priority]?.label}]${t.responsible ? ` ⭐ ${t.responsible}` : ""}${(t.assigned_to || []).length ? ` (${(t.assigned_to || []).join(", ")})` : ""}${t.extra_staff > 0 ? ` +${t.extra_staff} extra` : ""}${t.deadline ? ` [${deadlineLabel(t.deadline)}]` : ""}\n`;
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
<div class="lbl mt">SKICKA VECKOSAMMANFATTNING NU</div>
<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
  <input type="email" id="weekly-mail-input" placeholder="E-postadress" value="andreas.glad@eps.net" style="flex:1">
  <button class="btn btn-blue" onclick="sendWeeklyNow()">📧 SKICKA</button>
</div>
<div id="ai-box"></div>`;
}

// ============================================================
// INFO/FAQ-FLIKEN
// ============================================================
function rInfo() {
  return `
<div class="info-split">
  <div class="info-sidebar">${rInfoList()}</div>
  <div class="info-content">${rInfoContent()}</div>
</div>`;
}

function rInfoList() {
  let html = `<button class="btn mb" onclick="startNewInfo()" style="width:100%">+ NYTT FÖRSLAG</button>`;
  Object.entries(INFO_CATS).forEach(([catName, catCfg]) => {
    const articles = infoArticles.filter(a => a.category === catName);
    if (articles.length === 0) {
      html += `<div class="info-cat-section">
        <div class="info-cat-header" style="color:${catCfg.color}">${catCfg.emoji} ${esc(catName.toUpperCase())}</div>
        <div class="info-empty">Inga artiklar</div>
      </div>`;
      return;
    }
    const pinned = articles.filter(a => a.is_pinned);
    const suggestions = articles.filter(a => !a.is_pinned);
    html += `<div class="info-cat-section">
      <div class="info-cat-header" style="color:${catCfg.color}">${catCfg.emoji} ${esc(catName.toUpperCase())}</div>
      ${pinned.map(a => rInfoListItem(a, catCfg)).join("")}
      ${suggestions.map(a => rInfoListItem(a, catCfg)).join("")}
    </div>`;
  });
  return html;
}

function rInfoListItem(a, catCfg) {
  const active = openInfoId === a.id ? " active" : "";
  const imgCount = (infoImages[a.id] || []).length;
  const cmtCount = (infoComments[a.id] || []).length;
  return `<div class="info-list-item${active}" onclick="openInfo(${a.id})" style="border-left-color:${catCfg.color}">
    <div class="info-list-title">
      ${a.is_pinned ? `<span class="info-pin">📌</span>` : `<span class="info-suggest">💡 Förslag</span>`}
      ${esc(a.title)}
    </div>
    <div class="info-list-meta">
      ${esc(a.created_by || "")}${imgCount ? ` · 📷 ${imgCount}` : ""}${cmtCount ? ` · 💬 ${cmtCount}` : ""}
    </div>
  </div>`;
}

function rInfoContent() {
  if (infoEditMode === "new" || infoEditMode === "edit") return rInfoEditor();
  if (openInfoId == null) {
    return `<div class="info-empty-state">
      <div style="font-size:48px;margin-bottom:10px">📖</div>
      <div style="font-family:var(--display);font-size:18px;margin-bottom:6px">VÄLJ EN ARTIKEL</div>
      <div style="font-size:12px;color:var(--muted);max-width:300px;text-align:center;line-height:1.6">
        Klicka på en artikel i listan, eller lägg till ett nytt förslag. Alla kan föreslå artiklar och bilder — Admin fäster det som ska bli officiellt.
      </div>
    </div>`;
  }
  const a = infoArticles.find(x => x.id === openInfoId);
  if (!a) return `<div class="info-empty-state">Artikeln hittades inte</div>`;
  return rInfoArticle(a);
}

function rInfoArticle(a) {
  const catCfg = INFO_CATS[a.category] || INFO_CATS.Utrustning;
  const images = infoImages[a.id] || [];
  const comments = infoComments[a.id] || [];
  const canEdit = isAdmin || (a.created_by === user && !a.is_pinned);

  return `
<div class="info-article-head">
  <div style="flex:1">
    <div class="info-art-cat" style="color:${catCfg.color}">${catCfg.emoji} ${esc(a.category.toUpperCase())} ${a.is_pinned ? `· 📌 FÄST` : `· 💡 FÖRSLAG`}</div>
    <div class="info-art-title">${esc(a.title)}</div>
    <div class="info-art-meta">av ${esc(a.created_by || "okänd")} · ${fmtD(a.created_at)}${a.updated_at && a.updated_at !== a.created_at ? ` · uppdaterad ${fmtD(a.updated_at)}` : ""}</div>
  </div>
  <div class="info-art-actions">
    ${isAdmin && !a.is_pinned ? `<button class="btn" onclick="pinInfoArticle(${a.id})">📌 FÄST</button>` : ""}
    ${isAdmin && a.is_pinned ? `<button class="btn-ghost" onclick="unpinInfoArticle(${a.id})">Avfäst</button>` : ""}
    ${canEdit ? `<button class="btn-ghost" onclick="startEditInfo(${a.id})">✎ Redigera</button>` : ""}
    ${isAdmin ? `<button class="btn-ghost" onclick="doDelInfoArticle(${a.id})" style="color:var(--accent);border-color:var(--accent)">🗑</button>` : ""}
  </div>
</div>

${a.body ? `<div class="info-art-body">${esc(a.body)}</div>` : ""}

<div class="info-images">
  ${images.map(img =>
    `<div class="info-img-wrap">
      <img src="${escAttr(img.image_url)}" loading="lazy" onclick="window.open('${escAttr(img.image_url)}','_blank')">
      ${isAdmin ? `<button class="info-img-del" onclick="doDelInfoImage(${img.id})">×</button>` : ""}
    </div>`
  ).join("")}
  <label class="info-img-add">
    📷 Lägg till bild
    <input type="file" accept="image/*" style="display:none" onchange="handleInfoAddImg(${a.id}, this)">
  </label>
</div>

<div class="info-comments">
  <div class="comment-lbl">KOMMENTARER & FRÅGOR (${comments.length})</div>
  ${comments.map(c =>
    `<div class="info-comment">
      <div class="comment-meta">${esc(c.created_by)} · ${fmtD(c.created_at)}${isAdmin ? ` <button class="info-cmt-del" onclick="doDelInfoComment(${c.id})">×</button>` : ""}</div>
      ${c.body ? `<div class="comment-text" style="white-space:pre-wrap">${esc(c.body)}</div>` : ""}
      ${c.image_url ? `<img class="info-cmt-img" src="${escAttr(c.image_url)}" loading="lazy" onclick="window.open('${escAttr(c.image_url)}','_blank')">` : ""}
    </div>`
  ).join("")}
  <div class="info-comment-form">
    <textarea id="info-comment-input-${a.id}" rows="2" placeholder="Skriv en kommentar eller fråga..."></textarea>
    <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
      <label class="btn-ghost" style="cursor:pointer">
        📷 Bifoga bild
        <input type="file" accept="image/*" style="display:none" onchange="handleInfoCommentImg(${a.id}, this)">
      </label>
      ${_infoCommentImgUrl ? `<span style="font-size:11px;color:var(--blue)">✓ Bild redo</span>` : ""}
      <button class="btn" style="margin-left:auto" onclick="submitInfoComment(${a.id})">Skicka</button>
    </div>
  </div>
</div>`;
}

function rInfoEditor() {
  const isNew = infoEditMode === "new";
  const a = !isNew && openInfoId ? infoArticles.find(x => x.id === openInfoId) : null;
  const presetCat = isNew ? (window._infoEditPreset || "Utrustning") : (a?.category || "Utrustning");
  const existingImgs = !isNew && a ? (infoImages[a.id] || []) : [];

  return `
<div class="info-editor">
  <div class="info-art-cat">${isNew ? "💡 NYTT FÖRSLAG" : "✎ REDIGERA ARTIKEL"}</div>
  <label class="field-label">RUBRIK</label>
  <input type="text" id="info-title" placeholder="T.ex. Truckladdning — så gör du" value="${a ? escAttr(a.title) : ""}">
  <label class="field-label">KATEGORI</label>
  <select id="info-cat">
    ${Object.entries(INFO_CATS).map(([k, v]) =>
      `<option value="${esc(k)}" ${presetCat === k ? "selected" : ""}>${v.emoji} ${esc(k)}</option>`
    ).join("")}
  </select>
  <label class="field-label">BESKRIVNING</label>
  <textarea id="info-body" rows="10" placeholder="Steg-för-steg, viktiga detaljer, varningar...">${a ? esc(a.body || "") : ""}</textarea>

  ${existingImgs.length ? `<label class="field-label">BEFINTLIGA BILDER</label>
  <div class="info-images">
    ${existingImgs.map(img =>
      `<div class="info-img-wrap">
        <img src="${escAttr(img.image_url)}" loading="lazy">
        ${isAdmin ? `<button class="info-img-del" onclick="doDelInfoImage(${img.id})">×</button>` : ""}
      </div>`
    ).join("")}
  </div>` : ""}

  <label class="field-label">LÄGG TILL BILDER (${infoEditImages.length} redo)</label>
  <div class="info-images">
    ${infoEditImages.map(url =>
      `<div class="info-img-wrap"><img src="${escAttr(url)}" loading="lazy"></div>`
    ).join("")}
    <label class="info-img-add">
      📷 Välj bild
      <input type="file" accept="image/*" style="display:none" onchange="handleInfoEditImg(this)">
    </label>
  </div>

  <div class="modal-actions" style="margin-top:14px">
    <button class="btn-ghost" onclick="cancelInfoEdit()" style="flex:1">Avbryt</button>
    <button class="btn" onclick="saveInfoArticleForm()" style="flex:1">${isNew ? "SKAPA FÖRSLAG" : "SPARA"}</button>
  </div>
</div>`;
}
