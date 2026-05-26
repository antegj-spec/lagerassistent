// ============================================================
// render.js — Alla funktioner som bygger HTML för varje vy
// Beror på: config.js, ui.js
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

// ============================================================
// HEM-FLIKEN
// ============================================================
function rHem(): string {
  const hp = notes.list.filter(n => n.priority === "hög" && n.status !== "klar");
  const today = notes.list.filter(n =>
    new Date(n.created_at).toDateString() === new Date().toDateString()
  );
  const deadlineUrgent = notes.list.filter(n =>
    n.status !== "klar" && n.deadline &&
    (deadlineStatus(n.deadline) === "urgent" ||
     deadlineStatus(n.deadline) === "overdue" ||
     deadlineStatus(n.deadline) === "soon")
  );
  const cs = Object.entries(CATS).map(([k, v]) => ({
    k, v,
    a: notes.list.filter(n => n.category === k && n.status !== "klar").length,
    t: notes.list.filter(n => n.category === k).length
  })).filter(s => s.t > 0);

  // Mina uppgifter (om jag är tilldelad eller huvudansvarig)
  const myTasks = tasks.list.filter(t =>
    t.status !== "klar" &&
    (t.responsible === auth.user || (t.assigned_to || []).includes(auth.user || ""))
  );

  const matOpts  = materials.list.map(m => `<option value="${m.id}">${esc(m.emoji || "📦")} ${esc(m.name)}</option>`).join("");
  const userOpts = USERS.filter(u => u !== "Admin").map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join("");

  return `
<!-- Fas 5.6: Foto-först-flöde — kamera direkt, anteckning skapas i bakgrunden -->
<button class="btn quick-photo-btn" onclick="document.getElementById('quick-photo-file').click()"
  style="width:100%;padding:18px;font-size:16px;font-family:var(--display);font-weight:800;letter-spacing:1px;margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:10px">
  <span style="font-size:24px">📸</span> SNABBT FOTO
</button>
<input type="file" id="quick-photo-file" accept="image/*" capture="environment" style="display:none" onchange="quickPhotoNote(this)">

<div class="desktop-grid">
  <div class="card">
    <div class="lbl">NY ANTECKNING</div>
    <textarea id="note-input" rows="3" placeholder="Beskriv vad du observerat... (t.ex. 'Kravallstaket rad 3 trasig fot, brådskande')"></textarea>
    <label class="field-label">KATEGORI (auto)</label>
    <select id="note-cat">${Object.entries(CATS).filter(([k]) => k !== "intern" || INTERN_USERS.includes(auth.user || "")).map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join("")}</select>
    <label class="field-label">PRIORITET (auto)</label>
    <select id="note-prio">${Object.entries(PRIOS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select>
    <label class="field-label">TILLDELA TILL (valfritt)</label>
    <select id="note-assign"><option value="">— Ingen —</option>${userOpts}</select>
    ${materials.list.length ? `<label class="field-label">KOPPLA TILL MATERIAL (valfritt)</label>
    <select id="note-material"><option value="">— Inget —</option>${matOpts}</select>` : ""}
    <label class="field-label">DEADLINE (valfritt)</label>
    <input type="datetime-local" id="note-deadline">
    <div class="img-upload-area" onclick="document.getElementById('img-file').click()">
      ${ui.imgData
        ? `<img class="img-preview" src="${ui.imgData}">`
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
        `<div class="alert-item" style="border-left-color:var(--blue)">${esc(t.title)}${t.responsible === auth.user ? " (huvudansvarig)" : ""}</div>`
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
    <button class="btn-ghost" onclick="permDelete(${n.id})" style="margin-left:auto;color:var(--accent);border-color:var(--accent)">🗑 Radera permanent</button>
  </div>
  ` : ""}
</div>`;
}

// ============================================================
// MATERIAL-FLIKEN — med sub-tabs (Status / Åtgärder / Returer)
// ============================================================
function rMat(): string {
  // Fas 7: "Returer" lyftes ut till egen top-level sub-tab under Lager.
  // Material-internal sub-tabs är nu bara Status + Åtgärder.
  const actionCount = materials.actionComments.length;
  // Säkerställ att vi inte hänger på "returer"-state från före Fas 7.
  if (ui.matSubTab === "returer") ui.matSubTab = "status";
  const subTabs = `
<div class="filter-row mb" style="border-bottom:1px solid var(--border);padding-bottom:8px">
  <button class="filter-btn ${ui.matSubTab === "status" ? "active" : ""}" onclick="setMatSubTab('status')">📦 MATERIAL STATUS</button>
  <button class="filter-btn ${ui.matSubTab === "åtgärder" ? "active" : ""}" onclick="setMatSubTab('åtgärder')" style="${actionCount > 0 ? "border-color:#E8521A;color:#E8521A" : ""}">🚨 ÅTGÄRDER${actionCount > 0 ? ` (${actionCount})` : ""}</button>
</div>`;

  if (ui.matSubTab === "åtgärder") return subTabs + rMatActions();
  return subTabs + rMatStatus();
}

// ---- KOMMENTARSKORT MED STATUS ----
function rMatCommentCard(c: MaterialComment, matId: number): string {
  const isUrgent = c.status === "åtgärd_krävs";
  const isNeeded = c.status === "åtgärd_behövs";
  const isAction = isUrgent || isNeeded;
  const itemId = c.item_id ?? "null";
  const accentColor = isUrgent ? "#E8521A" : isNeeded ? "#E8A81A" : "#4CAF7D";
  const accentLabel = isUrgent ? "⚠ Åtgärd krävs" : isNeeded ? "⚠ Åtgärd behövs" : "✅ Klart";
  const canMod = auth.isAdmin || c.created_by === auth.user;

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
    ${c.image_url ? `<img class="info-cmt-img" src="${escAttr(c.image_url)}" loading="lazy" onclick="openLightbox('${escAttr(c.image_url)}')">` : ""}
    <div class="comment-meta">${esc(c.created_by)} · ${fmtD(c.created_at)}</div>
  </div>`;
}

