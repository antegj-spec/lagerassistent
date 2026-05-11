// ============================================================
// actions.js — Alla användarhandlingar
// Beror på: config.js, supabase.js, ui.js, render.js
// ============================================================

// ============================================================
// ANTECKNINGAR
// ============================================================
async function addNote() {
  const inp  = document.getElementById("note-input");
  const text = inp?.value?.trim();
  if (!text) { toast("Skriv en anteckning först", 1); return; }

  const cat      = document.getElementById("note-cat")?.value || classifyCat(text);
  const prio     = document.getElementById("note-prio")?.value || classifyPrio(text);
  const assigned = document.getElementById("note-assign")?.value || null;
  const matIdRaw = document.getElementById("note-material")?.value;
  const material_id = matIdRaw ? parseInt(matIdRaw) : null;
  const deadlineRaw = document.getElementById("note-deadline")?.value;
  const deadline = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;

  const btn = document.getElementById("add-btn");
  if (btn) btn.disabled = true;
  try {
    let image_url = null;
    if (imgFile) { toast("Laddar upp bild..."); image_url = await uploadImg(imgFile); }
    await saveNote({ text, category: cat, priority: prio, status: "ny", created_by: user, image_url, assigned_to: assigned, material_id, deadline });
    await loadNotes();
    updMeta();
    imgData = null;
    imgFile = null;
    toast("✓ Anteckning sparad");
    render();
  } catch (e) {
    toast("Kunde inte spara — kontrollera anslutning", 1);
  }
  if (btn) btn.disabled = false;
}

async function toggleNote(id) {
  openId = openId === id ? null : id;
  if (openId && !comments[id]) {
    await loadComments(id);
  }
  render();
}

async function setStatus(id, status) {
  try {
    await saveNote({ id, status });
    notes = notes.map(n => n.id === id ? { ...n, status } : n);
    updMeta();
    toast(status === "klar" ? "✓ Markerad som klar" : "✓ Uppdaterad");
    render();
  } catch (e) {
    toast("Kunde inte uppdatera", 1);
  }
}

async function submitComment(noteId) {
  const inp  = document.getElementById("comment-input-" + noteId);
  const text = inp?.value?.trim();
  if (!text) return;
  try {
    await addComment(noteId, text);
    await loadComments(noteId);
    render();
    toast("✓ Kommentar sparad");
  } catch (e) {
    toast("Kunde inte spara kommentar", 1);
  }
}

