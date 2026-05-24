// @ts-nocheck
// ============================================================
// actions/materials.ts — Material, artiklar, counts, historik,
//   kommentarer, bilder, inhyrt material
// Beror på: services/materials.ts, services/images.ts (uploadImg),
//   services/notes.ts (loadNotes — efter material-delete refreshas notes),
//   ui.ts (toast, openModal, confirmModal, esc, escAttr), render.ts (render)
// ============================================================

// ---- ÖPPNA/STÄNG DETALJVY ----
async function openMat(id) {
  materials.openId = id;
  materials.openItemId = null;
  const loads = [];
  if (!materials.history[id]) loads.push(loadMatHistory(id));
  if (!materials.comments[id]) loads.push(loadMatComments(id));
  if (!materials.images[id]) loads.push(loadMatImages(id));
  await Promise.all(loads);
  render();
}

function closeMat() {
  materials.openId = null;
  materials.openItemId = null;
  // Fas 3.6 (B14): rensa bifogad kommentar-bild — annars hänger den med
  // till nästa material och fästs på fel objekt.
  ui.matCommentImgUrl = null;
  ui.itemCommentImgUrl = null;
  render();
}

// ---- ÖPPNA/STÄNG ARTIKELDETALJVY ----
async function openItem(itemId) {
  materials.openItemId = itemId;
  const loads = [];
  if (!materials.itemImages[itemId]) loads.push(loadMatItemImages(itemId));
  if (materials.openId && !materials.comments[materials.openId]) loads.push(loadMatComments(materials.openId));
  if (materials.openId && !materials.history[materials.openId]) loads.push(loadMatHistory(materials.openId));
  await Promise.all(loads);
  render();
}

function closeItem() {
  materials.openItemId = null;
  ui.itemCommentImgUrl = null;
  render();
}

// ---- MATERIAL-BILDER (lagerräknande och artikelbaserade) ----
async function handleMatImg(matId, inputEl) {
  await handleImgInput(inputEl, async (url) => {
    await addMatImage(matId, url);
    await loadMatImages(matId);
  });
}

