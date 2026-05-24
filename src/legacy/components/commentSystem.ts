// ============================================================
// components/commentSystem.ts — Generiska helpers för
//   delete/edit-kommentar-flöden
// Beror på: ui.ts (toast, openModal, closeModal, confirmModal, esc),
//   render.ts (render)
//
// Fas 4.3: Note/Task/Material/Info-kommentarer hade tidigare nästan
// identisk del- och edit-logik kopierad 3-4 ggr. Två generiska
// flow-funktioner ersätter dessa duplikat.
//
// HTML-rendering av kommentartrådar förblir per-aggregate i render.ts
// (markup-skillnaderna är för stora för att löna sig att unifiera).
// ============================================================

interface CommentEndpoints {
  /** Anropar PostgREST-DELETE för kommentaren. */
  del: (id: number) => Promise<void>;
  /** Reload-funktioner som körs efter mutation (oftast load*Comments + ev. loadActionComments). */
  reload: () => Promise<void>;
}

/**
 * Standardflöde för att radera en kommentar:
 *   confirmModal → del → reload → render + toast.
 *
 * Returnerar `true` om radering skedde, `false` om användaren avbröt.
 * Vid undantag visas felmeddelande och `false` returneras.
 */
async function delCommentFlow(commentId: number, eps: CommentEndpoints): Promise<boolean> {
  if (!await confirmModal("Ta bort kommentaren?", { confirmLabel: "Ta bort", danger: true })) {
    return false;
  }
  try {
    await eps.del(commentId);
    await eps.reload();
    render();
    toast("🗑 Borttagen");
    return true;
  } catch (e) {
    toast("Kunde inte ta bort", 1);
    return false;
  }
}

interface EditCommentOpts {
  /** Nuvarande text att förifylla. */
  currentText: string;
  /** Modal-titel (t.ex. "Redigera kommentar" / "Redigera uppdatering"). */
  modalTitle?: string;
  /** Inline-id för textarea — måste vara unikt om flera edit-modaler öppnas. */
  textareaId: string;
  /** Globalt funktionsnamn att anropa vid SPARA (string pga inline-onclick). */
  onSaveFn: string;
  /** Args som skickas verbatim till onSaveFn(...args). Strängas in i inline-onclick. */
  saveArgs: (number | string)[];
}

/**
 * Öppnar en standardmodal med textarea + Avbryt/Spara-knappar för
 * kommentar-redigering. SPARA-knappen anropar `onSaveFn(...saveArgs)`
 * inline. Skapa motsvarande save-funktion på globalt scope som hämtar
 * textareans värde via dokument-ID och anropar `editCommentFlow()`.
 */
function openEditCommentModal(opts: EditCommentOpts): void {
  const title = opts.modalTitle ?? "Redigera kommentar";
  const args = opts.saveArgs
    .map(a => typeof a === "string" ? `'${a.replace(/'/g, "\\'")}'` : String(a))
    .join(",");
  openModal(`
    <div class="modal-title">${esc(title)}</div>
    <textarea id="${opts.textareaId}" rows="3">${esc(opts.currentText)}</textarea>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="${opts.onSaveFn}(${args})" style="flex:1">SPARA</button>
    </div>
  `);
}

interface EditFlowOpts {
  textareaId: string;
  edit: (id: number, text: string) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Standardflöde efter SPARA i edit-modal:
 *   hämta textareans värde → validera → edit → reload → closeModal +
 *   render + toast.
 */
async function editCommentFlow(commentId: number, opts: EditFlowOpts): Promise<void> {
  const text = (document.getElementById(opts.textareaId) as HTMLTextAreaElement | null)?.value?.trim();
  if (!text) { toast("Kommentaren får inte vara tom", 1); return; }
  try {
    await opts.edit(commentId, text);
    await opts.reload();
    closeModal();
    render();
    toast("✓ Sparad");
  } catch (e) {
    toast("Kunde inte spara", 1);
  }
}
