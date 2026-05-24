// ============================================================
// actions/notes.ts — Anteckningar + papperskorg + kommentarer
// Beror på: services/notes.ts (loadNotes, saveNote, delNotePerm, ...),
//   services/images.ts (uploadImg), ui.ts (toast, openModal, confirmModal,
//   updMeta, classifyCat, classifyPrio, esc, escAttr), render.ts (render)
//
// Fas 4.10: @ts-nocheck borttaget. DOM-lookups typas explicit.
// Fas 4.5/4.6: hot paths använder patchNoteCard + optimistic().
// ============================================================

// Fas 5.8: spara/återställ senast använda värden i note-formuläret.
// Per användare i localStorage. Deadline hoppas över (datum-specifikt).
function noteDefaultsKey(): string {
  return `lager-note-defaults-${auth.user || "default"}`;
}

function saveNoteFormDefaults(): void {
  const cat      = (document.getElementById("note-cat") as HTMLSelectElement | null)?.value;
  const prio     = (document.getElementById("note-prio") as HTMLSelectElement | null)?.value;
  const assigned = (document.getElementById("note-assign") as HTMLSelectElement | null)?.value;
  const matId    = (document.getElementById("note-material") as HTMLSelectElement | null)?.value;
  try {
    localStorage.setItem(noteDefaultsKey(), JSON.stringify({ cat, prio, assigned, matId }));
  } catch (e) { /* storage full / disabled — strunta */ }
}

function applyNoteFormDefaults(): void {
  let saved: { cat?: string; prio?: string; assigned?: string; matId?: string } | null = null;
  try { saved = JSON.parse(localStorage.getItem(noteDefaultsKey()) || "null"); }
  catch (e) { return; }
  if (!saved) return;

  const setIfOption = (id: string, val: string | undefined): void => {
    if (!val) return;
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (!el) return;
    if ([...el.options].some(o => o.value === val)) el.value = val;
  };
  setIfOption("note-cat", saved.cat);
  setIfOption("note-prio", saved.prio);
  setIfOption("note-assign", saved.assigned);
  setIfOption("note-material", saved.matId);
}

// ============================================================
// Fas 5.7: Mall-anteckningar — sparas per användare i localStorage.
// ============================================================
interface NoteTemplate {
  name: string;
  text: string;
  cat?: string;
  prio?: string;
  assigned?: string;
  matId?: string;
}

function noteTemplatesKey(): string {
  return `lager-note-templates-${auth.user || "default"}`;
}

