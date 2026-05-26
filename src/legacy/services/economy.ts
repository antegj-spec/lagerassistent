// ============================================================
// services/economy.ts — Ekonomi/utgifter (Fas 8 Etapp C)
// Beror på: store.ts, supabase.ts (sb)
// ============================================================

async function loadEconomy(year?: number): Promise<void> {
  try {
    const y = year ?? economy.year;
    const list = await sb<EconomyEntry[]>(
      `/rest/v1/economy_entries?year=eq.${y}&order=category.asc,created_at.asc`
    );
    economy.entries = list || [];
    economy.year = y;
  } catch (e) {
    console.error("loadEconomy failed:", e);
  }
}

async function saveEconomyEntry(e: Partial<EconomyEntry> & { id?: string }): Promise<string | undefined> {
  const { id, created_at, ...b } = e as Partial<EconomyEntry>;
  if (id) {
    await sb("/rest/v1/economy_entries?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const res = await sb<{ id: string }[]>("/rest/v1/economy_entries", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return res?.[0]?.id;
  }
}

async function delEconomyEntry(id: string): Promise<void> {
  await sb("/rest/v1/economy_entries?id=eq." + id, {
    method: "DELETE",
    prefer: "return=minimal"
  });
}

// Hämtar tillgängliga år (DISTINCT) för årsväljaren.
async function loadEconomyYears(): Promise<number[]> {
  try {
    const list = await sb<{ year: number }[]>(
      "/rest/v1/economy_entries?select=year&order=year.desc"
    );
    const years = Array.from(new Set((list || []).map(r => r.year))).sort((a, b) => b - a);
    // Säkerställ att aktuellt år alltid finns med (även om ingen post finns).
    const now = new Date().getFullYear();
    if (!years.includes(now)) years.unshift(now);
    return years;
  } catch (e) {
    console.error("loadEconomyYears failed:", e);
    return [new Date().getFullYear()];
  }
}
