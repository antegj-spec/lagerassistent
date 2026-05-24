// ============================================================
// services/tasks.ts — Arbetsuppgifter + status-log + kommentarer + checklista
// Beror på: store.ts, supabase.ts (sb)
// ============================================================

async function loadTasks(): Promise<void> {
  try {
    const all = await sb<Task[]>("/rest/v1/tasks?order=created_at.desc") || [];
    const active = all.filter(t => !t.deleted_at);
    tasks.list = active.filter(t => !t.archived);
    if (auth.isAdmin) {
      tasks.archived = active.filter(t => t.archived);
    }
  } catch (e) {
    console.error("loadTasks failed:", e);
  }
}

async function saveTask(t: Partial<Task> & { id?: number; created_at?: string }): Promise<number | undefined> {
  const { id, created_at, ...b } = t;
  if (id) {
    await sb("/rest/v1/tasks?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const r = await sb<{ id: number }[]>("/rest/v1/tasks", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0]?.id;
  }
}

async function delTaskPerm(id: number): Promise<void> {
  await sb("/rest/v1/tasks?id=eq." + id, { method: "DELETE" });
}

// ---- TASK STATUS LOG ----
async function logTaskStatus(entry: Partial<TaskStatusLog>): Promise<void> {
  await sb("/rest/v1/task_status_log", {
    method: "POST",
    body: JSON.stringify(entry),
    prefer: "return=minimal"
  });
}

async function loadTaskStatusLog(task_id: number): Promise<void> {
  try {
    const data = await sb<TaskStatusLog[]>("/rest/v1/task_status_log?task_id=eq." + task_id + "&order=created_at.desc&limit=30") || [];
    tasks.statusLogs[task_id] = data;
  } catch (e) {
    tasks.statusLogs[task_id] = [];
  }
}

// ---- KOMMENTARER PÅ UPPGIFTER ----
async function loadTaskComments(task_id: number): Promise<void> {
  try {
    const data = await sb<TaskComment[]>("/rest/v1/task_comments?task_id=eq." + task_id + "&order=created_at.asc") || [];
    tasks.comments[task_id] = data;
  } catch (e) {
    tasks.comments[task_id] = [];
  }
}

async function addTaskComment(task_id: number, text: string): Promise<void> {
  await sb("/rest/v1/task_comments", {
    method: "POST",
    body: JSON.stringify({ task_id, text, created_by: auth.user, created_at: new Date().toISOString() }),
    prefer: "return=minimal"
  });
}

async function delTaskComment(id: number): Promise<void> {
  await sb("/rest/v1/task_comments?id=eq." + id, { method: "DELETE" });
}

async function editTaskComment(id: number, text: string): Promise<void> {
  await sb("/rest/v1/task_comments?id=eq." + id, {
    method: "PATCH",
    body: JSON.stringify({ text, updated_at: new Date().toISOString() }),
    prefer: "return=minimal"
  });
}

// ---- CHECKLISTA (task_checklist) ----
async function loadTaskChecklist(task_id: number): Promise<void> {
  try {
    const data = await sb<TaskChecklistItem[]>("/rest/v1/task_checklist?task_id=eq." + task_id + "&order=created_at.asc") || [];
    tasks.checklists[task_id] = data;
  } catch (e) {
    tasks.checklists[task_id] = [];
  }
}

async function addChecklistItem(task_id: number, text: string): Promise<number | undefined> {
  const r = await sb<{ id: number }[]>("/rest/v1/task_checklist", {
    method: "POST",
    body: JSON.stringify({ task_id, text, done: false, created_by: auth.user }),
    headers: { "Prefer": "return=representation" }
  });
  return r?.[0]?.id;
}

async function toggleChecklistItem(id: number, done: boolean): Promise<void> {
  await sb("/rest/v1/task_checklist?id=eq." + id, {
    method: "PATCH",
    body: JSON.stringify({ done }),
    prefer: "return=minimal"
  });
}

async function delChecklistItem(id: number): Promise<void> {
  await sb("/rest/v1/task_checklist?id=eq." + id, { method: "DELETE" });
}
