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
  reparation:  { label: "Reparation",   emoji: "🔧", color: "#E8521A" },
  // Fas 6.5: Reserverad till framtida event/kund. reserved_for fångar målet.
  reserverad:  { label: "Reserverad",   emoji: "📌", color: "#9B59B6" }
};

// INFO-KATEGORIER (FAQ/info-flik)
const INFO_CATS: Record<InfoCategory, { emoji: string; color: string }> = {
  "Utrustning":        { emoji: "🛠", color: "#2E7DC4" },
  "Maskiner":          { emoji: "⚙️", color: "#9B59B6" },
  "Rutiner":           { emoji: "📋", color: "#4CAF7D" },
  "Platser och Arenor": { emoji: "📍", color: "#E0772D" },
  "Material":          { emoji: "📦", color: "#C0392B" }
};

// TASK-STATUSAR
const TASK_STATS: Record<TaskStatus, { label: string; color: string }> = {
  ny:    { label: "Ny",    color: "#6B7280" },
  pågår: { label: "Pågår", color: "#E8A81A" },
  klar:  { label: "Klar",  color: "#4CAF7D" }
};

// ============================================================
// EKONOMI (Fas 8 Etapp C) — utgiftskategorier
// Hardcoded — speglar Excel-filen (Utgifter 2026.xlsx). Lägg till
// nya kategorier genom att utöka denna array + EconomyCategory-typen.
// ============================================================

interface EconomyCategoryDef {
  id: EconomyCategory;
  label: string;
  emoji: string;
}

const ECONOMY_CATEGORIES: readonly EconomyCategoryDef[] = [
  { id: "lunchrum",         label: "Lunchrum, kontor & omkläd.", emoji: "🍽" },
  { id: "övrigt",           label: "Övrigt",                      emoji: "📋" },
  { id: "personal",         label: "Personal",                    emoji: "👥" },
  { id: "vatten_tvätt",     label: "Vatten & tvätt",              emoji: "💧" },
  { id: "knickmop",         label: "Knickmop",                    emoji: "🧹" },
  { id: "verkstad_verktyg", label: "Verkstad & verktyg",          emoji: "🔧" },
  { id: "lagerutbyggnad",   label: "Lagerutbyggnad",              emoji: "🏗" },
  { id: "reparation",       label: "Reparation",                  emoji: "🛠" }
];

function economyCategoryLabel(id: string): string {
  return ECONOMY_CATEGORIES.find(c => c.id === id)?.label || id;
}
function economyCategoryEmoji(id: string): string {
  return ECONOMY_CATEGORIES.find(c => c.id === id)?.emoji || "📋";
}

// ============================================================
// NAVIGATION (Fas 7) — main-tabs + sub-tabs
// 5 main-grupper i top-nav. Varje grupp har en lista sub-tabs.
// Den första sub-tabben är default när man klickar main-knappen.
// `adminOnly` på en grupp döljer hela gruppen för icke-admin.
// `adminOnly` på en enskild sub-tab döljer bara den chippen.
// ============================================================

interface SubTabDef {
  id: TabName;
  label: string;
  emoji: string;
  adminOnly?: boolean;
}

interface MainTabDef {
  id: MainTabName;
  label: string;
  adminOnly?: boolean;
  subTabs: SubTabDef[];
}

const MAIN_TABS: readonly MainTabDef[] = [
  {
    id: "hem",
    label: "Hem",
    subTabs: [
      { id: "hem", label: "Hem", emoji: "🏠" }
    ]
  },
  {
    id: "arbete",
    label: "Arbete",
    subTabs: [
      { id: "anteckningar", label: "Noter", emoji: "📝" },
      { id: "plan",         label: "Plan",  emoji: "📋" }
    ]
  },
  {
    id: "lager",
    label: "Lager",
    subTabs: [
      { id: "material", label: "Material", emoji: "📦" },
      { id: "returer",  label: "Returer",  emoji: "↩" }
    ]
  },
  {
    id: "drift",
    label: "Drift",
    subTabs: [
      { id: "körjournal", label: "Körjournal", emoji: "🚗" },
      { id: "info",       label: "Info",       emoji: "ℹ" }
    ]
  },
  {
    id: "admin",
    label: "Admin",
    adminOnly: true,
    subTabs: [
      { id: "dashboard", label: "Dashboard", emoji: "📊" },
      { id: "export",    label: "Export",    emoji: "📤" },
      { id: "chat",      label: "AI",        emoji: "🤖" },
      { id: "ekonomi",   label: "Ekonomi",   emoji: "💰" },
      { id: "trash",     label: "Papper",    emoji: "🗑" }
    ]
  }
];

// Reverse-mapping från sub-tab → main-tab. Genereras en gång vid load.
const TAB_TO_MAIN: Record<TabName, MainTabName> = (() => {
  const map = {} as Record<TabName, MainTabName>;
  for (const main of MAIN_TABS) {
    for (const sub of main.subTabs) {
      map[sub.id] = main.id;
    }
  }
  return map;
})();

// Snabb-lookup: är denna tab admin-only? (via dess main-grupp eller egen flagga)
function isTabAdminOnly(t: TabName): boolean {
  const main = MAIN_TABS.find(m => m.id === TAB_TO_MAIN[t]);
  if (!main) return false;
  if (main.adminOnly) return true;
  const sub = main.subTabs.find(s => s.id === t);
  return !!sub?.adminOnly;
}

// ============================================================
// STATE
// Fas 4.1: All mutabel state lever nu i store.ts (appState + top-
// level aliases auth/ui/notes/materials/returns/tasks/info/chat).
// Konstanter ovan består. Dead state borttagen: pinSet, userPins
// (gamla first-time-PIN-flow är borta).
// ============================================================
