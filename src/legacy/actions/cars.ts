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

// ---- GAP-DETEKTION ----
// Returnerar luckor per bil där en resa börjar högre än föregående resa slutade.
// Sorteras kronologiskt så vi kan hitta hopp mellan rader.
interface TripGap {
  car_id: string;
  prev: CarTrip;
  next: CarTrip;
  gap_km: number;
}

function detectTripGaps(tripsForCar: CarTrip[]): TripGap[] {
  // Sortera kronologiskt (äldst först, sen odometer_start) per bil.
  const sorted = [...tripsForCar].sort((a, b) => {
    if (a.trip_date < b.trip_date) return -1;
    if (a.trip_date > b.trip_date) return 1;
    return a.odometer_start - b.odometer_start;
  });
  const gaps: TripGap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const diff = next.odometer_start - prev.odometer_end;
    if (diff > 0) {
      gaps.push({ car_id: next.car_id, prev, next, gap_km: diff });
    }
  }
  return gaps;
}

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
    .filter(t => t.car_id === car_id)
    .sort((a, b) => {
      if (a.trip_date > b.trip_date) return -1;
      if (a.trip_date < b.trip_date) return 1;
      return b.odometer_end - a.odometer_end;
    })[0];
  if (latestForCar && odometer_start < latestForCar.odometer_end) {
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
      if (saveBtn) saveBtn.setAttribute("onclick", `saveEditTrip('${escAttr(id)}')`);
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
    const num = parseInt(raw.replace(/\D/g, ""), 10);
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
  let list = [...cars.trips];
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
    "Körd sträcka (km)": t.odometer_end - t.odometer_start,
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
