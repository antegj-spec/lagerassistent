// ============================================================
// supabase.ts — All kommunikation med Supabase och Storage
// Beror på: config.ts
// ============================================================

// ---- GRUNDLÄGGANDE FETCH-WRAPPER ----
interface SbOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: string;
  headers?: Record<string, string>;
  prefer?: string;
}

// Fas 1: skickar JWT från sessionStorage istället för anon-key (SB_KEY används bara
// som apikey-header för att passera Supabase Gateway). Vid 401 auto-logout.
function getAuthToken(): string {
  return sessionStorage.getItem("lager-token") || SB_KEY;
}

// Fas 3.4 (B9): Paginerad GET via PostgREST Range-headers.
// PostgREST default-limit är 1000 rader per request. För kollektioner
// som kan växa förbi det (material_items, material_history, ...) måste
// vi iterera. Stannar när sidan är mindre än pageSize ELLER när
// Content-Range visar att vi har alla rader. 416 = Range past end =
// inga fler rader (tyst exit).
async function sbPaged<T = unknown>(path: string, pageSize = 1000): Promise<T[]> {
  const token = getAuthToken();
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const end = offset + pageSize - 1;
    const r = await fetch(SB_URL + path, {
      headers: {
        "apikey": SB_KEY,
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "Range-Unit": "items",
        "Range": offset + "-" + end
      }
    });
    if (r.status === 401 && token !== SB_KEY && typeof logout === "function") {
      console.warn("Got 401 — session expired, logging out");
      logout();
      throw new Error("Session expired");
    }
    if (r.status === 416) return all; // past end — done
    if (!r.ok) throw new Error(await r.text());

    const text = await r.text();
    const page = (text ? JSON.parse(text) : []) as T[];
    all.push(...page);
    if (page.length < pageSize) return all;

    // Belt-and-suspenders: Content-Range tells us total
    const cr = r.headers.get("Content-Range"); // "0-999/15234" eller "0-999/*"
    if (cr) {
      const m = cr.match(/\/(\d+)$/);
      if (m && offset + page.length >= parseInt(m[1], 10)) return all;
    }
    offset += pageSize;
  }
}

async function sb<T = unknown>(path: string, opts: SbOptions = {}): Promise<T | null> {
  const token = getAuthToken();
  const r = await fetch(SB_URL + path, {
    ...opts,
    headers: {
      "apikey": SB_KEY,                       // alltid anon-key — krävs av Supabase Gateway
      "Authorization": "Bearer " + token,    // JWT om inloggad, annars anon-key
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "",
      ...(opts.headers || {})
    }
  });
  // Auto-logout vid 401 (utom på själva login-flödet)
  if (r.status === 401 && token !== SB_KEY && typeof logout === "function") {
    console.warn("Got 401 — session expired, logging out");
    logout();
    throw new Error("Session expired");
  }
  if (!r.ok && r.status !== 204) {
    const e = await r.text();
    throw new Error(e);
  }
  if (r.status === 204) return null;
  const text = await r.text();
  return text ? JSON.parse(text) as T : null;
}

// ============================================================
// ANTECKNINGAR
// ============================================================
async function loadNotes(): Promise<void> {
  try {
    // RLS filtrerar intern-noter server-side (löser B7).
    // Klienten filtrerar fortfarande deleted_at för aktiv-vy vs papperskorg.
    const all = await sb<Note[]>("/rest/v1/notes?order=created_at.desc") || [];
    notes.list = all.filter(n => !n.deleted_at);
    if (auth.isAdmin) {
      const cutoff = new Date(Date.now() - TRASH_DAYS * 86400000).toISOString();
      notes.trashed = all.filter(n => n.deleted_at && n.deleted_at > cutoff);
    }
  } catch (e) {
    toast("Kunde inte ladda anteckningar", 1);
  }
}

