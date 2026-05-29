// ============================================================
// render/cars.ts — KÖRJOURNAL (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// KÖRJOURNAL (Fas 8 Etapp B)
// ============================================================

function rCarJournal(): string {
  const activeCars = cars.list.filter(c => c.active);
  const allTrips = cars.trips;

  // Filter-state (lightweight, in-memory — inte i ui-store):
  // hanteras via DOM-läsning inom render-cycle.
  const filterCar    = (document.getElementById("cj-filter-car")    as HTMLSelectElement | null)?.value || "";
  const filterDriver = (document.getElementById("cj-filter-driver") as HTMLSelectElement | null)?.value || "";
  const filterPriv   = (document.getElementById("cj-filter-priv")   as HTMLSelectElement | null)?.value || "alla";
  const filterFuel   = (document.getElementById("cj-filter-fuel")   as HTMLInputElement | null)?.checked || false;
  const filterMonth  = (document.getElementById("cj-filter-month")  as HTMLInputElement | null)?.value || "";

  let visible = allTrips;
  if (filterCar)    visible = visible.filter(t => t.car_id === filterCar);
  if (filterDriver) visible = visible.filter(t => t.driver === filterDriver);
  if (filterPriv === "privat") visible = visible.filter(t => t.is_private);
  if (filterPriv === "tjänst") visible = visible.filter(t => !t.is_private);
  if (filterFuel)   visible = visible.filter(t => t.is_fueling);
  if (filterMonth)  visible = visible.filter(t => t.trip_date.startsWith(filterMonth));

  // Gap-detektion per bil (på FILTERED tripset så vi inte visar luckor
  // användaren inte ser).
  const gapsByCar: Record<string, ReturnType<typeof detectTripGaps>> = {};
  const carsInView = Array.from(new Set(visible.map(t => t.car_id)));
  for (const cid of carsInView) {
    const tripsForCar = allTrips.filter(t => t.car_id === cid);
    gapsByCar[cid] = detectTripGaps(tripsForCar);
  }
  // Flata gap-listan + filtrera så de bara visas om båda resor är synliga.
  const visibleSet = new Set(visible.map(t => t.id));
  const visibleGaps = Object.values(gapsByCar).flat().filter(
    g => visibleSet.has(g.prev.id) && visibleSet.has(g.next.id)
  );

  const userOpts = ["", ...USERS.filter(u => u !== "Admin")].map(u =>
    `<option value="${esc(u)}" ${u === filterDriver ? "selected" : ""}>${u || "Alla förare"}</option>`
  ).join("");
  const carFilterOpts = `<option value="">Alla bilar</option>` +
    cars.list.map(c => `<option value="${esc(c.id)}" ${c.id === filterCar ? "selected" : ""}>${esc(carLabel(c))}</option>`).join("");

  return `
<div class="cj-toolbar">
  <button class="btn cj-add-btn" onclick="openAddTrip()">+ NY RESA</button>
  ${auth.isAdmin ? `<button class="btn-ghost" onclick="openCarRegistry()" title="Bilregister">⚙ Bilar</button>` : ""}
  ${auth.isAdmin ? `<button class="btn-ghost" onclick="openCarExport()" title="Exportera">📤 Export</button>` : ""}
</div>

<div class="cj-filters">
  <select id="cj-filter-car" onchange="render()">${carFilterOpts}</select>
  <select id="cj-filter-driver" onchange="render()">${userOpts}</select>
  <select id="cj-filter-priv" onchange="render()">
    <option value="alla" ${filterPriv === "alla" ? "selected" : ""}>Privat + Tjänst</option>
    <option value="tjänst" ${filterPriv === "tjänst" ? "selected" : ""}>Endast tjänst</option>
    <option value="privat" ${filterPriv === "privat" ? "selected" : ""}>Endast privat</option>
  </select>
  <input type="month" id="cj-filter-month" value="${escAttr(filterMonth)}" onchange="render()">
  <label class="cj-filter-checkbox">
    <input type="checkbox" id="cj-filter-fuel" ${filterFuel ? "checked" : ""} onchange="render()"> Bara tankningar
  </label>
</div>

${visibleGaps.length ? `
<div class="cj-gap-list">
  ${visibleGaps.map(g => rGapCard(g)).join("")}
</div>` : ""}

<div class="lbl">${visible.length} ${visible.length === 1 ? "RESA" : "RESOR"}</div>

${visible.length === 0
  ? `<div class="empty">Inga resor matchar filtret.${!allTrips.length && activeCars.length ? "<br><br>Klicka <b>+ NY RESA</b> för att börja." : ""}${!activeCars.length ? "<br><br>Inga bilar i registret än." + (auth.isAdmin ? " Klicka <b>⚙ Bilar</b>." : " Be admin lägga till en.") : ""}</div>`
  : visible.map(rTripCard).join("")}
`;
}

function rGapCard(g: { car_id: string; prev: CarTrip; next: CarTrip; gap_km: number }): string {
  const car = carById(g.car_id);
  return `
<div class="cj-gap-card">
  <div class="cj-gap-title">⚠ Lucka i mätarställning — ${g.gap_km} km saknas</div>
  <div class="cj-gap-meta">
    ${esc(car ? carLabel(car) : "Bil")} ·
    från ${g.prev.odometer_end} km (${esc(g.prev.trip_date)}) →
    till ${g.next.odometer_start} km (${esc(g.next.trip_date)})
  </div>
  <button class="btn-ghost cj-gap-fill-btn" onclick='openAddTrip(${JSON.stringify({
    car_id: g.car_id,
    trip_date: g.prev.trip_date,
    odometer_start: g.prev.odometer_end,
    odometer_end: g.next.odometer_start,
  })})'>+ Fyll luckan</button>
</div>`;
}

