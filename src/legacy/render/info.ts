// ============================================================
// render/info.ts — INFO (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

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
  const openArticle = info.openId != null ? info.articles.find(a => a.id === info.openId) : null;
  let html = `<button class="btn mb" onclick="startNewInfo()" style="width:100%">+ NYTT FÖRSLAG</button>`;
  Object.entries(INFO_CATS).forEach(([catName, catCfg]) => {
    const articles = info.articles.filter(a => a.category === catName);
    const isOpen = openArticle?.category === catName;
    const header = `<summary class="info-cat-header" style="color:${catCfg.color}">
        <span class="info-cat-caret">▸</span>
        <span class="info-cat-label">${catCfg.emoji} ${esc(catName.toUpperCase())}</span>
        <span class="info-cat-count">${articles.length}</span>
      </summary>`;
    if (articles.length === 0) {
      html += `<details class="info-cat-section"${isOpen ? " open" : ""}>
        ${header}
        <div class="info-empty">Inga artiklar</div>
      </details>`;
      return;
    }
    const pinned = articles.filter(a => a.is_pinned);
    const suggestions = articles.filter(a => !a.is_pinned);
    html += `<details class="info-cat-section"${isOpen ? " open" : ""}>
      ${header}
      ${pinned.map(a => rInfoListItem(a, catCfg)).join("")}
      ${suggestions.map(a => rInfoListItem(a, catCfg)).join("")}
    </details>`;
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
    ${auth.isAdmin ? `<button class="btn-ghost danger" onclick="doDelInfoArticle(${a.id})">🗑</button>` : ""}
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
      <span class="info-pdf-name">${esc(p.pdf_name)}</span>
      <div class="info-pdf-actions">
        <button class="btn-ghost" onclick="openPdfOverlay('${escAttr(p.pdf_url)}','${escAttr(p.pdf_name)}')">Visa</button>
        ${auth.isAdmin ? `<button class="btn-ghost danger" onclick="doDelInfoPdf(${p.id})">🗑</button>` : ""}
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
  // editDraft har företräde: bevarar osparad text när en upload re-renderar.
  const draft = info.editDraft;
  const titleVal = draft ? draft.title : (a ? a.title : "");
  const bodyVal = draft ? draft.body : (a ? (a.body || "") : "");
  const presetCat = draft ? draft.category
    : (isNew ? ((window as any)._infoEditPreset || "Utrustning") : (a?.category || "Utrustning"));
  const existingImgs = !isNew && a ? (info.images[a.id] || []) : [];

  return `
<div class="info-editor">
  <div class="info-art-cat">${isNew ? "💡 NYTT FÖRSLAG" : "✎ REDIGERA ARTIKEL"}</div>
  <label class="field-label">RUBRIK</label>
  <input type="text" id="info-title" placeholder="T.ex. Truckladdning — så gör du" value="${escAttr(titleVal)}">
  <label class="field-label">KATEGORI</label>
  <select id="info-cat">
    ${Object.entries(INFO_CATS).map(([k, v]) =>
      `<option value="${esc(k)}" ${presetCat === k ? "selected" : ""}>${v.emoji} ${esc(k)}</option>`
    ).join("")}
  </select>
  <label class="field-label">BESKRIVNING</label>
  <textarea id="info-body" rows="10" placeholder="Steg-för-steg, viktiga detaljer, varningar...">${esc(bodyVal)}</textarea>

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

  <label class="field-label">BIFOGA PDF (${info.editPdfs.length} redo)</label>
  <div class="info-pdf-list">
    ${info.editPdfs.map((p, i) =>
      `<div class="info-pdf-item">
        <span class="info-pdf-icon">📄</span>
        <span class="info-pdf-name">${esc(p.name)}</span>
        <div class="info-pdf-actions">
          <button class="btn-ghost danger" onclick="removeInfoEditPdf(${i})">×</button>
        </div>
      </div>`
    ).join("")}
  </div>
  <label class="btn-ghost" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
    📄 Välj PDF
    <input type="file" accept="application/pdf" style="display:none" onchange="handleInfoEditPdf(this)">
  </label>

  <div class="modal-actions" style="margin-top:14px">
    <button class="btn-ghost" onclick="cancelInfoEdit()" style="flex:1">Avbryt</button>
    <button class="btn" onclick="saveInfoArticleForm()" style="flex:1">${isNew ? "SKAPA FÖRSLAG" : "SPARA"}</button>
  </div>
</div>`;
}
