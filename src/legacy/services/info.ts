// ============================================================
// services/info.ts — Info-artiklar (FAQ-flik) + bilder + kommentarer
// Beror på: store.ts, supabase.ts (sb)
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
