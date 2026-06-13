// ============================================================
// services/materials.ts — Material, items, counts, history,
//   borrowed, comments, images, item-images
// Beror på: config.ts, store.ts, supabase.ts (sb, sbPaged)
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

    // Ladda aktiva allokeringar (reserverat + uthyrt). Avslutade (återlämnad/
    // avbruten) syns i historiken, inte i de aktiva listorna.
    const allocs = await sbPaged<MaterialAllocation>(
      "/rest/v1/material_allocations?status=eq.aktiv&order=reserved_at.desc"
    );
    materials.allocations = {};
    allocs.forEach(a => {
      if (!materials.allocations[a.material_id]) materials.allocations[a.material_id] = [];
      materials.allocations[a.material_id].push(a);
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

// ---- ALLOKERINGAR: RESERVERAT/UTHYRT (Fas 6.9) ----
// Alla tre går via SECURITY DEFINER-RPC som flyttar material_counts (eller
// artikelstatus) ATOMISKT i samma transaktion som allokeringsraden ändras.
// Speglar moveCount()-mönstret inkl. error-unwrap från PostgREST-JSON.
function unwrapRpcError(e: any): never {
  let msg = e?.message ?? String(e);
  try {
    const parsed = JSON.parse(msg);
    if (parsed?.message) msg = parsed.message;
  } catch { /* var inte JSON — behåll originalet */ }
  throw new Error(msg);
}

async function createAllocation(args: {
  material_id: number;
  kind: AllocationKind;
  qty?: number;
  item_id?: number | null;
  target_text?: string | null;
  place_id?: number | null;
  expected_return?: string | null;
  comment?: string | null;
}): Promise<void> {
  try {
    await sb("/rest/v1/rpc/create_allocation", {
      method: "POST",
      body: JSON.stringify({
        p_material_id: args.material_id,
        p_kind: args.kind,
        p_qty: args.qty ?? 1,
        p_item_id: args.item_id ?? null,
        p_target_text: args.target_text ?? null,
        p_place_id: args.place_id ?? null,
        p_expected_return: args.expected_return ?? null,
        p_comment: args.comment ?? null
      }),
      prefer: "return=minimal"
    });
  } catch (e) { unwrapRpcError(e); }
}

async function promoteAllocation(allocation_id: number, comment: string | null = null): Promise<void> {
  try {
    await sb("/rest/v1/rpc/promote_allocation", {
      method: "POST",
      body: JSON.stringify({ p_allocation_id: allocation_id, p_comment: comment }),
      prefer: "return=minimal"
    });
  } catch (e) { unwrapRpcError(e); }
}

async function closeAllocation(
  allocation_id: number,
  to_status: MaterialStatus = "tillgänglig",
  comment: string | null = null
): Promise<void> {
  try {
    await sb("/rest/v1/rpc/close_allocation", {
      method: "POST",
      body: JSON.stringify({ p_allocation_id: allocation_id, p_to_status: to_status, p_comment: comment }),
      prefer: "return=minimal"
    });
  } catch (e) { unwrapRpcError(e); }
}

// Atomiskt "Ändra total" (migration 029): sätter total_count OCH stämmer av
// mellanskillnaden mot 'okänd' i en transaktion server-side. Ersätter det
// tidigare saveMat()+setMatCount()-mönstret som kunde halv-spara om mobilen
// tappade andra anropet mitt i.
async function setTotalCount(material_id: number, new_total: number): Promise<void> {
  try {
    await sb("/rest/v1/rpc/set_total_count", {
      method: "POST",
      body: JSON.stringify({ p_material_id: material_id, p_new_total: new_total }),
      prefer: "return=minimal"
    });
  } catch (e) { unwrapRpcError(e); }
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

// ---- KOMMENTARER PÅ MATERIAL/ARTIKLAR ----
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
