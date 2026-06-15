// ============================================================
// render/economy.ts — EKONOMI (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// EKONOMI (Fas 8 Etapp C) — admin-only utgiftshantering
// ============================================================
function rEkonomi(): string {
  if (!auth.isAdmin) {
    return `<div class="empty">Endast Admin har tillgång till Ekonomi.</div>`;
  }
  const years = getEconomyYears();
  const yearOpts = years.map(y => `<option value="${y}" ${y === economy.year ? "selected" : ""}>${y}</option>`).join("");
  const cf = economy.categoryFilter;
  const allEntries = economy.entries;
  const visible = cf === "alla" ? allEntries : allEntries.filter(e => e.category === cf);

  // Summor per kategori (på hela året, inte filtered — chips visar totals).
  const sumByCat = ecoSumByCategory(allEntries);
  const yearTotal = ecoTotal(allEntries);
  const filteredTotal = ecoTotal(visible);

  const chips = `
<div class="eco-chips">
  <button class="eco-chip ${cf === "alla" ? "active" : ""}" onclick="setEconomyCategoryFilter('alla')">📊 Alla (${formatSek(yearTotal)})</button>
  ${ECONOMY_CATEGORIES.map(c => {
    const total = sumByCat[c.id] || 0;
    const active = cf === c.id;
    if (!total && !active) return "";
    return `<button class="eco-chip ${active ? "active" : ""}" onclick="setEconomyCategoryFilter('${esc(c.id)}')">${c.emoji} ${esc(c.label)} (${formatSek(total)})</button>`;
  }).filter(Boolean).join("")}
</div>`;

  // Gruppera per kategori i config-ordning, okända kategorier sist.
  const grouped: Record<string, EconomyEntry[]> = {};
  for (const e of visible) {
    (grouped[e.category] = grouped[e.category] || []).push(e);
  }
  const orderedCats: string[] = ECONOMY_CATEGORIES
    .map(c => c.id as string)
    .filter(id => (grouped[id]?.length || 0) > 0);
  for (const k of Object.keys(grouped)) {
    if (!orderedCats.includes(k)) orderedCats.push(k);
  }

  return `
<div class="eco-toolbar">
  <select id="eco-year-select" onchange="_onEconomyYearChange()" class="eco-year-select">${yearOpts}</select>
  <button class="btn" onclick="openAddEconomy()">+ NY UTGIFT</button>
</div>

${chips}

${orderedCats.length === 0
  ? `<div class="empty">Inga utgifter ${economy.year}${cf !== "alla" ? " i den här kategorin" : ""}.<br><br>Klicka <b>+ NY UTGIFT</b> för att börja.</div>`
  : orderedCats.map(cid => rEcoCategorySection(cid, grouped[cid] || [])).join("")}

<div class="eco-totals-footer">
  <div>
    <div class="eco-totals-label">${cf === "alla" ? `Total ${economy.year}` : `${economyCategoryEmoji(cf)} ${esc(economyCategoryLabel(cf))}`}</div>
    <div class="eco-totals-value">${formatSek(filteredTotal)}</div>
  </div>
  ${cf !== "alla" ? `<div style="text-align:right">
    <div class="eco-totals-label">Hela året</div>
    <div class="eco-totals-value eco-totals-secondary">${formatSek(yearTotal)}</div>
  </div>` : ""}
</div>`;
}

function rEcoCategorySection(cid: string, entries: EconomyEntry[]): string {
  const total = ecoTotal(entries);
  return `
<div class="eco-section">
  <div class="eco-section-header">
    <div class="eco-section-title">${economyCategoryEmoji(cid)} ${esc(economyCategoryLabel(cid))}</div>
    <div class="eco-section-total">${formatSek(total)}</div>
  </div>
  ${entries.map(rEcoEntry).join("")}
</div>`;
}

function rEcoEntry(e: EconomyEntry): string {
  return `
<div class="eco-entry">
  <div class="eco-entry-main">
    <div class="eco-entry-title">${esc(e.title)}</div>
    ${e.comment ? `<div class="eco-entry-comment">${esc(e.comment)}</div>` : ""}
  </div>
  <div class="eco-entry-price">${formatSek(e.price)}</div>
  <div class="eco-entry-actions">
    <button class="cmt-act-btn" onclick="openEditEconomy('${escJs(e.id)}')" title="Redigera">✎</button>
    <button class="cmt-act-btn cmt-act-del" onclick="doDelEconomy('${escJs(e.id)}')" title="Radera">🗑</button>
  </div>
</div>`;
}
