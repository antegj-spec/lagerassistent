// ============================================================
// actions/autoTask.ts — Auto-skapa task från material-kommentar (Fas 6.2)
// Beror på: services/tasks.ts (saveTask, logTaskStatus, loadTasks),
//   store.ts (materials, tasks), ui.ts (toast, updMeta)
//
// Trigger: ny material/item-kommentar med status='åtgärd_krävs'.
// Endast NYA kommentarer (submitMatComment) — cycle-omklassificering
// triggar INTE auto-task (annars spammar man tasks vid back-and-forth).
//
// Undo via soft-delete: saveTask({ id, deleted_at }) — loadTasks
// filtrerar bort raden. Soft i stället för hard så ev. dependency
// (kommentar/checklista skapad direkt efteråt) inte cascade-raderas.
// ============================================================

async function autoCreateTaskFromMatComment(
  matId: number,
  itemId: number | null,
  commentText: string,
  createdBy: string
): Promise<void> {
  const mat = materials.list.find(m => m.id === matId);
  if (!mat) return;
  const item = itemId != null ? (materials.items[matId] || []).find(i => i.id === itemId) : null;

  const subject = item ? `${mat.name} ${item.article_id}` : mat.name;
  const title = `🚨 Åtgärd: ${subject}`;
  const matRef = item ? `📦 ${mat.name} / ${item.article_id}` : `📦 ${mat.name}`;
  const description = `${commentText || "(ingen text)"}\n\n— Auto-skapad från material-kommentar (${matRef})`;

  try {
    const newId = await saveTask({
      title,
      description,
      priority: "hög",
      status: "ny",
      created_by: createdBy || "",
      responsible: createdBy || null,
      assigned_to: createdBy ? [createdBy] : [],
    });
    if (newId == null) return;
    await logTaskStatus({
      task_id: newId,
      old_status: null,
      new_status: "ny",
      changed_by: createdBy || "",
    });
    await loadTasks();
    updMeta();

    toast(`✓ Task auto-skapad: ${subject}`, 0, "ÅNGRA", async () => {
      try {
        // Soft-delete: loadTasks filtrerar deleted_at !== null.
        await saveTask({ id: newId, deleted_at: new Date().toISOString() });
        await loadTasks();
        updMeta();
        toast("✓ Auto-task ångrad");
      } catch (e) {
        toast("Kunde inte ångra auto-task", 1);
      }
    });
  } catch (e) {
    // Tyst fel — huvud-toasten ("Kommentar sparad") har redan visats.
    // Användaren kan skapa task manuellt om de behöver.
    console.warn("Auto-task creation failed:", e);
  }
}
