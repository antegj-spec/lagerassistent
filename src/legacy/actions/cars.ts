// ============================================================
// actions/cars.ts — Körjournal (Fas 8 Etapp B)
// Beror på: services/cars.ts, services/images.ts, ui.ts, render.ts
//
// Funktioner:
//   - Modaler: openAddTrip / openEditTrip / openAddCar
//   - Submit: addTrip / saveEditTrip / addCar / doDelTrip / doDelCar
//   - Validering: trip-validering inkl. gap-varning
//   - Gap-detektion: detectTripGaps (renderas som varningskort i lista)
//   - OCR: scanOdometer (kamera → Claude Vision Haiku → fält)
//   - Geo: fetchLocation (geolocation → Google Maps Geocoding → fält)
//   - Export: exportCarJournal (6 varianter via SheetJS)
// ============================================================

// Senast-använda bil/förare per-användare, sparas i localStorage så
// formuläret förifylls snabbt nästa gång.
const CAR_LAST_KEY = "lager-car-last";

interface CarLastState {
  car_id?: string;
  driver?: string;
}

function _carLastGet(): CarLastState {
  try { return JSON.parse(localStorage.getItem(CAR_LAST_KEY) || "{}"); }
  catch { return {}; }
}

function _carLastSet(s: CarLastState): void {
  try { localStorage.setItem(CAR_LAST_KEY, JSON.stringify({ ..._carLastGet(), ...s })); }
  catch { /* localStorage kan vara full eller blockad */ }
}

// ---- HJÄLPARE ----

function carById(id: string): Car | undefined {
  return cars.list.find(c => c.id === id);
}

function carLabel(c: Car): string {
  return c.nickname ? `${c.reg_nr} (${c.nickname})` : c.reg_nr;
}

// Senast kända mätarställning för en bil = högsta odometer_end bland
// avslutade resor. null om bilen aldrig haft en avslutad resa.
function latestKnownOdo(car_id: string): number | null {
  const ends = cars.trips
    .filter(t => t.car_id === car_id && t.status === "closed" && t.odometer_end != null)
    .map(t => t.odometer_end as number);
  return ends.length ? Math.max(...ends) : null;
}

// Den (enda) pågående resan för en bil, om någon.
function openTripForCar(car_id: string): CarTrip | undefined {
  return cars.trips.find(t => t.car_id === car_id && t.status === "open");
}

// Alla pågående resor (för banner i körjournalvyn).
function openTrips(): CarTrip[] {
  return cars.trips.filter(t => t.status === "open");
}

// Gap-detektion (detectTripGaps) + TripGap-typen bor i lib/calc.ts —
// ren, sidoeffektsfri logik som enhetstestas isolerat.

// ---- LÄGG TILL RESA ----

function openAddTrip(prefill?: Partial<CarTrip>): void {
  const last = _carLastGet();
  const today = new Date().toISOString().split("T")[0];
  const userOpts = USERS.filter(u => u !== "Admin").map(u =>
    `<option value="${esc(u)}" ${u === (prefill?.driver || last.driver || auth.user) ? "selected" : ""}>${esc(u)}</option>`
  ).join("");
  const carOpts = cars.list.filter(c => c.active).map(c =>
    `<option value="${esc(c.id)}" ${c.id === (prefill?.car_id || last.car_id) ? "selected" : ""}>${esc(carLabel(c))}</option>`
  ).join("");

  if (!cars.list.filter(c => c.active).length) {
    openModal(`
      <div class="modal-title">Inga bilar registrerade</div>
      <p>Du måste lägga till minst en bil innan du kan logga en resa.</p>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
        ${auth.isAdmin ? `<button class="btn" onclick="openAddCar()" style="flex:1">+ Bil</button>` : ""}
      </div>
    `);
    return;
  }

  openModal(`
    <div class="modal-title">Ny resa</div>
    <label class="field-label">DATUM</label>
    <input type="date" id="trip-date" value="${escAttr(prefill?.trip_date || today)}">

    <label class="field-label">FÖRARE</label>
    <select id="trip-driver">${userOpts}</select>

    <label class="field-label">BIL</label>
    <select id="trip-car">${carOpts}</select>

    <label class="field-label">FRÅN</label>
    <div class="trip-input-with-btn">
      <input type="text" id="trip-from" value="${escAttr(prefill?.from_loc || "")}" placeholder="Plats / adress">
      <button type="button" class="btn-icon" onclick="fetchLocation('trip-from')" title="Hämta nuvarande plats">📍</button>
    </div>

    <label class="field-label">TILL</label>
    <div class="trip-input-with-btn">
      <input type="text" id="trip-to" value="${escAttr(prefill?.to_loc || "")}" placeholder="Plats / adress">
      <button type="button" class="btn-icon" onclick="fetchLocation('trip-to')" title="Hämta nuvarande plats">📍</button>
    </div>

    <label class="field-label">SYFTE</label>
    <input type="text" id="trip-purpose" value="${escAttr(prefill?.purpose || "")}" placeholder="T.ex. 'Leverans till kund'">

    <label class="field-label">MÄTARSTÄLLNING START (km)</label>
    <div class="trip-input-with-btn">
      <input type="number" id="trip-odo-start" inputmode="numeric" value="${prefill?.odometer_start ?? ""}" min="0">
      <button type="button" class="btn-icon" onclick="scanOdometer('trip-odo-start')" title="Scanna med kamera">📷</button>
    </div>

    <label class="field-label">MÄTARSTÄLLNING SLUT (km)</label>
    <div class="trip-input-with-btn">
      <input type="number" id="trip-odo-end" inputmode="numeric" value="${prefill?.odometer_end ?? ""}" min="0">
      <button type="button" class="btn-icon" onclick="scanOdometer('trip-odo-end')" title="Scanna med kamera">📷</button>
    </div>

    <div class="trip-checkbox-row">
      <label><input type="checkbox" id="trip-private"> Privat körning</label>
      <label><input type="checkbox" id="trip-fueling" onchange="toggleFuelingFields()"> Tankning</label>
    </div>

    <div id="trip-fueling-fields" style="display:none">
      <label class="field-label">LITER</label>
      <input type="number" id="trip-liters" inputmode="decimal" step="0.01" min="0">
      <label class="field-label">TOTALPRIS (SEK)</label>
      <input type="number" id="trip-price" inputmode="decimal" step="0.01" min="0">
    </div>

    <label class="field-label">BILD / KVITTO (valfritt)</label>
    <div class="img-upload-area" onclick="document.getElementById('trip-img-file').click()">
      ${ui.imgData
        ? `<img class="img-preview" src="${ui.imgData}">`
        : `<div style="color:var(--muted);font-size:12px">📸 Lägg till bild</div>`}
    </div>
    <input type="file" id="trip-img-file" accept="image/*" capture="environment" style="display:none" onchange="handleImg(this)">

    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal();ui.imgData=null;ui.imgFile=null" style="flex:1">Avbryt</button>
      <button class="btn" onclick="addTrip()" style="flex:1">SPARA</button>
    </div>
  `);
}

