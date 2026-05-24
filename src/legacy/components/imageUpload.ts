// ============================================================
// components/imageUpload.ts — Generisk bild-upload-flow
// Beror på: services/images.ts (uploadImg), ui.ts (toast),
//   render.ts (render)
//
// Fas 4.4: Tidigare har ~7 action-handlers duplicerat
//   file→toast→uploadImg→onUrl→toast→render
// med små variationer. handleImgInput() konsoliderar det till
// en enda funktion — call-sites blir 3-radiga.
// ============================================================

/**
 * Hanterar en file-input → kompression → upload → callback.
 *
 * Anropas typiskt från en `<input type="file" onchange="...">`-handler.
 * Tar inputEl, läser första filen, kör uploadImg() och anropar
 * onUrl(url) när det är klart. Toast + render hanteras här.
 *
 * Vid fel visas felmeddelandet via toast och onUrl anropas INTE.
 *
 * Ex.:
 *   async function handleMatImg(matId: number, inputEl: HTMLInputElement) {
 *     await handleImgInput(inputEl, async (url) => {
 *       await addMatImage(matId, url);
 *       await loadMatImages(matId);
 *     });
 *   }
 */
async function handleImgInput(
  inputEl: HTMLInputElement,
  onUrl: (url: string) => Promise<void> | void,
  opts: { successLabel?: string; renderAfter?: boolean } = {}
): Promise<void> {
  const file = inputEl.files?.[0];
  if (!file) return;
  const successLabel = opts.successLabel ?? "✓ Bild tillagd";
  const renderAfter = opts.renderAfter ?? true;
  try {
    toast("Laddar upp bild...");
    const url = await uploadImg(file);
    await onUrl(url);
    toast(successLabel);
    if (renderAfter) render();
  } catch (e) {
    toast("Kunde inte ladda upp bild", 1);
  }
}