async function saveNote(n: Partial<Note> & { id?: number }): Promise<Note | undefined> {
  const { id, ...b } = n;
  if (id) {
    await sb("/rest/v1/notes?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return undefined;
  } else {
    const r = await sb<Note[]>("/rest/v1/notes", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0];
  }
}

async function delNotePerm(id: number): Promise<void> {
  await sb("/rest/v1/notes?id=eq." + id, { method: "DELETE" });
}

// Fas 3.3 (B8): Batch-radering — ett HTTP-anrop istället för N.
// Används av emptyTrash. Returnerar utan att göra något om listan är tom
// (PostgREST ?id=in.() returnerar 400 för tom lista).
async function delNotesPermBatch(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await sb("/rest/v1/notes?id=in.(" + ids.join(",") + ")", { method: "DELETE" });
}

// ============================================================
// MATERIAL — materials_v2 (ny struktur)
// ============================================================
async function loadMats(): Promise<void> {
  try {
    // Fas 3.4: paginerad fetch — undviker tyst trunkering vid >1000 rader.
    const all = await sbPaged<Material>("/rest/v1/materials_v2?order=name.asc");
    materials.list = all.filter(m => !m.deleted_at);

    // Ladda counts för alla lagerräknande material
    const counts = await sbPaged<MaterialCount>("/rest/v1/material_counts");
    materials.counts = {};
    counts.forEach(c => {
      if (!materials.counts[c.material_id]) materials.counts[c.material_id] = {};
      materials.counts[c.material_id][c.status] = c.count;
    });

    // Ladda items för alla artikelbaserade material
    const items = await sbPaged<MaterialItem>("/rest/v1/material_items?order=article_id.asc");
    materials.items = {};
    items.forEach(it => {
      if (!materials.items[it.material_id]) materials.items[it.material_id] = [];
      materials.items[it.material_id].push(it);
    });

    // Ladda inhyrt material (icke-raderat)
    const borrowed = await sb<BorrowedMaterial[]>("/rest/v1/borrowed_material?order=start_date.desc") || [];
    materials.borrowed = {};
    borrowed.filter(b => !b.deleted_at).forEach(b => {
      if (!materials.borrowed[b.material_id]) materials.borrowed[b.material_id] = [];
      materials.borrowed[b.material_id].push(b);
    });
  } catch (e) {
    console.error("loadMats failed:", e);
  }
}

async function saveMat(m: Partial<Material> & { id?: number; created_at?: string }): Promise<number | undefined> {
  const { id, created_at, ...b } = m;
  if (id) {
    await sb("/rest/v1/materials_v2?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const r = await sb<{ id: number }[]>("/rest/v1/materials_v2", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0]?.id;
  }
}

async function delMatPerm(id: number): Promise<void> {
  await sb("/rest/v1/materials_v2?id=eq." + id, { method: "DELETE" });
}

// ---- ARTIKLAR (material_items) ----
async function saveMatItem(item: Partial<MaterialItem> & { id?: number; created_at?: string }): Promise<number | undefined> {
  const { id, created_at, ...b } = item;
  if (id) {
    await sb("/rest/v1/material_items?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const r = await sb<{ id: number }[]>("/rest/v1/material_items", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0]?.id;
  }
}

async function delMatItem(id: number): Promise<void> {
  await sb("/rest/v1/material_items?id=eq." + id, { method: "DELETE" });
}

// ---- COUNTS (material_counts) ----
async function setMatCount(material_id: number, status: MaterialStatus, count: number): Promise<void> {
  // Försök PATCH först
  const existing = await sb<{ id: number }[]>("/rest/v1/material_counts?material_id=eq." + material_id + "&status=eq." + encodeURIComponent(status));
  if (existing && existing.length > 0) {
    await sb("/rest/v1/material_counts?id=eq." + existing[0].id, {
      method: "PATCH",
      body: JSON.stringify({ count, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
  } else {
    await sb("/rest/v1/material_counts", {
      method: "POST",
      body: JSON.stringify({ material_id, status, count }),
      prefer: "return=minimal"
    });
  }
}

// ---- HISTORIK ----
async function logMatHistory(entry: Partial<MaterialHistory>): Promise<void> {
  await sb("/rest/v1/material_history", {
    method: "POST",
    body: JSON.stringify(entry),
    prefer: "return=minimal"
  });
}

// ---- ATOMIC MOVE (Fas 3.1) ----
// Anropar Postgres-funktionen move_count() via PostgREST RPC.
// Servern validerar JWT, låser raden, uppdaterar counts och loggar history
// i en transaktion. Ersätter setMatCount+setMatCount+logMatHistory-mönstret.
async function moveCount(
  material_id: number,
  from_status: MaterialStatus,
  to_status: MaterialStatus,
  qty: number,
  comment: string | null = null
): Promise<void> {
  try {
    await sb("/rest/v1/rpc/move_count", {
      method: "POST",
      body: JSON.stringify({
        p_material_id: material_id,
        p_from_status: from_status,
        p_to_status: to_status,
        p_qty: qty,
        p_comment: comment
      }),
      prefer: "return=minimal"
    });
  } catch (e: any) {
    // PostgREST returnerar { code, message, hint, details } som JSON.
    // Extrahera message så toast kan visa något läsbart.
    let msg = e?.message ?? String(e);
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.message) msg = parsed.message;
    } catch { /* var inte JSON — behåll originalet */ }
    throw new Error(msg);
  }
}

async function loadMatHistory(material_id: number): Promise<void> {
  try {
    const data = await sb<MaterialHistory[]>("/rest/v1/material_history?material_id=eq." + material_id + "&order=created_at.desc&limit=50") || [];
    materials.history[material_id] = data;
  } catch (e) {
    materials.history[material_id] = [];
  }
}

// ---- INHYRT MATERIAL ----
async function saveBorrowed(b: Partial<BorrowedMaterial> & { id?: number; created_at?: string }): Promise<number | undefined> {
  const { id, created_at, ...body } = b;
  if (id) {
    await sb("/rest/v1/borrowed_material?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const r = await sb<{ id: number }[]>("/rest/v1/borrowed_material", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0]?.id;
  }
}

async function delBorrowed(id: number): Promise<void> {
  await sb("/rest/v1/borrowed_material?id=eq." + id, {
    method: "PATCH",
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    prefer: "return=minimal"
  });
}

// ============================================================
// RETURER
// ============================================================
async function loadReturns(): Promise<void> {
  try {
    const all = await sb<Return[]>("/rest/v1/returns?order=return_date.desc") || [];
    const active = all.filter(r => !r.deleted_at);
    returns.list = active.filter(r => !r.archived);
    returns.archived = active.filter(r => r.archived);
  } catch (e) {
    console.error("loadReturns failed:", e);
  }
}

async function saveReturn(r: Partial<Return> & { id?: number; created_at?: string }): Promise<number | undefined> {
  const { id, created_at, ...b } = r;
  if (id) {
    await sb("/rest/v1/returns?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const res = await sb<{ id: number }[]>("/rest/v1/returns", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return res?.[0]?.id;
  }
}

async function delReturn(id: number): Promise<void> {
  await sb("/rest/v1/returns?id=eq." + id, {
    method: "PATCH",
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    prefer: "return=minimal"
  });
}

// ============================================================
// TASKS (Arbetsplanering)
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

// ============================================================
// PINS
// ============================================================
interface ChangePinResponse {
  ok?: boolean;
  error?: string;
  [k: string]: unknown;
}

async function changePinViaEdge(currentPin: string, newPin: string): Promise<ChangePinResponse> {
  const token = sessionStorage.getItem("lager-token");
  if (!token) throw new Error("Not logged in");
  const r = await fetch(SB_URL + "/functions/v1/change-pin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SB_KEY,
      "Authorization": "Bearer " + token,
    },
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
  });
  const data: ChangePinResponse = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Kunde inte byta PIN");
  return data;
}

async function savePin(userName: string, pin: string, isSet: boolean = true): Promise<void> {
  try {
    await sb("/rest/v1/user_pins?user_name=eq." + encodeURIComponent(userName), {
      method: "PATCH",
      body: JSON.stringify({ pin, pin_set: isSet, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
  } catch (e) {}
  try {
    await sb("/rest/v1/user_pins", {
      method: "POST",
      body: JSON.stringify({ user_name: userName, pin, pin_set: isSet }),
      prefer: "return=minimal,resolution=merge-duplicates"
    });
  } catch (e) {}
}

// ============================================================
// KOMMENTARER (på anteckningar)
// ============================================================
async function loadComments(noteId: number): Promise<void> {
  try {
    const data = await sb<NoteComment[]>("/rest/v1/comments?note_id=eq." + noteId + "&order=created_at.asc") || [];
    notes.comments[noteId] = data;
  } catch (e) {
    notes.comments[noteId] = [];
  }
}

async function addComment(noteId: number, text: string): Promise<void> {
  await sb("/rest/v1/comments", {
    method: "POST",
    body: JSON.stringify({
      note_id: noteId,
      text,
      created_by: auth.user,
      created_at: new Date().toISOString()
    }),
    prefer: "return=minimal"
  });
}

async function delComment(id: number): Promise<void> {
  await sb("/rest/v1/comments?id=eq." + id, { method: "DELETE" });
}

async function editComment(id: number, text: string): Promise<void> {
  await sb("/rest/v1/comments?id=eq." + id, {
    method: "PATCH",
    body: JSON.stringify({ text, updated_at: new Date().toISOString() }),
    prefer: "return=minimal"
  });
}

// ============================================================
// KOMMENTARER PÅ UPPGIFTER (task_comments)
// ============================================================
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

// ============================================================
// CHECKLISTA (task_checklist)
// ============================================================
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

// ============================================================
// KOMMENTARER PÅ MATERIAL/ARTIKLAR (material_comments)
// ============================================================
async function loadMatComments(material_id: number): Promise<void> {
  try {
    const data = await sb<MaterialComment[]>("/rest/v1/material_comments?material_id=eq." + material_id + "&order=created_at.asc") || [];
    materials.comments[material_id] = data;
  } catch (e) {
    materials.comments[material_id] = [];
  }
}

async function addMatComment(
  material_id: number,
  item_id: number | null,
  text: string,
  image_url: string | null,
  status: MaterialCommentStatus | null
): Promise<void> {
  const body: Record<string, unknown> = {
    material_id, text, created_by: auth.user,
    created_at: new Date().toISOString(),
    status: status || "klart"
  };
  if (item_id != null) body.item_id = item_id;
  if (image_url) body.image_url = image_url;
  await sb("/rest/v1/material_comments", {
    method: "POST",
    body: JSON.stringify(body),
    prefer: "return=minimal"
  });
}

async function setMatCommentStatus(commentId: number, status: MaterialCommentStatus): Promise<void> {
  await sb("/rest/v1/material_comments?id=eq." + commentId, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    prefer: "return=minimal"
  });
}

async function loadActionComments(): Promise<void> {
  try {
    const data = await sb<MaterialComment[]>("/rest/v1/material_comments?status=in.(åtgärd_krävs,åtgärd_behövs)&order=created_at.desc") || [];
    materials.actionComments = data;
  } catch (e) {
    materials.actionComments = [];
  }
}

async function delMatComment(id: number): Promise<void> {
  await sb("/rest/v1/material_comments?id=eq." + id, { method: "DELETE" });
}

async function editMatComment(id: number, text: string): Promise<void> {
  await sb("/rest/v1/material_comments?id=eq." + id, {
    method: "PATCH",
    body: JSON.stringify({ text, updated_at: new Date().toISOString() }),
    prefer: "return=minimal"
  });
}

// ---- ARTIKELBILDER (material_item_images) ----
async function loadMatItemImages(item_id: number): Promise<void> {
  try {
    const data = await sb<MaterialItemImage[]>("/rest/v1/material_item_images?item_id=eq." + item_id + "&order=created_at.asc") || [];
    materials.itemImages[item_id] = data;
  } catch (e) {
    materials.itemImages[item_id] = [];
  }
}

async function addMatItemImage(item_id: number, material_id: number, image_url: string): Promise<void> {
  await sb("/rest/v1/material_item_images", {
    method: "POST",
    body: JSON.stringify({ item_id, material_id, image_url, uploaded_by: auth.user }),
    prefer: "return=minimal"
  });
}

async function delMatItemImage(id: number): Promise<void> {
  await sb("/rest/v1/material_item_images?id=eq." + id, { method: "DELETE" });
}

// ---- MATERIALBILDER (material_images) ----
async function loadMatImages(material_id: number): Promise<void> {
  try {
    const data = await sb<MaterialImage[]>("/rest/v1/material_images?material_id=eq." + material_id + "&order=created_at.asc") || [];
    materials.images[material_id] = data;
  } catch (e) {
    materials.images[material_id] = [];
  }
}

async function addMatImage(material_id: number, image_url: string): Promise<void> {
  await sb("/rest/v1/material_images", {
    method: "POST",
    body: JSON.stringify({ material_id, image_url, uploaded_by: auth.user }),
    prefer: "return=minimal"
  });
}

async function delMatImage(id: number): Promise<void> {
  await sb("/rest/v1/material_images?id=eq." + id, { method: "DELETE" });
}

// ============================================================
// INFO-ARTIKLAR (FAQ/info-flik)
// ============================================================
async function loadInfoArticles(): Promise<void> {
  try {
    const all = await sb<InfoArticle[]>("/rest/v1/info_articles?order=is_pinned.desc,created_at.desc") || [];
    info.articles = all.filter(a => !a.deleted_at);
    // Ladda alla bilder och kommentarer i en svep
    const imgs = await sb<InfoImage[]>("/rest/v1/info_images?order=created_at.asc") || [];
    info.images = {};
    imgs.forEach(img => {
      if (!info.images[img.article_id]) info.images[img.article_id] = [];
      info.images[img.article_id].push(img);
    });
    const cmts = await sb<InfoComment[]>("/rest/v1/info_comments?order=created_at.asc") || [];
    info.comments = {};
    cmts.forEach(c => {
      if (!info.comments[c.article_id]) info.comments[c.article_id] = [];
      info.comments[c.article_id].push(c);
    });
  } catch (e) {
    console.error("loadInfoArticles failed:", e);
  }
}

async function saveInfoArticle(a: Partial<InfoArticle> & { id?: number; created_at?: string }): Promise<number | undefined> {
  const { id, created_at, ...b } = a;
  if (id) {
    await sb("/rest/v1/info_articles?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const r = await sb<{ id: number }[]>("/rest/v1/info_articles", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0]?.id;
  }
}

async function delInfoArticle(id: number): Promise<void> {
  await sb("/rest/v1/info_articles?id=eq." + id, {
    method: "PATCH",
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    prefer: "return=minimal"
  });
}

async function addInfoImage(article_id: number, image_url: string): Promise<void> {
  await sb("/rest/v1/info_images", {
    method: "POST",
    body: JSON.stringify({ article_id, image_url, uploaded_by: auth.user }),
    prefer: "return=minimal"
  });
}

async function delInfoImage(id: number): Promise<void> {
  await sb("/rest/v1/info_images?id=eq." + id, { method: "DELETE" });
}

async function addInfoComment(article_id: number, body: string, image_url?: string | null): Promise<void> {
  await sb("/rest/v1/info_comments", {
    method: "POST",
    body: JSON.stringify({ article_id, body, image_url: image_url || null, created_by: auth.user }),
    prefer: "return=minimal"
  });
}

async function delInfoComment(id: number): Promise<void> {
  await sb("/rest/v1/info_comments?id=eq." + id, { method: "DELETE" });
}

// ============================================================
// BILDHANTERING
// ============================================================
async function uploadImg(file: File): Promise<string> {
  const blob = await compressImg(file, 800, 0.72);
  const name = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9.]/g, "_");
  const r = await fetch(SB_URL + "/storage/v1/object/lager-images/" + name, {
    method: "POST",
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY,
      "Content-Type": blob.type
    },
    body: blob
  });
  if (!r.ok) throw new Error("Upload failed");
  return SB_URL + "/storage/v1/object/public/lager-images/" + name;
}

function compressImg(file: File, maxW: number, q: number): Promise<Blob> {
  // Fas 3.6 (B12): object URL + revoke. Sparar ~30% minne vs. base64 data-URL
  // och frigör resursen direkt — viktigt på iPhone Safari vid många foton.
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => res(b!), "image/jpeg", q);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      rej(e);
    };
    img.src = url;
  });
}