function toggleFuelingFields(): void {
  const fields = document.getElementById("trip-fueling-fields");
  const checked = (document.getElementById("trip-fueling") as HTMLInputElement | null)?.checked;
  if (fields) fields.style.display = checked ? "block" : "none";
}

async function addTrip(): Promise<void> {
  const trip_date = (document.getElementById("trip-date") as HTMLInputElement | null)?.value || "";
  const driver = (document.getElementById("trip-driver") as HTMLSelectElement | null)?.value || "";
  const car_id = (document.getElementById("trip-car") as HTMLSelectElement | null)?.value || "";
  const from_loc = (document.getElementById("trip-from") as HTMLInputElement | null)?.value?.trim() || null;
  const to_loc = (document.getElementById("trip-to") as HTMLInputElement | null)?.value?.trim() || null;
  const purpose = (document.getElementById("trip-purpose") as HTMLInputElement | null)?.value?.trim() || null;
  const odo_start_str = (document.getElementById("trip-odo-start") as HTMLInputElement | null)?.value || "";
  const odo_end_str = (document.getElementById("trip-odo-end") as HTMLInputElement | null)?.value || "";
  const is_private = !!(document.getElementById("trip-private") as HTMLInputElement | null)?.checked;
  const is_fueling = !!(document.getElementById("trip-fueling") as HTMLInputElement | null)?.checked;
  const liters_str = (document.getElementById("trip-liters") as HTMLInputElement | null)?.value || "";
  const price_str = (document.getElementById("trip-price") as HTMLInputElement | null)?.value || "";

  // Validering
  if (!trip_date) { toast("Ange datum", 1); return; }
  if (!driver) { toast("Ange förare", 1); return; }
  if (!car_id) { toast("Ange bil", 1); return; }
  const odometer_start = parseInt(odo_start_str, 10);
  const odometer_end = parseInt(odo_end_str, 10);
  if (!Number.isFinite(odometer_start) || odometer_start < 0) { toast("Ange giltig start-km", 1); return; }
  if (!Number.isFinite(odometer_end) || odometer_end < 0) { toast("Ange giltig slut-km", 1); return; }
  if (odometer_end < odometer_start) {
    toast("Slut-km måste vara större än eller lika med start-km", 1);
    return;
  }
  if (is_fueling) {
    if (!liters_str || parseFloat(liters_str) <= 0) { toast("Ange liter tankat", 1); return; }
    if (!price_str || parseFloat(price_str) <= 0) { toast("Ange totalpris", 1); return; }
  }

  // Varning vid odometer-konflikt mot senaste registrerade slut-km för samma bil.
  const latestForCar = cars.trips
    .filter(t => t.car_id === car_id && t.odometer_end != null)
    .sort((a, b) => {
      if (a.trip_date > b.trip_date) return -1;
      if (a.trip_date < b.trip_date) return 1;
      return (b.odometer_end ?? 0) - (a.odometer_end ?? 0);
    })[0];
  if (latestForCar && latestForCar.odometer_end != null && odometer_start < latestForCar.odometer_end) {
    const ok = await confirmModal(
      `Mätarställning ${odometer_start} km är lägre än senast registrerade slut (${latestForCar.odometer_end} km, ${latestForCar.trip_date}).\n\nSpara ändå? (Användbart om resan ligger i efterhand.)`,
      { confirmLabel: "Spara ändå", cancelLabel: "Avbryt" }
    );
    if (!ok) return;
  }

  // Bild-upload (om foto valt)
  let image_path: string | null = null;
  if (ui.imgFile) {
    try { image_path = await uploadImg(ui.imgFile); }
    catch (e) { toast("Bilden kunde inte laddas upp — sparar utan", 1); }
  }

  try {
    await saveCarTrip({
      car_id, driver, trip_date, from_loc, to_loc, purpose,
      odometer_start, odometer_end,
      status: "closed", needs_purpose: false,
      is_private, is_fueling,
      liters: is_fueling ? parseFloat(liters_str) : null,
      total_price: is_fueling ? parseFloat(price_str) : null,
      image_path,
      created_by: auth.user || "",
    });
    _carLastSet({ car_id, driver });
    ui.imgData = null; ui.imgFile = null;
    await loadCarTrips();
    closeModal();
    toast("✓ Resa sparad");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + (e as Error).message, 1);
  }
}

