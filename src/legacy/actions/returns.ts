// ============================================================
// actions/returns.ts — Returer (uthyrt material som kommit tillbaka)
// Beror på: services/returns.ts, ui.ts (toast, openModal, confirmModal,
//   esc, escAttr), render.ts (render)
//
// Fas 4.10: @ts-nocheck borttaget. Alla DOM-element typas explicit
// där .value används (input/textarea/select).
// ============================================================

// En materialrad i retur-formuläret. Allt fri text (material, antal, kommentar).
function _returnRowHtml(mat = "", qty = "", cmt = ""): string {
  return `<div class="ret-item-row">
    <button type="button" class="ret-item-del" onclick="removeReturnRow(this)" aria-label="Ta bort rad">×</button>
    <div class="ret-item-line">
      <input type="text" class="ret-mat" placeholder="Material" value="${escAttr(mat)}">
      <input type="text" class="ret-qty" placeholder="Antal" value="${escAttr(qty)}">
    </div>
    <input type="text" class="ret-cmt" placeholder="Kommentar (valfritt)" value="${escAttr(cmt)}">
  </div>`;
}

function addReturnRow(): void {
  const c = document.getElementById("ret-items");
  if (c) c.insertAdjacentHTML("beforeend", _returnRowHtml());
}

function removeReturnRow(btn: HTMLElement): void {
  const c = document.getElementById("ret-items");
  const row = btn.closest(".ret-item-row") as HTMLElement | null;
  if (!row || !c) return;
  // Behåll minst en rad — töm den istället för att ta bort den sista.
  if (c.querySelectorAll(".ret-item-row").length <= 1) {
    row.querySelectorAll("input").forEach(i => { (i as HTMLInputElement).value = ""; });
  } else {
    row.remove();
  }
}

function _collectReturnRows(): { material: string; quantity: string | null; comment: string | null }[] {
  return Array.from(document.querySelectorAll("#ret-items .ret-item-row")).map(r => ({
    material: (r.querySelector(".ret-mat") as HTMLInputElement | null)?.value || "",
    quantity: (r.querySelector(".ret-qty") as HTMLInputElement | null)?.value || null,
    comment: (r.querySelector(".ret-cmt") as HTMLInputElement | null)?.value || null,
  }));
}

function openAddReturn(): void {
  const today = new Date().toISOString().split("T")[0];
  const userOpts = USERS.filter(u => u !== "Admin").map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join("");
  openModal(`
    <div class="modal-title">Ny retur</div>
    <label class="field-label">NAMN PÅ RETUREN</label>
    <input type="text" id="ret-name" placeholder="T.ex. Håkan Hellström Sommarturné">
    <label class="field-label">DATUM</label>
    <input type="date" id="ret-date" value="${today}">
    <label class="field-label">MOTTAGARE</label>
    <select id="ret-received">
      <option value="${esc(auth.user)}">${esc(auth.user)}</option>
      ${userOpts}
    </select>
    <label class="field-label">MATERIAL SOM KOM TILLBAKA</label>
    <div id="ret-items">${_returnRowHtml()}</div>
    <button type="button" class="ret-add-row" onclick="addReturnRow()">+ Lägg till material</button>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="addReturn()" style="flex:1">SPARA</button>
    </div>
  `);
}

async function addReturn(): Promise<void> {
  const name = (document.getElementById("ret-name") as HTMLInputElement | null)?.value?.trim();
  if (!name) { toast("Ange ett namn", 1); return; }
  const return_date = (document.getElementById("ret-date") as HTMLInputElement | null)?.value || "";
  const received_by = (document.getElementById("ret-received") as HTMLSelectElement | null)?.value || "";
  const rows = _collectReturnRows();
  if (!rows.some(r => r.material.trim())) { toast("Lägg till minst ett material", 1); return; }
  try {
    const id = await saveReturn({
      name, return_date, received_by, content: null, comment: null,
      created_by: auth.user || ""
    });
    if (id == null) throw new Error("Kunde inte skapa retur");
    await replaceReturnItems(id, rows);
    await loadReturns();
    closeModal();
    toast("✓ Retur sparad");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + (e as Error).message, 1);
  }
}

function openEditReturn(id: number): void {
  const r = [...returns.list, ...returns.archived].find(r => r.id === id);
  if (!r) return;
  const userOpts = USERS.filter(u => u !== "Admin").map(u =>
    `<option value="${esc(u)}" ${r.received_by === u ? "selected" : ""}>${esc(u)}</option>`
  ).join("");
  const existing = returns.items[id] || [];
  // Befintliga rader, annars seeda EN rad från ev. gammalt fritext-innehåll så
  // legacy-data bevaras vid omredigering.
  const rowsHtml = existing.length
    ? existing.map(it => _returnRowHtml(it.material, it.quantity || "", it.comment || "")).join("")
    : _returnRowHtml(r.content || "", "", r.comment || "");
  openModal(`
    <div class="modal-title">Redigera retur</div>
    <label class="field-label">NAMN</label>
    <input type="text" id="ret-edit-name" value="${escAttr(r.name)}">
    <label class="field-label">DATUM</label>
    <input type="date" id="ret-edit-date" value="${escAttr(r.return_date)}">
    <label class="field-label">MOTTAGARE</label>
    <select id="ret-edit-received">${userOpts}</select>
    <label class="field-label">MATERIAL SOM KOM TILLBAKA</label>
    <div id="ret-items">${rowsHtml}</div>
    <button type="button" class="ret-add-row" onclick="addReturnRow()">+ Lägg till material</button>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveEditReturn(${id})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveEditReturn(id: number): Promise<void> {
  const name = (document.getElementById("ret-edit-name") as HTMLInputElement | null)?.value?.trim();
  if (!name) { toast("Ange ett namn", 1); return; }
  const return_date = (document.getElementById("ret-edit-date") as HTMLInputElement | null)?.value || "";
  const received_by = (document.getElementById("ret-edit-received") as HTMLSelectElement | null)?.value || "";
  const rows = _collectReturnRows();
  if (!rows.some(r => r.material.trim())) { toast("Lägg till minst ett material", 1); return; }
  try {
    // content/comment nollas — raderna är nu källan (gamla fält bevaras bara
    // för returer som ännu inte redigerats om).
    await saveReturn({ id, name, return_date, received_by, content: null, comment: null });
    await replaceReturnItems(id, rows);
    await loadReturns();
    closeModal();
    toast("✓ Sparat");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}

async function toggleReturnArchive(id: number, archived: boolean): Promise<void> {
  try {
    await saveReturn({ id, archived });
    await loadReturns();
    toast(archived ? "📁 Arkiverad" : "↩ Aktiverad");
    render();
  } catch (e) {
    toast("Kunde inte ändra", 1);
  }
}

async function doDelReturn(id: number): Promise<void> {
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
