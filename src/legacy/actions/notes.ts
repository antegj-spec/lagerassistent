// @ts-nocheck
// ============================================================
// actions/notes.ts — Anteckningar + papperskorg + kommentarer
// Beror på: services/notes.ts (loadNotes, saveNote, delNotePerm, ...),
//   services/images.ts (uploadImg), ui.ts (toast, openModal, confirmModal,
//   updMeta, classifyCat, classifyPrio, esc, escAttr), render.ts (render)
// ============================================================

async function addNote() {
  const inp  = document.getElementById("note-input");
  const text = inp?.value?.trim();
  if (!text) { toast("Skriv en anteckning först", 1); return; }

  const cat      = document.getElementById("note-cat")?.value || classifyCat(text);
  const prio     = document.getElementById("note-prio")?.value || classifyPrio(text);
  const assigned = document.getElementById("note-assign")?.value || null;
  const matIdRaw = document.getElementById("note-material")?.value;
  const material_id = matIdRaw ? parseInt(matIdRaw) : null;
  const deadlineRaw = document.getElementById("note-deadline")?.value;
  const deadline = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;

  const btn = document.getElementById("add-btn");
  if (btn) btn.disabled = true;
  try {
    let image_url = null;
    if (ui.imgFile) { toast("Laddar upp bild..."); image_url = await uploadImg(ui.imgFile); }
    await saveNote({ text, category: cat, priority: prio, status: "ny", created_by: auth.user, image_url, assigned_to: assigned, material_id, deadline });
    await loadNotes();
    updMeta();
    ui.imgData = null;
    ui.imgFile = null;
    toast("✓ Anteckning sparad");
    render();
  } catch (e) {
    toast("Kunde inte spara — kontrollera anslutning", 1);
  }
  if (btn) btn.disabled = false;
}

async function toggleNote(id) {
  notes.openId = notes.openId === id ? null : id;
  if (notes.openId && !notes.comments[id]) {
    await loadComments(id);
  }
  render();
}

async function setStatus(id, status) {
  try {
    await saveNote({ id, status });
    notes.list = notes.list.map(n => n.id === id ? { ...n, status } : n);
    updMeta();
    toast(status === "klar" ? "✓ Markerad som klar" : "✓ Uppdaterad");
    render();
  } catch (e) {
    toast("Kunde inte uppdatera", 1);
  }
}

async function submitComment(noteId) {
  const inp  = document.getElementById("comment-input-" + noteId);
  const text = inp?.value?.trim();
  if (!text) return;
  try {
    await addComment(noteId, text);
    await loadComments(noteId);
    render();
    toast("✓ Kommentar sparad");
  } catch (e) {
    toast("Kunde inte spara kommentar", 1);
  }
}

async function delNoteCommentAction(noteId, commentId) {
  await delCommentFlow(commentId, {
    del: delComment,
    reload: () => loadComments(noteId)
  });
}

function editNoteCommentAction(noteId, commentId, currentText) {
  openEditCommentModal({
    currentText,
    textareaId: "edit-note-cmt",
    onSaveFn: "saveNoteCommentEdit",
    saveArgs: [noteId, commentId]
  });
}

async function saveNoteCommentEdit(noteId, commentId) {
  await editCommentFlow(commentId, {
    textareaId: "edit-note-cmt",
    edit: editComment,
    reload: () => loadComments(noteId)
  });
}

