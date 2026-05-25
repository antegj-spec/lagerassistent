// ============================================================
// actions/export.ts — CSV-export (Fas 6.10)
// Beror på: store.ts (notes/materials/tasks/returns), config.ts
//   (CATS, PRIOS, STATS, TASK_STATS, MAT_STATS), ui.ts (toast)
//
// Inget nytt npm-paket. Generera UTF-8-BOM CSV → Blob → download.
// Excel öppnar BOM-CSV korrekt med åäö.
// ============================================================

function csvEscape(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  // Citationstecken om kommatecken, semikolon, citationstecken eller radbrytning förekommer
  if (/[",;\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: unknown[][]): string {
  // BOM så Excel auto-detekterar UTF-8
  return "﻿" + rows.map(r => r.map(csvEscape).join(";")).join("\r\n");
}

function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function exportNotesCsv(): void {
  const rows: unknown[][] = [
    ["ID", "Skapad", "Skapad av", "Kategori", "Prioritet", "Status", "Text", "Tilldelad", "Material", "Deadline"],
  ];
  notes.list.forEach(n => {
    const mat = n.material_id ? materials.list.find(m => m.id === n.material_id)?.name : "";
    rows.push([
      n.id,
      n.created_at,
      n.created_by || "",
      CATS[n.category]?.label || n.category,
      PRIOS[n.priority || "medel"]?.label || n.priority || "",
      STATS[n.status] || n.status,
      n.text,
      n.assigned_to || "",
      mat || "",
      n.deadline || "",
    ]);
  });
  downloadCsv(`anteckningar-${todayStamp()}.csv`, rows);
  toast(`✓ ${notes.list.length} anteckningar exporterade`);
}

function exportTasksCsv(): void {
  const rows: unknown[][] = [
    ["ID", "Skapad", "Skapad av", "Titel", "Beskrivning", "Prioritet", "Status", "Huvudansvarig", "Tilldelade", "Extra personal", "Startdatum", "Deadline", "Arkiverad"],
  ];
  [...tasks.list, ...tasks.archived].forEach(t => {
    rows.push([
      t.id,
      t.created_at,
      t.created_by || "",
      t.title,
      t.description || "",
      PRIOS[t.priority || "medel"]?.label || t.priority || "",
      TASK_STATS[t.status]?.label || t.status,
      t.responsible || "",
      (t.assigned_to || []).join(", "),
      t.extra_staff || 0,
      t.start_date || "",
      t.deadline || "",
      t.archived ? "ja" : "nej",
    ]);
  });
  downloadCsv(`uppgifter-${todayStamp()}.csv`, rows);
  toast(`✓ ${tasks.list.length + tasks.archived.length} uppgifter exporterade`);
}

function exportMaterialsCsv(): void {
  const rows: unknown[][] = [
    ["Material", "Typ", "Enhet", "Total", "Tillgänglig", "Uthyrd", "Tvätt", "Reparation", "Okänd"],
  ];
  materials.list.forEach(m => {
    if (m.is_article_based) {
      const items = materials.items[m.id] || [];
      const counts: Record<string, number> = { tillgänglig: 0, uthyrd: 0, tvätt: 0, reparation: 0, okänd: 0 };
      items.forEach(it => { if (counts[it.status] !== undefined) counts[it.status]++; });
      rows.push([
        m.name,
        "Artiklar",
        "st",
        items.length,
        counts.tillgänglig,
        counts.uthyrd,
        counts.tvätt,
        counts.reparation,
        counts.okänd,
      ]);
    } else {
      const c = materials.counts[m.id] || {};
      rows.push([
        m.name,
        "Räkning",
        m.unit || "st",
        m.total_count || 0,
        c.tillgänglig || 0,
        c.uthyrd || 0,
        c.tvätt || 0,
        c.reparation || 0,
        c.okänd || 0,
      ]);
    }
  });
  downloadCsv(`material-${todayStamp()}.csv`, rows);
  toast(`✓ ${materials.list.length} material exporterade`);
}

function exportReturnsCsv(): void {
  const rows: unknown[][] = [
    ["ID", "Returdatum", "Material", "Leverantör", "Mottagen av", "Innehåll", "Kommentar", "Skapad", "Skapad av", "Arkiverad"],
  ];
  [...returns.list, ...returns.archived].forEach(r => {
    rows.push([
      r.id,
      r.return_date,
      r.name || "",
      r.supplier || "",
      r.received_by || "",
      r.content || "",
      r.comment || "",
      r.created_at,
      r.created_by || "",
      r.archived ? "ja" : "nej",
    ]);
  });
  downloadCsv(`returer-${todayStamp()}.csv`, rows);
  toast(`✓ ${returns.list.length + returns.archived.length} returer exporterade`);
}