async function doDelete(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;
  try {
    const deletedAt = new Date().toISOString();
    await saveNote({ id, deleted_at: deletedAt });
    notes = notes.filter(n => n.id !== id);
    if (isAdmin) trashedNotes = [{ ...note, deleted_at: deletedAt }, ...trashedNotes];
    openId = null;
    updMeta();
    render();
    toast("Anteckning raderad", 0, "ÅNGRA", async () => {
      try {
        await saveNote({ id, deleted_at: null });
        await loadNotes();
        updMeta();
        render();
        toast("✓ Återställd");
      } catch (e) {
        toast("Kunde inte återställa", 1);
      }
    });
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}

async function restoreNote(id) {
  try {
    await saveNote({ id, deleted_at: null });
    await loadNotes();
    updMeta();
    render();
    toast("✓ Återställd");
  } catch (e) {
    toast("Kunde inte återställa", 1);
  }
}

async function permDelete(id) {
  if (!confirm("Radera permanent? Detta kan inte ångras.")) return;
  try {
    await delNotePerm(id);
    trashedNotes = trashedNotes.filter(n => n.id !== id);
    render();
    toast("🗑 Raderad permanent");
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}

async function emptyTrash() {
  if (!confirm(`Radera alla ${trashedNotes.length} anteckningar i papperskorgen permanent? Kan inte ångras.`)) return;
  try {
    for (const n of trashedNotes) await delNotePerm(n.id);
    trashedNotes = [];
    render();
    toast("🗑 Papperskorgen tömd");
  } catch (e) {
    toast("Kunde inte tömma", 1);
  }
}

// REDIGERA ANTECKNING
function openEdit(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;
  const matOpts  = materials.map(m =>
    `<option value="${m.id}" ${note.material_id === m.id ? "selected" : ""}>${esc(m.emoji || "📦")} ${esc(m.name)}</option>`
  ).join("");
  const userOpts = USERS.filter(u => u !== "Admin").map(u =>
    `<option value="${esc(u)}" ${note.assigned_to === u ? "selected" : ""}>${esc(u)}</option>`
  ).join("");
  const dlVal = note.deadline ? new Date(note.deadline).toISOString().slice(0, 16) : "";

  openModal(`
    <div class="modal-title">Redigera anteckning</div>
    <label class="field-label">TEXT</label>
    <textarea id="edit-text" rows="4">${esc(note.text)}</textarea>
    <label class="field-label">KATEGORI</label>
    <select id="edit-cat">${Object.entries(CATS).filter(([k]) => k !== "intern" || INTERN_USERS.includes(user)).map(([k, v]) =>
      `<option value="${k}" ${note.category === k ? "selected" : ""}>${v.emoji} ${v.label}</option>`
    ).join("")}</select>
    <label class="field-label">PRIORITET</label>
    <select id="edit-prio">${Object.entries(PRIOS).map(([k, v]) =>
      `<option value="${k}" ${note.priority === k ? "selected" : ""}>${v.label}</option>`
    ).join("")}</select>
    <label class="field-label">TILLDELA TILL</label>
    <select id="edit-assign"><option value="">— Ingen —</option>${userOpts}</select>
    ${materials.length ? `<label class="field-label">KOPPLA TILL MATERIAL</label>
    <select id="edit-mat"><option value="">— Inget —</option>${matOpts}</select>` : ""}
    <label class="field-label">DEADLINE</label>
    <input type="datetime-local" id="edit-deadline" value="${escAttr(dlVal)}">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveEdit(${id})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveEdit(id) {
  const text = document.getElementById("edit-text")?.value?.trim();
  if (!text) { toast("Text får inte vara tom", 1); return; }
  const cat      = document.getElementById("edit-cat")?.value;
  const prio     = document.getElementById("edit-prio")?.value;
  const assigned = document.getElementById("edit-assign")?.value || null;
  const matRaw   = document.getElementById("edit-mat")?.value;
  const material_id = matRaw ? parseInt(matRaw) : null;
  const dlRaw    = document.getElementById("edit-deadline")?.value;
  const deadline = dlRaw ? new Date(dlRaw).toISOString() : null;
  try {
    await saveNote({ id, text, category: cat, priority: prio, assigned_to: assigned, material_id, deadline });
    notes = notes.map(n => n.id === id ? { ...n, text, category: cat, priority: prio, assigned_to: assigned, material_id, deadline } : n);
    closeModal();
    toast("✓ Sparad");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}

// ============================================================
// MATERIAL
// ============================================================

// ---- ÖPPNA/STÄNG DETALJVY ----
async function openMat(id) {
  openMatId = id;
  openItemId = null;
  const loads = [];
  if (!materialHistory[id]) loads.push(loadMatHistory(id));
  if (!materialComments[id]) loads.push(loadMatComments(id));
  await Promise.all(loads);
  render();
}

function closeMat() {
  openMatId = null;
  render();
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
  const m = materials.find(m => m.id === id);
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
  if (!confirm("Radera material och alla dess artiklar/historik? Kan inte ångras.")) return;
  try {
    await delMatPerm(id);
    materials = materials.filter(m => m.id !== id);
    delete materialItems[id];
    delete materialCounts[id];
    delete borrowedMaterial[id];
    openMatId = null;
    await loadNotes();
    toast("🗑 Raderad");
    render();
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}

// ---- TOTALT ANTAL (lagerräknande) ----
function openSetTotal(matId) {
  const m = materials.find(m => m.id === matId);
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
  const m = materials.find(m => m.id === matId);
  if (!m) return;
  const counts = materialCounts[m.id] || {};
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

  const counts = materialCounts[matId] || {};
  const fromCount = counts[from] || 0;
  if (qty > fromCount) { toast(`Du kan flytta max ${fromCount}`, 1); return; }

  try {
    await setMatCount(matId, from, fromCount - qty);
    await setMatCount(matId, to, (counts[to] || 0) + qty);
    await logMatHistory({
      material_id: matId,
      old_status: from,
      new_status: to,
      count_change: qty,
      changed_by: user,
      comment
    });
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
  const m = materials.find(m => m.id === matId);
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
      changed_by: user,
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
  const items = materialItems[matId] || [];
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
  const items = materialItems[matId] || [];
  const it = items.find(i => i.id === itemId);
  if (!it) return;
  const newStatus = document.getElementById("item-new-status")?.value;
  const comment = document.getElementById("item-status-comment")?.value?.trim() || null;
  if (newStatus === it.status) { closeModal(); return; }

  // Bara Admin kan sätta "tillgänglig"
  if (newStatus === "tillgänglig" && !isAdmin) {
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
      changed_by: user,
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
  if (!confirm("Radera artikeln permanent?")) return;
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
  const m = materials.find(m => m.id === matId);
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
      created_by: user
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
  if (!confirm("Ta bort inhyrt material?")) return;
  try {
    await delBorrowed(borrowId);
    await loadMats();
    toast("🗑 Borttaget");
    render();
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}

// ============================================================
// RETURER
// ============================================================
function openAddReturn() {
  const today = new Date().toISOString().split("T")[0];
  const userOpts = USERS.filter(u => u !== "Admin").map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join("");
  openModal(`
    <div class="modal-title">Ny retur</div>
    <label class="field-label">NAMN PÅ RETUREN</label>
    <input type="text" id="ret-name" placeholder="T.ex. Håka Hellström Sommarturne">
    <label class="field-label">DATUM</label>
    <input type="date" id="ret-date" value="${today}">
    <label class="field-label">MOTTAGARE</label>
    <select id="ret-received">
      <option value="${esc(user)}">${esc(user)}</option>
      ${userOpts}
    </select>
    <label class="field-label">INNEHÅLL (vad kom tillbaka)</label>
    <textarea id="ret-content" rows="5" placeholder="T.ex. '20 pall EPS PRO, 40 m kabelskydd, 4 LD20...'"></textarea>
    <label class="field-label">KOMMENTAR (om tillstånd, defekt etc)</label>
    <textarea id="ret-comment" rows="3"></textarea>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="addReturn()" style="flex:1">SPARA</button>
    </div>
  `);
}

async function addReturn() {
  const name = document.getElementById("ret-name")?.value?.trim();
  if (!name) { toast("Ange ett namn", 1); return; }
  const return_date = document.getElementById("ret-date")?.value;
  const received_by = document.getElementById("ret-received")?.value;
  const content = document.getElementById("ret-content")?.value?.trim() || null;
  const comment = document.getElementById("ret-comment")?.value?.trim() || null;
  try {
    await saveReturn({
      name, return_date, received_by, content, comment,
      created_by: user
    });
    await loadReturns();
    closeModal();
    toast("✓ Retur sparad");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + e.message, 1);
  }
}

function openEditReturn(id) {
  const r = [...returnsList, ...archivedReturns].find(r => r.id === id);
  if (!r) return;
  const userOpts = USERS.filter(u => u !== "Admin").map(u =>
    `<option value="${esc(u)}" ${r.received_by === u ? "selected" : ""}>${esc(u)}</option>`
  ).join("");
  openModal(`
    <div class="modal-title">Redigera retur</div>
    <label class="field-label">NAMN</label>
    <input type="text" id="ret-edit-name" value="${escAttr(r.name)}">
    <label class="field-label">DATUM</label>
    <input type="date" id="ret-edit-date" value="${escAttr(r.return_date)}">
    <label class="field-label">MOTTAGARE</label>
    <select id="ret-edit-received">${userOpts}</select>
    <label class="field-label">INNEHÅLL</label>
    <textarea id="ret-edit-content" rows="5">${esc(r.content || "")}</textarea>
    <label class="field-label">KOMMENTAR</label>
    <textarea id="ret-edit-comment" rows="3">${esc(r.comment || "")}</textarea>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveEditReturn(${id})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveEditReturn(id) {
  const name = document.getElementById("ret-edit-name")?.value?.trim();
  if (!name) { toast("Ange ett namn", 1); return; }
  const return_date = document.getElementById("ret-edit-date")?.value;
  const received_by = document.getElementById("ret-edit-received")?.value;
  const content = document.getElementById("ret-edit-content")?.value?.trim() || null;
  const comment = document.getElementById("ret-edit-comment")?.value?.trim() || null;
  try {
    await saveReturn({ id, name, return_date, received_by, content, comment });
    await loadReturns();
    closeModal();
    toast("✓ Sparat");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}

async function toggleReturnArchive(id, archived) {
  try {
    await saveReturn({ id, archived });
    await loadReturns();
    toast(archived ? "📁 Arkiverad" : "↩ Aktiverad");
    render();
  } catch (e) {
    toast("Kunde inte ändra", 1);
  }
}

async function doDelReturn(id) {
  if (!confirm("Radera returen permanent?")) return;
  try {
    await delReturn(id);
    await loadReturns();
    toast("🗑 Raderad");
    render();
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}

// ============================================================
// ARBETSPLANERING (TASKS)
// ============================================================
function toggleTask(id) {
  openTaskId = openTaskId === id ? null : id;
  if (openTaskId) {
    const loads = [];
    if (!taskStatusLogs[id]) loads.push(loadTaskStatusLog(id));
    if (!taskComments[id]) loads.push(loadTaskComments(id));
    if (loads.length) Promise.all(loads).then(() => render());
    else render();
  } else {
    render();
  }
}

async function submitTaskComment(taskId) {
  const inp = document.getElementById("task-comment-input-" + taskId);
  const text = inp?.value?.trim();
  if (!text) return;
  try {
    await addTaskComment(taskId, text);
    await loadTaskComments(taskId);
    render();
    toast("✓ Uppdatering sparad");
  } catch (e) {
    toast("Kunde inte spara uppdatering", 1);
  }
}

function toggleItem(itemId) {
  openItemId = openItemId === itemId ? null : itemId;
  render();
}

async function submitMatComment(matId, itemId) {
  const key = itemId != null ? "item-comment-input-" + itemId : "mat-comment-input-" + matId;
  const inp = document.getElementById(key);
  const text = inp?.value?.trim();
  if (!text) return;
  try {
    await addMatComment(matId, itemId, text);
    await loadMatComments(matId);
    render();
    toast("✓ Kommentar sparad");
  } catch (e) {
    toast("Kunde inte spara kommentar", 1);
  }
}

function openAddTask() {
  const today = new Date().toISOString().split("T")[0];
  const userOpts = USERS.filter(u => u !== "Admin");
  const userCheckboxes = userOpts.map(u =>
    `<label style="display:flex;align-items:center;gap:6px;padding:6px 0;font-size:13px">
      <input type="checkbox" class="task-assign-check" value="${esc(u)}" style="width:18px;height:18px;margin:0">
      ${esc(u)}
    </label>`
  ).join("");
  const respOpts = userOpts.map(u =>
    `<option value="${esc(u)}">${esc(u)}</option>`
  ).join("");

  openModal(`
    <div class="modal-title">Ny uppgift</div>
    <label class="field-label">TITEL</label>
    <input type="text" id="task-title" placeholder="T.ex. 'Servicekörning Festivalen 2026'">
    <label class="field-label">BESKRIVNING</label>
    <textarea id="task-desc" rows="3" placeholder="Vad ska göras?"></textarea>
    <label class="field-label">PRIORITET</label>
    <select id="task-prio">${Object.entries(PRIOS).map(([k, v]) =>
      `<option value="${k}" ${k === "medel" ? "selected" : ""}>${v.label}</option>`
    ).join("")}</select>
    <label class="field-label">STARTDATUM</label>
    <input type="date" id="task-start" value="${today}">
    <label class="field-label">DEADLINE</label>
    <input type="datetime-local" id="task-deadline">
    <label class="field-label">HUVUDANSVARIG</label>
    <select id="task-resp">
      <option value="">— Ingen —</option>
      ${respOpts}
    </select>
    <label class="field-label">TILLDELA TILL (flera möjligt)</label>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 12px">
      ${userCheckboxes}
    </div>
    <label class="field-label">EXTRA INHYRD PERSONAL (antal)</label>
    <input type="number" id="task-extra" min="0" value="0">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="addTask()" style="flex:1">SPARA</button>
    </div>
  `);
}

async function addTask() {
  const title = document.getElementById("task-title")?.value?.trim();
  if (!title) { toast("Ange en titel", 1); return; }
  const description = document.getElementById("task-desc")?.value?.trim() || null;
  const priority = document.getElementById("task-prio")?.value || "medel";
  const start_date = document.getElementById("task-start")?.value || null;
  const dlRaw = document.getElementById("task-deadline")?.value;
  const deadline = dlRaw ? new Date(dlRaw).toISOString() : null;
  const responsible = document.getElementById("task-resp")?.value || null;
  const assigned_to = Array.from(document.querySelectorAll(".task-assign-check:checked")).map(c => c.value);
  // Lägg till huvudansvarig i assigned_to om ej redan med
  if (responsible && !assigned_to.includes(responsible)) assigned_to.push(responsible);
  const extra_staff = parseInt(document.getElementById("task-extra")?.value) || 0;

  try {
    const newId = await saveTask({
      title, description, priority, status: "ny",
      start_date, deadline, responsible, assigned_to, extra_staff,
      created_by: user
    });
    await logTaskStatus({
      task_id: newId,
      old_status: null,
      new_status: "ny",
      changed_by: user
    });
    await loadTasks();
    updMeta();
    closeModal();
    toast("✓ Uppgift skapad");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + e.message, 1);
  }
}

function openEditTask(id) {
  const t = [...tasks, ...archivedTasks].find(t => t.id === id);
  if (!t) return;
  const userOpts = USERS.filter(u => u !== "Admin");
  const assignedSet = new Set(t.assigned_to || []);
  const userCheckboxes = userOpts.map(u =>
    `<label style="display:flex;align-items:center;gap:6px;padding:6px 0;font-size:13px">
      <input type="checkbox" class="task-assign-check-edit" value="${esc(u)}" style="width:18px;height:18px;margin:0" ${assignedSet.has(u) ? "checked" : ""}>
      ${esc(u)}
    </label>`
  ).join("");
  const respOpts = userOpts.map(u =>
    `<option value="${esc(u)}" ${t.responsible === u ? "selected" : ""}>${esc(u)}</option>`
  ).join("");
  const dlVal = t.deadline ? new Date(t.deadline).toISOString().slice(0, 16) : "";

  openModal(`
    <div class="modal-title">Redigera uppgift</div>
    <label class="field-label">TITEL</label>
    <input type="text" id="task-edit-title" value="${escAttr(t.title)}">
    <label class="field-label">BESKRIVNING</label>
    <textarea id="task-edit-desc" rows="3">${esc(t.description || "")}</textarea>
    <label class="field-label">PRIORITET</label>
    <select id="task-edit-prio">${Object.entries(PRIOS).map(([k, v]) =>
      `<option value="${k}" ${t.priority === k ? "selected" : ""}>${v.label}</option>`
    ).join("")}</select>
    <label class="field-label">STARTDATUM</label>
    <input type="date" id="task-edit-start" value="${escAttr(t.start_date || "")}">
    <label class="field-label">DEADLINE</label>
    <input type="datetime-local" id="task-edit-deadline" value="${escAttr(dlVal)}">
    <label class="field-label">HUVUDANSVARIG</label>
    <select id="task-edit-resp">
      <option value="">— Ingen —</option>
      ${respOpts}
    </select>
    <label class="field-label">TILLDELA TILL</label>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 12px">
      ${userCheckboxes}
    </div>
    <label class="field-label">EXTRA INHYRD PERSONAL</label>
    <input type="number" id="task-edit-extra" min="0" value="${t.extra_staff || 0}">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveEditTask(${id})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveEditTask(id) {
  const title = document.getElementById("task-edit-title")?.value?.trim();
  if (!title) { toast("Ange en titel", 1); return; }
  const description = document.getElementById("task-edit-desc")?.value?.trim() || null;
  const priority = document.getElementById("task-edit-prio")?.value || "medel";
  const start_date = document.getElementById("task-edit-start")?.value || null;
  const dlRaw = document.getElementById("task-edit-deadline")?.value;
  const deadline = dlRaw ? new Date(dlRaw).toISOString() : null;
  const responsible = document.getElementById("task-edit-resp")?.value || null;
  const assigned_to = Array.from(document.querySelectorAll(".task-assign-check-edit:checked")).map(c => c.value);
  if (responsible && !assigned_to.includes(responsible)) assigned_to.push(responsible);
  const extra_staff = parseInt(document.getElementById("task-edit-extra")?.value) || 0;

  try {
    await saveTask({
      id, title, description, priority,
      start_date, deadline, responsible, assigned_to, extra_staff
    });
    await loadTasks();
    closeModal();
    toast("✓ Sparat");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}

async function setTaskStatus(id, status) {
  const t = [...tasks, ...archivedTasks].find(t => t.id === id);
  if (!t) return;
  if (t.status === status) return;
  try {
    await saveTask({ id, status });
    await logTaskStatus({
      task_id: id,
      old_status: t.status,
      new_status: status,
      changed_by: user
    });
    await loadTasks();
    await loadTaskStatusLog(id);
    updMeta();
    toast(status === "klar" ? "✓ Markerad som klar" : "✓ Status uppdaterad");
    render();
  } catch (e) {
    toast("Kunde inte uppdatera", 1);
  }
}

async function archiveTask(id, archive) {
  try {
    await saveTask({ id, archived: archive });
    await loadTasks();
    openTaskId = null;
    toast(archive ? "📁 Arkiverad" : "↩ Aktiverad");
    render();
  } catch (e) {
    toast("Kunde inte ändra", 1);
  }
}

async function doDelTask(id) {
  if (!confirm("Radera uppgiften permanent? Kan inte ångras.")) return;
  try {
    await delTaskPerm(id);
    await loadTasks();
    openTaskId = null;
    updMeta();
    toast("🗑 Raderad");
    render();
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}

// ============================================================
// INFO/FAQ
// ============================================================
function openInfo(id) {
  openInfoId = id;
  infoEditMode = null;
  render();
}

function closeInfo() {
  openInfoId = null;
  infoEditMode = null;
  infoEditImages = [];
  render();
}

function startNewInfo(presetCat) {
  openInfoId = null;
  infoEditMode = "new";
  infoEditImages = [];
  window._infoEditPreset = presetCat || "Utrustning";
  render();
}

function startEditInfo(id) {
  openInfoId = id;
  infoEditMode = "edit";
  infoEditImages = [];
  render();
}

function cancelInfoEdit() {
  infoEditMode = null;
  infoEditImages = [];
  render();
}

async function saveInfoArticleForm() {
  const title = document.getElementById("info-title")?.value?.trim();
  if (!title) { toast("Ange en rubrik", 1); return; }
  const body = document.getElementById("info-body")?.value?.trim() || null;
  const category = document.getElementById("info-cat")?.value || "Utrustning";

  try {
    if (infoEditMode === "new") {
      const newId = await saveInfoArticle({
        title, body, category,
        is_pinned: false,
        created_by: user
      });
      // Koppla på uppladdade bilder
      for (const url of infoEditImages) {
        await addInfoImage(newId, url);
      }
      await loadInfoArticles();
      infoEditMode = null;
      infoEditImages = [];
      openInfoId = newId;
      toast("✓ Förslag skapat");
    } else if (infoEditMode === "edit" && openInfoId) {
      await saveInfoArticle({ id: openInfoId, title, body, category });
      for (const url of infoEditImages) {
        await addInfoImage(openInfoId, url);
      }
      await loadInfoArticles();
      infoEditMode = null;
      infoEditImages = [];
      toast("✓ Sparat");
    }
    render();
  } catch (e) {
    toast("Kunde inte spara: " + e.message, 1);
  }
}

async function pinInfoArticle(id) {
  if (!isAdmin) return;
  try {
    await saveInfoArticle({ id, is_pinned: true });
    await loadInfoArticles();
    toast("📌 Artikeln är nu fäst");
    render();
  } catch (e) {
    toast("Kunde inte fästa", 1);
  }
}

async function unpinInfoArticle(id) {
  if (!isAdmin) return;
  try {
    await saveInfoArticle({ id, is_pinned: false });
    await loadInfoArticles();
    toast("Avfäst — tillbaka som förslag");
    render();
  } catch (e) {
    toast("Kunde inte avfästa", 1);
  }
}

async function doDelInfoArticle(id) {
  if (!isAdmin) return;
  if (!confirm("Ta bort artikeln? Den arkiveras (soft-delete).")) return;
  try {
    await delInfoArticle(id);
    await loadInfoArticles();
    if (openInfoId === id) openInfoId = null;
    toast("🗑 Borttagen");
    render();
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}

// Bilder vid skapande/redigering
async function handleInfoEditImg(inputEl) {
  const file = inputEl.files?.[0];
  if (!file) return;
  try {
    toast("Laddar upp bild...");
    const url = await uploadImg(file);
    infoEditImages.push(url);
    toast("✓ Bild tillagd");
    render();
  } catch (e) {
    toast("Kunde inte ladda upp bild", 1);
  }
}

// Bilder direkt på en befintlig artikel (alla användare)
async function handleInfoAddImg(articleId, inputEl) {
  const file = inputEl.files?.[0];
  if (!file) return;
  try {
    toast("Laddar upp bild...");
    const url = await uploadImg(file);
    await addInfoImage(articleId, url);
    await loadInfoArticles();
    toast("✓ Bild tillagd");
    render();
  } catch (e) {
    toast("Kunde inte ladda upp bild", 1);
  }
}

async function doDelInfoImage(imgId) {
  if (!isAdmin) return;
  if (!confirm("Ta bort bilden?")) return;
  try {
    await delInfoImage(imgId);
    await loadInfoArticles();
    toast("🗑 Bild borttagen");
    render();
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}

// Kommentarer
let _infoCommentImgUrl = null;
async function handleInfoCommentImg(articleId, inputEl) {
  const file = inputEl.files?.[0];
  if (!file) return;
  try {
    toast("Laddar upp bild...");
    _infoCommentImgUrl = await uploadImg(file);
    toast("✓ Bild redo att skickas");
    render();
  } catch (e) {
    toast("Kunde inte ladda upp bild", 1);
  }
}

async function submitInfoComment(articleId) {
  const inp = document.getElementById("info-comment-input-" + articleId);
  const body = inp?.value?.trim();
  if (!body && !_infoCommentImgUrl) { toast("Skriv en kommentar eller bifoga en bild", 1); return; }
  try {
    await addInfoComment(articleId, body || "", _infoCommentImgUrl);
    _infoCommentImgUrl = null;
    await loadInfoArticles();
    render();
    toast("✓ Kommentar sparad");
  } catch (e) {
    toast("Kunde inte spara kommentar", 1);
  }
}

async function doDelInfoComment(commentId) {
  if (!isAdmin) return;
  if (!confirm("Ta bort kommentaren?")) return;
  try {
    await delInfoComment(commentId);
    await loadInfoArticles();
    toast("🗑 Borttagen");
    render();
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}
