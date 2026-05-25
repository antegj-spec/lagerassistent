// ============================================================
// actions/info.ts — Info/FAQ-artiklar + bilder + kommentarer
// Beror på: services/info.ts, services/images.ts (uploadImg),
//   ui.ts (toast, confirmModal), render.ts (render)
//
// Fas 4.10: @ts-nocheck borttaget. DOM-lookups typas explicit.
// ============================================================

function openInfo(id: number): void {
  info.openId = id;
  info.editMode = null;
  _navPush();
  render();
}

function closeInfo(): void {
  info.openId = null;
  info.editMode = null;
  info.editImages = [];
  // Fas 3.6 (B14): rensa bifogad kommentar-bild
  ui.infoCommentImgUrl = null;
  render();
}

function startNewInfo(presetCat?: InfoCategory | string): void {
  info.openId = null;
  info.editMode = "new";
  info.editImages = [];
  (window as any)._infoEditPreset = presetCat || "Utrustning";
  render();
}

function startEditInfo(id: number): void {
  info.openId = id;
  info.editMode = "edit";
  info.editImages = [];
  render();
}

function cancelInfoEdit(): void {
  info.editMode = null;
  info.editImages = [];
  render();
}

async function saveInfoArticleForm(): Promise<void> {
  const title = (document.getElementById("info-title") as HTMLInputElement | null)?.value?.trim();
  if (!title) { toast("Ange en rubrik", 1); return; }
  const body = (document.getElementById("info-body") as HTMLTextAreaElement | null)?.value?.trim() || null;
  const category = ((document.getElementById("info-cat") as HTMLSelectElement | null)?.value || "Utrustning") as InfoCategory;

  try {
    if (info.editMode === "new") {
      const newId = await saveInfoArticle({
        title, body, category,
        is_pinned: false,
        created_by: auth.user || ""
      });
      if (newId == null) throw new Error("Kunde inte skapa förslag");
      // Koppla på uppladdade bilder
      for (const url of info.editImages) {
        await addInfoImage(newId, url);
      }
      await loadInfoArticles();
      info.editMode = null;
      info.editImages = [];
      info.openId = newId;
      toast("✓ Förslag skapat");
    } else if (info.editMode === "edit" && info.openId) {
      await saveInfoArticle({ id: info.openId, title, body, category });
      for (const url of info.editImages) {
        await addInfoImage(info.openId, url);
      }
      await loadInfoArticles();
      info.editMode = null;
      info.editImages = [];
      toast("✓ Sparat");
    }
    render();
  } catch (e) {
    toast("Kunde inte spara: " + (e as Error).message, 1);
  }
}

async function pinInfoArticle(id: number): Promise<void> {
  if (!auth.isAdmin) return;
  try {
    await saveInfoArticle({ id, is_pinned: true });
    await loadInfoArticles();
    toast("📌 Artikeln är nu fäst");
    render();
  } catch (e) {
    toast("Kunde inte fästa", 1);
  }
}

async function unpinInfoArticle(id: number): Promise<void> {
  if (!auth.isAdmin) return;
  try {
    await saveInfoArticle({ id, is_pinned: false });
    await loadInfoArticles();
    toast("Avfäst — tillbaka som förslag");
    render();
  } catch (e) {
    toast("Kunde inte avfästa", 1);
  }
}

async function doDelInfoArticle(id: number): Promise<void> {
  if (!auth.isAdmin) return;
  if (!await confirmModal("Ta bort artikeln? Den arkiveras (soft-delete).", { confirmLabel: "Arkivera" })) return;
  try {
    await delInfoArticle(id);
    await loadInfoArticles();
    if (info.openId === id) info.openId = null;
    toast("🗑 Borttagen");
    render();
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}

// Bilder vid skapande/redigering
async function handleInfoEditImg(inputEl: HTMLInputElement): Promise<void> {
  await handleImgInput(inputEl, (url) => { info.editImages.push(url); });
}

// Bilder direkt på en befintlig artikel (alla användare)
async function handleInfoAddImg(articleId: number, inputEl: HTMLInputElement): Promise<void> {
  await handleImgInput(inputEl, async (url) => {
    await addInfoImage(articleId, url);
    await loadInfoArticles();
  });
}

async function doDelInfoImage(imgId: number): Promise<void> {
  if (!auth.isAdmin) return;
  if (!await confirmModal("Ta bort bilden?", { confirmLabel: "Ta bort", danger: true })) return;
  try {
    await delInfoImage(imgId);
    await loadInfoArticles();
    toast("🗑 Bild borttagen");
    render();
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}

// Kommentarer
async function handleInfoCommentImg(_articleId: number, inputEl: HTMLInputElement): Promise<void> {
  await handleImgInput(inputEl, (url) => { ui.infoCommentImgUrl = url; },
    { successLabel: "✓ Bild redo att skickas" });
}

async function submitInfoComment(articleId: number): Promise<void> {
  const inp = document.getElementById("info-comment-input-" + articleId) as HTMLTextAreaElement | null;
  const body = inp?.value?.trim();
  if (!body && !ui.infoCommentImgUrl) { toast("Skriv en kommentar eller bifoga en bild", 1); return; }
  try {
    await addInfoComment(articleId, body || "", ui.infoCommentImgUrl);
    ui.infoCommentImgUrl = null;
    await loadInfoArticles();
    render();
    toast("✓ Kommentar sparad");
  } catch (e) {
    toast("Kunde inte spara kommentar", 1);
  }
}

async function doDelInfoComment(commentId: number): Promise<void> {
  if (!auth.isAdmin) return;
  await delCommentFlow(commentId, {
    del: delInfoComment,
    reload: loadInfoArticles
  });
}

// ---- PDF-HANTERING ----

async function handleInfoAddPdf(articleId: number, inputEl: HTMLInputElement): Promise<void> {
  const file = inputEl.files?.[0];
  if (!file) return;
  if (file.type !== "application/pdf") { toast("Välj en PDF-fil", 1); return; }
  if (file.size > 20 * 1024 * 1024) { toast("PDF:en får max vara 20 MB", 1); return; }
  toast("Laddar upp PDF...");
  try {
    const url = await uploadPdf(file);
    await addInfoPdf(articleId, url, file.name);
    await loadInfoArticles();
    toast("✓ PDF uppladdad");
    render();
  } catch (e) {
    toast("Kunde inte ladda upp PDF", 1);
  }
}

async function doDelInfoPdf(pdfId: number): Promise<void> {
  if (!auth.isAdmin) return;
  if (!await confirmModal("Ta bort PDF:en?", { confirmLabel: "Ta bort", danger: true })) return;
  try {
    await delInfoPdf(pdfId);
    await loadInfoArticles();
    toast("🗑 PDF borttagen");
    render();
  } catch (e) {
    toast("Kunde inte ta bort", 1);
  }
}

function openPdfOverlay(url: string, name: string): void {
  const c = document.getElementById("modal-container");
  if (!c) return;
  c.innerHTML = `
    <div class="info-pdf-overlay">
      <div class="info-pdf-overlay-bar">
        <span>${esc(name)}</span>
        <a href="${escAttr(url)}" download="${escAttr(name)}" class="btn-ghost" style="flex-shrink:0">⬇ Ladda ned</a>
        <button class="btn-ghost" onclick="closeModal()" style="flex-shrink:0">✕ Stäng</button>
      </div>
      <iframe src="${escAttr(url)}" title="${escAttr(name)}"></iframe>
    </div>`;
}
