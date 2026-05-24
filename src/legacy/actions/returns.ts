// @ts-nocheck
// ============================================================
// actions/returns.ts — Returer (uthyrt material som kommit tillbaka)
// Beror på: services/returns.ts, ui.ts (toast, openModal, confirmModal,
//   esc, escAttr), render.ts (render)
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
      <option value="${esc(auth.user)}">${esc(auth.user)}</option>
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
      created_by: auth.user
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
  const r = [...returns.list, ...returns.archived].find(r => r.id === id);
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
  if (!await confirmModal("Radera returen permanent?", { confirmLabel: "Radera", danger: true })) return;
  try {
    await delReturn(id);
    await loadReturns();
    toast("🗑 Raderad");
    render();
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}