function rTripCard(t: CarTrip): string {
  const car = carById(t.car_id);
  const distance = t.odometer_end - t.odometer_start;
  const canEdit = auth.isAdmin || t.created_by === auth.user;
  return `
<div class="cj-trip-card${t.is_private ? " cj-trip-private" : ""}${t.is_fueling ? " cj-trip-fueling" : ""}">
  <div class="cj-trip-header">
    <div class="cj-trip-date">${esc(t.trip_date)}</div>
    <div class="cj-trip-badges">
      ${t.is_private ? `<span class="cj-badge cj-badge-private">Privat</span>` : ""}
      ${t.is_fueling ? `<span class="cj-badge cj-badge-fuel">⛽ ${t.liters ?? "?"} L · ${t.total_price ?? "?"} kr</span>` : ""}
    </div>
  </div>
  <div class="cj-trip-row"><b>${esc(car ? carLabel(car) : "—")}</b> · ${esc(t.driver)}</div>
  ${t.from_loc || t.to_loc ? `<div class="cj-trip-row">${esc(t.from_loc || "?")} → ${esc(t.to_loc || "?")}</div>` : ""}
  ${t.purpose ? `<div class="cj-trip-row cj-trip-purpose">${esc(t.purpose)}</div>` : ""}
  <div class="cj-trip-row cj-trip-odo">
    ${t.odometer_start} → ${t.odometer_end} km <b>(${distance} km)</b>
  </div>
  ${t.image_path ? `<img class="cj-trip-img" src="${escAttr(t.image_path)}" loading="lazy" onclick="openLightbox('${escAttr(t.image_path)}')">` : ""}
  ${canEdit ? `
  <div class="cj-trip-actions">
    <button class="btn-ghost" onclick="openEditTrip('${escAttr(t.id)}')">✎ Redigera</button>
    <button class="btn-ghost" onclick="doDelTrip('${escAttr(t.id)}')" style="color:var(--accent)">🗑</button>
  </div>` : ""}
</div>`;
}

// Bilregister — admin-modal
function openCarRegistry(): void {
  if (!auth.isAdmin) return;
  const list = cars.list.map(c => `
    <div class="cj-car-row">
      <div>
        <b>${esc(c.reg_nr)}</b>${c.nickname ? ` <span style="color:var(--muted)">(${esc(c.nickname)})</span>` : ""}
        ${!c.active ? ` <span class="cj-badge" style="background:var(--border)">Inaktiv</span>` : ""}
      </div>
      <div class="cj-car-actions">
        <button class="btn-ghost" onclick="toggleCarActive('${escAttr(c.id)}', ${!c.active})">${c.active ? "Inaktivera" : "Aktivera"}</button>
        <button class="btn-ghost" onclick="doDelCar('${escAttr(c.id)}')" style="color:var(--accent)">🗑</button>
      </div>
    </div>`).join("");
  openModal(`
    <div class="modal-title">Bilregister</div>
    ${cars.list.length ? `<div class="cj-car-list">${list}</div>` : `<div class="empty" style="padding:20px 0">Inga bilar.</div>`}
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Stäng</button>
      <button class="btn" onclick="openAddCar()" style="flex:1">+ NY BIL</button>
    </div>
  `);
}

// Export-väljare
function openCarExport(): void {
  if (!auth.isAdmin) return;
  const year = new Date().getFullYear();
  const carOpts = cars.list.map(c => `<option value="${esc(c.id)}">${esc(carLabel(c))}</option>`).join("");
  const driverOpts = USERS.filter(u => u !== "Admin").map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join("");
  openModal(`
    <div class="modal-title">Exportera körjournal</div>
    <p style="margin:0 0 12px;color:var(--muted);font-size:13px">Välj exporttyp. Filen laddas ner som .xlsx.</p>

    <button class="btn mt" style="width:100%" onclick="exportCarAll();closeModal()">📊 Hela körjournalen</button>

    <div class="lbl mt">PER ÅR</div>
    <div style="display:flex;gap:6px">
      <input type="number" id="exp-year" value="${year}" min="2000" max="2099" style="flex:1">
      <button class="btn-ghost" onclick="_exportYearFromForm()">Exportera år</button>
    </div>

    <div class="lbl mt">PER MÅNAD</div>
    <div style="display:flex;gap:6px">
      <input type="month" id="exp-month" value="${year}-${String(new Date().getMonth()+1).padStart(2,'0')}" style="flex:1">
      <button class="btn-ghost" onclick="_exportMonthFromForm()">Exportera månad</button>
    </div>

    <div class="lbl mt">PER FÖRARE</div>
    <div style="display:flex;gap:6px">
      <select id="exp-driver" style="flex:1">${driverOpts}</select>
      <button class="btn-ghost" onclick="_exportDriverFromForm()">Exportera</button>
    </div>

    <div class="lbl mt">PER BIL</div>
    <div style="display:flex;gap:6px">
      <select id="exp-car" style="flex:1">${carOpts}</select>
      <button class="btn-ghost" onclick="_exportCarFromForm()">Exportera</button>
    </div>

    <button class="btn-ghost mt" style="width:100%" onclick="exportCarFueling();closeModal()">⛽ Endast tankningar</button>

    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Stäng</button>
    </div>
  `);
}