// ---- REDIGERA RESA ----

function openEditTrip(id: string): void {
  const t = cars.trips.find(t => t.id === id);
  if (!t) return;
  if (!auth.isAdmin && t.created_by !== auth.user) {
    toast("Du kan bara redigera egna resor", 1);
    return;
  }
  // Återanvänd add-modalen via prefill, men byt knapp-handler via DOM-mutation efter render.
  openAddTrip(t);
  setTimeout(() => {
    // Sätt fueling-toggle korrekt
    const fc = document.getElementById("trip-fueling") as HTMLInputElement | null;
    if (fc && t.is_fueling) { fc.checked = true; toggleFuelingFields(); }
    const pc = document.getElementById("trip-private") as HTMLInputElement | null;
    if (pc && t.is_private) pc.checked = true;
    if (t.is_fueling) {
      const l = document.getElementById("trip-liters") as HTMLInputElement | null;
      const p = document.getElementById("trip-price") as HTMLInputElement | null;
      if (l && t.liters != null) l.value = String(t.liters);
      if (p && t.total_price != null) p.value = String(t.total_price);
    }
    // Byt SPARA-knappens onclick till saveEditTrip(id)
    const actions = document.querySelector(".modal-actions");
    if (actions) {
      const saveBtn = actions.querySelectorAll("button")[1] as HTMLButtonElement | null;
      if (saveBtn) saveBtn.setAttribute("onclick", `saveEditTrip('${escJs(id)}')`);
    }
    const titleEl = document.querySelector(".modal-title");
    if (titleEl) titleEl.textContent = "Redigera resa";
  }, 0);
}

