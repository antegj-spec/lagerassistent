// ============================================================
// actions/tasks.ts — Arbetsuppgifter + statusövergångar +
//   kommentarer + checklista
// Beror på: services/tasks.ts, ui.ts (toast, openModal, confirmModal,
//   updMeta, esc, escAttr), render.ts (render)
//
// Fas 4.10: @ts-nocheck borttaget. DOM-lookups typas explicit.
// Fas 4.5/4.6: setTaskStatus använder patchTaskRow + optimistic().
// ============================================================

async function openTaskDetail(id: number): Promise<void> {
  tasks.openId = id;
  const loads: Promise<void>[] = [];
  if (!tasks.statusLogs[id]) loads.push(loadTaskStatusLog(id));
  if (!tasks.comments[id]) loads.push(loadTaskComments(id));
  if (!tasks.checklists[id]) loads.push(loadTaskChecklist(id));
  if (loads.length) await Promise.all(loads);
  render();
}

function closeTaskDetail(): void {
  tasks.openId = null;
  render();
}

async function submitTaskComment(taskId: number): Promise<void> {
  const inp = document.getElementById("task-comment-input-" + taskId) as HTMLTextAreaElement | null;
  const text = inp?.value?.trim();
  if (!text) return;
  try {
    await addTaskComment(taskId, text);
    await loadTaskComments(taskId);
    render();
    toast("✓ Uppdatering sparad");
  } catch (e) {
    toast("Kunde inte spara uppdatering", 1);
  }
}

async function delTaskCommentAction(taskId: number, commentId: number): Promise<void> {
  await delCommentFlow(commentId, {
    del: delTaskComment,
    reload: () => loadTaskComments(taskId)
  });
}

function editTaskCommentAction(taskId: number, commentId: number, currentText: string): void {
  openEditCommentModal({
    currentText,
    modalTitle: "Redigera uppdatering",
    textareaId: "edit-task-cmt",
    onSaveFn: "saveTaskCommentEdit",
    saveArgs: [taskId, commentId]
  });
}

async function saveTaskCommentEdit(taskId: number, commentId: number): Promise<void> {
  await editCommentFlow(commentId, {
    textareaId: "edit-task-cmt",
    edit: editTaskComment,
    reload: () => loadTaskComments(taskId)
  });
}

// ---- CHECKLISTA ----
async function toggleChecklist(taskId: number, itemId: number, done: boolean): Promise<void> {
  try {
    await toggleChecklistItem(itemId, done);
    await loadTaskChecklist(taskId);
    render();
  } catch (e) {
    toast("Kunde inte uppdatera", 1);
  }
}

async function addChecklistAction(taskId: number): Promise<void> {
  const inp = document.getElementById("checklist-new-" + taskId) as HTMLInputElement | null;
  const text = inp?.value?.trim();
  if (!text) return;
  try {
    await addChecklistItem(taskId, text);
    await loadTaskChecklist(taskId);
    render();
  } catch (e) {
    toast("Kunde inte lägga till", 1);
  }
}