async function doDelMatImg(imgId, matId) {
  if (!auth.isAdmin) return;
  if (!await confirmModal("Ta bort bilden?", { confirmLabel: "Ta bort", danger: true })) return;
  try {
    await delMatImage(imgId);
    await loadMatImages(matId);
    toast("🗑 Bild borttagen");
    render();
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}

// ---- KOMMENTARSSTATUS ----
async function cycleCommentStatus(commentId, matId, itemId, currentStatus) {
  const order = ["klart", "åtgärd_behövs", "åtgärd_krävs"];
  const idx = order.indexOf(currentStatus);
  const newStatus = order[(idx + 1) % order.length];
  try {
    await setMatCommentStatus(commentId, newStatus);
    await loadMatComments(matId);
    await loadActionComments();
    const label = newStatus === "åtgärd_krävs" ? "🚨 Åtgärd krävs" : newStatus === "åtgärd_behövs" ? "⚠ Åtgärd behövs" : "✓ Markerad som klar";
    toast(label);
    render();
  } catch (e) {
    toast("Kunde inte uppdatera", 1);
  }
}

async function delMatCommentAction(commentId, matId) {
  await delCommentFlow(commentId, {
    del: delMatComment,
    reload: async () => { await loadMatComments(matId); await loadActionComments(); }
  });
}

function editMatCommentAction(commentId, matId, itemId) {
  const allCmts = materials.comments[matId] || [];
  const c = allCmts.find(c => c.id === commentId);
  if (!c) return;
  openEditCommentModal({
    currentText: c.text,
    textareaId: "edit-mat-cmt",
    onSaveFn: "saveMatCommentEdit",
    saveArgs: [commentId, matId]
  });
}

async function saveMatCommentEdit(commentId, matId) {
  await editCommentFlow(commentId, {
    textareaId: "edit-mat-cmt",
    edit: editMatComment,
    reload: () => loadMatComments(matId)
  });
}

// ---- BILD PÅ MATERIAL-KOMMENTAR (material-nivå) ----
async function handleMatCommentImg(inputEl) {
  await handleImgInput(inputEl, (url) => { ui.matCommentImgUrl = url; },
    { successLabel: "✓ Bild redo att skickas" });
}

async function reloadMatHistory(id) {
  await loadMatHistory(id);
  render();
}

// ---- LÄGG TILL MATERIALTYP ----
function openAddMat() {
  openModal(`
    <div class="modal-title">Ny materialtyp</div>
    <label class="field-label">NAMN</label>
    <input type="text" id="mat-name" placeholder="T.ex. LD20 eller EPS PRO">
    <label class="field-label">EMOJI</label>
    <input type="text" id="mat-emoji" placeholder="📦" style="max-width:80px" value="📦">
    <label class="field-label">TYP</label>
    <select id="mat-type">
      <option value="false">Lagerräknande (antal pall/st per status, t.ex. EPS PRO)</option>
      <option value="true">Artikelbaserat (varje artikel har eget ID, t.ex. LD20)</option>
    </select>
    <label class="field-label">ENHET</label>
    <select id="mat-unit">
      <option value="st">st</option>
      <option value="pall">pall</option>
      <option value="meter">meter</option>
      <option value="kg">kg</option>
    </select>
    <div id="mat-total-row">
      <label class="field-label">TOTALT ANTAL (endast lagerräknande)</label>
      <input type="number" id="mat-total" placeholder="0" min="0" value="0">
    </div>
    <label class="field-label">INFO (valfritt)</label>
    <textarea id="mat-info" rows="3" placeholder="Vikt, packning, moduldelar, artikelnummer..."></textarea>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="addMat()" style="flex:1">SPARA</button>
    </div>
  `);
}

async function addMat() {
  const name = document.getElementById("mat-name")?.value?.trim();
  if (!name) { toast("Ange ett namn", 1); return; }
  const emoji = document.getElementById("mat-emoji")?.value?.trim() || "📦";
  const is_article_based = document.getElementById("mat-type")?.value === "true";
  const unit = document.getElementById("mat-unit")?.value || "st";
  const total_count = is_article_based ? 0 : (parseInt(document.getElementById("mat-total")?.value) || 0);
  const info_text = document.getElementById("mat-info")?.value?.trim() || null;
  try {
    const newId = await saveMat({ name, emoji, is_article_based, total_count, unit, info_text });
    // Initiera räkning för lagerräknande
    if (!is_article_based && total_count > 0) {
      await setMatCount(newId, "tillgänglig", total_count);
    }
    await loadMats();
    closeModal();
    toast("✓ Material sparat");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + e.message, 1);
  }
}