async function doDelete(id) {
  const note = notes.list.find(n => n.id === id);
  if (!note) return;
  try {
    const deletedAt = new Date().toISOString();
    await saveNote({ id, deleted_at: deletedAt });
    notes.list = notes.list.filter(n => n.id !== id);
    if (auth.isAdmin) notes.trashed = [{ ...note, deleted_at: deletedAt }, ...notes.trashed];
    notes.openId = null;
    updMeta();
    render();
    toast("Anteckning raderad", 0, "ÅNGRA", async () => {
      try {
        await saveNote({ id, deleted_at: null });
        await loadNotes();
        updMeta();
        render();
        toast("✓ Återställd");
      } catch (e) {
        toast("Kunde inte återställa", 1);
      }
    });
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}

async function restoreNote(id) {
  try {
    await saveNote({ id, deleted_at: null });
    await loadNotes();
    updMeta();
    render();
    toast("✓ Återställd");
  } catch (e) {
    toast("Kunde inte återställa", 1);
  }
}

async function permDelete(id) {
  if (!await confirmModal("Radera permanent? Detta kan inte ångras.", { confirmLabel: "Radera", danger: true })) return;
  try {
    await delNotePerm(id);
    notes.trashed = notes.trashed.filter(n => n.id !== id);
    render();
    toast("🗑 Raderad permanent");
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}

async function emptyTrash() {
  if (!await confirmModal(`Radera alla ${notes.trashed.length} anteckningar i papperskorgen permanent? Kan inte ångras.`, { confirmLabel: "Töm papperskorg", danger: true })) return;
  try {
    // Fas 3.3: ett batch-DELETE istället för N separata. Snabbare + atomiskt
    // (alla raderas eller ingen — undviker halv-tömd papperskorg vid fel).
    await delNotesPermBatch(notes.trashed.map(n => n.id));
    notes.trashed = [];
    render();
    toast("🗑 Papperskorgen tömd");
  } catch (e) {
    toast("Kunde inte tömma", 1);
  }
}

// REDIGERA ANTECKNING
function openEdit(id) {
  const note = notes.list.find(n => n.id === id);
  if (!note) return;
  const matOpts  = materials.list.map(m =>
    `<option value="${m.id}" ${note.material_id === m.id ? "selected" : ""}>${esc(m.emoji || "📦")} ${esc(m.name)}</option>`
  ).join("");
  const userOpts = USERS.filter(u => u !== "Admin").map(u =>
    `<option value="${esc(u)}" ${note.assigned_to === u ? "selected" : ""}>${esc(u)}</option>`
  ).join("");
  const dlVal = note.deadline ? new Date(note.deadline).toISOString().slice(0, 16) : "";

  openModal(`
    <div class="modal-title">Redigera anteckning</div>
    <label class="field-label">TEXT</label>
    <textarea id="edit-text" rows="4">${esc(note.text)}</textarea>
    <label class="field-label">KATEGORI</label>
    <select id="edit-cat">${Object.entries(CATS).filter(([k]) => k !== "intern" || INTERN_USERS.includes(auth.user)).map(([k, v]) =>
      `<option value="${k}" ${note.category === k ? "selected" : ""}>${v.emoji} ${v.label}</option>`
    ).join("")}</select>
    <label class="field-label">PRIORITET</label>
    <select id="edit-prio">${Object.entries(PRIOS).map(([k, v]) =>
      `<option value="${k}" ${note.priority === k ? "selected" : ""}>${v.label}</option>`
    ).join("")}</select>
    <label class="field-label">TILLDELA TILL</label>
    <select id="edit-assign"><option value="">— Ingen —</option>${userOpts}</select>
    ${materials.list.length ? `<label class="field-label">KOPPLA TILL MATERIAL</label>
    <select id="edit-mat"><option value="">— Inget —</option>${matOpts}</select>` : ""}
    <label class="field-label">DEADLINE</label>
    <input type="datetime-local" id="edit-deadline" value="${escAttr(dlVal)}">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveEdit(${id})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveEdit(id) {
  const text = document.getElementById("edit-text")?.value?.trim();
  if (!text) { toast("Text får inte vara tom", 1); return; }
  const cat      = document.getElementById("edit-cat")?.value;
  const prio     = document.getElementById("edit-prio")?.value;
  const assigned = document.getElementById("edit-assign")?.value || null;
  const matRaw   = document.getElementById("edit-mat")?.value;
  const material_id = matRaw ? parseInt(matRaw) : null;
  const dlRaw    = document.getElementById("edit-deadline")?.value;
  const deadline = dlRaw ? new Date(dlRaw).toISOString() : null;
  try {
    await saveNote({ id, text, category: cat, priority: prio, assigned_to: assigned, material_id, deadline });
    notes.list = notes.list.map(n => n.id === id ? { ...n, text, category: cat, priority: prio, assigned_to: assigned, material_id, deadline } : n);
    closeModal();
    toast("✓ Sparad");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}