async function saveEditTrip(id: string): Promise<void> {
  // Återanvänd add-validering: läs samma fält, gör samma checks, men kör PATCH.
  const trip_date = (document.getElementById("trip-date") as HTMLInputElement | null)?.value || "";
  const driver = (document.getElementById("trip-driver") as HTMLSelectElement | null)?.value || "";
  const car_id = (document.getElementById("trip-car") as HTMLSelectElement | null)?.value || "";
  const from_loc = (document.getElementById("trip-from") as HTMLInputElement | null)?.value?.trim() || null;
  const to_loc = (document.getElementById("trip-to") as HTMLInputElement | null)?.value?.trim() || null;
  const purpose = (document.getElementById("trip-purpose") as HTMLInputElement | null)?.value?.trim() || null;
  const odometer_start = parseInt((document.getElementById("trip-odo-start") as HTMLInputElement | null)?.value || "", 10);
  const odometer_end = parseInt((document.getElementById("trip-odo-end") as HTMLInputElement | null)?.value || "", 10);
  const is_private = !!(document.getElementById("trip-private") as HTMLInputElement | null)?.checked;
  const is_fueling = !!(document.getElementById("trip-fueling") as HTMLInputElement | null)?.checked;
  const liters_str = (document.getElementById("trip-liters") as HTMLInputElement | null)?.value || "";
  const price_str = (document.getElementById("trip-price") as HTMLInputElement | null)?.value || "";

  if (!Number.isFinite(odometer_start) || !Number.isFinite(odometer_end) || odometer_end < odometer_start) {
    toast("Kontrollera mätarställningar", 1); return;
  }
  if (is_fueling && (!parseFloat(liters_str) || !parseFloat(price_str))) {
    toast("Ange tankningsuppgifter", 1); return;
  }

  let image_path: string | null | undefined = undefined;
  if (ui.imgFile) {
    try { image_path = await uploadImg(ui.imgFile); }
    catch { toast("Bilden kunde inte laddas upp", 1); }
  }

  try {
    await saveCarTrip({
      id, car_id, driver, trip_date, from_loc, to_loc, purpose,
      odometer_start, odometer_end, is_private, is_fueling,
      liters: is_fueling ? parseFloat(liters_str) : null,
      total_price: is_fueling ? parseFloat(price_str) : null,
      ...(image_path !== undefined ? { image_path } : {}),
    });
    ui.imgData = null; ui.imgFile = null;
    await loadCarTrips();
    closeModal();
    toast("✓ Uppdaterad");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}

async function doDelTrip(id: string): Promise<void> {
  if (!await confirmModal("Radera resan permanent?", { confirmLabel: "Radera", danger: true })) return;
  try {
    await delCarTrip(id);
    await loadCarTrips();
    toast("🗑 Raderad");
    render();
  } catch {
    toast("Kunde inte radera", 1);
  }
}

// ============================================================
// INLED / AVSLUTA RESA (körjournal v2)
//
// En resa är ett tillstånd: inled (status='open', odometer_end null)
// → avsluta (status='closed'). Den öppna raden ligger i Supabase och
// överlever omladdning/mobilbyte hur länge som helst.
// ============================================================

// ---- INLED RESA ----

function startTrip(): void {
  const activeCars = cars.list.filter(c => c.active);
  if (!activeCars.length) {
    openModal(`
      <div class="modal-title">Inga bilar registrerade</div>
      <p>Du måste lägga till minst en bil innan du kan logga en resa.</p>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
        ${auth.isAdmin ? `<button class="btn" onclick="openAddCar()" style="flex:1">+ Bil</button>` : ""}
      </div>
    `);
    return;
  }

  const last = _carLastGet();
  const today = new Date().toISOString().split("T")[0];
  const userOpts = USERS.filter(u => u !== "Admin").map(u =>
    `<option value="${esc(u)}" ${u === (last.driver || auth.user) ? "selected" : ""}>${esc(u)}</option>`
  ).join("");
  const carOpts = activeCars.map(c =>
    `<option value="${esc(c.id)}" ${c.id === last.car_id ? "selected" : ""}>${esc(carLabel(c))}</option>`
  ).join("");

  openModal(`
    <div class="modal-title">Inled resa</div>
    <label class="field-label">DATUM</label>
    <input type="date" id="trip-date" value="${escAttr(today)}">

    <label class="field-label">FÖRARE</label>
    <select id="trip-driver">${userOpts}</select>

    <label class="field-label">BIL</label>
    <select id="trip-car" onchange="onStartCarChange()">${carOpts}</select>

    <label class="field-label">FRÅN</label>
    <div class="trip-input-with-btn">
      <input type="text" id="trip-from" placeholder="Plats / adress">
      <button type="button" class="btn-icon" onclick="fetchLocation('trip-from')" title="Hämta nuvarande plats">📍</button>
    </div>

    <label class="field-label">MÄTARSTÄLLNING NU (km)</label>
    <div class="trip-input-with-btn">
      <input type="number" id="trip-odo-start" inputmode="numeric" min="0">
      <button type="button" class="btn-icon" onclick="scanOdometer('trip-odo-start')" title="Scanna med kamera">📷</button>
    </div>
    <div id="trip-known-hint" class="cj-hint"></div>

    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal();ui.imgData=null;ui.imgFile=null" style="flex:1">Avbryt</button>
      <button class="btn" onclick="submitStartTrip()" style="flex:1">INLED RESA</button>
    </div>
  `);
  setTimeout(onStartCarChange, 0);
}

// Förifyll mätarställning + visa hint baserat på vald bil. Markerar
// också om bilen redan har en pågående resa.
function onStartCarChange(): void {
  const car_id = (document.getElementById("trip-car") as HTMLSelectElement | null)?.value || "";
  const odoEl = document.getElementById("trip-odo-start") as HTMLInputElement | null;
  const hintEl = document.getElementById("trip-known-hint");
  if (!car_id || !odoEl || !hintEl) return;

  const ongoing = openTripForCar(car_id);
  if (ongoing) {
    hintEl.innerHTML = `<span class="cj-hint-warn">⚠ Bilen har redan en pågående resa (start ${ongoing.odometer_start} km). Avsluta den först.</span>`;
    return;
  }

  const known = latestKnownOdo(car_id);
  if (known != null) {
    odoEl.value = String(known);
    hintEl.innerHTML = `Senast kända ställning: <b>${known} km</b>. Stämmer det med mätaren? Annars ändra till verkligt värde.`;
  } else {
    odoEl.value = "";
    hintEl.textContent = "Ingen tidigare resa för bilen — ange aktuell mätarställning.";
  }
}

async function submitStartTrip(): Promise<void> {
  const trip_date = (document.getElementById("trip-date") as HTMLInputElement | null)?.value || "";
  const driver = (document.getElementById("trip-driver") as HTMLSelectElement | null)?.value || "";
  const car_id = (document.getElementById("trip-car") as HTMLSelectElement | null)?.value || "";
  const from_loc = (document.getElementById("trip-from") as HTMLInputElement | null)?.value?.trim() || null;
  const odo_str = (document.getElementById("trip-odo-start") as HTMLInputElement | null)?.value || "";

  if (!trip_date) { toast("Ange datum", 1); return; }
  if (!driver) { toast("Ange förare", 1); return; }
  if (!car_id) { toast("Ange bil", 1); return; }
  const odometer_start = parseInt(odo_str, 10);
  if (!Number.isFinite(odometer_start) || odometer_start < 0) { toast("Ange giltig mätarställning", 1); return; }

  if (openTripForCar(car_id)) {
    toast("Bilen har redan en pågående resa — avsluta den först", 1);
    return;
  }

  const known = latestKnownOdo(car_id);

  // Mätaren står lägre än senast kända → troligen efterhandsregistrering.
  if (known != null && odometer_start < known) {
    const ok = await confirmModal(
      `Mätarställning ${odometer_start} km är lägre än senast kända (${known} km).\n\nInled ändå?`,
      { confirmLabel: "Inled ändå", cancelLabel: "Avbryt" }
    );
    if (!ok) return;
  }

  // Mätaren står högre än senast kända → oförklarad körning. Skapa en
  // lucka-rad (known→odometer_start) som fylls i syfte på i efterhand.
  let createGap = false;
  if (known != null && odometer_start > known) {
    const gapKm = odometer_start - known;
    const ok = await confirmModal(
      `Mätaren visar ${odometer_start} km men senast kända var ${known} km — ${gapKm} km saknas i journalen.\n\nEn lucka skapas som du fyller i (vad bilen använts till) i efterhand. Fortsätt?`,
      { confirmLabel: "Skapa lucka & inled", cancelLabel: "Avbryt" }
    );
    if (!ok) return;
    createGap = true;
  }

  // Bild (om odometer-foto sparats via scan)
  let image_path: string | null = null;
  if (ui.imgFile) {
    try { image_path = await uploadImg(ui.imgFile); }
    catch { toast("Bilden kunde inte laddas upp — sparar utan", 1); }
  }

  try {
    if (createGap && known != null) {
      await saveCarTrip({
        car_id, driver, trip_date,
        from_loc: null, to_loc: null, purpose: null,
        odometer_start: known, odometer_end: odometer_start,
        status: "closed", needs_purpose: true,
        is_private: false, is_fueling: false,
        liters: null, total_price: null, image_path: null,
        created_by: auth.user || "",
      });
    }
    await saveCarTrip({
      car_id, driver, trip_date, from_loc,
      to_loc: null, purpose: null,
      odometer_start, odometer_end: null,
      status: "open", needs_purpose: false,
      is_private: false, is_fueling: false,
      liters: null, total_price: null, image_path,
      created_by: auth.user || "",
    });
    _carLastSet({ car_id, driver });
    ui.imgData = null; ui.imgFile = null;
    await loadCarTrips();
    closeModal();
    toast(createGap ? "✓ Lucka skapad & resa inledd" : "✓ Resa inledd");
    render();
  } catch (e) {
    toast("Kunde inte inleda: " + (e as Error).message, 1);
  }
}

// ---- AVSLUTA RESA ----

function endTrip(id?: string): void {
  const t = id ? cars.trips.find(x => x.id === id) : openTrips()[0];
  if (!t) { toast("Ingen pågående resa", 1); return; }
  if (t.status !== "open") { toast("Resan är redan avslutad", 1); return; }
  const car = carById(t.car_id);

  openModal(`
    <div class="modal-title">Avsluta resa</div>
    <div class="cj-end-info">
      <b>${esc(car ? carLabel(car) : "—")}</b> · ${esc(t.driver)}<br>
      Start ${t.odometer_start} km · ${esc(t.trip_date)}${t.from_loc ? " · från " + esc(t.from_loc) : ""}
    </div>

    <label class="field-label">TILL</label>
    <div class="trip-input-with-btn">
      <input type="text" id="trip-to" value="${escAttr(t.to_loc || "")}" placeholder="Plats / adress">
      <button type="button" class="btn-icon" onclick="fetchLocation('trip-to')" title="Hämta nuvarande plats">📍</button>
    </div>

    <label class="field-label">SYFTE</label>
    <input type="text" id="trip-purpose" value="${escAttr(t.purpose || "")}" placeholder="T.ex. 'Leverans till kund'">

    <label class="field-label">MÄTARSTÄLLNING SLUT (km)</label>
    <div class="trip-input-with-btn">
      <input type="number" id="trip-odo-end" inputmode="numeric" min="${t.odometer_start}">
      <button type="button" class="btn-icon" onclick="scanOdometer('trip-odo-end')" title="Scanna med kamera">📷</button>
    </div>

    <div class="trip-checkbox-row">
      <label><input type="checkbox" id="trip-private" ${t.is_private ? "checked" : ""}> Privat körning</label>
      <label><input type="checkbox" id="trip-fueling" onchange="toggleFuelingFields()"> Tankning</label>
    </div>

    <div id="trip-fueling-fields" style="display:none">
      <label class="field-label">LITER</label>
      <input type="number" id="trip-liters" inputmode="decimal" step="0.01" min="0">
      <label class="field-label">TOTALPRIS (SEK)</label>
      <input type="number" id="trip-price" inputmode="decimal" step="0.01" min="0">
    </div>

    <label class="field-label">BILD / KVITTO (valfritt)</label>
    <div class="img-upload-area" onclick="document.getElementById('trip-img-file').click()">
      ${ui.imgData
        ? `<img class="img-preview" src="${ui.imgData}">`
        : `<div style="color:var(--muted);font-size:12px">📸 Lägg till bild</div>`}
    </div>
    <input type="file" id="trip-img-file" accept="image/*" capture="environment" style="display:none" onchange="handleImg(this)">

    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal();ui.imgData=null;ui.imgFile=null" style="flex:1">Avbryt</button>
      <button class="btn" onclick="submitEndTrip('${escJs(t.id)}')" style="flex:1">AVSLUTA RESA</button>
    </div>
  `);
}

async function submitEndTrip(id: string): Promise<void> {
  const t = cars.trips.find(x => x.id === id);
  if (!t) { toast("Resan hittades inte", 1); return; }

  const to_loc = (document.getElementById("trip-to") as HTMLInputElement | null)?.value?.trim() || null;
  const purpose = (document.getElementById("trip-purpose") as HTMLInputElement | null)?.value?.trim() || null;
  const odo_end_str = (document.getElementById("trip-odo-end") as HTMLInputElement | null)?.value || "";
  const is_private = !!(document.getElementById("trip-private") as HTMLInputElement | null)?.checked;
  const is_fueling = !!(document.getElementById("trip-fueling") as HTMLInputElement | null)?.checked;
  const liters_str = (document.getElementById("trip-liters") as HTMLInputElement | null)?.value || "";
  const price_str = (document.getElementById("trip-price") as HTMLInputElement | null)?.value || "";

  const odometer_end = parseInt(odo_end_str, 10);
  if (!Number.isFinite(odometer_end) || odometer_end < 0) { toast("Ange giltig slut-km", 1); return; }
  if (odometer_end < t.odometer_start) {
    toast(`Slut-km måste vara minst start-km (${t.odometer_start})`, 1);
    return;
  }
  if (is_fueling) {
    if (!liters_str || parseFloat(liters_str) <= 0) { toast("Ange liter tankat", 1); return; }
    if (!price_str || parseFloat(price_str) <= 0) { toast("Ange totalpris", 1); return; }
  }

  let image_path: string | null | undefined = undefined;
  if (ui.imgFile) {
    try { image_path = await uploadImg(ui.imgFile); }
    catch { toast("Bilden kunde inte laddas upp", 1); }
  }

  try {
    await saveCarTrip({
      id,
      to_loc, purpose,
      odometer_end, status: "closed",
      is_private, is_fueling,
      liters: is_fueling ? parseFloat(liters_str) : null,
      total_price: is_fueling ? parseFloat(price_str) : null,
      ...(image_path !== undefined ? { image_path } : {}),
    });
    ui.imgData = null; ui.imgFile = null;
    await loadCarTrips();
    closeModal();
    toast("✓ Resa avslutad");
    render();
  } catch (e) {
    toast("Kunde inte avsluta: " + (e as Error).message, 1);
  }
}

// ---- FYLL I LUCKA (syfte i efterhand) ----

function fillGapPurpose(id: string): void {
  const t = cars.trips.find(x => x.id === id);
  if (!t) return;
  const car = carById(t.car_id);
  openModal(`
    <div class="modal-title">Fyll i lucka</div>
    <div class="cj-end-info">
      <b>${esc(car ? carLabel(car) : "—")}</b><br>
      ${t.odometer_start} → ${t.odometer_end} km (${tripDistance(t)} km) · ${esc(t.trip_date)}
    </div>
    <label class="field-label">VAD ANVÄNDES BILEN TILL?</label>
    <input type="text" id="gap-purpose" value="${escAttr(t.purpose || "")}" placeholder="T.ex. 'Privat körning' / 'Hämtning av material'">
    <div class="trip-checkbox-row">
      <label><input type="checkbox" id="gap-private" ${t.is_private ? "checked" : ""}> Privat körning</label>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="submitGapPurpose('${escJs(t.id)}')" style="flex:1">SPARA</button>
    </div>
  `);
}

async function submitGapPurpose(id: string): Promise<void> {
  const purpose = (document.getElementById("gap-purpose") as HTMLInputElement | null)?.value?.trim() || null;
  const is_private = !!(document.getElementById("gap-private") as HTMLInputElement | null)?.checked;
  if (!purpose) { toast("Ange vad bilen användes till", 1); return; }
  try {
    await saveCarTrip({ id, purpose, is_private, needs_purpose: false });
    await loadCarTrips();
    closeModal();
    toast("✓ Lucka ifylld");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + (e as Error).message, 1);
  }
}