function getNoteTemplates(): NoteTemplate[] {
  try {
    const raw = localStorage.getItem(noteTemplatesKey());
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function setNoteTemplates(list: NoteTemplate[]): void {
  try { localStorage.setItem(noteTemplatesKey(), JSON.stringify(list)); }
  catch (e) { /* storage full / disabled */ }
}

function renderNoteTemplatesUI(): void {
  const input = document.getElementById("note-input");
  if (!input || !input.parentElement) return;
  // Förhindra dubbel-injicering om bindEvents körs flera gånger
  document.getElementById("note-templates-row")?.remove();

  const tpls = getNoteTemplates();
  const row = document.createElement("div");
  row.id = "note-templates-row";
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;align-items:center";

  const lbl = document.createElement("span");
  lbl.style.cssText = "font-size:10px;color:var(--muted);font-family:var(--display);font-weight:700";
  lbl.textContent = tpls.length ? "📋 MALLAR:" : "📋 MALLAR (inga ännu)";
  row.appendChild(lbl);

  for (const t of tpls) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.style.cssText = "font-size:11px;padding:3px 10px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer";
    chip.textContent = t.name;
    chip.title = "Klicka för att fylla i — högerklick för att radera";
    chip.onclick = () => applyNoteTemplate(t.name);
    chip.oncontextmenu = (e) => { e.preventDefault(); void deleteNoteTemplate(t.name); };
    row.appendChild(chip);
  }

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.style.cssText = "font-size:11px;padding:3px 10px;border-radius:12px;border:1px dashed var(--border);background:transparent;color:var(--muted);cursor:pointer;margin-left:auto";
  saveBtn.textContent = "+ Spara som mall";
  saveBtn.onclick = () => void saveCurrentAsTemplate();
  row.appendChild(saveBtn);

  input.parentElement.insertBefore(row, input);
}

function applyNoteTemplate(name: string): void {
  const t = getNoteTemplates().find(x => x.name === name);
  if (!t) return;
  const input = document.getElementById("note-input") as HTMLTextAreaElement | HTMLInputElement | null;
  if (input) input.value = t.text;
  const setIfOption = (id: string, val: string | undefined): void => {
    if (!val) return;
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (!el) return;
    if ([...el.options].some(o => o.value === val)) el.value = val;
  };
  setIfOption("note-cat", t.cat);
  setIfOption("note-prio", t.prio);
  setIfOption("note-assign", t.assigned);
  setIfOption("note-material", t.matId);
  toast(`✓ Mall "${t.name}" tillämpad`);
}

async function saveCurrentAsTemplate(): Promise<void> {
  const input = document.getElementById("note-input") as HTMLTextAreaElement | HTMLInputElement | null;
  const text = input?.value?.trim();
  if (!text) { toast("Skriv text i anteckningen först", 1); return; }

  const suggestedName = text.substring(0, 30);
  const name = prompt("Namn på mallen?", suggestedName);
  if (!name || !name.trim()) return;

  const tpls = getNoteTemplates();
  const existing = tpls.findIndex(t => t.name === name.trim());
  const tpl: NoteTemplate = {
    name: name.trim(),
    text,
    cat: (document.getElementById("note-cat") as HTMLSelectElement | null)?.value,
    prio: (document.getElementById("note-prio") as HTMLSelectElement | null)?.value,
    assigned: (document.getElementById("note-assign") as HTMLSelectElement | null)?.value,
    matId: (document.getElementById("note-material") as HTMLSelectElement | null)?.value,
  };
  if (existing >= 0) tpls[existing] = tpl;
  else tpls.push(tpl);
  setNoteTemplates(tpls);
  renderNoteTemplatesUI();
  toast(`✓ Mall "${tpl.name}" sparad`);
}

async function deleteNoteTemplate(name: string): Promise<void> {
  if (!await confirmModal(`Radera mallen "${name}"?`, { confirmLabel: "Radera", danger: true })) return;
  setNoteTemplates(getNoteTemplates().filter(t => t.name !== name));
  renderNoteTemplatesUI();
  toast("🗑 Mall raderad");
}

// ============================================================
// Fas 5.5: Voice input för anteckningar via Web Speech API.
// Mic-knapp i textarea-hörnet — sv-SE, continuous mode.
// Tyst om SpeechRecognition saknas (alltid på iOS Safari pre-15).
// ============================================================
let voiceRecognition: any = null;
let voiceActive: boolean = false;

function attachVoiceInput(): void {
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return;

  // Stoppa ev. tidigare session om DOM:en byttes mellan renders.
  if (voiceRecognition && voiceActive) {
    try { voiceRecognition.stop(); } catch (e) { /* ignore */ }
    voiceActive = false;
    voiceRecognition = null;
  }

  const input = document.getElementById("note-input") as HTMLTextAreaElement | null;
  if (!input || !input.parentElement) return;
  if (document.getElementById("note-mic-btn")) return;

  // Wrap textarea i relativ container för att kunna ankra mic-knappen.
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative";
  input.parentElement.insertBefore(wrap, input);
  wrap.appendChild(input);

  const btn = document.createElement("button");
  btn.id = "note-mic-btn";
  btn.type = "button";
  btn.title = "Diktera anteckningen (sv-SE)";
  btn.textContent = "🎤";
  btn.style.cssText = "position:absolute;right:8px;bottom:8px;font-size:16px;width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:var(--surface);cursor:pointer;z-index:5;padding:0";
  btn.onclick = () => toggleVoiceInput(input, btn);
  wrap.appendChild(btn);
}

function toggleVoiceInput(input: HTMLTextAreaElement, btn: HTMLButtonElement): void {
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) { toast("Voice input stöds inte i denna webbläsare", 1); return; }

  if (voiceActive && voiceRecognition) {
    try { voiceRecognition.stop(); } catch (e) { /* ignore */ }
    return;
  }

  const rec = new SR();
  rec.lang = "sv-SE";
  rec.continuous = true;
  rec.interimResults = false;

  rec.onresult = (e: any) => {
    let chunk = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) chunk += e.results[i][0].transcript;
    }
    if (!chunk) return;
    const sep = (input.value && !input.value.endsWith(" ") && !input.value.endsWith("\n")) ? " " : "";
    input.value = (input.value || "") + sep + chunk;
    // trigga classifyCat/classifyPrio via befintlig input-listener
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  rec.onerror = (e: any) => {
    toast(`Mic-fel: ${e.error || "okänt"}`, 1);
  };

  rec.onend = () => {
    voiceActive = false;
    voiceRecognition = null;
    btn.style.background = "var(--surface)";
    btn.textContent = "🎤";
  };

  try {
    rec.start();
    voiceRecognition = rec;
    voiceActive = true;
    btn.style.background = "#E8521A";
    btn.textContent = "⏹";
    toast("🎤 Lyssnar — tala på svenska");
  } catch (e) {
    toast("Kunde inte starta voice input", 1);
  }
}

