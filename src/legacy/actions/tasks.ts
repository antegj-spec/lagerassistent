// @ts-nocheck
// ============================================================
// actions/tasks.ts — Arbetsuppgifter + statusövergångar +
//   kommentarer + checklista
// Beror på: services/tasks.ts, ui.ts (toast, openModal, confirmModal,
//   updMeta, esc, escAttr), render.ts (render)
// ============================================================

async function openTaskDetail(id) {
  tasks.openId = id;
  const loads = [];
  if (!tasks.statusLogs[id]) loads.push(loadTaskStatusLog(id));
  if (!tasks.comments[id]) loads.push(loadTaskComments(id));
  if (!tasks.checklists[id]) loads.push(loadTaskChecklist(id));
  if (loads.length) await Promise.all(loads);
  render();
}

function closeTaskDetail() {
  tasks.openId = null;
  render();
}

async function submitTaskComment(taskId) {
  const inp = document.getElementById("task-comment-input-" + taskId);
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

async function delTaskCommentAction(taskId, commentId) {
  await delCommentFlow(commentId, {
    del: delTaskComment,
    reload: () => loadTaskComments(taskId)
  });
}

function editTaskCommentAction(taskId, commentId, currentText) {
  openEditCommentModal({
    currentText,
    modalTitle: "Redigera uppdatering",
    textareaId: "edit-task-cmt",
    onSaveFn: "saveTaskCommentEdit",
    saveArgs: [taskId, commentId]
  });
}

async function saveTaskCommentEdit(taskId, commentId) {
  await editCommentFlow(commentId, {
    textareaId: "edit-task-cmt",
    edit: editTaskComment,
    reload: () => loadTaskComments(taskId)
  });
}

// ---- CHECKLISTA ----
async function toggleChecklist(taskId, itemId, done) {
  try {
    await toggleChecklistItem(itemId, done);
    await loadTaskChecklist(taskId);
    render();
  } catch (e) {
    toast("Kunde inte uppdatera", 1);
  }
}

async function addChecklistAction(taskId) {
  const inp = document.getElementById("checklist-new-" + taskId);
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

async function delChecklistAction(taskId, itemId) {
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

async function addTask() {
  const title = document.getElementById("task-title")?.value?.trim();
  if (!title) { toast("Ange en titel", 1); return; }
  const description = document.getElementById("task-desc")?.value?.trim() || null;
  const priority = document.getElementById("task-prio")?.value || "medel";
  const start_date = document.getElementById("task-start")?.value || null;
  const dlRaw = document.getElementById("task-deadline")?.value;
  const deadline = dlRaw ? new Date(dlRaw).toISOString() : null;
  const responsible = document.getElementById("task-resp")?.value || null;
  const assigned_to = Array.from(document.querySelectorAll(".task-assign-check:checked")).map(c => c.value);
  // Lägg till huvudansvarig i assigned_to om ej redan med
  if (responsible && !assigned_to.includes(responsible)) assigned_to.push(responsible);
  const extra_staff = parseInt(document.getElementById("task-extra")?.value) || 0;

  try {
    const newId = await saveTask({
      title, description, priority, status: "ny",
      start_date, deadline, responsible, assigned_to, extra_staff,
      created_by: auth.user
    });
    await logTaskStatus({
      task_id: newId,
      old_status: null,
      new_status: "ny",
      changed_by: auth.user
    });
    await loadTasks();
    updMeta();
    closeModal();
    toast("✓ Uppgift skapad");
    render();
  } catch (e) {
    toast("Kunde inte spara: " + e.message, 1);
  }
}

function openEditTask(id) {
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

async function saveEditTask(id) {
  const title = document.getElementById("task-edit-title")?.value?.trim();
  if (!title) { toast("Ange en titel", 1); return; }
  const description = document.getElementById("task-edit-desc")?.value?.trim() || null;
  const priority = document.getElementById("task-edit-prio")?.value || "medel";
  const start_date = document.getElementById("task-edit-start")?.value || null;
  const dlRaw = document.getElementById("task-edit-deadline")?.value;
  const deadline = dlRaw ? new Date(dlRaw).toISOString() : null;
  const responsible = document.getElementById("task-edit-resp")?.value || null;
  const assigned_to = Array.from(document.querySelectorAll(".task-assign-check-edit:checked")).map(c => c.value);
  if (responsible && !assigned_to.includes(responsible)) assigned_to.push(responsible);
  const extra_staff = parseInt(document.getElementById("task-edit-extra")?.value) || 0;

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

async function setTaskStatus(id, status) {
  const t = [...tasks.list, ...tasks.archived].find(t => t.id === id);
  if (!t) return;
  if (t.status === status) return;
  try {
    await saveTask({ id, status });
    await logTaskStatus({
      task_id: id,
      old_status: t.status,
      new_status: status,
      changed_by: auth.user
    });
    await loadTasks();
    await loadTaskStatusLog(id);
    updMeta();
    toast(status === "klar" ? "✓ Markerad som klar" : "✓ Status uppdaterad");
    render();
  } catch (e) {
    toast("Kunde inte uppdatera", 1);
  }
}

async function archiveTask(id, archive) {
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

async function doDelTask(id) {
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