// ---- ÅTGÄRDER-VYN ----
function rMatActions(): string {
  interface ActionGroup { mat: Material; items: MaterialComment[]; }
  const grouped: Record<number, ActionGroup> = {};
  materials.actionComments.forEach(c => {
    const mat = materials.list.find(m => m.id === c.material_id);
    if (!mat) return;
    if (!grouped[c.material_id]) grouped[c.material_id] = { mat, items: [] };
    grouped[c.material_id].items.push(c);
  });
  const groups: ActionGroup[] = Object.values(grouped);

  return `
<div class="lbl">⚠ KRÄVER ÅTGÄRD (${materials.actionComments.length})</div>
${groups.length === 0
  ? `<div class="empty">Inga öppna åtgärder 🎉</div>`
  : groups.map(g => {
    const matItems = materials.items[g.mat.id] || [];
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
function rItemDetail(it: MaterialItem, m: Material): string {
  const stat = MAT_STATS[it.status] || MAT_STATS.tillgänglig;
  const images = materials.itemImages[it.id] || [];
  const cmts = (materials.comments[m.id] || []).filter(c => c.item_id === it.id);
  const history = (materials.history[m.id] || []).filter(h => h.article_id === it.article_id);

  // Fas 6.8: räkna ut om service är överskriden
  const serviceOverdue = it.service_interval_days != null && it.last_washed
    ? (Date.now() - new Date(it.last_washed).getTime()) / 86400000 > it.service_interval_days
    : false;
  const daysSinceWash = it.last_washed
    ? Math.floor((Date.now() - new Date(it.last_washed).getTime()) / 86400000)
    : null;

  return `
<button class="btn-ghost mb" onclick="history.back()">← Tillbaka till ${esc(m.name)}</button>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
    <div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${esc(m.emoji || "📦")} ${esc(m.name)}</div>
      <div style="font-family:var(--display);font-size:26px;font-weight:900">${esc(it.article_id)}</div>
      ${it.last_washed ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">🧼 Senast tvättat: ${fmtDateOnly(it.last_washed)}${daysSinceWash != null ? ` (${daysSinceWash}d sedan)` : ""}</div>` : ""}
      ${it.status === "reserverad" && it.reserved_for ? `<div style="font-size:12px;color:#9B59B6;margin-top:6px;font-family:var(--display);font-weight:700">📌 Reserverad till: ${esc(it.reserved_for)}</div>` : ""}
      <div style="font-size:11px;color:${serviceOverdue ? "#E8521A" : "var(--muted)"};margin-top:6px">
        🔧 Service-intervall: ${it.service_interval_days != null ? `${it.service_interval_days} dagar${serviceOverdue ? " — ÖVERSKRIDEN" : ""}` : "ej satt"}
        <button class="btn-ghost" onclick="openServiceIntervalModal(${it.id},${m.id})" style="font-size:10px;padding:2px 8px;margin-left:6px">✎</button>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
      <span class="tag" style="background:${stat.color}22;color:${stat.color};font-size:12px;padding:4px 10px">${stat.emoji} ${stat.label.toUpperCase()}</span>
      <button class="btn-ghost" onclick="openChangeItemStatus(${it.id},${m.id})">✎ Ändra status</button>
      ${auth.isAdmin ? `<button class="btn-ghost" onclick="doDelItem(${it.id},${m.id})" style="color:var(--accent);border-color:var(--accent)">🗑 Radera</button>` : ""}
    </div>
  </div>
</div>

<div class="card">
  <div class="lbl">BILDER (${images.length})</div>
  <div class="info-images">
    ${images.map(img =>
      `<div class="info-img-wrap">
        <img src="${escAttr(img.image_url)}" loading="lazy" onclick="openLightbox('${escAttr(img.image_url)}')">
        ${auth.isAdmin ? `<button class="info-img-del" onclick="doDelItemImg(${img.id},${it.id})">×</button>` : ""}
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
      ${ui.itemCommentImgUrl ? `<span style="font-size:11px;color:var(--blue)">✓ Bild redo</span>` : ""}
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
function rMatStatus(): string {
  // Om ett material är öppet — visa detaljvyn
  if (materials.openId) {
    const m = materials.list.find(m => m.id === materials.openId);
    if (m) return rMatDetail(m);
  }

  // Fas 6.6: lagernivå-varningar (count-based, available < min_threshold)
  const lowStock = materials.list.filter(m =>
    !m.is_article_based && m.min_threshold != null &&
    ((materials.counts[m.id]?.tillgänglig || 0) < m.min_threshold)
  );

  // Fas 6.8: service-överskridna items
  const overdueService: { mat: Material; item: MaterialItem; daysOver: number }[] = [];
  materials.list.forEach(m => {
    if (!m.is_article_based) return;
    (materials.items[m.id] || []).forEach(it => {
      if (it.service_interval_days == null || !it.last_washed) return;
      const daysSince = (Date.now() - new Date(it.last_washed).getTime()) / 86400000;
      const daysOver = Math.floor(daysSince - it.service_interval_days);
      if (daysOver > 0) overdueService.push({ mat: m, item: it, daysOver });
    });
  });

  const warningsBlock = (lowStock.length > 0 || overdueService.length > 0) ? `
<div class="alert" style="margin-bottom:14px">
  ${lowStock.length > 0 ? `<div class="alert-title">⚠ LÅGT LAGER (${lowStock.length})</div>
    ${lowStock.map(m => {
      const avail = materials.counts[m.id]?.tillgänglig || 0;
      return `<div class="alert-item" onclick="openMat(${m.id})" style="cursor:pointer">${esc(m.emoji || "📦")} ${esc(m.name)}: ${avail} ${esc(m.unit || "st")} tillgängliga (tröskel ${m.min_threshold})</div>`;
    }).join("")}` : ""}
  ${overdueService.length > 0 ? `<div class="alert-title" style="margin-top:${lowStock.length > 0 ? "10px" : "0"}">🔧 SERVICE ÖVERSKRIDEN (${overdueService.length})</div>
    ${overdueService.slice(0, 8).map(o => `<div class="alert-item" onclick="openMat(${o.mat.id})" style="cursor:pointer">${esc(o.mat.emoji || "📦")} ${esc(o.mat.name)} ${esc(o.item.article_id)} — ${o.daysOver}d försenad</div>`).join("")}
    ${overdueService.length > 8 ? `<div class="alert-item" style="color:var(--muted)">+ ${overdueService.length - 8} fler...</div>` : ""}` : ""}
</div>` : "";

  return `
${warningsBlock}
${auth.isAdmin ? `<button class="btn mb" onclick="openAddMat()" style="width:100%">+ LÄGG TILL MATERIALTYP</button>` : ""}
<div class="lbl">MATERIALREGISTER (${materials.list.length})</div>
<div class="mat-list">
${materials.list.length === 0
  ? `<div class="empty">Inga material tillagda ännu</div>`
  : materials.list.map(m => rMatCardSummary(m)).join("")
}
</div>`;
}

// ---- KORT FÖR MATERIAL-LISTAN ----
function rMatCardSummary(m: Material): string {
  if (m.is_article_based) {
    const items = materials.items[m.id] || [];
    const counts: Record<string, number> = {};
    Object.keys(MAT_STATS).forEach(s => counts[s] = 0);
    items.forEach(it => { if (counts[it.status] !== undefined) counts[it.status]++; });

    return `<div class="mat-card" data-material-id="${m.id}" onclick="openMat(${m.id})" style="cursor:pointer">
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
    const counts = materials.counts[m.id] || {};
    const borrowed = (materials.borrowed[m.id] || []).reduce((sum, b) => sum + (b.quantity || 0), 0);
    const total = (m.total_count || 0) + borrowed;
    const tillgVal = counts.tillgänglig || 0;
    const pct = total > 0 ? Math.round(tillgVal / total * 100) : 0;
    const col = pct > 75 ? "#4CAF7D" : pct > 40 ? "#E8A81A" : "#E8521A";

    return `<div class="mat-card" data-material-id="${m.id}" onclick="openMat(${m.id})" style="cursor:pointer">
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
      (counts[k as MaterialStatus] || 0) > 0 ? `<div class="mat-stat"><span style="color:${v.color}">${counts[k as MaterialStatus]}</span>${v.label.toUpperCase()}</div>` : ""
    ).join("")}
  </div>
</div>`;
  }
}

// ---- DETALJVY FÖR ETT MATERIAL ----
function rMatDetail(m: Material): string {
  // Om en artikel är öppen — visa full artikelvy
  if (materials.openItemId && m.is_article_based) {
    const items = materials.items[m.id] || [];
    const it = items.find(i => i.id === materials.openItemId);
    if (it) return rItemDetail(it, m);
  }

  const history = materials.history[m.id] || [];
  const borrowed = materials.borrowed[m.id] || [];
  const matImages = materials.images[m.id] || [];
  const matLevelComments = (materials.comments[m.id] || []).filter(c => !c.item_id);

  let body = m.is_article_based ? rMatItemsView(m) : rMatCountsView(m);

  return `
<button class="btn-ghost mb" onclick="history.back()">← Tillbaka till lista</button>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
    <div>
      <div style="font-size:32px">${esc(m.emoji || "📦")}</div>
      <div style="font-family:var(--display);font-size:24px;font-weight:900">${esc(m.name)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${m.is_article_based ? "Artikelbaserat" : "Lagerräknande"}</div>
    </div>
    ${auth.isAdmin ? `<div style="display:flex;gap:6px">
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
        <img src="${escAttr(img.image_url)}" loading="lazy" onclick="openLightbox('${escAttr(img.image_url)}')">
        ${auth.isAdmin ? `<button class="info-img-del" onclick="doDelMatImg(${img.id},${m.id})">×</button>` : ""}
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
    ${auth.isAdmin ? `<button class="btn-ghost" onclick="openAddBorrowed(${m.id})">+ LÄGG TILL</button>` : ""}
  </div>
  ${borrowed.length === 0
    ? `<div style="font-size:12px;color:var(--muted)">Inget inhyrt material för tillfället</div>`
    : borrowed.map(b => `<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:6px">
        <div style="font-family:var(--display);font-weight:700">${b.quantity} ${esc(m.unit || "st")} från ${esc(b.supplier || "okänd")}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">${fmtDateOnly(b.start_date)}${b.end_date ? ` → ${fmtDateOnly(b.end_date)}` : " — pågående"}</div>
        ${b.reason ? `<div style="font-size:11px;margin-top:4px">${esc(b.reason)}</div>` : ""}
        ${b.comment ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">${esc(b.comment)}</div>` : ""}
        ${auth.isAdmin ? `<div style="margin-top:8px"><button class="btn-ghost" onclick="doDelBorrowed(${b.id},${m.id})" style="font-size:10px">🗑 Ta bort</button></div>` : ""}
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
      ${ui.matCommentImgUrl ? `<span style="font-size:11px;color:var(--blue)">✓ Bild redo</span>` : ""}
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
function rMatItemsView(m: Material): string {
  const items = materials.items[m.id] || [];
  const sortedItems = [...items].sort((a, b) =>
    (a.article_id || "").localeCompare(b.article_id || "", "sv", { numeric: true })
  );

  return `
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div class="lbl" style="margin:0">ARTIKLAR (${items.length})</div>
    ${auth.isAdmin ? `<button class="btn-ghost" onclick="openAddItem(${m.id})">+ NY ARTIKEL</button>` : ""}
  </div>
  ${sortedItems.length === 0
    ? `<div style="font-size:12px;color:var(--muted)">Inga artiklar tillagda</div>`
    : sortedItems.map(it => {
        const stat = MAT_STATS[it.status] || MAT_STATS.tillgänglig;
        const itComments = (materials.comments[m.id] || []).filter(c => c.item_id === it.id);
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
              ${auth.isAdmin ? `<button class="btn-ghost" onclick="doDelItem(${it.id},${m.id})" style="color:var(--accent)">🗑</button>` : ""}
            </div>
          </div>
        </div>`;
      }).join("")
  }
</div>`;
}

// ---- LAGERRÄKNANDE VY (status-räkning) ----
function rMatCountsView(m: Material): string {
  const counts = materials.counts[m.id] || {};
  const borrowed = (materials.borrowed[m.id] || []).reduce((sum, b) => sum + (b.quantity || 0), 0);
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
    ${auth.isAdmin ? `<button class="btn-ghost" onclick="openSetTotal(${m.id})">✎ Ändra total</button>` : ""}
  </div>

  <div class="lbl">STATUS-FÖRDELNING</div>
  ${Object.entries(MAT_STATS).map(([k, v]) => {
    const count = counts[k as MaterialStatus] || 0;
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
    ${auth.isAdmin ? `<button class="btn-ghost" onclick="doDelReturn(${r.id})" style="margin-left:auto;color:var(--accent);border-color:var(--accent)">🗑</button>` : ""}
  </div>
</div>`;
}

// ============================================================
// PLAN-FLIKEN (Arbetsplanering)
// ============================================================
function rPlan(): string {
  // Detaljvy
  if (tasks.openId) {
    const t = [...tasks.list, ...tasks.archived].find(t => t.id === tasks.openId);
    if (t) return rTaskDetail(t);
  }

  const subTabs = `
<div class="filter-row mb" style="border-bottom:1px solid var(--border);padding-bottom:8px">
  <button class="filter-btn ${ui.planSubTab === "aktiva" ? "active" : ""}" onclick="setPlanSubTab('aktiva')">📋 AKTIVA (${tasks.list.length})</button>
  ${auth.isAdmin ? `<button class="filter-btn ${ui.planSubTab === "arkiv" ? "active" : ""}" onclick="setPlanSubTab('arkiv')">📁 ARKIV (${tasks.archived.length})</button>` : ""}
</div>`;

  if (ui.planSubTab === "arkiv" && auth.isAdmin) return subTabs + rPlanArchive();
  return subTabs + rPlanActive();
}

function rPlanActive(): string {
  const allUsers = USERS.filter(u => u !== "Admin");
  const filtered = tasks.list.filter(t => {
    if (ui.planPersonFilter === "alla") return true;
    if (ui.planPersonFilter === "ingen") return !t.responsible && !(t.assigned_to || []).length;
    return t.responsible === ui.planPersonFilter || (t.assigned_to || []).includes(ui.planPersonFilter);
  });

  return `
${auth.isAdmin ? `<button class="btn mb" onclick="openAddTask()" style="width:100%">+ NY UPPGIFT</button>` : ""}
<div class="lbl">FILTRERA PÅ PERSON</div>
<div class="filter-row mb">
  <button class="filter-btn ${ui.planPersonFilter === "alla" ? "active" : ""}" onclick="setPlanPersonFilter('alla')">Alla</button>
  <button class="filter-btn ${ui.planPersonFilter === "ingen" ? "active" : ""}" onclick="setPlanPersonFilter('ingen')">Ej tilldelat</button>
  ${allUsers.map(u => `<button class="filter-btn ${ui.planPersonFilter === u ? "active" : ""}" onclick="setPlanPersonFilter('${esc(u)}')">${esc(u)}</button>`).join("")}
</div>
<div class="lbl">${filtered.length} UPPGIFTER</div>
${filtered.length === 0
  ? `<div class="empty">Inga uppgifter matchar filtret</div>`
  : filtered.map(t => rTaskListRow(t)).join("")
}`;
}

function rPlanArchive(): string {
  return `
${tasks.archived.length === 0
  ? `<div class="empty">Inget arkiverat</div>`
  : tasks.archived.map(t => rTaskListRow(t, true)).join("")
}`;
}

// ---- KOMPAKT UPPGIFTSRAD I LISTAN ----
function rTaskListRow(t: Task, isArchived: boolean = false): string {
  const prio = PRIOS[t.priority || "medel"] || PRIOS.medel;
  const stat = TASK_STATS[t.status] || TASK_STATS.ny;
  const dlStatus = t.deadline ? deadlineStatus(t.deadline) : null;
  const dlLabel  = t.deadline ? deadlineLabel(t.deadline) : "";
  const isDone = t.status === "klar";
  const cmtCount = (tasks.comments[t.id] || []).length;
  const checkItems = tasks.checklists[t.id] || [];
  const doneItems = checkItems.filter(i => i.done).length;

  const lastUpdate = cmtCount
    ? fmtD((tasks.comments[t.id] || []).at(-1)?.created_at || "")
    : fmtD(t.updated_at || t.created_at);

  return `<div class="task-row" data-task-id="${t.id}" onclick="openTaskDetail(${t.id})" style="border-left:3px solid ${prio.color};${isDone ? "opacity:.55;" : ""}${
    dlStatus === "overdue" ? "border-top:2px solid #ff6b6b;" :
    dlStatus === "urgent"  ? "border-top:2px solid var(--accent);" : ""
  }">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
    <div style="flex:1;min-width:0">
      <div style="font-family:var(--display);font-weight:700;font-size:15px;${isDone ? "text-decoration:line-through;color:var(--muted);" : ""}">${esc(t.title)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;align-items:center">
        <span style="font-size:9px;color:${prio.color};font-family:var(--display);font-weight:700">● ${prio.label}</span>
        <button onclick="event.stopPropagation();cycleTaskStatus(${t.id})" title="Tryck för att cykla status" style="font-size:9px;color:${stat.color};font-family:var(--display);font-weight:700;background:transparent;border:1px solid currentColor;border-radius:10px;padding:1px 8px;cursor:pointer">${stat.label.toUpperCase()}</button>
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

// ---- INFO-LÄNK-SEKTION FÖR UPPGIFT ----
function rTaskInfoLinks(taskId: number): string {
  const linkedIds = tasks.infoLinks[taskId] || [];
  const linkedArticles = linkedIds
    .map(id => info.articles.find(a => a.id === id))
    .filter(Boolean) as InfoArticle[];

  const articleOptions = info.articles
    .filter(a => !linkedIds.includes(a.id))
    .map(a => `<option value="${a.id}">${esc(a.title)}</option>`)
    .join("");

  return `
<div class="card">
  <div class="lbl">KOPPLADE GUIDER & RUTINER (${linkedArticles.length})</div>
  ${linkedArticles.length === 0 ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Inga kopplade artiklar — länka en INFO-artikel nedan</div>` : ""}
  ${linkedArticles.map(a => {
    const catCfg = INFO_CATS[a.category] || INFO_CATS.Utrustning;
    const artImages = info.images[a.id] || [];
    return `
  <details class="task-info-link">
    <summary>
      ${catCfg.emoji} <span style="flex:1">${esc(a.title)}</span>
      <span style="font-size:10px;color:var(--muted);font-weight:400">${esc(a.category)}</span>
      ${auth.isAdmin ? `<button class="cmt-act-btn cmt-act-del" onclick="event.preventDefault();removeTaskInfoLinkAction(${taskId},${a.id})" style="flex-shrink:0">🗑</button>` : ""}
    </summary>
    <div class="task-info-link-content">
      ${a.body ? `<div style="white-space:pre-wrap;margin-bottom:10px">${esc(a.body)}</div>` : ""}
      ${artImages.length > 0 ? `<div class="info-images" style="margin-bottom:0">${artImages.map(img =>
        `<div class="info-img-wrap"><img src="${escAttr(img.image_url)}" loading="lazy" onclick="openLightbox('${escAttr(img.image_url)}')"></div>`
      ).join("")}</div>` : ""}
    </div>
  </details>`;
  }).join("")}
  ${auth.isAdmin && info.articles.length > linkedIds.length ? `
  <div class="task-info-link-add">
    <select id="task-info-link-select-${taskId}">
      <option value="">— Välj artikel —</option>
      ${articleOptions}
    </select>
    <button class="btn-ghost" onclick="addTaskInfoLinkAction(${taskId})">+ Länka</button>
  </div>` : ""}
</div>`;
}

// ---- FULL DETALJSIDA FÖR UPPGIFT ----
function rTaskDetail(t: Task): string {
  const prio = PRIOS[t.priority || "medel"] || PRIOS.medel;
  const stat = TASK_STATS[t.status] || TASK_STATS.ny;
  const dlStatus = t.deadline ? deadlineStatus(t.deadline) : null;
  const dlLabel  = t.deadline ? deadlineLabel(t.deadline) : "";
  const isDone = t.status === "klar";
  const log = tasks.statusLogs[t.id] || [];
  const cmts = tasks.comments[t.id] || [];
  const checkItems = tasks.checklists[t.id] || [];
  const isArchived = tasks.archived.some(a => a.id === t.id);

  return `
<button class="btn-ghost mb" onclick="history.back()">← Tillbaka till planering</button>

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
    ${auth.isAdmin || t.responsible === auth.user ? `<div style="display:flex;flex-direction:column;gap:6px">
      <button class="btn-ghost" onclick="openEditTask(${t.id})">✎ Redigera</button>
      ${auth.isAdmin ? `<button class="btn-ghost" onclick="doDelTask(${t.id})" style="color:var(--accent);border-color:var(--accent)">🗑</button>` : ""}
    </div>` : ""}
  </div>

  <div class="lbl">PERSONAL</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${t.responsible ? `<span class="note-assign" style="font-size:12px;padding:4px 10px">⭐ ${esc(t.responsible)}</span>` : ""}
    ${(t.assigned_to || []).filter(u => u !== t.responsible).map(u => `<span class="note-assign" style="font-size:12px;padding:4px 10px">@${esc(u)}</span>`).join("")}
    ${(t.extra_staff || 0) > 0 ? `<span class="note-assign" style="font-size:12px;padding:4px 10px">+${t.extra_staff} extra inhyrd</span>` : ""}
    ${!t.responsible && !(t.assigned_to || []).length ? `<span style="font-size:12px;color:var(--muted)">Ingen tilldelad</span>` : ""}
  </div>

  <div class="lbl">STATUS</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${Object.entries(TASK_STATS).map(([k, v]) =>
      `<button class="status-btn ${t.status === k ? "active" : ""}" onclick="setTaskStatus(${t.id},'${k}')">${v.label}</button>`
    ).join("")}
    ${auth.isAdmin && !isArchived && t.status === "klar" ? `<button class="btn-ghost" onclick="archiveTask(${t.id},true)">📁 Arkivera</button>` : ""}
    ${auth.isAdmin && isArchived ? `<button class="btn-ghost" onclick="archiveTask(${t.id},false)">↩ Aktivera</button>` : ""}
  </div>
</div>

${t.description ? `<div class="card">
  <div class="lbl">BESKRIVNING</div>
  <div style="font-size:13px;line-height:1.7;white-space:pre-wrap">${esc(t.description)}</div>
</div>` : ""}

${rTaskInfoLinks(t.id)}

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
    const canMod = auth.isAdmin || c.created_by === auth.user;
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

// ============================================================
// CHATT-FLIKEN
// ============================================================
function rChat(): string {
  const msgs = chat.list.map(m =>
    `<div class="chat-msg ${m.role}">
      <div class="chat-bubble ${m.role === "user" ? "user" : "ai"}">${esc(m.content)}</div>
    </div>`
  ).join("");

  return `
<div class="chat-box" id="chat-box">
  ${chat.list.length === 0
    ? `<div class="chat-empty">Ställ en fråga om lagret, materialet eller arbetet.<br><br><span style="color:var(--dim)">T.ex. "Vad ska jag prioritera idag?" eller "Tips för kravallstaket?"</span></div>`
    : msgs + (ui.loading ? `<div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>` : "")
  }
</div>
<div class="chat-row">
  <input type="text" id="chat-input" placeholder="Skriv en fråga..." onkeydown="if(event.key==='Enter')sendChat()">
  <button class="btn" onclick="sendChat()" ${ui.loading ? "disabled" : ""}>→</button>
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
      <div class="task-row" onclick="openMat(${p.matId})" style="border-left:3px solid #E8521A;cursor:pointer">
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

// ============================================================
// INFO/FAQ-FLIKEN
// ============================================================
function rInfo(): string {
  return `
<div class="info-split">
  <div class="info-sidebar">${rInfoList()}</div>
  <div class="info-content">${rInfoContent()}</div>
</div>`;
}

function rInfoList(): string {
  let html = `<button class="btn mb" onclick="startNewInfo()" style="width:100%">+ NYTT FÖRSLAG</button>`;
  Object.entries(INFO_CATS).forEach(([catName, catCfg]) => {
    const articles = info.articles.filter(a => a.category === catName);
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

function rInfoListItem(a: InfoArticle, catCfg: { emoji: string; color: string }): string {
  const active = info.openId === a.id ? " active" : "";
  const imgCount = (info.images[a.id] || []).length;
  const cmtCount = (info.comments[a.id] || []).length;
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

function rInfoContent(): string {
  if (info.editMode === "new" || info.editMode === "edit") return rInfoEditor();
  if (info.openId == null) {
    return `<div class="info-empty-state">
      <div style="font-size:48px;margin-bottom:10px">📖</div>
      <div style="font-family:var(--display);font-size:18px;margin-bottom:6px">VÄLJ EN ARTIKEL</div>
      <div style="font-size:12px;color:var(--muted);max-width:300px;text-align:center;line-height:1.6">
        Klicka på en artikel i listan, eller lägg till ett nytt förslag. Alla kan föreslå artiklar och bilder — Admin fäster det som ska bli officiellt.
      </div>
    </div>`;
  }
  const a = info.articles.find(x => x.id === info.openId);
  if (!a) return `<div class="info-empty-state">Artikeln hittades inte</div>`;
  return rInfoArticle(a);
}

function rInfoArticle(a: InfoArticle): string {
  const catCfg = INFO_CATS[a.category] || INFO_CATS.Utrustning;
  const images = info.images[a.id] || [];
  const pdfs = info.pdfs[a.id] || [];
  const cmts = info.comments[a.id] || [];
  const canEdit = auth.isAdmin || (a.created_by === auth.user && !a.is_pinned);

  return `
<div class="info-article-head">
  <div style="flex:1">
    <div class="info-art-cat" style="color:${catCfg.color}">${catCfg.emoji} ${esc(a.category.toUpperCase())} ${a.is_pinned ? `· 📌 FÄST` : `· 💡 FÖRSLAG`}</div>
    <div class="info-art-title">${esc(a.title)}</div>
    <div class="info-art-meta">av ${esc(a.created_by || "okänd")} · ${fmtD(a.created_at)}${a.updated_at && a.updated_at !== a.created_at ? ` · uppdaterad ${fmtD(a.updated_at)}` : ""}</div>
  </div>
  <div class="info-art-actions">
    ${auth.isAdmin && !a.is_pinned ? `<button class="btn" onclick="pinInfoArticle(${a.id})">📌 FÄST</button>` : ""}
    ${auth.isAdmin && a.is_pinned ? `<button class="btn-ghost" onclick="unpinInfoArticle(${a.id})">Avfäst</button>` : ""}
    ${canEdit ? `<button class="btn-ghost" onclick="startEditInfo(${a.id})">✎ Redigera</button>` : ""}
    ${auth.isAdmin ? `<button class="btn-ghost" onclick="doDelInfoArticle(${a.id})" style="color:var(--accent);border-color:var(--accent)">🗑</button>` : ""}
  </div>
</div>

${a.body ? `<div class="info-art-body">${esc(a.body)}</div>` : ""}

<div class="info-images">
  ${images.map(img =>
    `<div class="info-img-wrap">
      <img src="${escAttr(img.image_url)}" loading="lazy" onclick="openLightbox('${escAttr(img.image_url)}')">
      ${auth.isAdmin ? `<button class="info-img-del" onclick="doDelInfoImage(${img.id})">×</button>` : ""}
    </div>`
  ).join("")}
  <label class="info-img-add">
    📷 Lägg till bild
    <input type="file" accept="image/*" style="display:none" onchange="handleInfoAddImg(${a.id}, this)">
  </label>
</div>

${`<div class="info-pdf-list">
  ${pdfs.map(p =>
    `<div class="info-pdf-item">
      <span class="info-pdf-icon">📄</span>
      <span class="info-pdf-name">${esc(p.file_name)}</span>
      <div class="info-pdf-actions">
        <button class="btn-ghost" onclick="openPdfOverlay('${escAttr(p.pdf_url)}','${escAttr(p.file_name)}')">Visa</button>
        ${auth.isAdmin ? `<button class="btn-ghost" onclick="doDelInfoPdf(${p.id})" style="color:var(--accent);border-color:var(--accent)">🗑</button>` : ""}
      </div>
    </div>`
  ).join("")}
</div>
<label class="btn-ghost" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin-bottom:12px">
  📄 Bifoga PDF
  <input type="file" accept="application/pdf" style="display:none" onchange="handleInfoAddPdf(${a.id}, this)">
</label>`}

<div class="info-comments">
  <div class="comment-lbl">KOMMENTARER & FRÅGOR (${cmts.length})</div>
  ${cmts.map(c =>
    `<div class="info-comment">
      <div class="comment-meta">${esc(c.created_by)} · ${fmtD(c.created_at)}${auth.isAdmin ? ` <button class="info-cmt-del" onclick="doDelInfoComment(${c.id})">×</button>` : ""}</div>
      ${c.body ? `<div class="comment-text" style="white-space:pre-wrap">${esc(c.body)}</div>` : ""}
      ${c.image_url ? `<img class="info-cmt-img" src="${escAttr(c.image_url)}" loading="lazy" onclick="openLightbox('${escAttr(c.image_url)}')">` : ""}
    </div>`
  ).join("")}
  <div class="info-comment-form">
    <textarea id="info-comment-input-${a.id}" rows="2" placeholder="Skriv en kommentar eller fråga..."></textarea>
    <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
      <label class="btn-ghost" style="cursor:pointer">
        📷 Bifoga bild
        <input type="file" accept="image/*" style="display:none" onchange="handleInfoCommentImg(${a.id}, this)">
      </label>
      ${ui.infoCommentImgUrl ? `<span style="font-size:11px;color:var(--blue)">✓ Bild redo</span>` : ""}
      <button class="btn" style="margin-left:auto" onclick="submitInfoComment(${a.id})">Skicka</button>
    </div>
  </div>
</div>`;
}

function rInfoEditor(): string {
  const isNew = info.editMode === "new";
  const a = !isNew && info.openId ? info.articles.find(x => x.id === info.openId) : null;
  const presetCat = isNew ? ((window as any)._infoEditPreset || "Utrustning") : (a?.category || "Utrustning");
  const existingImgs = !isNew && a ? (info.images[a.id] || []) : [];

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
        ${auth.isAdmin ? `<button class="info-img-del" onclick="doDelInfoImage(${img.id})">×</button>` : ""}
      </div>`
    ).join("")}
  </div>` : ""}

  <label class="field-label">LÄGG TILL BILDER (${info.editImages.length} redo)</label>
  <div class="info-images">
    ${info.editImages.map(url =>
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

// ============================================================
// KÖRJOURNAL (Fas 8 Etapp B)
// ============================================================

function rCarJournal(): string {
  const activeCars = cars.list.filter(c => c.active);
  const allTrips = cars.trips;

  // Filter-state (lightweight, in-memory — inte i ui-store):
  // hanteras via DOM-läsning inom render-cycle.
  const filterCar    = (document.getElementById("cj-filter-car")    as HTMLSelectElement | null)?.value || "";
  const filterDriver = (document.getElementById("cj-filter-driver") as HTMLSelectElement | null)?.value || "";
  const filterPriv   = (document.getElementById("cj-filter-priv")   as HTMLSelectElement | null)?.value || "alla";
  const filterFuel   = (document.getElementById("cj-filter-fuel")   as HTMLInputElement | null)?.checked || false;
  const filterMonth  = (document.getElementById("cj-filter-month")  as HTMLInputElement | null)?.value || "";

  let visible = allTrips;
  if (filterCar)    visible = visible.filter(t => t.car_id === filterCar);
  if (filterDriver) visible = visible.filter(t => t.driver === filterDriver);
  if (filterPriv === "privat") visible = visible.filter(t => t.is_private);
  if (filterPriv === "tjänst") visible = visible.filter(t => !t.is_private);
  if (filterFuel)   visible = visible.filter(t => t.is_fueling);
  if (filterMonth)  visible = visible.filter(t => t.trip_date.startsWith(filterMonth));

  // Gap-detektion per bil (på FILTERED tripset så vi inte visar luckor
  // användaren inte ser).
  const gapsByCar: Record<string, ReturnType<typeof detectTripGaps>> = {};
  const carsInView = Array.from(new Set(visible.map(t => t.car_id)));
  for (const cid of carsInView) {
    const tripsForCar = allTrips.filter(t => t.car_id === cid);
    gapsByCar[cid] = detectTripGaps(tripsForCar);
  }
  // Flata gap-listan + filtrera så de bara visas om båda resor är synliga.
  const visibleSet = new Set(visible.map(t => t.id));
  const visibleGaps = Object.values(gapsByCar).flat().filter(
    g => visibleSet.has(g.prev.id) && visibleSet.has(g.next.id)
  );

  const userOpts = ["", ...USERS.filter(u => u !== "Admin")].map(u =>
    `<option value="${esc(u)}" ${u === filterDriver ? "selected" : ""}>${u || "Alla förare"}</option>`
  ).join("");
  const carFilterOpts = `<option value="">Alla bilar</option>` +
    cars.list.map(c => `<option value="${esc(c.id)}" ${c.id === filterCar ? "selected" : ""}>${esc(carLabel(c))}</option>`).join("");

  return `
<div class="cj-toolbar">
  <button class="btn cj-add-btn" onclick="openAddTrip()">+ NY RESA</button>
  ${auth.isAdmin ? `<button class="btn-ghost" onclick="openCarRegistry()" title="Bilregister">⚙ Bilar</button>` : ""}
  ${auth.isAdmin ? `<button class="btn-ghost" onclick="openCarExport()" title="Exportera">📤 Export</button>` : ""}
</div>

<div class="cj-filters">
  <select id="cj-filter-car" onchange="render()">${carFilterOpts}</select>
  <select id="cj-filter-driver" onchange="render()">${userOpts}</select>
  <select id="cj-filter-priv" onchange="render()">
    <option value="alla" ${filterPriv === "alla" ? "selected" : ""}>Privat + Tjänst</option>
    <option value="tjänst" ${filterPriv === "tjänst" ? "selected" : ""}>Endast tjänst</option>
    <option value="privat" ${filterPriv === "privat" ? "selected" : ""}>Endast privat</option>
  </select>
  <input type="month" id="cj-filter-month" value="${escAttr(filterMonth)}" onchange="render()">
  <label class="cj-filter-checkbox">
    <input type="checkbox" id="cj-filter-fuel" ${filterFuel ? "checked" : ""} onchange="render()"> Bara tankningar
  </label>
</div>

${visibleGaps.length ? `
<div class="cj-gap-list">
  ${visibleGaps.map(g => rGapCard(g)).join("")}
</div>` : ""}

<div class="lbl">${visible.length} ${visible.length === 1 ? "RESA" : "RESOR"}</div>

${visible.length === 0
  ? `<div class="empty">Inga resor matchar filtret.${!allTrips.length && activeCars.length ? "<br><br>Klicka <b>+ NY RESA</b> för att börja." : ""}${!activeCars.length ? "<br><br>Inga bilar i registret än." + (auth.isAdmin ? " Klicka <b>⚙ Bilar</b>." : " Be admin lägga till en.") : ""}</div>`
  : visible.map(rTripCard).join("")}
`;
}

function rGapCard(g: { car_id: string; prev: CarTrip; next: CarTrip; gap_km: number }): string {
  const car = carById(g.car_id);
  return `
<div class="cj-gap-card">
  <div class="cj-gap-title">⚠ Lucka i mätarställning — ${g.gap_km} km saknas</div>
  <div class="cj-gap-meta">
    ${esc(car ? carLabel(car) : "Bil")} ·
    från ${g.prev.odometer_end} km (${esc(g.prev.trip_date)}) →
    till ${g.next.odometer_start} km (${esc(g.next.trip_date)})
  </div>
  <button class="btn-ghost cj-gap-fill-btn" onclick='openAddTrip(${JSON.stringify({
    car_id: g.car_id,
    trip_date: g.prev.trip_date,
    odometer_start: g.prev.odometer_end,
    odometer_end: g.next.odometer_start,
  })})'>+ Fyll luckan</button>
</div>`;
}

function rTripCard(t: CarTrip): string {
  const car = carById(t.car_id);
  const distance = t.odometer_end - t.odometer_start;
  const canEdit = auth.isAdmin || t.created_by === auth.user;
  return `
<div class="cj-trip-card${t.is_private ? " cj-trip-private" : ""}${t.is_fueling ? " cj-trip-fueling" : ""}">
  <div class="cj-trip-header">
    <div class="cj-trip-date">${esc(t.trip_date)}</div>
    <div class="cj-trip-badges">
      ${t.is_private ? `<span class="cj-badge cj-badge-private">Privat</span>` : ""}
      ${t.is_fueling ? `<span class="cj-badge cj-badge-fuel">⛽ ${t.liters ?? "?"} L · ${t.total_price ?? "?"} kr</span>` : ""}
    </div>
  </div>
  <div class="cj-trip-row"><b>${esc(car ? carLabel(car) : "—")}</b> · ${esc(t.driver)}</div>
  ${t.from_loc || t.to_loc ? `<div class="cj-trip-row">${esc(t.from_loc || "?")} → ${esc(t.to_loc || "?")}</div>` : ""}
  ${t.purpose ? `<div class="cj-trip-row cj-trip-purpose">${esc(t.purpose)}</div>` : ""}
  <div class="cj-trip-row cj-trip-odo">
    ${t.odometer_start} → ${t.odometer_end} km <b>(${distance} km)</b>
  </div>
  ${t.image_path ? `<img class="cj-trip-img" src="${escAttr(t.image_path)}" loading="lazy" onclick="openLightbox('${escAttr(t.image_path)}')">` : ""}
  ${canEdit ? `
  <div class="cj-trip-actions">
    <button class="btn-ghost" onclick="openEditTrip('${escAttr(t.id)}')">✎ Redigera</button>
    <button class="btn-ghost" onclick="doDelTrip('${escAttr(t.id)}')" style="color:var(--accent)">🗑</button>
  </div>` : ""}
</div>`;
}

// Bilregister — admin-modal
function openCarRegistry(): void {
  if (!auth.isAdmin) return;
  const list = cars.list.map(c => `
    <div class="cj-car-row">
      <div>
        <b>${esc(c.reg_nr)}</b>${c.nickname ? ` <span style="color:var(--muted)">(${esc(c.nickname)})</span>` : ""}
        ${!c.active ? ` <span class="cj-badge" style="background:var(--border)">Inaktiv</span>` : ""}
      </div>
      <div class="cj-car-actions">
        <button class="btn-ghost" onclick="toggleCarActive('${escAttr(c.id)}', ${!c.active})">${c.active ? "Inaktivera" : "Aktivera"}</button>
        <button class="btn-ghost" onclick="doDelCar('${escAttr(c.id)}')" style="color:var(--accent)">🗑</button>
      </div>
    </div>`).join("");
  openModal(`
    <div class="modal-title">Bilregister</div>
    ${cars.list.length ? `<div class="cj-car-list">${list}</div>` : `<div class="empty" style="padding:20px 0">Inga bilar.</div>`}
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Stäng</button>
      <button class="btn" onclick="openAddCar()" style="flex:1">+ NY BIL</button>
    </div>
  `);
}

// Export-väljare
function openCarExport(): void {
  if (!auth.isAdmin) return;
  const year = new Date().getFullYear();
  const carOpts = cars.list.map(c => `<option value="${esc(c.id)}">${esc(carLabel(c))}</option>`).join("");
  const driverOpts = USERS.filter(u => u !== "Admin").map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join("");
  openModal(`
    <div class="modal-title">Exportera körjournal</div>
    <p style="margin:0 0 12px;color:var(--muted);font-size:13px">Välj exporttyp. Filen laddas ner som .xlsx.</p>

    <button class="btn mt" style="width:100%" onclick="exportCarAll();closeModal()">📊 Hela körjournalen</button>

    <div class="lbl mt">PER ÅR</div>
    <div style="display:flex;gap:6px">
      <input type="number" id="exp-year" value="${year}" min="2000" max="2099" style="flex:1">
      <button class="btn-ghost" onclick="_exportYearFromForm()">Exportera år</button>
    </div>

    <div class="lbl mt">PER MÅNAD</div>
    <div style="display:flex;gap:6px">
      <input type="month" id="exp-month" value="${year}-${String(new Date().getMonth()+1).padStart(2,'0')}" style="flex:1">
      <button class="btn-ghost" onclick="_exportMonthFromForm()">Exportera månad</button>
    </div>

    <div class="lbl mt">PER FÖRARE</div>
    <div style="display:flex;gap:6px">
      <select id="exp-driver" style="flex:1">${driverOpts}</select>
      <button class="btn-ghost" onclick="_exportDriverFromForm()">Exportera</button>
    </div>

    <div class="lbl mt">PER BIL</div>
    <div style="display:flex;gap:6px">
      <select id="exp-car" style="flex:1">${carOpts}</select>
      <button class="btn-ghost" onclick="_exportCarFromForm()">Exportera</button>
    </div>

    <button class="btn-ghost mt" style="width:100%" onclick="exportCarFueling();closeModal()">⛽ Endast tankningar</button>

    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Stäng</button>
    </div>
  `);
}

// ============================================================
// EKONOMI (Fas 8 Etapp C) — admin-only utgiftshantering
// ============================================================
function rEkonomi(): string {
  if (!auth.isAdmin) {
    return `<div class="empty">Endast Admin har tillgång till Ekonomi.</div>`;
  }
  const years = getEconomyYears();
  const yearOpts = years.map(y => `<option value="${y}" ${y === economy.year ? "selected" : ""}>${y}</option>`).join("");
  const cf = economy.categoryFilter;
  const allEntries = economy.entries;
  const visible = cf === "alla" ? allEntries : allEntries.filter(e => e.category === cf);

  // Summor per kategori (på hela året, inte filtered — chips visar totals).
  const sumByCat: Record<string, number> = {};
  for (const e of allEntries) {
    sumByCat[e.category] = (sumByCat[e.category] || 0) + Number(e.price);
  }
  const yearTotal = allEntries.reduce((acc, e) => acc + Number(e.price), 0);
  const filteredTotal = visible.reduce((acc, e) => acc + Number(e.price), 0);

  const chips = `
<div class="eco-chips">
  <button class="eco-chip ${cf === "alla" ? "active" : ""}" onclick="setEconomyCategoryFilter('alla')">📊 Alla (${formatSek(yearTotal)})</button>
  ${ECONOMY_CATEGORIES.map(c => {
    const total = sumByCat[c.id] || 0;
    const active = cf === c.id;
    if (!total && !active) return "";
    return `<button class="eco-chip ${active ? "active" : ""}" onclick="setEconomyCategoryFilter('${esc(c.id)}')">${c.emoji} ${esc(c.label)} (${formatSek(total)})</button>`;
  }).filter(Boolean).join("")}
</div>`;

  // Gruppera per kategori i config-ordning, okända kategorier sist.
  const grouped: Record<string, EconomyEntry[]> = {};
  for (const e of visible) {
    (grouped[e.category] = grouped[e.category] || []).push(e);
  }
  const orderedCats: string[] = ECONOMY_CATEGORIES
    .map(c => c.id as string)
    .filter(id => (grouped[id]?.length || 0) > 0);
  for (const k of Object.keys(grouped)) {
    if (!orderedCats.includes(k)) orderedCats.push(k);
  }

  return `
<div class="eco-toolbar">
  <select id="eco-year-select" onchange="_onEconomyYearChange()" class="eco-year-select">${yearOpts}</select>
  <button class="btn" onclick="openAddEconomy()">+ NY UTGIFT</button>
</div>

${chips}

${orderedCats.length === 0
  ? `<div class="empty">Inga utgifter ${economy.year}${cf !== "alla" ? " i den här kategorin" : ""}.<br><br>Klicka <b>+ NY UTGIFT</b> för att börja.</div>`
  : orderedCats.map(cid => rEcoCategorySection(cid, grouped[cid] || [])).join("")}

<div class="eco-totals-footer">
  <div>
    <div class="eco-totals-label">${cf === "alla" ? `Total ${economy.year}` : `${economyCategoryEmoji(cf)} ${esc(economyCategoryLabel(cf))}`}</div>
    <div class="eco-totals-value">${formatSek(filteredTotal)}</div>
  </div>
  ${cf !== "alla" ? `<div style="text-align:right">
    <div class="eco-totals-label">Hela året</div>
    <div class="eco-totals-value eco-totals-secondary">${formatSek(yearTotal)}</div>
  </div>` : ""}
</div>`;
}

function rEcoCategorySection(cid: string, entries: EconomyEntry[]): string {
  const total = entries.reduce((a, e) => a + Number(e.price), 0);
  return `
<div class="eco-section">
  <div class="eco-section-header">
    <div class="eco-section-title">${economyCategoryEmoji(cid)} ${esc(economyCategoryLabel(cid))}</div>
    <div class="eco-section-total">${formatSek(total)}</div>
  </div>
  ${entries.map(rEcoEntry).join("")}
</div>`;
}

function rEcoEntry(e: EconomyEntry): string {
  return `
<div class="eco-entry">
  <div class="eco-entry-main">
    <div class="eco-entry-title">${esc(e.title)}</div>
    ${e.comment ? `<div class="eco-entry-comment">${esc(e.comment)}</div>` : ""}
  </div>
  <div class="eco-entry-price">${formatSek(e.price)}</div>
  <div class="eco-entry-actions">
    <button class="cmt-act-btn" onclick="openEditEconomy('${escAttr(e.id)}')" title="Redigera">✎</button>
    <button class="cmt-act-btn cmt-act-del" onclick="doDelEconomy('${escAttr(e.id)}')" title="Radera">🗑</button>
  </div>
</div>`;
}

// SEK-formatering: 11116 → "11 116 kr", 2557.88 → "2 558 kr" (avrundat).
function formatSek(n: number): string {
  const rounded = Math.round(Number(n));
  return rounded.toLocaleString("sv-SE") + " kr";
}
