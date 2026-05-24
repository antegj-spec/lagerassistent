// ============================================================
// render/patches.ts — Granular DOM-patches per aggregate (Fas 4.5)
// Beror på: store.ts, render.ts (rCard, rMatCardSummary,
// rTaskListRow), ui.ts (updMeta)
//
// Hot-path-actions slipper anropa full render(). Istället plockar
// patch-funktionen ut DOM-noden via data-attribut och ersätter
// bara det berörda kortet.
//
// Två lager:
//  1. Per-aggregate patches (patchNoteCard, patchMaterialCard,
//     patchTaskRow) — kallas explicit av actions efter mutation.
//  2. Cross-cutting patches (patchHeaderMeta) — kallas av
//     render/subscribers.ts vid varje store-notify.
//
// Begränsningar:
//  - patchX(id) hittar BARA ett kort. Om listan ändras
//    (insert/delete) måste action göra full render() eller en
//    custom list-patch.
//  - För detaljvy (notes.openId, materials.openId) är hela main
//    redan en stor expansion av kortet — patch fallbackar till
//    full render() om kortet inte är synligt som lista-item.
// ============================================================

// ---- INTERN HJÄLPARE ----
function replaceCardHtml(selector: string, html: string): boolean {
  const el = document.querySelector(selector);
  if (!el) return false;
  const tmpl = document.createElement("template");
  tmpl.innerHTML = html.trim();
  const next = tmpl.content.firstElementChild;
  if (!next) return false;
  el.replaceWith(next);
  return true;
}

// ---- ANTECKNINGAR ----
// Byt ut ett note-card. Returnerar true om DOM-noden hittades.
// Anropas av actions: setStatus, toggleNote, submitComment, etc.
function patchNoteCard(id: number): boolean {
  const note = notes.list.find(n => n.id === id);
  if (!note) {
    // Noten är borta (raderad eller filtrerad bort) — ta bort kortet.
    const el = document.querySelector(`[data-note-id="${id}"]`);
    if (el) el.remove();
    return false;
  }
  // Om noten är "öppen" är hela kommentarssektionen del av kortet —
  // rCard hanterar både stängt och öppet läge.
  return replaceCardHtml(`[data-note-id="${id}"]`, rCard(note));
}

// ---- MATERIAL ----
// Byter ut ett mat-card i listan (rMatCardSummary). Detaljvy hanteras
// separat — där kallar action full render() eftersom mer än ett
// element ändras.
function patchMaterialCard(id: number): boolean {
  const mat = materials.list.find(m => m.id === id);
  if (!mat) {
    const el = document.querySelector(`[data-material-id="${id}"]`);
    if (el) el.remove();
    return false;
  }
  return replaceCardHtml(`[data-material-id="${id}"]`, rMatCardSummary(mat));
}

// ---- TASKS ----
function patchTaskRow(id: number): boolean {
  const task = tasks.list.find(t => t.id === id) || tasks.archived.find(t => t.id === id);
  if (!task) {
    const el = document.querySelector(`[data-task-id="${id}"]`);
    if (el) el.remove();
    return false;
  }
  const isArchived = tasks.archived.some(a => a.id === id);
  return replaceCardHtml(`[data-task-id="${id}"]`, rTaskListRow(task, isArchived));
}

// ---- HEADER-META ----
// Wrapper runt updMeta() (som redan finns i ui.ts). Den uppdaterar
// header-meta + deadline-varningar — båda är cross-cutting och beror
// på notes, tasks och materials. Subscribers triggar denna vid varje
// store-change på de tre keys:en.
function patchHeaderMeta(): void {
  if (typeof updMeta === "function") updMeta();
}