async function delChecklistAction(taskId: number, itemId: number): Promise<void> {
  try {
    await delChecklistItem(itemId);
    await loadTaskChecklist(taskId);
    render();
    toast("🗑 Borttagen");
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}

function openAddTask() {
  const today = new Date().toISOString().split("T")[0];
  const userOpts = USERS.filter(u => u !== "Admin");
  const userCheckboxes = userOpts.map(u =>
    `<label style="display:flex;align-items:center;gap:6px;padding:6px 0;font-size:13px">
      <input type="checkbox" class="task-assign-check" value="${esc(u)}" style="width:18px;height:18px;margin:0">
      ${esc(u)}
    </label>`
  ).join("");
  const respOpts = userOpts.map(u =>
    `<option value="${esc(u)}">${esc(u)}</option>`
  ).join("");

  openModal(`
    <div class="modal-title">Ny uppgift</div>
    <label class="field-label">TITEL</label>
    <input type="text" id="task-title" placeholder="T.ex. 'Servicekörning Festivalen 2026'">
    <label class="field-label">BESKRIVNING</label>
    <textarea id="task-desc" rows="3" placeholder="Vad ska göras?"></textarea>
    <label class="field-label">PRIORITET</label>
    <select id="task-prio">${Object.entries(PRIOS).map(([k, v]) =>
      `<option value="${k}" ${k === "medel" ? "selected" : ""}>${v.label}</option>`
    ).join("")}</select>
    <label class="field-label">STARTDATUM</label>
    <input type="date" id="task-start" value="${today}">
    <label class="field-label">DEADLINE</label>
    <input type="datetime-local" id="task-deadline">
    <label class="field-label">HUVUDANSVARIG</label>
    <select id="task-resp">
      <option value="">— Ingen —</option>
      ${respOpts}
    </select>
    <label class="field-label">TILLDELA TILL (flera möjligt)</label>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 12px">
      ${userCheckboxes}
    </div>
    <label class="field-label">EXTRA INHYRD PERSONAL (antal)</label>
    <input type="number" id="task-extra" min="0" value="0">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="addTask()" style="flex:1">SPARA</button>
    </div>
  `);
}

async function addTask(): Promise<void> {
  const title = (document.getElementById("task-title") as HTMLInputElement | null)?.value?.trim();
  if (!title) { toast("Ange en titel", 1); return; }
  const description = (document.getElementById("task-desc") as HTMLTextAreaElement | null)?.value?.trim() || null;
  const priority = ((document.getElementById("task-prio") as HTMLSelectElement | null)?.value || "medel") as Priority;
  const start_date = (document.getElementById("task-start") as HTMLInputElement | null)?.value || null;
  const dlRaw = (document.getElementById("task-deadline") as HTMLInputElement | null)?.value;
  const deadline = dlRaw ? new Date(dlRaw).toISOString() : null;
  const responsible = (document.getElementById("task-resp") as HTMLSelectElement | null)?.value || null;
  const assigned_to = Array.from(document.querySelectorAll<HTMLInputElement>(".task-assign-check:checked")).map(c => c.value);
  // Lägg till huvudansvarig i assigned_to om ej redan med
  if (responsible && !assigned_to.includes(responsible)) assigned_to.push(responsible);
  const extra_staff = parseInt((document.getElementById("task-extra") as HTMLInputElement | null)?.value || "0") || 0;

  try {
    const newId = await saveTask({
      title, description, priority, status: "ny",
      start_date, deadline, responsible, assigned_to, extra_staff,
      created_by: auth.user || ""
    });
    if (newId == null) throw new Error("Kunde inte skapa uppgift");
    await logTaskStatus({
      task_id: newId,
      old_status: null,
      new_status: "ny",
      changed_by: auth.user || ""
    });
    await loadTasks();
    updMeta();
    closeModal();
    toast("✓ Uppgift skapad");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + (e as Error).message, 1);
  }
}

function openEditTask(id: number): void {
  const t = [...tasks.list, ...tasks.archived].find(t => t.id === id);
  if (!t) return;
  const userOpts = USERS.filter(u => u !== "Admin");
  const assignedSet = new Set(t.assigned_to || []);
  const userCheckboxes = userOpts.map(u =>
    `<label style="display:flex;align-items:center;gap:6px;padding:6px 0;font-size:13px">
      <input type="checkbox" class="task-assign-check-edit" value="${esc(u)}" style="width:18px;height:18px;margin:0" ${assignedSet.has(u) ? "checked" : ""}>
      ${esc(u)}
    </label>`
  ).join("");
  const respOpts = userOpts.map(u =>
    `<option value="${esc(u)}" ${t.responsible === u ? "selected" : ""}>${esc(u)}</option>`
  ).join("");
  const dlVal = t.deadline ? new Date(t.deadline).toISOString().slice(0, 16) : "";

  openModal(`
    <div class="modal-title">Redigera uppgift</div>
    <label class="field-label">TITEL</label>
    <input type="text" id="task-edit-title" value="${escAttr(t.title)}">
    <label class="field-label">BESKRIVNING</label>
    <textarea id="task-edit-desc" rows="3">${esc(t.description || "")}</textarea>
    <label class="field-label">PRIORITET</label>
    <select id="task-edit-prio">${Object.entries(PRIOS).map(([k, v]) =>
      `<option value="${k}" ${t.priority === k ? "selected" : ""}>${v.label}</option>`
    ).join("")}</select>
    <label class="field-label">STARTDATUM</label>
    <input type="date" id="task-edit-start" value="${escAttr(t.start_date || "")}">
    <label class="field-label">DEADLINE</label>
    <input type="datetime-local" id="task-edit-deadline" value="${escAttr(dlVal)}">
    <label class="field-label">HUVUDANSVARIG</label>
    <select id="task-edit-resp">
      <option value="">— Ingen —</option>
      ${respOpts}
    </select>
    <label class="field-label">TILLDELA TILL</label>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 12px">
      ${userCheckboxes}
    </div>
    <label class="field-label">EXTRA INHYRD PERSONAL</label>
    <input type="number" id="task-edit-extra" min="0" value="${t.extra_staff || 0}">
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="saveEditTask(${id})" style="flex:1">SPARA</button>
    </div>
  `);
}

