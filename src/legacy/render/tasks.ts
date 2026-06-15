// ============================================================
// render/tasks.ts — PLAN/uppgifter (utbruten ur render.ts)
// Global scope (module:"none") — anropas av render() i render.ts.
// Beror på: config.js, ui.js, store.js
// ============================================================

// ============================================================
// PLAN-FLIKEN (Arbetsplanering)
// ============================================================
function rPlan(): string {
  // Detaljvy
  if (tasks.openId) {
    const t = [...tasks.list, ...tasks.archived].find(t => t.id === tasks.openId);
    if (t) return rTaskDetail(t);
  }

  const subTabs = `
<div class="filter-row mb" style="border-bottom:1px solid var(--border);padding-bottom:8px">
  <button class="filter-btn ${ui.planSubTab === "aktiva" ? "active" : ""}" onclick="setPlanSubTab('aktiva')">📋 AKTIVA (${tasks.list.length})</button>
  ${auth.isAdmin ? `<button class="filter-btn ${ui.planSubTab === "arkiv" ? "active" : ""}" onclick="setPlanSubTab('arkiv')">📁 ARKIV (${tasks.archived.length})</button>` : ""}
</div>`;

  if (ui.planSubTab === "arkiv" && auth.isAdmin) return subTabs + rPlanArchive();
  return subTabs + rPlanActive();
}

function rPlanActive(): string {
  const allUsers = USERS.filter(u => u !== "Admin");
  const filtered = tasks.list.filter(t => {
    if (ui.planPersonFilter === "alla") return true;
    if (ui.planPersonFilter === "ingen") return !t.responsible && !(t.assigned_to || []).length;
    return t.responsible === ui.planPersonFilter || (t.assigned_to || []).includes(ui.planPersonFilter);
  });
  // Klara uppgifter hamnar under aktiva (stabil sort behåller inbördes ordning).
  const sorted = [...filtered].sort((a, b) =>
    (a.status === "klar" ? 1 : 0) - (b.status === "klar" ? 1 : 0)
  );

  return `
${auth.isAdmin ? `<button class="btn mb" onclick="openAddTask()" style="width:100%">+ NY UPPGIFT</button>` : ""}
<div class="lbl">FILTRERA PÅ PERSON</div>
<div class="filter-row mb">
  <button class="filter-btn ${ui.planPersonFilter === "alla" ? "active" : ""}" onclick="setPlanPersonFilter('alla')">Alla</button>
  <button class="filter-btn ${ui.planPersonFilter === "ingen" ? "active" : ""}" onclick="setPlanPersonFilter('ingen')">Ej tilldelat</button>
  ${allUsers.map(u => `<button class="filter-btn ${ui.planPersonFilter === u ? "active" : ""}" onclick="setPlanPersonFilter('${esc(u)}')">${esc(u)}</button>`).join("")}
</div>
<div class="lbl">${filtered.length} UPPGIFTER</div>
${sorted.length === 0
  ? `<div class="empty">Inga uppgifter matchar filtret</div>`
  : sorted.map(t => rTaskListRow(t)).join("")
}`;
}

function rPlanArchive(): string {
  return `
${tasks.archived.length === 0
  ? `<div class="empty">Inget arkiverat</div>`
  : tasks.archived.map(t => rTaskListRow(t, true)).join("")
}`;
}

