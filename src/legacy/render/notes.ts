// ============================================================
// render/notes.ts — ANTECKNINGAR (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// ANTECKNINGAR-FLIKEN
// ============================================================
// Gemensamt filter — används av rNotes och applyNoteFilters (list-patch).
function getFilteredNotes(): Note[] {
  const filtered = notes.list.filter(n => {
    if (ui.fCat.length && !ui.fCat.includes(n.category)) return false;
    if (ui.fStat.length && !ui.fStat.includes(n.status)) return false;
    if (ui.fAssigned.length) {
      const ok = ui.fAssigned.some(a => a === "ingen" ? !n.assigned_to : n.assigned_to === a);
      if (!ok) return false;
    }
    if (ui.searchQuery && !n.text.toLowerCase().includes(ui.searchQuery.toLowerCase())) return false;
    return true;
  });
  // Klarmarkerade noter hamnar längst ner; behåller inbördes ordning (stabil sort).
  return filtered.sort((a, b) =>
    (a.status === "klar" ? 1 : 0) - (b.status === "klar" ? 1 : 0)
  );
}

interface NoteFilterCfg {
  label: string;
  selected: string[];
  setter: string;
  options: { value: string; label: string }[];
}

function noteFilterCfg(key: "cat" | "stat" | "assigned"): NoteFilterCfg {
  if (key === "cat") {
    return {
      label: "Kategori", selected: ui.fCat, setter: "setFC",
      options: Object.entries(CATS)
        .filter(([k]) => k !== "intern" || INTERN_USERS.includes(auth.user || ""))
        .map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` })),
    };
  }
  if (key === "stat") {
    return {
      label: "Status", selected: ui.fStat, setter: "setFS",
      options: Object.entries(STATS).map(([k, v]) => ({ value: k, label: v })),
    };
  }
  return {
    label: "Tilldelad", selected: ui.fAssigned, setter: "setFA",
    options: [
      { value: "ingen", label: "Ej tilldelad" },
      ...USERS.filter(u => u !== "Admin").map(u => ({ value: u, label: `@${u}` })),
    ],
  };
}

function noteFilterSummary(label: string, n: number): string {
  return n ? `${label} (${n})` : `${label}: Alla`;
}

function rNoteFilterDropdown(key: "cat" | "stat" | "assigned"): string {
  const cfg = noteFilterCfg(key);
  return `
<details class="filter-dropdown" id="filter-dd-${key}">
  <summary class="filter-dropdown-toggle">
    <span id="filter-sum-${key}">${esc(noteFilterSummary(cfg.label, cfg.selected.length))}</span>
    <span class="filter-caret">▾</span>
  </summary>
  <div class="filter-dropdown-menu">
    ${cfg.options.map(o => `
      <label class="filter-dropdown-opt">
        <input type="checkbox" ${cfg.selected.includes(o.value) ? "checked" : ""} onchange="${cfg.setter}('${escAttr(o.value)}')">
        <span>${esc(o.label)}</span>
      </label>`).join("")}
    <button class="filter-dropdown-clear" onclick="clearNoteFilter('${key}')">Rensa</button>
  </div>
</details>`;
}

function rNotes(): string {
  const filtered = getFilteredNotes();
  // "Idag" visas överst — men bara i standardvyn (utan aktivt sök/filter), så
  // den inte krockar med en filtrerad lista. Flyttad hit från Hem (Fas 9).
  const isDefaultView = !ui.searchQuery && !ui.fCat.length && !ui.fStat.length && !ui.fAssigned.length;
  const today = notes.list.filter(n =>
    new Date(n.created_at).toDateString() === new Date().toDateString()
  );
  return `
${isDefaultView && today.length ? `<div class="lbl">IDAG (${today.length})</div>
<div class="note-list">${today.slice(0, 8).map(n => rCard(n)).join("")}</div>
<div class="section-gap"></div>` : ""}
<div class="search-box">
  <input type="text" id="search-input" placeholder="Sök bland anteckningar..." value="${escAttr(ui.searchQuery)}" oninput="setSearch(this.value)">
  ${ui.searchQuery ? `<button class="search-clear" onclick="clearSearch()">×</button>` : ""}
</div>
<div class="notes-filter-row mb">
  ${rNoteFilterDropdown("cat")}
  ${rNoteFilterDropdown("stat")}
  ${rNoteFilterDropdown("assigned")}
</div>
<div class="lbl" id="notes-count">${filtered.length} ANTECKNINGAR ${ui.searchQuery ? `("${esc(ui.searchQuery)}")` : ""}</div>
<div class="note-list" id="note-list">
  ${filtered.length === 0
    ? `<div class="empty">Inga matchar filtret</div>`
    : filtered.map(n => rCard(n)).join("")
  }
</div>`;
}

// Patcha bara list + räknare när ett filter ändras — lämnar dropdownens
// DOM orörd så den stannar öppen och kryssrutorna behåller fokus.
function applyNoteFilters(): void {
  const filtered = getFilteredNotes();
  const list = document.getElementById("note-list");
  if (list) {
    list.innerHTML = filtered.length === 0
      ? `<div class="empty">Inga matchar filtret</div>`
      : filtered.map(n => rCard(n)).join("");
  }
  const cnt = document.getElementById("notes-count");
  if (cnt) cnt.textContent = `${filtered.length} ANTECKNINGAR ${ui.searchQuery ? `("${ui.searchQuery}")` : ""}`;
  const upd = (key: string, label: string, n: number) => {
    const el = document.getElementById(`filter-sum-${key}`);
    if (el) el.textContent = noteFilterSummary(label, n);
  };
  upd("cat", "Kategori", ui.fCat.length);
  upd("stat", "Status", ui.fStat.length);
  upd("assigned", "Tilldelad", ui.fAssigned.length);
}

// ---- ANTECKNINGSKORT ----
function rCard(n: Note, inTrash: boolean = false): string {
  const cat = CATS[n.category];
  const prio = PRIOS[n.priority || "medel"];
  const open = notes.openId === n.id;
  const linkedMat = n.material_id ? materials.list.find(m => m.id === n.material_id) : null;
  const dlStatus = n.deadline ? deadlineStatus(n.deadline) : null;
  const dlLabel  = n.deadline ? deadlineLabel(n.deadline) : "";
  const noteComments = notes.comments[n.id] || [];
  const commentCount = noteComments.length;

  // Alt A (Fas 9): prioritet bär färgen via kortets vänsterkant. Bara "hög"
  // får kant — medel/låg = lugnt läge utan kant, så akuta kort sticker ut.
  const prioBorder = n.priority === "hög" ? (prio?.color || "transparent") : "transparent";
  // Deadline visas som färgad text i meta-raden (inte längre en egen bricka).
  const dlColor =
    dlStatus === "overdue" ? "var(--red)" :
    dlStatus === "urgent"  ? "var(--accent)" :
    dlStatus === "soon"    ? "var(--yellow)" : "var(--muted)";

  return `<div class="note-card" data-note-id="${n.id}" onclick="toggleNote(${n.id})" style="border-left:3px solid ${prioBorder}">
  <div class="note-tags">
    <span class="note-cat" style="color:${cat?.color}">${cat?.emoji} ${cat?.label?.toUpperCase()}</span>
    <button onclick="event.stopPropagation();cycleNoteStatus(${n.id})" title="Tryck för att cykla status" style="font-size:9px;color:${n.status === "klar" ? "#4CAF7D" : "var(--muted)"};font-family:var(--display);font-weight:700;background:transparent;border:1px solid currentColor;border-radius:10px;padding:1px 8px;cursor:pointer">${(STATS[n.status] || esc(n.status)).toUpperCase()}</button>
    ${n.assigned_to ? `<span class="note-assign">@${esc(n.assigned_to)}</span>` : ""}
    ${linkedMat ? `<span class="note-link">📦 ${esc(linkedMat.name)}</span>` : ""}
    ${commentCount > 0 ? `<span style="font-size:9px;color:var(--muted)">💬 ${commentCount}</span>` : ""}
    ${n.image_url ? `<span style="font-size:9px;color:var(--muted)" title="Har bild">📷</span>` : ""}
  </div>
  <div class="note-text ${n.status === "klar" ? "done" : ""}">${esc(n.text)}</div>
  ${open && n.image_url ? `<img class="note-img" src="${escAttr(n.image_url)}" loading="lazy" style="cursor:zoom-in" onclick="event.stopPropagation();openLightbox('${escAttr(n.image_url)}')">` : ""}
  <div class="note-meta">
    ${dlStatus ? `<span class="note-deadline" style="color:${dlColor}">${esc(dlLabel)}</span>` : ""}
    <span>${fmtD(n.created_at)}</span>
    <span>· ${esc(n.created_by || "")}</span>
    ${inTrash ? `<span style="color:var(--accent)">· raderad ${fmtDateOnly(n.deleted_at || "")}</span>` : ""}
  </div>
  ${open && !inTrash ? `
  <div class="note-actions" onclick="event.stopPropagation()">
    ${Object.entries(STATS).map(([k, v]) =>
      `<button class="status-btn ${n.status === k ? "active" : ""}" onclick="setStatus(${n.id},'${k}')">${v}</button>`
    ).join("")}
    <button class="btn-ghost" onclick="openEdit(${n.id})">✎ Redigera</button>
    <button class="btn-ghost" onclick="doDelete(${n.id})" style="margin-left:auto">🗑</button>
  </div>
  <div class="comments-section" onclick="event.stopPropagation()">
    <div class="comment-lbl">KOMMENTARER (${commentCount})</div>
    ${noteComments.map(c => {
      const canMod = auth.isAdmin || c.created_by === auth.user;
      return `<div class="comment-item">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
          <div class="comment-text" style="flex:1">${esc(c.text)}</div>
          ${canMod ? `<div style="display:flex;gap:4px;flex-shrink:0">
            <button class="cmt-act-btn" onclick="editNoteCommentAction(${n.id},${c.id},'${escAttr(c.text)}')">✎</button>
            <button class="cmt-act-btn cmt-act-del" onclick="delNoteCommentAction(${n.id},${c.id})">🗑</button>
          </div>` : ""}
        </div>
        <div class="comment-meta">${esc(c.created_by)} · ${fmtD(c.created_at)}</div>
      </div>`;
    }).join("")}
    <div class="comment-input-row">
      <input type="text" id="comment-input-${n.id}" placeholder="Skriv en kommentar..." onkeydown="if(event.key==='Enter')submitComment(${n.id})">
      <button class="btn-ghost" onclick="submitComment(${n.id})">Skicka</button>
    </div>
  </div>
  ` : ""}
  ${open && inTrash ? `
  <div class="note-actions" onclick="event.stopPropagation()">
    <button class="btn-ghost" onclick="restoreNote(${n.id})">↩ Återställ</button>
    <button class="btn-ghost danger ml-auto" onclick="permDelete(${n.id})">🗑 Radera permanent</button>
  </div>
  ` : ""}
</div>`;
}
