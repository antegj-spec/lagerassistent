// ============================================================
// actions/economy.ts — Ekonomi-handlers (Fas 8 Etapp C)
// Beror på: services/economy.ts, ui.ts, render.ts
// ============================================================

// Cache av tillgängliga år (för att slippa läsa varje render).
let _economyYearsCache: number[] | null = null;

async function refreshEconomyYears(): Promise<void> {
  _economyYearsCache = await loadEconomyYears();
}

function getEconomyYears(): number[] {
  return _economyYearsCache ?? [new Date().getFullYear()];
}

// ---- BYTE AV ÅR + KATEGORI-FILTER ----

async function setEconomyYear(y: number): Promise<void> {
  if (!Number.isFinite(y)) return;
  economy.year = y;
  await loadEconomy(y);
  notify("economy");
  render();
}

function setEconomyCategoryFilter(cat: string): void {
  economy.categoryFilter = cat;
  notify("economy");
  render();
}

// ---- LÄGG TILL / REDIGERA ----

function openAddEconomy(prefill?: { category?: string }): void {
  if (!auth.isAdmin) return;
  const catOpts = ECONOMY_CATEGORIES.map(c =>
    `<option value="${esc(c.id)}" ${c.id === prefill?.category ? "selected" : ""}>${c.emoji} ${esc(c.label)}</option>`
  ).join("");
  openModal(`
    <div class="modal-title">Ny utgift (${economy.year})</div>
    <label class="field-label">KATEGORI</label>
    <select id="eco-cat">${catOpts}</select>
    <label class="field-label">VAD</label>
    <input type="text" id="eco-title" placeholder="T.ex. 'Köksblandare'">
    <label class="field-label">PRIS (SEK)</label>
    <input type="number" id="eco-price" inputmode="decimal" step="0.01" min="0">
    <label class="field-label">KOMMENTAR (valfritt)</label>
    <textarea id="eco-comment" rows="2" placeholder="T.ex. 'Biltema'"></textarea>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="addEconomy()" style="flex:1">SPARA</button>
    </div>
  `);
}

async function addEconomy(): Promise<void> {
  if (!auth.isAdmin) return;
  const category = (document.getElementById("eco-cat") as HTMLSelectElement | null)?.value || "";
  const title = (document.getElementById("eco-title") as HTMLInputElement | null)?.value?.trim() || "";
  const priceStr = (document.getElementById("eco-price") as HTMLInputElement | null)?.value || "";
  const comment = (document.getElementById("eco-comment") as HTMLTextAreaElement | null)?.value?.trim() || null;
  if (!title) { toast("Ange vad", 1); return; }
  const price = parseFloat(priceStr);
  if (!Number.isFinite(price) || price < 0) { toast("Ange giltigt pris", 1); return; }
  try {
    await saveEconomyEntry({
      category, year: economy.year, title, price, comment,
      created_by: auth.user || ""
    });
    await loadEconomy();
    await refreshEconomyYears();
    closeModal();
    toast("✓ Sparad");
    notify("economy");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + (e as Error).message, 1);
  }
}

function openEditEconomy(id: string): void {
  if (!auth.isAdmin) return;
  const e = economy.entries.find(x => x.id === id);
  if (!e) return;
  const catOpts = ECONOMY_CATEGORIES.map(c =>
    `<option value="${esc(c.id)}" ${c.id === e.category ? "selected" : ""}>${c.emoji} ${esc(c.label)}</option>`
  ).join("");
  openModal(`
    <div class="modal-title">Redigera utgift</div>
    <label class="field-label">KATEGORI</label>
    <select id="eco-cat">${catOpts}</select>
    <label class="field-label">VAD</label>
    <input type="text" id="eco-title" value="${escAttr(e.title)}">
    <label class="field-label">PRIS (SEK)</label>
    <input type="number" id="eco-price" inputmode="decimal" step="0.01" min="0" value="${e.price}">
    <label class="field-label">KOMMENTAR</label>
    <textarea id="eco-comment" rows="2">${esc(e.comment || "")}</textarea>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveEditEconomy('${escJs(id)}')" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveEditEconomy(id: string): Promise<void> {
  if (!auth.isAdmin) return;
  const category = (document.getElementById("eco-cat") as HTMLSelectElement | null)?.value || "";
  const title = (document.getElementById("eco-title") as HTMLInputElement | null)?.value?.trim() || "";
  const priceStr = (document.getElementById("eco-price") as HTMLInputElement | null)?.value || "";
  const comment = (document.getElementById("eco-comment") as HTMLTextAreaElement | null)?.value?.trim() || null;
  if (!title) { toast("Ange vad", 1); return; }
  const price = parseFloat(priceStr);
  if (!Number.isFinite(price) || price < 0) { toast("Ange giltigt pris", 1); return; }
  try {
    await saveEconomyEntry({ id, category, title, price, comment });
    await loadEconomy();
    closeModal();
    toast("✓ Uppdaterad");
    notify("economy");
    render();
  } catch {
    toast("Kunde inte spara", 1);
  }
}

async function doDelEconomy(id: string): Promise<void> {
  if (!auth.isAdmin) return;
  if (!await confirmModal("Radera utgiften permanent?", { confirmLabel: "Radera", danger: true })) return;
  try {
    await delEconomyEntry(id);
    await loadEconomy();
    notify("economy");
    toast("🗑 Raderad");
    render();
  } catch {
    toast("Kunde inte radera", 1);
  }
}

// ---- ÅRSVÄLJAR-HANDLER (slipper TS-cast i inline onclick) ----
function _onEconomyYearChange(): void {
  const v = (document.getElementById("eco-year-select") as HTMLSelectElement | null)?.value;
  const y = parseInt(v || "", 10);
  if (Number.isFinite(y)) void setEconomyYear(y);
}
