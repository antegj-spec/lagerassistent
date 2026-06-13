// ============================================================
// services/notes.ts — Supabase-anrop för anteckningar + kommentarer
// Beror på: config.ts, store.ts, supabase.ts (sb), ui.ts (toast)
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

// ---- KOMMENTARER (på anteckningar) ----
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
  // OBS: comments-tabellen saknar updated_at-kolumn (till skillnad från
  // task_comments/material_comments). Skicka inte med den — PostgREST ger
  // 400 Bad Request på okänd kolumn.
  await sb("/rest/v1/comments?id=eq." + id, {
    method: "PATCH",
    body: JSON.stringify({ text }),
    prefer: "return=minimal"
  });
}
