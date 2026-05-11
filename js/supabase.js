// ============================================================
// supabase.js — All kommunikation med Supabase och Storage
// Beror på: config.js
// ============================================================

// ---- GRUNDLÄGGANDE FETCH-WRAPPER ----
async function sb(path, opts = {}) {
  const r = await fetch(SB_URL + path, {
    ...opts,
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "",
      ...(opts.headers || {})
    }
  });
  if (!r.ok && r.status !== 204) {
    const e = await r.text();
    throw new Error(e);
  }
  if (r.status === 204) return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// ============================================================
// ANTECKNINGAR
// ============================================================
async function loadNotes() {
  try {
    const all = await sb("/rest/v1/notes?order=created_at.desc") || [];
    notes = all.filter(n => !n.deleted_at);
    if (isAdmin) {
      const cutoff = new Date(Date.now() - TRASH_DAYS * 86400000).toISOString();
      trashedNotes = all.filter(n => n.deleted_at && n.deleted_at > cutoff);
    }
  } catch (e) {
    toast("Kunde inte ladda anteckningar", 1);
  }
}

async function saveNote(n) {
  const { id, ...b } = n;
  if (id) {
    await sb("/rest/v1/notes?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
  } else {
    const r = await sb("/rest/v1/notes", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0];
  }
}

async function delNotePerm(id) {
  await sb("/rest/v1/notes?id=eq." + id, { method: "DELETE" });
}

// ============================================================
// MATERIAL — materials_v2 (ny struktur)
// ============================================================
async function loadMats() {
  try {
    const all = await sb("/rest/v1/materials_v2?order=name.asc") || [];
    materials = all.filter(m => !m.deleted_at);

    // Ladda counts för alla lagerräknande material
    const counts = await sb("/rest/v1/material_counts") || [];
    materialCounts = {};
    counts.forEach(c => {
      if (!materialCounts[c.material_id]) materialCounts[c.material_id] = {};
      materialCounts[c.material_id][c.status] = c.count;
    });

    // Ladda items för alla artikelbaserade material
    const items = await sb("/rest/v1/material_items?order=article_id.asc") || [];
    materialItems = {};
    items.forEach(it => {
      if (!materialItems[it.material_id]) materialItems[it.material_id] = [];
      materialItems[it.material_id].push(it);
    });

    // Ladda inhyrt material (icke-raderat)
    const borrowed = await sb("/rest/v1/borrowed_material?order=start_date.desc") || [];
    borrowedMaterial = {};
    borrowed.filter(b => !b.deleted_at).forEach(b => {
      if (!borrowedMaterial[b.material_id]) borrowedMaterial[b.material_id] = [];
      borrowedMaterial[b.material_id].push(b);
    });
  } catch (e) {
    console.error("loadMats failed:", e);
  }
}

async function saveMat(m) {
  const { id, created_at, ...b } = m;
  if (id) {
    await sb("/rest/v1/materials_v2?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const r = await sb("/rest/v1/materials_v2", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0]?.id;
  }
}

async function delMatPerm(id) {
  await sb("/rest/v1/materials_v2?id=eq." + id, { method: "DELETE" });
}

// ---- ARTIKLAR (material_items) ----
async function saveMatItem(item) {
  const { id, created_at, ...b } = item;
  if (id) {
    await sb("/rest/v1/material_items?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const r = await sb("/rest/v1/material_items", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0]?.id;
  }
}

async function delMatItem(id) {
  await sb("/rest/v1/material_items?id=eq." + id, { method: "DELETE" });
}

// ---- COUNTS (material_counts) ----
async function setMatCount(material_id, status, count) {
  // Försök PATCH först
  const existing = await sb("/rest/v1/material_counts?material_id=eq." + material_id + "&status=eq." + encodeURIComponent(status));
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
async function logMatHistory(entry) {
  await sb("/rest/v1/material_history", {
    method: "POST",
    body: JSON.stringify(entry),
    prefer: "return=minimal"
  });
}

async function loadMatHistory(material_id) {
  try {
    const data = await sb("/rest/v1/material_history?material_id=eq." + material_id + "&order=created_at.desc&limit=50") || [];
    materialHistory[material_id] = data;
  } catch (e) {
    materialHistory[material_id] = [];
  }
}

// ---- INHYRT MATERIAL ----
async function saveBorrowed(b) {
  const { id, created_at, ...body } = b;
  if (id) {
    await sb("/rest/v1/borrowed_material?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const r = await sb("/rest/v1/borrowed_material", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0]?.id;
  }
}

async function delBorrowed(id) {
  await sb("/rest/v1/borrowed_material?id=eq." + id, {
    method: "PATCH",
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    prefer: "return=minimal"
  });
}

// ============================================================
// RETURER
// ============================================================
async function loadReturns() {
  try {
    const all = await sb("/rest/v1/returns?order=return_date.desc") || [];
    const active = all.filter(r => !r.deleted_at);
    returnsList = active.filter(r => !r.archived);
    archivedReturns = active.filter(r => r.archived);
  } catch (e) {
    console.error("loadReturns failed:", e);
  }
}

async function saveReturn(r) {
  const { id, created_at, ...b } = r;
  if (id) {
    await sb("/rest/v1/returns?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const res = await sb("/rest/v1/returns", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return res?.[0]?.id;
  }
}

async function delReturn(id) {
  await sb("/rest/v1/returns?id=eq." + id, {
    method: "PATCH",
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    prefer: "return=minimal"
  });
}

// ============================================================
// TASKS (Arbetsplanering)
// ============================================================
async function loadTasks() {
  try {
    const all = await sb("/rest/v1/tasks?order=created_at.desc") || [];
    const active = all.filter(t => !t.deleted_at);
    tasks = active.filter(t => !t.archived);
    if (isAdmin) {
      archivedTasks = active.filter(t => t.archived);
    }
  } catch (e) {
    console.error("loadTasks failed:", e);
  }
}

async function saveTask(t) {
  const { id, created_at, ...b } = t;
  if (id) {
    await sb("/rest/v1/tasks?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const r = await sb("/rest/v1/tasks", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return r?.[0]?.id;
  }
}

async function delTaskPerm(id) {
  await sb("/rest/v1/tasks?id=eq." + id, { method: "DELETE" });
}

// ---- TASK STATUS LOG ----
async function logTaskStatus(entry) {
  await sb("/rest/v1/task_status_log", {
    method: "POST",
    body: JSON.stringify(entry),
    prefer: "return=minimal"
  });
}

async function loadTaskStatusLog(task_id) {
  try {
    const data = await sb("/rest/v1/task_status_log?task_id=eq." + task_id + "&order=created_at.desc&limit=30") || [];
    taskStatusLogs[task_id] = data;
  } catch (e) {
    taskStatusLogs[task_id] = [];
  }
}

// ============================================================
// PINS
// ============================================================
async function loadPins() {
  try {
    const data = await sb("/rest/v1/user_pins") || [];
    userPins = {};
    pinSet = {};
    data.forEach(p => {
      userPins[p.user_name] = p.pin;
      pinSet[p.user_name] = p.pin_set || false;
    });
  } catch (e) {
    userPins = { ...DEFAULT_PINS };
  }
  USERS.forEach(u => {
    if (!userPins[u]) userPins[u] = DEFAULT_PINS[u];
  });
}

async function savePin(userName, pin, isSet = true) {
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
  userPins[userName] = pin;
  pinSet[userName] = isSet;
}

// ============================================================
// KOMMENTARER (på anteckningar)
// ============================================================
async function loadComments(noteId) {
  try {
    const data = await sb("/rest/v1/comments?note_id=eq." + noteId + "&order=created_at.asc") || [];
    comments[noteId] = data;
  } catch (e) {
    comments[noteId] = [];
  }
}

async function addComment(noteId, text) {
  await sb("/rest/v1/comments", {
    method: "POST",
    body: JSON.stringify({
      note_id: noteId,
      text,
      created_by: user,
      created_at: new Date().toISOString()
    }),
    prefer: "return=minimal"
  });
}

// ============================================================
// BILDHANTERING
// ============================================================
async function uploadImg(file) {
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

function compressImg(file, maxW, q) {
  return new Promise(res => {
    const fr = new FileReader();
    fr.onload = e => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        c.toBlob(res, "image/jpeg", q);
      };
      img.src = e.target.result;
    };
    fr.readAsDataURL(file);
  });
}
