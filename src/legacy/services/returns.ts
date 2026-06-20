// ============================================================
// services/returns.ts — Returer (uthyrt material som kommit tillbaka)
// Beror på: store.ts, supabase.ts (sb)
// ============================================================

async function loadReturns(): Promise<void> {
  try {
    const all = await sb<Return[]>("/rest/v1/returns?order=return_date.desc") || [];
    const active = all.filter(r => !r.deleted_at);
    returns.list = active.filter(r => !r.archived);
    returns.archived = active.filter(r => r.archived);
    // Materialrader (migration 030) — grupperas per return_id.
    const items = await sb<ReturnItem[]>("/rest/v1/return_items?order=sort_order.asc") || [];
    returns.items = {};
    items.forEach(it => {
      if (!returns.items[it.return_id]) returns.items[it.return_id] = [];
      returns.items[it.return_id].push(it);
    });
  } catch (e) {
    console.error("loadReturns failed:", e);
  }
}

// Ersätt alla materialrader för en retur (delete + insert). Anropas vid
// skapande och redigering. Tomma rader (utan materialnamn) filtreras bort.
async function replaceReturnItems(
  returnId: number,
  rows: { material: string; quantity: string | null; comment: string | null }[]
): Promise<void> {
  await sb("/rest/v1/return_items?return_id=eq." + returnId, { method: "DELETE" });
  const clean = rows.filter(r => r.material.trim());
  if (clean.length === 0) return;
  await sb("/rest/v1/return_items", {
    method: "POST",
    body: JSON.stringify(clean.map((r, i) => ({
      return_id: returnId,
      material: r.material.trim(),
      quantity: r.quantity?.trim() || null,
      comment: r.comment?.trim() || null,
      sort_order: i,
      created_by: auth.user,
    }))),
    prefer: "return=minimal",
  });
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