// ---- KOMPAKT UPPGIFTSRAD I LISTAN ----
function rTaskListRow(t: Task, isArchived: boolean = false): string {
  const prio = PRIOS[t.priority || "medel"] || PRIOS.medel;
  const stat = TASK_STATS[t.status] || TASK_STATS.ny;
  const dlStatus = t.deadline ? deadlineStatus(t.deadline) : null;
  const dlLabel  = t.deadline ? deadlineLabel(t.deadline) : "";
  const isDone = t.status === "klar";
  const cmtCount = (tasks.comments[t.id] || []).length;
  const checkItems = tasks.checklists[t.id] || [];
  const doneItems = checkItems.filter(i => i.done).length;

  const lastUpdate = cmtCount
    ? fmtD((tasks.comments[t.id] || []).at(-1)?.created_at || "")
    : fmtD(t.updated_at || t.created_at);

  return `<div class="task-row" data-task-id="${t.id}" onclick="openTaskDetail(${t.id})" style="border-left:3px solid ${prio.color};${isDone ? "opacity:.55;" : ""}${
    dlStatus === "overdue" ? "border-top:2px solid #ff6b6b;" :
    dlStatus === "urgent"  ? "border-top:2px solid var(--accent);" : ""
  }">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
    <div style="flex:1;min-width:0">
      <div style="font-family:var(--display);font-weight:700;font-size:15px;${isDone ? "text-decoration:line-through;color:var(--muted);" : ""}">${esc(t.title)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;align-items:center">
        <span style="font-size:9px;color:${prio.color};font-family:var(--display);font-weight:700">● ${prio.label}</span>
        <button onclick="event.stopPropagation();cycleTaskStatus(${t.id})" title="Tryck för att cykla status" style="font-size:9px;color:${stat.color};font-family:var(--display);font-weight:700;background:transparent;border:1px solid currentColor;border-radius:10px;padding:1px 8px;cursor:pointer">${stat.label.toUpperCase()}</button>
        ${t.responsible ? `<span class="note-assign">⭐ ${esc(t.responsible)}</span>` : ""}
        ${(t.assigned_to || []).filter(u => u !== t.responsible).map(u => `<span class="note-assign">@${esc(u)}</span>`).join("")}
        ${dlStatus ? `<span class="${deadlineBadgeClass(dlStatus)}">${esc(dlLabel)}</span>` : ""}
        ${checkItems.length ? `<span style="font-size:9px;color:var(--muted)">✓ ${doneItems}/${checkItems.length}</span>` : ""}
        ${cmtCount ? `<span style="font-size:9px;color:var(--muted)">💬 ${cmtCount}</span>` : ""}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:10px;color:var(--dim)">Uppdaterat</div>
      <div style="font-size:10px;color:var(--muted)">${lastUpdate}</div>
    </div>
  </div>
  <div class="note-meta" style="margin-top:4px">
    <span>Skapad ${fmtD(t.created_at)} av ${esc(t.created_by || "")}</span>
    ${t.start_date ? `<span>· start ${fmtDateOnly(t.start_date)}</span>` : ""}
  </div>
</div>`;
}

// ---- INFO-LÄNK-SEKTION FÖR UPPGIFT ----
function rTaskInfoLinks(taskId: number): string {
  const linkedIds = tasks.infoLinks[taskId] || [];
  const linkedArticles = linkedIds
    .map(id => info.articles.find(a => a.id === id))
    .filter(Boolean) as InfoArticle[];

  const articleOptions = info.articles
    .filter(a => !linkedIds.includes(a.id))
    .map(a => `<option value="${a.id}">${esc(a.title)}</option>`)
    .join("");

  return `
<div class="card">
  <div class="lbl">KOPPLADE GUIDER & RUTINER (${linkedArticles.length})</div>
  ${linkedArticles.length === 0 ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Inga kopplade artiklar — länka en INFO-artikel nedan</div>` : ""}
  ${linkedArticles.map(a => {
    const catCfg = INFO_CATS[a.category] || INFO_CATS.Utrustning;
    const artImages = info.images[a.id] || [];
    const artPdfs = info.pdfs[a.id] || [];
    return `
  <details class="task-info-link">
    <summary>
      ${catCfg.emoji} <span style="flex:1">${esc(a.title)}</span>
      <span style="font-size:10px;color:var(--muted);font-weight:400">${esc(a.category)}</span>
      ${auth.isAdmin ? `<button class="cmt-act-btn cmt-act-del" onclick="event.preventDefault();removeTaskInfoLinkAction(${taskId},${a.id})" style="flex-shrink:0">🗑</button>` : ""}
    </summary>
    <div class="task-info-link-content">
      ${a.body ? `<div style="white-space:pre-wrap;margin-bottom:10px">${esc(a.body)}</div>` : ""}
      ${artImages.length > 0 ? `<div class="info-images" style="margin-bottom:10px">${artImages.map(img =>
        `<div class="info-img-wrap"><img src="${escAttr(img.image_url)}" loading="lazy" onclick="openLightbox('${escJs(img.image_url)}')"></div>`
      ).join("")}</div>` : ""}
      ${artPdfs.map(p =>
        `<button class="btn-ghost" style="margin:0 6px 6px 0" onclick="openPdfOverlay('${escJs(p.pdf_url)}','${escJs(p.pdf_name)}')">📄 ${esc(p.pdf_name)}</button>`
      ).join("")}
      <button class="btn-ghost" style="margin-bottom:0" onclick="gotoInfo(${a.id})">📖 Öppna i Info →</button>
    </div>
  </details>`;
  }).join("")}
  ${auth.isAdmin && info.articles.length > linkedIds.length ? `
  <div class="task-info-link-add">
    <select id="task-info-link-select-${taskId}">
      <option value="">— Välj artikel —</option>
      ${articleOptions}
    </select>
    <button class="btn-ghost" onclick="addTaskInfoLinkAction(${taskId})">+ Länka</button>
  </div>` : ""}
