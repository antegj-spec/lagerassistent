// ============================================================
// config.ts — Konstanter, kategorier, prioriteter och state
// Laddas ALLTID FÖRST. Alla andra JS-filer beror på denna.
//
// Fas 2.6: typannoterat. Behåller klassisk-script-modell —
// alla deklarationer är globala för andra filer i samma
// compilation (tsconfig.legacy.json: module: "none").
// ============================================================

// SUPABASE-ANSLUTNING
const SB_URL: string = "https://tzidalknfoumoknhsetx.supabase.co";
const SB_KEY: string = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6aWRhbGtuZm91bW9rbmhzZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTE1NjgsImV4cCI6MjA5Mjk2NzU2OH0.bqyMhiCK34gws-WKyYH0zBKAPPytywMJMuA9fL3-4cY";

// ANVÄNDARE
const USERS: readonly string[] = ["Admin", "Andreas", "Nicklas", "Per", "Johannes"];
const DEFAULT_PINS: Record<string, string> = {
  "Admin":    "0987",
  "Andreas":  "0000",
  "Nicklas":  "0000",
  "Per":      "0000",
  "Johannes": "0000"
};

// INSTÄLLNINGAR
const TRASH_DAYS: number = 30;

// KATEGORIER (anteckningar)
const CATS: Record<Category, { label: string; emoji: string; color: string }> = {
  reparation: { label: "Reparation", emoji: "🔧", color: "#E8521A" },
  tvätt:      { label: "Tvätt",      emoji: "🧼", color: "#2E7DC4" },
  logistik:   { label: "Logistik",   emoji: "🚛", color: "#4CAF7D" },
  idé:        { label: "Idé",        emoji: "💡", color: "#E8A81A" },
  material:   { label: "Material",   emoji: "📦", color: "#9B59B6" },
  övrigt:     { label: "Övrigt",     emoji: "📋", color: "#6B7280" },
  intern:     { label: "Intern",     emoji: "🔒", color: "#C0392B" }
};

// Användare som får se kategorin "intern"
const INTERN_USERS: readonly string[] = ["Admin", "Andreas"];

// PRIORITETER
const PRIOS: Record<Priority, { label: string; color: string }> = {
  hög:   { label: "HÖG",   color: "#E8521A" },
  medel: { label: "MEDEL", color: "#E8A81A" },
  låg:   { label: "LÅG",   color: "#4CAF7D" }
};

// STATUS för anteckningar
const STATS: Record<NoteStatus, string> = {
  ny:     "Ny",
  pågår:  "Pågår",
  klar:   "Klar"
};

// MATERIAL-STATUSAR
const MAT_STATS: Record<MaterialStatus, { label: string; emoji: string; color: string }> = {
  okänd:       { label: "Okänd",        emoji: "❓", color: "#94A3B8" },
  tillgänglig: { label: "Tillgänglig",  emoji: "✅", color: "#4CAF7D" },
  uthyrd:      { label: "Uthyrd",       emoji: "📤", color: "#2E7DC4" },
  tvätt:       { label: "Tvätt behövs", emoji: "🧼", color: "#E8A81A" },
  reparation:  { label: "Reparation",   emoji: "🔧", color: "#E8521A" }
};

// INFO-KATEGORIER (FAQ/info-flik)
const INFO_CATS: Record<InfoCategory, { emoji: string; color: string }> = {
  "Utrustning": { emoji: "🛠", color: "#2E7DC4" },
  "Maskiner":   { emoji: "⚙️", color: "#9B59B6" },
  "Rutiner":    { emoji: "📋", color: "#4CAF7D" }
};

// TASK-STATUSAR
const TASK_STATS: Record<TaskStatus, { label: string; color: string }> = {
  ny:    { label: "Ny",    color: "#6B7280" },
  pågår: { label: "Pågår", color: "#E8A81A" },
  klar:  { label: "Klar",  color: "#4CAF7D" }
};

// ============================================================
// STATE
// Fas 4.1: All mutabel state lever nu i store.ts (appState + top-
// level aliases auth/ui/notes/materials/returns/tasks/info/chat).
// Konstanter ovan består. Dead state borttagen: pinSet, userPins
// (gamla first-time-PIN-flow är borta).
// ============================================================