// ============================================================
// Fas 5.6: Foto-först-flöde
// Trigger: input[type=file capture=environment] från Hem-fliken.
// Flöde: upload → saveNote med default-värden → loadNotes → render
// → openEdit(newId) så användaren kan fylla i text/kategori utan
// extra navigation. Default-text "📸 Foto" så listan har något att visa
// om användaren stänger edit-modalen utan att fylla i.
// ============================================================
async function quickPhotoNote(inputEl: HTMLInputElement): Promise<void> {
  const file = inputEl.files?.[0];
  if (!file) return;
  // Nollställ input direkt så samma file kan väljas igen efter avbruten edit
  inputEl.value = "";

  toast("📸 Laddar upp foto...");
  try {
    const image_url = await uploadImg(file);
    const newNote = await saveNote({
      text: "📸 Foto",
      category: "övrigt",
      priority: "medel",
      status: "ny",
      created_by: auth.user || "",
      image_url,
    });
    if (!newNote || newNote.id == null) throw new Error("Saknar id i svar");
    await loadNotes();
    updMeta();
    render();
    toast("✓ Foto sparat — fyll i detaljer");
    // Öppna edit-modal så användaren kan ändra text/kategori/prio direkt
    openEdit(newNote.id);
  } catch (e) {
    toast("Kunde inte spara foto — kontrollera anslutning", 1);
  }
}

async function addNote(): Promise<void> {
  const inp  = document.getElementById("note-input") as HTMLTextAreaElement | HTMLInputElement | null;
  const text = inp?.value?.trim();
  if (!text) { toast("Skriv en anteckning först", 1); return; }

  const cat      = ((document.getElementById("note-cat") as HTMLSelectElement | null)?.value || classifyCat(text)) as Category;
  const prio     = ((document.getElementById("note-prio") as HTMLSelectElement | null)?.value || classifyPrio(text)) as Priority;
  const assigned = (document.getElementById("note-assign") as HTMLSelectElement | null)?.value || null;
  const matIdRaw = (document.getElementById("note-material") as HTMLSelectElement | null)?.value;
  const material_id = matIdRaw ? parseInt(matIdRaw) : null;
  const deadlineRaw = (document.getElementById("note-deadline") as HTMLInputElement | null)?.value;
  const deadline = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;

  const btn = document.getElementById("add-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  try {
    let image_url: string | null = null;
    if (ui.imgFile) { toast("Laddar upp bild..."); image_url = await uploadImg(ui.imgFile); }
    await saveNote({ text, category: cat, priority: prio, status: "ny", created_by: auth.user || "", image_url, assigned_to: assigned, material_id, deadline });
    await loadNotes();
    updMeta();
    saveNoteFormDefaults();   // Fas 5.8: minns valen till nästa anteckning
    ui.imgData = null;
    ui.imgFile = null;
    toast("✓ Anteckning sparad");
    render();
  } catch (e) {
    toast("Kunde inte spara — kontrollera anslutning", 1);
  }
  if (btn) btn.disabled = false;
}