// ---- BILREGISTER (admin) ----

function openAddCar(): void {
  if (!auth.isAdmin) return;
  openModal(`
    <div class="modal-title">Ny bil</div>
    <label class="field-label">REG.NR</label>
    <input type="text" id="car-reg" placeholder="ABC123" style="text-transform:uppercase">
    <label class="field-label">SMEKNAMN (valfritt)</label>
    <input type="text" id="car-nick" placeholder="T.ex. 'Vita skåpisen'">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="addCar()" style="flex:1">SPARA</button>
    </div>
  `);
}

async function addCar(): Promise<void> {
  const reg_nr = (document.getElementById("car-reg") as HTMLInputElement | null)?.value?.trim().toUpperCase();
  const nickname = (document.getElementById("car-nick") as HTMLInputElement | null)?.value?.trim() || null;
  if (!reg_nr) { toast("Ange reg.nr", 1); return; }
  try {
    await saveCar({ reg_nr, nickname, active: true });
    await loadCars();
    closeModal();
    toast("✓ Bil tillagd");
    render();
  } catch (e) {
    toast("Kunde inte lägga till: " + (e as Error).message, 1);
  }
}

async function toggleCarActive(id: string, active: boolean): Promise<void> {
  try {
    await saveCar({ id, active });
    await loadCars();
    toast(active ? "✓ Aktiv" : "Inaktiv");
    render();
  } catch {
    toast("Kunde inte ändra", 1);
  }
}

