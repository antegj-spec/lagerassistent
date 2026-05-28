// ============================================================
// services/images.ts — Bild-upload (Supabase Storage) + komprimering
// Beror på: config.ts (SB_URL, SB_KEY)
// ============================================================

async function uploadPdf(file: File): Promise<string> {
  const name = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  // Bucket-policyn kräver auth.role() = 'authenticated' → använd JWT, inte anon-key.
  const r = await fetch(SB_URL + "/storage/v1/object/lager-pdfs/" + name, {
    method: "POST",
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer " + getAuthToken(),
      "Content-Type": "application/pdf"
    },
    body: file
  });
  if (!r.ok) throw new Error("PDF-uppladdning misslyckades: " + await r.text());
  return SB_URL + "/storage/v1/object/public/lager-pdfs/" + name;
}

async function uploadImg(file: File): Promise<string> {
  const blob = await compressImg(file, 800, 0.72);
  const name = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9.]/g, "_");
  const r = await fetch(SB_URL + "/storage/v1/object/lager-images/" + name, {
    method: "POST",
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY,
      "Content-Type": blob.type
    },
    body: blob
  });
  if (!r.ok) throw new Error("Upload failed");
  return SB_URL + "/storage/v1/object/public/lager-images/" + name;
}

function compressImg(file: File, maxW: number, q: number): Promise<Blob> {
  // Fas 3.6 (B12): object URL + revoke. Sparar ~30% minne vs. base64 data-URL
  // och frigör resursen direkt — viktigt på iPhone Safari vid många foton.
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => res(b!), "image/jpeg", q);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      rej(e);
    };
    img.src = url;
  });
}