async function toggleNote(id: number): Promise<void> {
  const prevOpen = notes.openId;
  notes.openId = prevOpen === id ? null : id;
  if (notes.openId && !notes.comments[id]) {
    await loadComments(id);
  }
  // Fas 4.5: patcha bara de två berörda korten (gamla öppnade + nya)
  // istället för full render(). Vid första-toggle är prevOpen null.
  if (prevOpen != null && prevOpen !== id) patchNoteCard(prevOpen);
  patchNoteCard(id);
}

// Fas 5.4: cykla genom statusar (ny → pågår → klar → ny) vid tap
// på status-badge i note-kortet. Använder befintlig setStatus med
// optimistic + patchNoteCard.
async function cycleNoteStatus(id: number): Promise<void> {
  const note = notes.list.find(n => n.id === id);
  if (!note) return;
  const order: NoteStatus[] = ["ny", "pågår", "klar"];
  const idx = order.indexOf(note.status);
  const next = order[(idx + 1) % order.length];
  await setStatus(id, next);
}

async function setStatus(id: number, status: NoteStatus): Promise<void> {
  // Fas 4.6: optimistisk update — DOM patchas direkt, API i bakgrunden.
  // Rollback via optimistic() vid fel.
  try {
    await optimistic({
      apply: () => {
        const prev = notes.list;
        notes.list = notes.list.map(n => n.id === id ? { ...n, status } : n);
        patchNoteCard(id);   // ögonblicklig visuell feedback
        return prev;
      },
      rollback: (prev) => {
        notes.list = prev;
        patchNoteCard(id);
      },
      api: () => saveNote({ id, status }),
      storeKey: "notes",     // patchHeaderMeta-subscriber triggas
      errorToast: "Kunde inte uppdatera — ångrat",
    });
    toast(status === "klar" ? "✓ Markerad som klar" : "✓ Uppdaterad");
  } catch (e) { /* toast redan visad av optimistic() */ }
}

async function submitComment(noteId: number): Promise<void> {
  const inp  = document.getElementById("comment-input-" + noteId) as HTMLInputElement | null;
  const text = inp?.value?.trim();
  if (!text) return;
  try {
    await addComment(noteId, text);
    await loadComments(noteId);
    patchNoteCard(noteId);
    toast("✓ Kommentar sparad");
  } catch (e) {
    toast("Kunde inte spara kommentar", 1);
  }
}

async function delNoteCommentAction(noteId: number, commentId: number): Promise<void> {
  await delCommentFlow(commentId, {
    del: delComment,
    reload: () => loadComments(noteId)
  });
}

function editNoteCommentAction(noteId: number, commentId: number, currentText: string): void {
  openEditCommentModal({
    currentText,
    textareaId: "edit-note-cmt",
    onSaveFn: "saveNoteCommentEdit",
    saveArgs: [noteId, commentId]
  });
}

async function saveNoteCommentEdit(noteId: number, commentId: number): Promise<void> {
  await editCommentFlow(commentId, {
    textareaId: "edit-note-cmt",
    edit: editComment,
    reload: () => loadComments(noteId)
  });
}

async function doDelete(id: number): Promise<void> {
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

async function restoreNote(id: number): Promise<void> {
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

async function permDelete(id: number): Promise<void> {
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

async function emptyTrash(): Promise<void> {
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
function openEdit(id: number): void {
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
    <select id="edit-cat">${Object.entries(CATS).filter(([k]) => k !== "intern" || INTERN_USERS.includes(auth.user || "")).map(([k, v]) =>
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

async function saveEdit(id: number): Promise<void> {
  const text = (document.getElementById("edit-text") as HTMLTextAreaElement | null)?.value?.trim();
  if (!text) { toast("Text får inte vara tom", 1); return; }
  const cat      = (document.getElementById("edit-cat") as HTMLSelectElement | null)?.value as Category;
  const prio     = (document.getElementById("edit-prio") as HTMLSelectElement | null)?.value as Priority;
  const assigned = (document.getElementById("edit-assign") as HTMLSelectElement | null)?.value || null;
  const matRaw   = (document.getElementById("edit-mat") as HTMLSelectElement | null)?.value;
  const material_id = matRaw ? parseInt(matRaw) : null;
  const dlRaw    = (document.getElementById("edit-deadline") as HTMLInputElement | null)?.value;
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