async function doDelCar(id: string): Promise<void> {
  const tripsForCar = cars.trips.filter(t => t.car_id === id).length;
  if (tripsForCar > 0) {
    toast(`Kan inte ta bort — ${tripsForCar} resor finns kopplade. Inaktivera istället.`, 1);
    return;
  }
  if (!await confirmModal("Ta bort bilen permanent?", { confirmLabel: "Ta bort", danger: true })) return;
  try {
    await delCar(id);
    await loadCars();
    toast("🗑 Raderad");
    render();
  } catch {
    toast("Kunde inte radera", 1);
  }
}

// ============================================================
// OCR — Claude Vision Haiku via Netlify-proxy
// ============================================================

async function scanOdometer(targetFieldId: string): Promise<void> {
  // Skapa hidden file-input dynamiskt (kamera direkt)
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  (inp as any).capture = "environment";
  inp.style.display = "none";
  document.body.appendChild(inp);
  inp.onchange = async () => {
    const f = inp.files?.[0];
    document.body.removeChild(inp);
    if (!f) return;
    await _runOcr(f, targetFieldId);
  };
  inp.click();
}

async function _runOcr(file: File, targetFieldId: string): Promise<void> {
  const targetEl = document.getElementById(targetFieldId) as HTMLInputElement | null;
  if (!targetEl) return;
  toast("Läser av mätarställning...");
  try {
    // Komprimera + konvertera till base64
    const blob = await compressImg(file, 1024, 0.85);
    const base64 = await _blobToBase64(blob);
    const r = await fetch("/.netlify/functions/claude-vision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (sessionStorage.getItem("lager-token") || ""),
      },
      body: JSON.stringify({
        kind: "odometer",
        image_base64: base64,
        media_type: blob.type,
      })
    });
    const data = await r.json();
    if (!r.ok) {
      toast(data?.error || "OCR misslyckades", 1);
      return;
    }
    const raw = (data.value || "").trim();
    if (!raw || /OKLART/i.test(raw)) {
      toast("Kunde inte läsa siffran — ange manuellt", 1);
      return;
    }
    // Odometrar visar tiondelar (ex "84 938,5"). Behåll bara heltalsdelen
    // före första decimaltecken (,/.) och strippa övriga icke-siffror —
    // annars klistras decimalen ihop med talet (84938,5 → 849385).
    const num = parseInt(raw.split(/[.,]/)[0].replace(/\D/g, ""), 10);
    if (!Number.isFinite(num)) {
      toast("Oklart svar — ange manuellt", 1);
      return;
    }
    targetEl.value = String(num);
    toast(`📷 ${num} km`);
    // Erbjud spara-bild-toggle bara om vi inte redan har en bild i formuläret
    if (!ui.imgFile) {
      const keep = await confirmModal(
        `Bild lästes av: ${num} km.\n\nVill du spara bilden som dokumentation till resan?`,
        { confirmLabel: "Spara bild", cancelLabel: "Slänga" }
      );
      if (keep) {
        ui.imgFile = file;
        const fr = new FileReader();
        fr.onload = e => {
          ui.imgData = e.target!.result as string;
          const area = document.querySelector(".img-upload-area");
          if (area) area.innerHTML = `<img class="img-preview" src="${ui.imgData}">`;
        };
        fr.readAsDataURL(file);
      }
    }
  } catch (e) {
    toast("OCR misslyckades: " + (e as Error).message, 1);
  }
}

