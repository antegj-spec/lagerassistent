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
