// ============================================================
// render/hem.ts — HEM-vyn (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// HEM-FLIKEN
// ============================================================
function rHem(): string {
  const hp = notes.list.filter(n => n.priority === "hög" && n.status !== "klar");
  const deadlineUrgent = notes.list.filter(n =>
    n.status !== "klar" && n.deadline &&
    (deadlineStatus(n.deadline) === "urgent" ||
     deadlineStatus(n.deadline) === "overdue" ||
     deadlineStatus(n.deadline) === "soon")
  );
  const cs = Object.entries(CATS).map(([k, v]) => ({
    k, v,
    a: notes.list.filter(n => n.category === k && n.status !== "klar").length,
    t: notes.list.filter(n => n.category === k).length
  })).filter(s => s.t > 0);

  // Mina uppgifter (om jag är tilldelad eller huvudansvarig)
  const myTasks = tasks.list.filter(t =>
    t.status !== "klar" &&
    (t.responsible === auth.user || (t.assigned_to || []).includes(auth.user || ""))
  );

  const matOpts  = materials.list.map(m => `<option value="${m.id}">${esc(m.emoji || "📦")} ${esc(m.name)}</option>`).join("");
  const userOpts = USERS.filter(u => u !== "Admin").map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join("");

  return `
<!-- Fas 5.6: Foto-först-flöde — kamera direkt, anteckning skapas i bakgrunden -->
<button class="btn quick-photo-btn" onclick="document.getElementById('quick-photo-file').click()"
  style="width:100%;padding:18px;font-size:16px;font-family:var(--display);font-weight:800;letter-spacing:1px;margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:10px">
  <span style="font-size:24px">📸</span> SNABBT FOTO
</button>
<input type="file" id="quick-photo-file" accept="image/*" capture="environment" style="display:none" onchange="quickPhotoNote(this)">

<div class="desktop-grid">
  <div class="card note-compose">
    <div class="lbl">NY ANTECKNING</div>
    <textarea id="note-input" rows="3" placeholder="Beskriv vad du observerat... (t.ex. 'Kravallstaket rad 3 trasig fot, brådskande')"></textarea>
    <div class="note-extra">
    <label class="field-label">KATEGORI (auto)</label>
    <select id="note-cat">${Object.entries(CATS).filter(([k]) => k !== "intern" || INTERN_USERS.includes(auth.user || "")).map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join("")}</select>
    <label class="field-label">PRIORITET (auto)</label>
    <select id="note-prio">${Object.entries(PRIOS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select>
    <label class="field-label">TILLDELA TILL (valfritt)</label>
    <select id="note-assign"><option value="">— Ingen —</option>${userOpts}</select>
    ${materials.list.length ? `<label class="field-label">KOPPLA TILL MATERIAL (valfritt)</label>
    <select id="note-material"><option value="">— Inget —</option>${matOpts}</select>` : ""}
    <label class="field-label">DEADLINE (valfritt)</label>
    <input type="datetime-local" id="note-deadline">
    <div class="img-upload-area" onclick="document.getElementById('img-file').click()">
      ${ui.imgData
        ? `<img class="img-preview" src="${ui.imgData}">`
        : `<div style="color:var(--muted);font-size:12px">📸 Lägg till foto<br><span style="font-size:10px;color:var(--dim)">Öppnar kameran direkt</span></div>`
      }
    </div>
    <input type="file" id="img-file" accept="image/*" capture="environment" style="display:none" onchange="handleImg(this)">
    <button class="btn mt" style="width:100%" onclick="addNote()" id="add-btn">LÄGG TILL →</button>
    </div>
  </div>
  <div>
    ${hp.length ? `<div class="alert"><div class="alert-title">🔴 HÖG PRIORITET (${hp.length})</div>${
      hp.slice(0, 4).map(n =>
        `<div class="alert-item">${CATS[n.category]?.emoji} ${esc(n.text.substring(0, 80))}${n.text.length > 80 ? "..." : ""}</div>`
      ).join("")
    }</div>` : ""}
    ${deadlineUrgent.length ? `<div class="deadline-alert"><div class="alert-title">⏰ KOMMANDE DEADLINES (${deadlineUrgent.length})</div>${
      deadlineUrgent.slice(0, 4).map(n =>
        `<div class="alert-item">${esc(n.text.substring(0, 60))}${n.text.length > 60 ? "..." : ""} — ${esc(deadlineLabel(n.deadline))}</div>`
      ).join("")
    }</div>` : ""}
    ${myTasks.length ? `<div class="alert" style="background:#0E1A1E;border-color:var(--blue)"><div class="alert-title" style="color:var(--blue)">📋 MINA UPPGIFTER (${myTasks.length})</div>${
      myTasks.slice(0, 4).map(t =>
        `<div class="alert-item" style="border-left-color:var(--blue)">${esc(t.title)}${t.responsible === auth.user ? " (huvudansvarig)" : ""}</div>`
      ).join("")
    }</div>` : ""}
    <div class="lbl">ÖVERSIKT</div>
    <div class="stats-grid">${
      cs.map(s => `<div class="stat-card" style="border-left:3px solid ${s.v.color}">
        <div style="font-size:18px;margin-bottom:3px">${s.v.emoji}</div>
        <div class="stat-num" style="color:${s.v.color}">${s.a}</div>
        <div class="stat-lbl">${s.v.label.toUpperCase()} · ${s.t} TOTALT</div>
      </div>`).join("")
    }</div>
  </div>
</div>`;
}