// ---- REDIGERA MATERIALTYP ----
function openEditMat(id) {
  const m = materials.list.find(m => m.id === id);
  if (!m) return;
  openModal(`
    <div class="modal-title">Redigera ${esc(m.name)}</div>
    <label class="field-label">NAMN</label>
    <input type="text" id="edit-mat-name" value="${escAttr(m.name)}">
    <label class="field-label">EMOJI</label>
    <input type="text" id="edit-mat-emoji" value="${escAttr(m.emoji || "📦")}" style="max-width:80px">
    <label class="field-label">ENHET</label>
    <select id="edit-mat-unit">
      <option value="st" ${m.unit === "st" ? "selected" : ""}>st</option>
      <option value="pall" ${m.unit === "pall" ? "selected" : ""}>pall</option>
      <option value="meter" ${m.unit === "meter" ? "selected" : ""}>meter</option>
      <option value="kg" ${m.unit === "kg" ? "selected" : ""}>kg</option>
    </select>
    <label class="field-label">INFO</label>
    <textarea id="edit-mat-info" rows="6" placeholder="Vikt, packning, moduldelar, artikelnummer...">${esc(m.info_text || "")}</textarea>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveEditMat(${id})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveEditMat(id) {
  const name = document.getElementById("edit-mat-name")?.value?.trim();
  if (!name) { toast("Ange ett namn", 1); return; }
  const emoji = document.getElementById("edit-mat-emoji")?.value?.trim() || "📦";
  const unit = document.getElementById("edit-mat-unit")?.value || "st";
  const info_text = document.getElementById("edit-mat-info")?.value?.trim() || null;
  try {
    await saveMat({ id, name, emoji, unit, info_text });
    await loadMats();
    closeModal();
    toast("✓ Sparat");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}

async function doDelMat(id) {
  if (!await confirmModal("Radera material och alla dess artiklar/historik? Kan inte ångras.", { confirmLabel: "Radera material", danger: true })) return;
  try {
    await delMatPerm(id);
    materials.list = materials.list.filter(m => m.id !== id);
    delete materials.items[id];
    delete materials.counts[id];
    delete materials.borrowed[id];
    materials.openId = null;
    await loadNotes();
    toast("🗑 Raderad");
    render();
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}

// ---- TOTALT ANTAL (lagerräknande) ----
function openSetTotal(matId) {
  const m = materials.list.find(m => m.id === matId);
  if (!m) return;
  openModal(`
    <div class="modal-title">Ändra totalt antal</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
      Sätt det totala antalet ${esc(m.unit || "st")} av ${esc(m.name)} (eget material, exklusive inhyrt).
    </p>
    <label class="field-label">TOTALT ANTAL</label>
    <input type="number" id="set-total" min="0" value="${m.total_count || 0}">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveTotal(${matId})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveTotal(matId) {
  const newTotal = parseInt(document.getElementById("set-total")?.value) || 0;
  try {
    await saveMat({ id: matId, total_count: newTotal });
    await loadMats();
    toast("✓ Totalt antal uppdaterat");
    closeModal();
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}

// ---- FLYTTA ANTAL MELLAN STATUSAR (lagerräknande) ----
function openMoveCount(matId) {
  const m = materials.list.find(m => m.id === matId);
  if (!m) return;
  const counts = materials.counts[m.id] || {};
  openModal(`
    <div class="modal-title">Flytta antal</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
      Flytta antal ${esc(m.unit || "st")} av ${esc(m.name)} mellan statusar.
    </p>
    <label class="field-label">FRÅN</label>
    <select id="move-from">${Object.entries(MAT_STATS).map(([k, v]) =>
      `<option value="${k}">${v.emoji} ${v.label} (${counts[k] || 0} ${esc(m.unit || "st")})</option>`
    ).join("")}</select>
    <label class="field-label">TILL</label>
    <select id="move-to">${Object.entries(MAT_STATS).map(([k, v]) =>
      `<option value="${k}">${v.emoji} ${v.label}</option>`
    ).join("")}</select>
    <label class="field-label">ANTAL</label>
    <input type="number" id="move-qty" min="1" value="1">
    <label class="field-label">KOMMENTAR (valfritt)</label>
    <input type="text" id="move-comment" placeholder="T.ex. 'Hyrt ut till Sommarfest'">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="doMoveCount(${matId})" style="flex:1">FLYTTA</button>
    </div>
  `);
}

async function doMoveCount(matId) {
  const from = document.getElementById("move-from")?.value;
  const to = document.getElementById("move-to")?.value;
  const qty = parseInt(document.getElementById("move-qty")?.value) || 0;
  const comment = document.getElementById("move-comment")?.value?.trim() || null;

  if (from === to) { toast("Från och till kan inte vara samma", 1); return; }
  if (qty <= 0) { toast("Ange ett antal större än 0", 1); return; }

  const counts = materials.counts[matId] || {};
  const fromCount = counts[from] || 0;
  if (qty > fromCount) { toast(`Du kan flytta max ${fromCount}`, 1); return; }

  try {
    // Fas 3.1: Atomic flytt via Postgres-funktion. Ersätter de tidigare
    // tre separata anropen (setMatCount × 2 + logMatHistory) som kunde
    // lämna korrupt state om något steg failade halvvägs. changed_by
    // sätts server-side från JWT — kan inte längre fejkas av klienten.
    await moveCount(matId, from, to, qty, comment);
    await loadMats();
    await loadMatHistory(matId);
    closeModal();
    toast("✓ Flyttat " + qty + " " + (MAT_STATS[from]?.label || from) + " → " + (MAT_STATS[to]?.label || to));
    render();
  } catch (e) {
    toast("Kunde inte flytta: " + e.message, 1);
  }
}

// ---- ARTIKLAR (artikelbaserat) ----
function openAddItem(matId) {
  const m = materials.list.find(m => m.id === matId);
  if (!m) return;
  openModal(`
    <div class="modal-title">Ny artikel — ${esc(m.name)}</div>
    <label class="field-label">ARTIKEL-ID</label>
    <input type="text" id="item-id" placeholder="T.ex. LD20-19">
    <label class="field-label">STATUS</label>
    <select id="item-status">${Object.entries(MAT_STATS).map(([k, v]) =>
      `<option value="${k}">${v.emoji} ${v.label}</option>`
    ).join("")}</select>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="addItem(${matId})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function addItem(matId) {
  const article_id = document.getElementById("item-id")?.value?.trim();
  if (!article_id) { toast("Ange ett artikel-ID", 1); return; }
  const status = document.getElementById("item-status")?.value || "tillgänglig";
  try {
    const newId = await saveMatItem({ material_id: matId, article_id, status });
    await logMatHistory({
      material_id: matId,
      item_id: newId,
      article_id,
      old_status: null,
      new_status: status,
      changed_by: auth.user,
      comment: "Ny artikel skapad"
    });
    await loadMats();
    await loadMatHistory(matId);
    closeModal();
    toast("✓ Artikel tillagd");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + e.message, 1);
  }
}

function openChangeItemStatus(itemId, matId) {
  const items = materials.items[matId] || [];
  const it = items.find(i => i.id === itemId);
  if (!it) return;
  openModal(`
    <div class="modal-title">Ändra status — ${esc(it.article_id)}</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
      Nuvarande status: <b>${esc(MAT_STATS[it.status]?.label || it.status)}</b>
    </p>
    <label class="field-label">NY STATUS</label>
    <select id="item-new-status">${Object.entries(MAT_STATS).map(([k, v]) =>
      `<option value="${k}" ${it.status === k ? "selected" : ""}>${v.emoji} ${v.label}</option>`
    ).join("")}</select>
    <label class="field-label">KOMMENTAR (valfritt)</label>
    <input type="text" id="item-status-comment" placeholder="T.ex. 'Reparation klar'">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveItemStatus(${itemId},${matId})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveItemStatus(itemId, matId) {
  const items = materials.items[matId] || [];
  const it = items.find(i => i.id === itemId);
  if (!it) return;
  const newStatus = document.getElementById("item-new-status")?.value;
  const comment = document.getElementById("item-status-comment")?.value?.trim() || null;
  if (newStatus === it.status) { closeModal(); return; }

  // Bara Admin kan sätta "tillgänglig"
  if (newStatus === "tillgänglig" && !auth.isAdmin && it.status !== "tillgänglig") {
    toast("Endast Admin kan sätta 'Tillgänglig'", 1);
    return;
  }

  try {
    const update = { id: itemId, status: newStatus };
    // Uppdatera senast tvättat-datum om vi rör tvätt
    if (it.status === "tvätt" && newStatus !== "tvätt") {
      update.last_washed = new Date().toISOString();
    }
    await saveMatItem(update);
    await logMatHistory({
      material_id: matId,
      item_id: itemId,
      article_id: it.article_id,
      old_status: it.status,
      new_status: newStatus,
      changed_by: auth.user,
      comment
    });
    await loadMats();
    await loadMatHistory(matId);
    closeModal();
    toast("✓ Status uppdaterad");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}

async function doDelItem(itemId, matId) {
  if (!await confirmModal("Radera artikeln permanent?", { confirmLabel: "Radera", danger: true })) return;
  try {
    await delMatItem(itemId);
    await loadMats();
    toast("🗑 Raderad");
    render();
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}

// ---- INHYRT MATERIAL ----
function openAddBorrowed(matId) {
  const m = materials.list.find(m => m.id === matId);
  if (!m) return;
  const today = new Date().toISOString().split("T")[0];
  openModal(`
    <div class="modal-title">Inhyrt material — ${esc(m.name)}</div>
    <label class="field-label">ANTAL ${esc((m.unit || "st").toUpperCase())}</label>
    <input type="number" id="borrow-qty" min="1" value="1">
    <label class="field-label">LEVERANTÖR</label>
    <input type="text" id="borrow-supplier" placeholder="T.ex. ABC Eventservice">
    <label class="field-label">FRÅN-DATUM</label>
    <input type="date" id="borrow-start" value="${today}">
    <label class="field-label">TILL-DATUM (valfritt)</label>
    <input type="date" id="borrow-end">
    <label class="field-label">ANLEDNING</label>
    <input type="text" id="borrow-reason" placeholder="T.ex. 'Extra material för Festivalen 2026'">
    <label class="field-label">KOMMENTAR (valfritt)</label>
    <textarea id="borrow-comment" rows="2"></textarea>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="addBorrowed(${matId})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function addBorrowed(matId) {
  const quantity = parseInt(document.getElementById("borrow-qty")?.value) || 0;
  if (quantity <= 0) { toast("Ange antal", 1); return; }
  const supplier = document.getElementById("borrow-supplier")?.value?.trim() || null;
  const start_date = document.getElementById("borrow-start")?.value;
  const end_date = document.getElementById("borrow-end")?.value || null;
  const reason = document.getElementById("borrow-reason")?.value?.trim() || null;
  const comment = document.getElementById("borrow-comment")?.value?.trim() || null;
  if (!start_date) { toast("Ange startdatum", 1); return; }

  try {
    await saveBorrowed({
      material_id: matId,
      quantity, supplier, start_date, end_date, reason, comment,
      created_by: auth.user
    });
    await loadMats();
    closeModal();
    toast("✓ Inhyrt material tillagt");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + e.message, 1);
  }
}

async function doDelBorrowed(borrowId, matId) {
  if (!await confirmModal("Ta bort inhyrt material?", { confirmLabel: "Ta bort", danger: true })) return;
  try {
    await delBorrowed(borrowId);
    await loadMats();
    toast("🗑 Borttaget");
    render();
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}

// ---- ARTIKELBILDER + KOMMENTARER ----
async function handleItemImg(itemId, matId, inputEl) {
  await handleImgInput(inputEl, async (url) => {
    await addMatItemImage(itemId, matId, url);
    await loadMatItemImages(itemId);
  });
}

async function doDelItemImg(imgId, itemId) {
  if (!auth.isAdmin) return;
  if (!await confirmModal("Ta bort bilden?", { confirmLabel: "Ta bort", danger: true })) return;
  try {
    await delMatItemImage(imgId);
    await loadMatItemImages(itemId);
    toast("🗑 Bild borttagen");
    render();
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}

async function handleItemCommentImg(inputEl) {
  await handleImgInput(inputEl, (url) => { ui.itemCommentImgUrl = url; },
    { successLabel: "✓ Bild redo att skickas" });
}

async function submitMatComment(matId, itemId) {
  const isItem = itemId != null;
  const key = isItem ? "item-comment-input-" + itemId : "mat-comment-input-" + matId;
  const inp = document.getElementById(key);
  const text = inp?.value?.trim();
  const imgUrl = isItem ? ui.itemCommentImgUrl : ui.matCommentImgUrl;
  if (!text && !imgUrl) return;

  const statusEl = document.getElementById(isItem ? "item-comment-status-" + itemId : "mat-comment-status-" + matId);
  const commentStatus = statusEl?.value || "klart";

  try {
    await addMatComment(matId, itemId, text || "", imgUrl, commentStatus);
    if (isItem) ui.itemCommentImgUrl = null;
    else ui.matCommentImgUrl = null;
    await loadMatComments(matId);
    if (commentStatus === "åtgärd_krävs") await loadActionComments();
    render();
    toast("✓ Kommentar sparad");
    // Fas 6.2: åtgärd_krävs → auto-skapa task (efter huvud-toasten, så
    // den nya ÅNGRA-toasten ersätter den efter ~2s).
    if (commentStatus === "åtgärd_krävs" && typeof autoCreateTaskFromMatComment === "function") {
      autoCreateTaskFromMatComment(matId, itemId, text || "", auth.user || "");
    }
  } catch (e) {
    toast("Kunde inte spara kommentar", 1);
  }
}