async function saveEditTask(id: number): Promise<void> {
  const title = (document.getElementById("task-edit-title") as HTMLInputElement | null)?.value?.trim();
  if (!title) { toast("Ange en titel", 1); return; }
  const description = (document.getElementById("task-edit-desc") as HTMLTextAreaElement | null)?.value?.trim() || null;
  const priority = ((document.getElementById("task-edit-prio") as HTMLSelectElement | null)?.value || "medel") as Priority;
  const start_date = (document.getElementById("task-edit-start") as HTMLInputElement | null)?.value || null;
  const dlRaw = (document.getElementById("task-edit-deadline") as HTMLInputElement | null)?.value;
  const deadline = dlRaw ? new Date(dlRaw).toISOString() : null;
  const responsible = (document.getElementById("task-edit-resp") as HTMLSelectElement | null)?.value || null;
  const assigned_to = Array.from(document.querySelectorAll<HTMLInputElement>(".task-assign-check-edit:checked")).map(c => c.value);
  if (responsible && !assigned_to.includes(responsible)) assigned_to.push(responsible);
  const extra_staff = parseInt((document.getElementById("task-edit-extra") as HTMLInputElement | null)?.value || "0") || 0;

  try {
    await saveTask({
      id, title, description, priority,
      start_date, deadline, responsible, assigned_to, extra_staff
    });
    await loadTasks();
    closeModal();
    toast("✓ Sparat");
    render();
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}

// Fas 5.4: cykla genom statusar (ny → pågår → klar → ny) vid tap
// på status-badge i task-raden. Använder befintlig setTaskStatus
// med optimistic + patchTaskRow.
async function cycleTaskStatus(id: number): Promise<void> {
  const task = tasks.list.find(t => t.id === id) || tasks.archived.find(t => t.id === id);
  if (!task) return;
  const order: TaskStatus[] = ["ny", "pågår", "klar"];
  const idx = order.indexOf(task.status);
  const next = order[(idx + 1) % order.length];
  await setTaskStatus(id, next);
}

async function setTaskStatus(id: number, status: TaskStatus): Promise<void> {
  const t = [...tasks.list, ...tasks.archived].find(t => t.id === id);
  if (!t) return;
  if (t.status === status) return;
  // Fas 4.6: optimistisk update för status-byte i list-vy.
  // Status-log laddas EFTER server-bekräftelse (kan inte gissas lokalt).
  // I detail-vy: behåll full render efter loadTaskStatusLog så loggens
  // nya rad syns.
  const oldStatus = t.status;
  try {
    await optimistic({
      apply: () => {
        const prev = tasks.list;
        tasks.list = tasks.list.map(x => x.id === id ? { ...x, status } : x);
        if (tasks.openId !== id) patchTaskRow(id);
        return prev;
      },
      rollback: (prev) => {
        tasks.list = prev;
        if (tasks.openId !== id) patchTaskRow(id);
      },
      api: async () => {
        await saveTask({ id, status });
        await logTaskStatus({
          task_id: id,
          old_status: oldStatus,
          new_status: status,
          changed_by: auth.user || ""
        });
        await loadTasks();
        await loadTaskStatusLog(id);
      },
      storeKey: "tasks",
      errorToast: "Kunde inte uppdatera — ångrat",
    });
    toast(status === "klar" ? "✓ Markerad som klar" : "✓ Status uppdaterad");
    // Detail-vyn behöver full render efter att loggen laddats.
    if (tasks.openId === id) render();
  } catch (e) { /* toast redan visad */ }
}

async function archiveTask(id: number, archive: boolean): Promise<void> {
  try {
    await saveTask({ id, archived: archive });
    await loadTasks();
    tasks.openId = null;
    toast(archive ? "📁 Arkiverad" : "↩ Aktiverad");
    render();
  } catch (e) {
    toast("Kunde inte ändra", 1);
  }
}

async function doDelTask(id: number): Promise<void> {
  if (!await confirmModal("Radera uppgiften permanent? Kan inte ångras.", { confirmLabel: "Radera", danger: true })) return;
  try {
    await delTaskPerm(id);
    await loadTasks();
    tasks.openId = null;
    updMeta();
    toast("🗑 Raderad");
    render();
  } catch (e) {
    toast("Kunde inte radera", 1);
  }
}