function _blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = fr.result as string;
      // strip "data:...base64," prefix
      const comma = s.indexOf(",");
      res(comma >= 0 ? s.slice(comma + 1) : s);
    };
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

// ============================================================
// GEO — Google Maps Geocoding via Netlify-proxy
// ============================================================

function fetchLocation(targetFieldId: string): void {
  const targetEl = document.getElementById(targetFieldId) as HTMLInputElement | null;
  if (!targetEl) return;
  if (!navigator.geolocation) {
    toast("Geolocation stöds inte i den här webbläsaren", 1);
    return;
  }
  toast("Hämtar plats...");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const r = await fetch("/.netlify/functions/geocode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + (sessionStorage.getItem("lager-token") || ""),
          },
          body: JSON.stringify({ lat: latitude, lng: longitude })
        });
        const data = await r.json();
        if (!r.ok || !data.address) {
          toast(data?.error || "Kunde inte slå upp adress", 1);
          return;
        }
        targetEl.value = data.address;
        toast("📍 " + data.address);
      } catch (e) {
        toast("Geocoding misslyckades: " + (e as Error).message, 1);
      }
    },
    (err) => {
      const msg = err.code === 1 ? "Nekad — tillåt platsåtkomst" :
                  err.code === 2 ? "Ej tillgänglig" :
                  err.code === 3 ? "Tidsgräns" : "Okänt fel";
      toast("📍 " + msg, 1);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

// ============================================================
// EXPORT — Excel via SheetJS-paketet (npm i xlsx, importeras via Vite)
// 6 varianter: helhet, månad, år, förare, bil, endast tankningar
// ============================================================

interface ExportFilter {
  kind: "all" | "month" | "year" | "driver" | "car" | "fueling";
  car_id?: string;
  driver?: string;
  year?: number;
  month?: number;       // 1-12
}

function _tripsFiltered(f: ExportFilter): CarTrip[] {
  // Pågående (öppna) resor exporteras inte förrän de avslutats.
  let list = cars.trips.filter(t => t.status !== "open");
  if (f.car_id) list = list.filter(t => t.car_id === f.car_id);
  if (f.driver) list = list.filter(t => t.driver === f.driver);
  if (f.year != null) list = list.filter(t => new Date(t.trip_date).getFullYear() === f.year);
  if (f.month != null) list = list.filter(t => (new Date(t.trip_date).getMonth() + 1) === f.month);
  if (f.kind === "fueling") list = list.filter(t => t.is_fueling);
  return list.sort((a, b) => a.trip_date < b.trip_date ? -1 : 1);
}

function _tripToRow(t: CarTrip): Record<string, unknown> {
  const car = carById(t.car_id);
  return {
    "Datum":       t.trip_date,
    "Förare":      t.driver,
    "Bil (reg.nr)": car?.reg_nr ?? "",
    "Bil (namn)":  car?.nickname ?? "",
    "Från":        t.from_loc ?? "",
    "Till":        t.to_loc ?? "",
    "Syfte":       t.purpose ?? "",
    "Start-km":    t.odometer_start,
    "Slut-km":     t.odometer_end,
    "Körd sträcka (km)": tripDistance(t),
    "Privat/Tjänst": t.is_private ? "Privat" : "Tjänst",
    "Tankning":    t.is_fueling ? "Ja" : "",
    "Liter":       t.is_fueling ? t.liters ?? "" : "",
    "Totalpris (SEK)": t.is_fueling ? t.total_price ?? "" : "",
  };
}

async function exportCarJournal(f: ExportFilter): Promise<void> {
  try {
    // xlsx laddas som UMD-global (window.XLSX) via <script>-tag i index.html.
    if (typeof XLSX === "undefined") {
      toast("Excel-biblioteket har inte laddats — kontrollera internet", 1);
      return;
    }
    const list = _tripsFiltered(f);
    if (!list.length) { toast("Inga resor matchar filtret", 1); return; }
    const rows = list.map(_tripToRow);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const sheetName = _exportSheetName(f);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const filename = _exportFilename(f);
    XLSX.writeFile(wb, filename);
    toast(`📤 ${list.length} resor → ${filename}`);
  } catch (e) {
    toast("Export misslyckades: " + (e as Error).message, 1);
  }
}

function _exportSheetName(f: ExportFilter): string {
  if (f.kind === "month" && f.year && f.month) return `${f.year}-${String(f.month).padStart(2, "0")}`;
  if (f.kind === "year"  && f.year) return String(f.year);
  if (f.kind === "driver" && f.driver) return f.driver;
  if (f.kind === "car" && f.car_id) {
    const c = carById(f.car_id);
    return (c?.reg_nr || "Bil").slice(0, 31);
  }
  if (f.kind === "fueling") return "Tankningar";
  return "Körjournal";
}

function _exportFilename(f: ExportFilter): string {
  const today = new Date().toISOString().split("T")[0];
  const base = "korjournal_" + _exportSheetName(f).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${base}_${today}.xlsx`;
}

// Praktiska wrappers som UI-knappar kan kalla direkt utan ExportFilter-objekt.
function exportCarAll(): void                                { void exportCarJournal({ kind: "all" }); }
function exportCarYear(year: number): void                   { void exportCarJournal({ kind: "year", year }); }
function exportCarMonth(year: number, month: number): void   { void exportCarJournal({ kind: "month", year, month }); }
function exportCarDriver(driver: string): void               { void exportCarJournal({ kind: "driver", driver }); }
function exportCarByCar(car_id: string): void                { void exportCarJournal({ kind: "car", car_id }); }
function exportCarFueling(): void                            { void exportCarJournal({ kind: "fueling" }); }

// Export-formulärets knappar (slipper TS-cast i inline onclick).
function _exportYearFromForm(): void {
  const v = (document.getElementById("exp-year") as HTMLInputElement | null)?.value;
  const y = parseInt(v || "", 10);
  if (Number.isFinite(y)) exportCarYear(y);
}
function _exportMonthFromForm(): void {
  const v = (document.getElementById("exp-month") as HTMLInputElement | null)?.value;
  if (!v) return;
  const [y, m] = v.split("-").map(Number);
  if (Number.isFinite(y) && Number.isFinite(m)) exportCarMonth(y, m);
}
function _exportDriverFromForm(): void {
  const v = (document.getElementById("exp-driver") as HTMLSelectElement | null)?.value;
  if (v) exportCarDriver(v);
}
function _exportCarFromForm(): void {
  const v = (document.getElementById("exp-car") as HTMLSelectElement | null)?.value;
  if (v) exportCarByCar(v);
}
