// @ts-nocheck
// ============================================================
// actions/materials.ts — Material, artiklar, counts, historik,
//   kommentarer, bilder, inhyrt material
// Beror på: services/materials.ts, services/images.ts (uploadImg),
//   services/notes.ts (loadNotes — efter material-delete refreshas notes),
//   ui.ts (toast, openModal, confirmModal, esc, escAttr), render.ts (render)
// ============================================================

// Navigera till material-fliken OCH öppna ett material direkt. Används av
// dashboardens problem-artiklar (openMat ensam byter inte ui.tab, så vyn
// stannade kvar på dashboarden).
async function gotoMaterial(id) {
  ui.tab = "material";
  ui.mainTab = "lager";
  ui.matSubTab = "status";
  ui.matSearch = "";
  if (typeof _highlightMainNav === "function") _highlightMainNav();
  await openMat(id);
}

// ---- ÖPPNA/STÄNG DETALJVY ----
async function openMat(id) {
  materials.openId = id;
  materials.openItemId = null;
  const loads = [];
  if (!materials.history[id]) loads.push(loadMatHistory(id));
  if (!materials.comments[id]) loads.push(loadMatComments(id));
  if (!materials.images[id]) loads.push(loadMatImages(id));
  await Promise.all(loads);
  _navPush();
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

// ---- MATERIAL-LISTAN: basis-flik / kategori-filter / sök ----
function setMatBasis(b) {
  ui.matBasis = b === "article" ? "article" : "count";
  ui.matCatFilter = null;
  materials.openId = null;
  render();
}

function setMatCatFilter(c) {
  // null = Alla, "" = Okategoriserad, annars kategori-id.
  ui.matCatFilter = c;
  materials.openId = null;
  render();
}

// Sök: re-rendera materialvyn in i #main och behåll fokus/caret i sökrutan
// (mönster från setSearch() i ui.ts).
function setMatSearch(v) {
  ui.matSearch = v;
  const m = document.getElementById("main");
  if (!m) return;
  const inp = document.getElementById("mat-search-input");
  const pos = document.activeElement === inp && inp ? inp.selectionStart : null;
  m.innerHTML = rMat();
  if (pos !== null) {
    const ni = document.getElementById("mat-search-input");
    if (ni) { ni.focus(); ni.setSelectionRange(pos, pos); }
  }
  bindEvents();
}

function clearMatSearch() {
  ui.matSearch = "";
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
    <label class="field-label">KATEGORI (lagerräknat)</label>
    <select id="mat-category">
      <option value="">— ingen —</option>
      ${MAT_CATEGORIES.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join("")}
    </select>
    <label class="field-label">ARTIKELNUMMER (valfritt)</label>
    <input type="text" id="mat-article-number" placeholder="T.ex. 1000247">
    <!-- Fas 6.6: lagernivå-tröskel, NULL = av -->
    <label class="field-label">LAGERNIVÅ-VARNING (under N tillgängliga = varning, valfritt)</label>
    <input type="number" id="mat-min-threshold" placeholder="t.ex. 10" min="0">
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
  const thresholdRaw = document.getElementById("mat-min-threshold")?.value;
  const min_threshold = thresholdRaw ? parseInt(thresholdRaw) : null;
  const category = document.getElementById("mat-category")?.value || null;
  const article_number = document.getElementById("mat-article-number")?.value?.trim() || null;
  try {
    const newId = await saveMat({ name, emoji, is_article_based, total_count, unit, info_text, min_threshold, category, article_number });
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
    <label class="field-label">KATEGORI (lagerräknat)</label>
    <select id="edit-mat-category">
      <option value="" ${!m.category ? "selected" : ""}>— ingen —</option>
      ${MAT_CATEGORIES.map(c => `<option value="${c.id}" ${m.category === c.id ? "selected" : ""}>${c.emoji} ${c.label}</option>`).join("")}
      ${m.category && !MAT_CATEGORIES.some(c => c.id === m.category) ? `<option value="${escAttr(m.category)}" selected>${esc(m.category)}</option>` : ""}
    </select>
    <label class="field-label">ARTIKELNUMMER (valfritt)</label>
    <input type="text" id="edit-mat-article-number" placeholder="T.ex. 1000247" value="${escAttr(m.article_number || "")}">
    <!-- Fas 6.6: lagernivå-tröskel -->
    <label class="field-label">LAGERNIVÅ-VARNING (under N tillgängliga = varning, tomt = av)</label>
    <input type="number" id="edit-mat-min-threshold" placeholder="t.ex. 10" min="0" value="${m.min_threshold != null ? m.min_threshold : ""}">
    <label class="field-label">INFO</label>
    <textarea id="edit-mat-info" rows="6" placeholder="Vikt, packning, moduldelar, artikelnummer...">${esc(m.info_text || "")}</textarea>
    <label class="field-label">KOPPLA TILL INFO-SIDA (valfritt)</label>
    <select id="edit-mat-info-article">
      <option value="">— ingen —</option>
      ${info.articles.map(a => `<option value="${a.id}" ${m.info_article_id === a.id ? "selected" : ""}>${esc(a.category)} · ${esc(a.title)}</option>`).join("")}
    </select>
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
  const thresholdRaw = document.getElementById("edit-mat-min-threshold")?.value;
  const min_threshold = thresholdRaw ? parseInt(thresholdRaw) : null;
  const category = document.getElementById("edit-mat-category")?.value || null;
  const article_number = document.getElementById("edit-mat-article-number")?.value?.trim() || null;
  const infoArticleRaw = document.getElementById("edit-mat-info-article")?.value;
  const info_article_id = infoArticleRaw ? parseInt(infoArticleRaw) : null;
  try {
    await saveMat({ id, name, emoji, unit, info_text, min_threshold, category, article_number, info_article_id });
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
// Summa av alla statusar UTOM "okänd" — dvs antal som är öronmärkta
// (Tillgänglig/Uthyrd/Tvätt/Reparation/Reserverad). "Okänd" fungerar som
// avstämnings-hög: okänd = total − allocated. Ändras totalen hamnar
// mellanskillnaden där, och eventuellt befintligt glapp stäms av samtidigt.
function allocatedExclOkand(matId) {
  const counts = materials.counts[matId] || {};
  return Object.entries(counts)
    .filter(([k]) => k !== "okänd")
    .reduce((sum, [, n]) => sum + (Number(n) || 0), 0);
}

// Summa aktivt inhyrt för ett material. Inhyrt ingår i material_counts sedan
// migration 031, så den effektiva totalen är eget total_count + inhyrt.
function borrowedSum(matId) {
  return (materials.borrowed[matId] || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
}

function openSetTotal(matId) {
  const m = materials.list.find(m => m.id === matId);
  if (!m) return;
  const unit = esc(m.unit || "st");
  const allocated = allocatedExclOkand(matId);
  const okand = (materials.counts[matId] || {})["okänd"] || 0;
  const borrowed = borrowedSum(matId);
  // Effektiv total = eget + inhyrt (speglar set_total_count server-side).
  const effectiveTotal = (m.total_count || 0) + borrowed;
  const gap = effectiveTotal - (allocated + okand);
  openModal(`
    <div class="modal-title">Ändra totalt antal</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
      Sätt det totala antalet ${unit} av ${esc(m.name)} (eget material, exklusive inhyrt).
      ${borrowed > 0 ? `Inhyrt (${borrowed} ${unit}) räknas redan in i Tillgänglig och påverkas inte. ` : ""}Mellanskillnaden mot statusarna hamnar i <b>Okänd</b> ❓ som du sedan fördelar via "Flytta antal".
    </p>
    ${gap !== 0 ? `<p style="font-size:12px;color:var(--red);background:var(--red-subtle);padding:8px 10px;border-radius:8px;margin-bottom:10px">
      ⚠️ Just nu är ${allocated + okand} ${unit} fördelade på statusar men effektiva totalen är ${effectiveTotal} ${unit}${borrowed > 0 ? ` (${m.total_count || 0} eget + ${borrowed} inhyrt)` : ""}. ${Math.abs(gap)} ${unit} ${gap > 0 ? "är oallokerat" : "är överallokerat"} — detta stäms av till Okänd när du sparar.
    </p>` : ""}
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
  if (newTotal < 0) { toast("Ange ett antal som inte är negativt", 1); return; }

  // Klient-side förkoll för snabb feedback. Servern (set_total_count) gör samma
  // koll auktoritativt — allt utom "okänd" är öronmärkt och får inte överskridas.
  // Inhyrt ingår i counts, så jämför mot den effektiva totalen (eget + inhyrt).
  const allocated = allocatedExclOkand(matId);
  const borrowed = borrowedSum(matId);
  if (newTotal + borrowed < allocated) {
    toast(`Totalen kan inte vara mindre än ${allocated - borrowed} eget (redan fördelat på Tillgänglig/Uthyrd m.fl., inhyrt borträknat). Flytta tillbaka antal först.`, 1);
    return;
  }

  try {
    // Atomiskt: sätter total_count OCH stämmer av mellanskillnaden mot "okänd"
    // i en enda transaktion (migration 029). Kan inte längre halv-spara om
    // mobilen tappar anslutningen mitt i.
    await setTotalCount(matId, newTotal);
    await loadMats();
    await loadMatHistory(matId);
    toast("✓ Totalt antal uppdaterat");
    closeModal();
    render();
  } catch (e) {
    toast("Kunde inte spara: " + (e?.message || ""), 1);
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

// ============================================================
// ALLOKERINGAR — RESERVERAT / UTHYRT (Fas 6.9)
// Lagerräknat material: flyttar antal tillgänglig → reserverad/uthyrd via
// create_allocation-RPC och skapar en spårbar post (mål + datum).
// ============================================================

// Öppna dialog för att reservera ELLER hyra ut (kind styr texterna).
function openAllocate(matId, kind) {
  const m = materials.list.find(m => m.id === matId);
  if (!m) return;
  const avail = (materials.counts[m.id] || {}).tillgänglig || 0;
  const isRent = kind === "uthyrd";
  const title = isRent ? "📤 Hyr ut" : "📌 Reservera";
  if (avail <= 0) { toast("Inget tillgängligt att " + (isRent ? "hyra ut" : "reservera"), 1); return; }
  openModal(`
    <div class="modal-title">${title} — ${esc(m.name)}</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
      ${avail} ${esc(m.unit || "st")} tillgängligt.
    </p>
    <label class="field-label">ANTAL</label>
    <input type="number" id="alloc-qty" min="1" max="${avail}" value="1">
    <label class="field-label">${isRent ? "UTHYRT TILL" : "RESERVERAT TILL"}</label>
    <input type="text" id="alloc-target" placeholder="T.ex. 'Tons of Rock 2026' eller kundnamn">
    <label class="field-label">${isRent ? "VÄNTAS TILLBAKA (valfritt)" : "BEHÖVS SENAST (valfritt)"}</label>
    <input type="date" id="alloc-return">
    <label class="field-label">KOMMENTAR (valfritt)</label>
    <input type="text" id="alloc-comment" placeholder="T.ex. 'Lastat på bil 2'">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="doAllocate(${matId},'${kind}')" style="flex:1">${isRent ? "HYR UT" : "RESERVERA"}</button>
    </div>
  `);
}

async function doAllocate(matId, kind) {
  const qty = parseInt(document.getElementById("alloc-qty")?.value) || 0;
  const target_text = document.getElementById("alloc-target")?.value?.trim() || null;
  const expected_return = document.getElementById("alloc-return")?.value || null;
  const comment = document.getElementById("alloc-comment")?.value?.trim() || null;

  if (qty <= 0) { toast("Ange ett antal större än 0", 1); return; }
  const avail = (materials.counts[matId] || {}).tillgänglig || 0;
  if (qty > avail) { toast(`Du kan max ${kind === "uthyrd" ? "hyra ut" : "reservera"} ${avail}`, 1); return; }
  if (!target_text) { toast(kind === "uthyrd" ? "Ange vart det hyrs ut" : "Ange vad det reserveras till", 1); return; }

  try {
    await createAllocation({ material_id: matId, kind, qty, target_text, expected_return, comment });
    await loadMats();
    await loadMatHistory(matId);
    closeModal();
    toast(kind === "uthyrd" ? `✓ Hyrt ut ${qty} till ${target_text}` : `✓ Reserverat ${qty} till ${target_text}`);
    render();
  } catch (e) {
    toast("Kunde inte spara: " + e.message, 1);
  }
}

// "Skicka vidare till uthyrt" — flyttar en reservation till uthyrd.
async function doPromoteAllocation(allocId, matId) {
  const a = (materials.allocations[matId] || []).find(x => x.id === allocId);
  if (!a) return;
  openModal(`
    <div class="modal-title">📤 Skicka vidare till uthyrt</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
      Reservationen <b>${esc(a.target_text || "—")}</b> (${a.quantity} st) markeras som uthyrd och får dagens datum som skickat-datum.
    </p>
    <label class="field-label">KOMMENTAR (valfritt)</label>
    <input type="text" id="promote-comment" placeholder="T.ex. 'Lastat och skickat'">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="confirmPromoteAllocation(${allocId},${matId})" style="flex:1">SKICKA VIDARE</button>
    </div>
  `);
}

async function confirmPromoteAllocation(allocId, matId) {
  const comment = document.getElementById("promote-comment")?.value?.trim() || null;
  try {
    await promoteAllocation(allocId, comment);
    await loadMats();
    await loadMatHistory(matId);
    closeModal();
    toast("✓ Skickat vidare till uthyrt");
    render();
  } catch (e) {
    toast("Kunde inte skicka vidare: " + e.message, 1);
  }
}

// Återlämna/avsluta en allokering — antalet går tillbaka till valt lagerstatus.
function openCloseAllocation(allocId, matId) {
  const a = (materials.allocations[matId] || []).find(x => x.id === allocId);
  if (!a) return;
  const isRent = a.kind === "uthyrd";
  openModal(`
    <div class="modal-title">${isRent ? "Återlämna uthyrt" : "Avsluta reservation"}</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
      <b>${esc(a.target_text || "—")}</b> (${a.quantity} st) — vart ska antalet tillbaka?
    </p>
    <label class="field-label">TILLBAKA TILL</label>
    <select id="close-to-status">
      <option value="tillgänglig">✅ Tillgänglig</option>
      <option value="tvätt">🧼 Tvätt behövs</option>
      <option value="reparation">🔧 Reparation</option>
      <option value="okänd">❓ Okänd</option>
    </select>
    <label class="field-label">KOMMENTAR (valfritt)</label>
    <input type="text" id="close-comment" placeholder="T.ex. 'Tillbaka i lager, allt helt'">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="doCloseAllocation(${allocId},${matId})" style="flex:1">${isRent ? "ÅTERLÄMNA" : "AVSLUTA"}</button>
    </div>
  `);
}

async function doCloseAllocation(allocId, matId) {
  const to_status = document.getElementById("close-to-status")?.value || "tillgänglig";
  const comment = document.getElementById("close-comment")?.value?.trim() || null;
  try {
    await closeAllocation(allocId, to_status, comment);
    await loadMats();
    await loadMatHistory(matId);
    closeModal();
    toast("✓ Återlämnat till " + (MAT_STATS[to_status]?.label || to_status));
    render();
  } catch (e) {
    toast("Kunde inte återlämna: " + e.message, 1);
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
    <label class="field-label">ARTIKELNUMMER (valfritt)</label>
    <input type="text" id="item-article-number" placeholder="T.ex. 1000247">
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
  const article_number = document.getElementById("item-article-number")?.value?.trim() || null;
  try {
    const newId = await saveMatItem({ material_id: matId, article_id, status, article_number });
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
  const reservedForVal = it.status === "reserverad" ? (it.reserved_for || "") : "";
  openModal(`
    <div class="modal-title">Ändra status — ${esc(it.article_id)}</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
      Nuvarande status: <b>${esc(MAT_STATS[it.status]?.label || it.status)}</b>
    </p>
    <label class="field-label">NY STATUS</label>
    <select id="item-new-status" onchange="toggleReservedForField(this.value)">${Object.entries(MAT_STATS).map(([k, v]) =>
      `<option value="${k}" ${it.status === k ? "selected" : ""}>${v.emoji} ${v.label}</option>`
    ).join("")}</select>
    <!-- Fas 6.5: reserved_for syns bara när status='reserverad' -->
    <div id="reserved-for-wrap" style="display:${it.status === "reserverad" ? "block" : "none"}">
      <label class="field-label">RESERVERAD TILL</label>
      <input type="text" id="item-reserved-for" placeholder="T.ex. 'Festivalen 2026' eller kundnamn" value="${escAttr(reservedForVal)}">
    </div>
    <label class="field-label">KOMMENTAR (valfritt)</label>
    <input type="text" id="item-status-comment" placeholder="T.ex. 'Reparation klar'">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveItemStatus(${itemId},${matId})" style="flex:1">SPARA</button>
    </div>
  `);
}

// Fas 6.5: visa/dölj reserved_for-fält baserat på vald status.
function toggleReservedForField(status) {
  const wrap = document.getElementById("reserved-for-wrap");
  if (wrap) wrap.style.display = status === "reserverad" ? "block" : "none";
}

// Fas 6.8: sätt service-intervall på en artikel.
function openServiceIntervalModal(itemId, matId) {
  const items = materials.items[matId] || [];
  const it = items.find(i => i.id === itemId);
  if (!it) return;
  openModal(`
    <div class="modal-title">Service-intervall — ${esc(it.article_id)}</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5">
      Varningen visas i Dashboard när det gått fler dagar sedan senast tvättat än intervallet.<br>
      Lämna tomt för att inaktivera.
    </p>
    <label class="field-label">DAGAR MELLAN SERVICE</label>
    <input type="number" id="item-service-days" min="1" placeholder="t.ex. 90" value="${it.service_interval_days != null ? it.service_interval_days : ""}">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveServiceInterval(${itemId},${matId})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveServiceInterval(itemId, matId) {
  const raw = document.getElementById("item-service-days")?.value;
  const service_interval_days = raw ? parseInt(raw) : null;
  try {
    await saveMatItem({ id: itemId, service_interval_days });
    await loadMats();
    closeModal();
    toast(service_interval_days ? `✓ Service-intervall: ${service_interval_days}d` : "✓ Service-intervall borttaget");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}

// Sätt/ändra artikelnummer på en befintlig artikel. Artikelnumret är fritext
// och INTE samma som artikel-ID:t (namnet) — t.ex. ID "LD20-19", artikelnr
// "1000247". Lämna tomt för att ta bort.
function openItemArticleNumber(itemId, matId) {
  const items = materials.items[matId] || [];
  const it = items.find(i => i.id === itemId);
  if (!it) return;
  openModal(`
    <div class="modal-title">Artikelnummer — ${esc(it.article_id)}</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5">
      Artikelnumret är fritext och behöver inte vara samma som artikel-ID:t.<br>
      Lämna tomt för att ta bort numret.
    </p>
    <label class="field-label">ARTIKELNUMMER</label>
    <input type="text" id="item-article-number-edit" placeholder="T.ex. 1000247" value="${escAttr(it.article_number || "")}">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveItemArticleNumber(${itemId},${matId})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveItemArticleNumber(itemId, matId) {
  const article_number = document.getElementById("item-article-number-edit")?.value?.trim() || null;
  try {
    await saveMatItem({ id: itemId, article_number });
    await loadMats();
    closeModal();
    toast(article_number ? `✓ Artikelnummer: ${article_number}` : "✓ Artikelnummer borttaget");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
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
    // Fas 6.5: sätt eller rensa reserved_for beroende på ny status.
    if (newStatus === "reserverad") {
      const rf = document.getElementById("item-reserved-for")?.value?.trim() || null;
      update.reserved_for = rf;
    } else if (it.status === "reserverad") {
      // Lämnar reserverad-state → rensa reserved_for
      update.reserved_for = null;
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
    // Atomiskt: skapar inhyrt-posten OCH ökar tillgänglig (migration 031), så
    // inhyrt går att reservera/hyra ut/flytta som eget material.
    await createBorrowed({
      material_id: matId,
      quantity, supplier, start_date, end_date, reason, comment
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
    // Minskar tillgänglig atomiskt. Kastar om för lite ligger i Tillgänglig
    // (inhyrt är ute på uthyrning/flyttat) — visa serverns meddelande.
    await removeBorrowed(borrowId);
    await loadMats();
    toast("🗑 Borttaget");
    render();
  } catch (e) {
    toast("Kunde inte ta bort: " + (e?.message || ""), 1);
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