</div>`;
}

// ---- FULL DETALJSIDA FÖR UPPGIFT ----
function rTaskDetail(t: Task): string {
  const prio = PRIOS[t.priority || "medel"] || PRIOS.medel;
  const stat = TASK_STATS[t.status] || TASK_STATS.ny;
  const dlStatus = t.deadline ? deadlineStatus(t.deadline) : null;
  const dlLabel  = t.deadline ? deadlineLabel(t.deadline) : "";
  const isDone = t.status === "klar";
  const log = tasks.statusLogs[t.id] || [];
  const cmts = tasks.comments[t.id] || [];
  const checkItems = tasks.checklists[t.id] || [];
  const isArchived = tasks.archived.some(a => a.id === t.id);

  return `
<button class="btn-ghost mb" onclick="history.back()">← Tillbaka till planering</button>

<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
    <div style="flex:1;min-width:0">
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
        <span style="font-size:9px;color:${prio.color};font-family:var(--display);font-weight:700">● ${prio.label}</span>
        <span style="font-size:9px;color:${stat.color};font-family:var(--display);font-weight:700">${stat.label.toUpperCase()}</span>
        ${dlStatus ? `<span class="${deadlineBadgeClass(dlStatus)}">${esc(dlLabel)}</span>` : ""}
      </div>
      <div style="font-family:var(--display);font-size:24px;font-weight:900;${isDone ? "text-decoration:line-through;color:var(--muted);" : ""}">${esc(t.title)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px">
        Skapad ${fmtD(t.created_at)} av ${esc(t.created_by || "")}
        ${t.start_date ? `· start ${fmtDateOnly(t.start_date)}` : ""}
      </div>
    </div>
    ${auth.isAdmin || t.responsible === auth.user ? `<div style="display:flex;flex-direction:column;gap:6px">
      <button class="btn-ghost" onclick="openEditTask(${t.id})">✎ Redigera</button>
      ${auth.isAdmin ? `<button class="btn-ghost danger" onclick="doDelTask(${t.id})">🗑</button>` : ""}
    </div>` : ""}
  </div>

  <div class="lbl">PERSONAL</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${t.responsible ? `<span class="note-assign" style="font-size:12px;padding:4px 10px">⭐ ${esc(t.responsible)}</span>` : ""}
    ${(t.assigned_to || []).filter(u => u !== t.responsible).map(u => `<span class="note-assign" style="font-size:12px;padding:4px 10px">@${esc(u)}</span>`).join("")}
    ${(t.extra_staff || 0) > 0 ? `<span class="note-assign" style="font-size:12px;padding:4px 10px">+${t.extra_staff} extra inhyrd</span>` : ""}
    ${!t.responsible && !(t.assigned_to || []).length ? `<span style="font-size:12px;color:var(--muted)">Ingen tilldelad</span>` : ""}
  </div>

  <div class="lbl">STATUS</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${Object.entries(TASK_STATS).map(([k, v]) =>
      `<button class="status-btn ${t.status === k ? "active" : ""}" onclick="setTaskStatus(${t.id},'${k}')">${v.label}</button>`
    ).join("")}
    ${auth.isAdmin && !isArchived && t.status === "klar" ? `<button class="btn-ghost" onclick="archiveTask(${t.id},true)">📁 Arkivera</button>` : ""}
    ${auth.isAdmin && isArchived ? `<button class="btn-ghost" onclick="archiveTask(${t.id},false)">↩ Aktivera</button>` : ""}
  </div>
</div>

${t.description ? `<div class="card">
  <div class="lbl">BESKRIVNING</div>
  <div style="font-size:13px;line-height:1.7;white-space:pre-wrap">${esc(t.description)}</div>
</div>` : ""}

${rTaskInfoLinks(t.id)}

<!-- CHECKLISTA -->
<div class="card">
  <div class="lbl">CHECKLISTA (${checkItems.filter(i=>i.done).length}/${checkItems.length})</div>
  ${checkItems.length === 0 ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Inga punkter ännu — lägg till nedan</div>` : ""}
  ${checkItems.map(item => `
    <div class="checklist-item">
      <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;flex:1">
        <input type="checkbox" ${item.done ? "checked" : ""} onchange="toggleChecklist(${t.id},${item.id},this.checked)"
          style="width:18px;height:18px;margin-top:1px;flex-shrink:0;accent-color:var(--accent)">
        <span style="font-size:13px;${item.done ? "text-decoration:line-through;color:var(--muted);" : ""}">${esc(item.text)}</span>
      </label>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <span style="font-size:10px;color:var(--dim)">${esc(item.created_by)}</span>
        <button class="cmt-act-btn cmt-act-del" onclick="delChecklistAction(${t.id},${item.id})">🗑</button>
      </div>
    </div>
  `).join("")}
  <div style="display:flex;gap:6px;margin-top:10px">
    <input type="text" id="checklist-new-${t.id}" placeholder="Ny checklistpunkt..." style="flex:1"
      onkeydown="if(event.key==='Enter')addChecklistAction(${t.id})">
    <button class="btn-ghost" onclick="addChecklistAction(${t.id})">+ Lägg till</button>
  </div>
</div>

<!-- DAGLIGA UPPDATERINGAR -->
<div class="card">
  <div class="lbl">DAGLIGA UPPDATERINGAR (${cmts.length})</div>
  ${cmts.map(c => {
    const canMod = auth.isAdmin || c.created_by === auth.user;
    return `<div class="comment-item">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
        <div class="comment-text" style="white-space:pre-wrap;flex:1">${esc(c.text)}</div>
        ${canMod ? `<div style="display:flex;gap:4px;flex-shrink:0">
          <button class="cmt-act-btn" onclick="editTaskCommentAction(${t.id},${c.id},'${escJs(c.text)}')">✎</button>
          <button class="cmt-act-btn cmt-act-del" onclick="delTaskCommentAction(${t.id},${c.id})">🗑</button>
        </div>` : ""}
      </div>
      <div class="comment-meta">${esc(c.created_by)} · ${fmtD(c.created_at)}</div>
    </div>`;
  }).join("")}
  <div class="comment-input-row" style="margin-top:10px">
    <input type="text" id="task-comment-input-${t.id}" placeholder="Lägg till daglig uppdatering..."
      onkeydown="if(event.key==='Enter')submitTaskComment(${t.id})">
    <button class="btn-ghost" onclick="submitTaskComment(${t.id})">Skicka</button>
  </div>
</div>

${log.length > 0 ? `<div class="card">
  <div class="lbl">STATUSHISTORIK (${log.length})</div>
  ${log.slice(0, 10).map(l =>
    `<div class="comment-item">
      <div class="comment-text">${esc(l.old_status ? TASK_STATS[l.old_status]?.label || l.old_status : "skapad")} → <b>${esc(TASK_STATS[l.new_status]?.label || l.new_status)}</b></div>
      <div class="comment-meta">${esc(l.changed_by)} · ${fmtD(l.created_at)}</div>
    </div>`
  ).join("")}
</div>` : ""}`;
}
