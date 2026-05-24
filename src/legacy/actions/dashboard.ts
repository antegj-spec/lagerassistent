// ============================================================
// actions/dashboard.ts — Dashboard-flikens load-on-demand-flow
// Beror på: supabase.ts (sb), store.ts (notify), render.ts (render),
//   ui.ts (toast), config.ts (MAT_STATS)
//
// Fas 6.9/6.7/6.13: aktivitetsfeed + problem-artiklar.
// State hålls i en lokal modul-level-variabel (inte appState) eftersom
// den är cache:ad per session och recomputeras vid varje tab-byte.
// ============================================================

interface DashboardActivity {
  at: string;                  // ISO timestamp
  who: string;                 // username
  kind: "task-status" | "material-status";
  text: string;                // ren prosa: "ändrade EPS PRO LD-1 till reparation"
}

interface ProblemArticle {
  matId: number;
  matName: string;
  matEmoji: string;
  reasons: string[];           // typer av varningar (reparation, åtgärd, …)
  count: number;               // antal items eller actionComments
}

interface DashboardData {
  activity: DashboardActivity[];
  problemArticles: ProblemArticle[];
  loadedAt: number | null;
}

const dashboard: DashboardData = {
  activity: [],
  problemArticles: [],
  loadedAt: null,
};

// Hur många dygn bakåt aktivitetsfeeden tittar
const ACTIVITY_DAYS_BACK = 14;
const ACTIVITY_LIMIT = 80;

async function loadDashboard(): Promise<void> {
  const since = new Date(Date.now() - ACTIVITY_DAYS_BACK * 86400000).toISOString();

  // ---- 6.13 Aktivitetsfeed: task_status_log + material_history ----
  const [taskLog, matHist] = await Promise.all([
    sb<TaskStatusLog[]>(
      `/rest/v1/task_status_log?created_at=gte.${since}&order=created_at.desc&limit=${ACTIVITY_LIMIT}`
    ).catch(() => [] as TaskStatusLog[]),
    sb<MaterialHistory[]>(
      `/rest/v1/material_history?created_at=gte.${since}&order=created_at.desc&limit=${ACTIVITY_LIMIT}`
    ).catch(() => [] as MaterialHistory[]),
  ]);

  const entries: DashboardActivity[] = [];

  (taskLog || []).forEach(l => {
    const t = [...tasks.list, ...tasks.archived].find(x => x.id === l.task_id);
    const title = t?.title || `Uppgift #${l.task_id}`;
    const verb = l.old_status == null ? "skapade" : `flyttade till ${TASK_STATS[l.new_status]?.label.toLowerCase() || l.new_status}`;
    entries.push({
      at: l.created_at,
      who: l.changed_by,
      kind: "task-status",
      text: `${verb}: ${title}`,
    });
  });

  (matHist || []).forEach(h => {
    const m = materials.list.find(x => x.id === h.material_id);
    const matName = m?.name || `Material #${h.material_id}`;
    const matEmoji = m?.emoji || "📦";
    const oldS = h.old_status || h.from_status;
    const newS = h.new_status || h.to_status;
    const article = h.article_id ? ` ${h.article_id}` : "";
    let verb: string;
    if (oldS == null && newS != null) {
      verb = `la till${article} (${MAT_STATS[newS]?.label.toLowerCase() || newS})`;
    } else if (oldS != null && newS != null) {
      verb = `flyttade${article} ${MAT_STATS[oldS]?.label.toLowerCase() || oldS} → ${MAT_STATS[newS]?.label.toLowerCase() || newS}`;
    } else {
      verb = `ändrade${article}`;
    }
    entries.push({
      at: h.created_at,
      who: h.changed_by,
      kind: "material-status",
      text: `${verb} (${matEmoji} ${matName})`,
    });
  });

  entries.sort((a, b) => (a.at < b.at ? 1 : -1));
  dashboard.activity = entries.slice(0, ACTIVITY_LIMIT);

  // ---- 6.7 Topp problem-artiklar ----
  // Aggregera: artiklar med status reparation + actionComments per material.
  const probMap: Record<number, ProblemArticle> = {};
  const ensure = (m: Material): ProblemArticle => {
    if (!probMap[m.id]) {
      probMap[m.id] = { matId: m.id, matName: m.name, matEmoji: m.emoji || "📦", reasons: [], count: 0 };
    }
    return probMap[m.id];
  };

  materials.list.forEach(m => {
    const items = materials.items[m.id] || [];
    const inRepair = items.filter(it => it.status === "reparation").length;
    if (inRepair > 0) {
      const p = ensure(m);
      p.reasons.push(`${inRepair} på rep`);
      p.count += inRepair;
    }
    if (!m.is_article_based) {
      const c = materials.counts[m.id] || {};
      const repCount = c.reparation || 0;
      if (repCount > 0) {
        const p = ensure(m);
        p.reasons.push(`${repCount} på rep`);
        p.count += repCount;
      }
    }
  });

  // actionComments = material_comments med status 'åtgärd_krävs' (laddad i materials.actionComments)
  const actionsByMat: Record<number, number> = {};
  materials.actionComments.forEach(c => {
    actionsByMat[c.material_id] = (actionsByMat[c.material_id] || 0) + 1;
  });
  Object.entries(actionsByMat).forEach(([matIdStr, n]) => {
    const matId = parseInt(matIdStr);
    const m = materials.list.find(x => x.id === matId);
    if (!m) return;
    const p = ensure(m);
    p.reasons.push(`${n} åtgärd krävs`);
    p.count += n;
  });

  dashboard.problemArticles = Object.values(probMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  dashboard.loadedAt = Date.now();
}

async function openDashboard(): Promise<void> {
  // Säkra att aktivitetsfeed har material/tasks-namn att joina mot.
  // Dessa laddas redan vid login (loadAllInitial). Men actionComments
  // behövs för problem-artiklar och laddas bara när man besöker
  // åtgärder-sub-tab — så vi laddar om för säkerhets skull.
  if (typeof loadActionComments === "function") {
    try { await loadActionComments(); } catch (e) { /* ignore */ }
  }
  try {
    await loadDashboard();
  } catch (e) {
    toast("Kunde inte ladda dashboard", 1);
  }
  render();
}
