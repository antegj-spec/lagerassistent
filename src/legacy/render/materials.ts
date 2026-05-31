// ============================================================
// render/materials.ts — MATERIAL (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

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
      ${it.article_number ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">Artikelnr: ${esc(it.article_number)}</div>` : ""}
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
      ${auth.isAdmin ? `<button class="btn-ghost danger" onclick="doDelItem(${it.id},${m.id})">🗑 Radera</button>` : ""}
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
      class="field-input"
      onkeydown="if(event.ctrlKey&&event.key==='Enter')submitMatComment(${m.id},${it.id})"></textarea>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px">
      <label class="field-label" style="margin:0;font-size:10px">STATUS:</label>
      <select id="item-comment-status-${it.id}"
        class="field-select">
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

  // Fas 9: två axlar (lagerräknat/artikelbaserat) + kategori-filter + sök.
  const search = ui.matSearch.trim().toLowerCase();
  const searching = search.length > 0;
  const countList = materials.list.filter(m => !m.is_article_based);
  const articleList = materials.list.filter(m => m.is_article_based);

  // Vilka material visas?
  let shown: Material[];
  if (searching) {
    // Sök över ALLT material (båda baser, ignorera flik/kategori).
    shown = materials.list.filter(m =>
      m.name.toLowerCase().includes(search) ||
      (m.article_number || "").toLowerCase().includes(search) ||
      (m.category || "").toLowerCase().includes(search)
    );
  } else if (ui.matBasis === "article") {
    shown = articleList;
  } else {
    shown = ui.matCatFilter === null
      ? countList
      : ui.matCatFilter === ""
        ? countList.filter(m => !m.category)
        : countList.filter(m => m.category === ui.matCatFilter);
  }
  shown = [...shown].sort((a, b) => a.name.localeCompare(b.name, "sv"));

  const searchBox = `
<div class="search-box mb">
  <input type="text" id="mat-search-input" placeholder="Sök material (namn, artikelnr, kategori)..."
    value="${escAttr(ui.matSearch)}" oninput="setMatSearch(this.value)">
  ${ui.matSearch ? `<button class="search-clear" onclick="clearMatSearch()">×</button>` : ""}
</div>`;

  const basisTabs = `
<div class="filter-row">
  <button class="filter-btn ${!searching && ui.matBasis === "count" ? "active" : ""}" onclick="setMatBasis('count')">📦 Lagerräknat (${countList.length})</button>
  <button class="filter-btn ${!searching && ui.matBasis === "article" ? "active" : ""}" onclick="setMatBasis('article')">🔖 Artikelbaserat (${articleList.length})</button>
</div>`;

  // Kategori-chips visas bara för lagerräknat och inte under aktiv sökning.
  let catChips = "";
  if (!searching && ui.matBasis === "count") {
    const uncat = countList.filter(m => !m.category).length;
    const chip = (id: string | null, label: string, count: number, emoji = "") =>
      `<button class="filter-btn ${ui.matCatFilter === id ? "active" : ""}" onclick="setMatCatFilter(${id === null ? "null" : `'${escAttr(id)}'`})">${emoji ? emoji + " " : ""}${esc(label)} (${count})</button>`;
    catChips = `
<div class="filter-row">
  ${chip(null, "Alla", countList.length)}
  ${MAT_CATEGORIES.map(c => chip(c.id, c.label, countList.filter(m => m.category === c.id).length, c.emoji)).join("")}
  ${chip("", "Okategoriserad", uncat)}
</div>`;
  }

  const heading = searching
    ? `SÖKRESULTAT (${shown.length}) · "${esc(ui.matSearch)}"`
    : `MATERIALREGISTER (${shown.length})`;

  return `
${warningsBlock}
${auth.isAdmin ? `<button class="btn mb" onclick="openAddMat()" style="width:100%">+ LÄGG TILL MATERIALTYP</button>` : ""}
${searchBox}
${basisTabs}
${catChips}
<div class="lbl">${heading}</div>
<div class="mat-list">
${shown.length === 0
  ? `<div class="empty">${searching ? "Inga material matchar sökningen" : "Inga material här ännu"}</div>`
  : shown.map(m => rMatRow(m)).join("")
}
</div>`;
}

// ---- KOMPAKT RAD FÖR MATERIAL-LISTAN ----
// En rad per material. Behåller färg + antal + statuslinje. Används både
// av listvyn och av patchMaterialCard() (data-material-id krävs).
function rMatRow(m: Material): string {
  const art = m.article_number
    ? `<span class="mat-row-art">#${esc(m.article_number)}</span>` : "";
  const cat = m.category
    ? `<span class="mat-cat-badge">${esc(m.category)}</span>` : "";
  const title = `<span class="mat-row-emoji">${esc(m.emoji || "📦")}</span><span class="mat-name">${esc(m.name)}</span>${art}${cat}`;

  if (m.is_article_based) {
    const items = materials.items[m.id] || [];
    const counts: Record<string, number> = {};
    Object.keys(MAT_STATS).forEach(s => counts[s] = 0);
    items.forEach(it => { if (counts[it.status] !== undefined) counts[it.status]++; });

    return `<div class="mat-row" data-material-id="${m.id}" onclick="openMat(${m.id})">
  <div class="mat-row-top">
    <div class="mat-row-title">${title}</div>
    <div class="mat-row-avail">${items.length}<span class="mat-row-unit"> art.</span></div>
  </div>
  <div class="mat-row-stats">
    ${Object.entries(MAT_STATS).map(([k, v]) =>
      counts[k] > 0 ? `<span style="color:${v.color}">${v.emoji} ${counts[k]}</span>` : ""
    ).join("") || `<span class="mat-row-empty">Inga artiklar</span>`}
  </div>
</div>`;
  }

  // Lagerräknande
  const counts = materials.counts[m.id] || {};
  const borrowed = (materials.borrowed[m.id] || []).reduce((sum, b) => sum + (b.quantity || 0), 0);
  const total = (m.total_count || 0) + borrowed;
  const tillgVal = counts.tillgänglig || 0;
  const pct = total > 0 ? Math.round(tillgVal / total * 100) : 0;
  const col = pct > 75 ? "#4CAF7D" : pct > 40 ? "#E8A81A" : "#E8521A";

  return `<div class="mat-row" data-material-id="${m.id}" onclick="openMat(${m.id})">
  <div class="mat-row-top">
    <div class="mat-row-title">${title}</div>
    <div class="mat-row-avail" style="color:${col}">${tillgVal}<span class="mat-row-unit">/${total} ${esc(m.unit || "st")}</span></div>
  </div>
  <div class="mat-bar"><div class="mat-fill" style="width:${pct}%;background:${col}"></div></div>
  <div class="mat-row-stats">
    ${Object.entries(MAT_STATS).map(([k, v]) =>
      (counts[k as MaterialStatus] || 0) > 0 ? `<span style="color:${v.color}">${v.emoji} ${counts[k as MaterialStatus]}</span>` : ""
    ).join("")}${borrowed > 0 ? `<span class="mat-row-borrowed">+${borrowed} inhyrt</span>` : ""}
  </div>
</div>`;
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
      <button class="btn-ghost danger" onclick="doDelMat(${m.id})">🗑</button>
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
      class="field-input"
      onkeydown="if(event.ctrlKey&&event.key==='Enter')submitMatComment(${m.id},null)"></textarea>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px">
      <label class="field-label" style="margin:0;font-size:10px">STATUS:</label>
      <select id="mat-comment-status-${m.id}"
        class="field-select">
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
