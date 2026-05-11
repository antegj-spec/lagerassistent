// ============================================================
// config.js — Konstanter, kategorier, prioriteter och state
// Laddas ALLTID FÖRST. Alla andra JS-filer beror på denna.
// ============================================================

// SUPABASE-ANSLUTNING
const SB_URL = "https://tzidalknfoumoknhsetx.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6aWRhbGtuZm91bW9rbmhzZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTE1NjgsImV4cCI6MjA5Mjk2NzU2OH0.bqyMhiCK34gws-WKyYH0zBKAPPytywMJMuA9fL3-4cY";

// ANVÄNDARE
const USERS = ["Admin", "Andreas", "Nicklas", "Per", "Johannes"];
const DEFAULT_PINS = {
  "Admin":    "0987",
  "Andreas":  "0000",
  "Nicklas":  "0000",
  "Per":      "0000",
  "Johannes": "0000"
};

// INSTÄLLNINGAR
const TRASH_DAYS = 30;

// KATEGORIER (anteckningar)
const CATS = {
  reparation: { label: "Reparation", emoji: "🔧", color: "#E8521A" },
  tvätt:      { label: "Tvätt",      emoji: "🧼", color: "#2E7DC4" },
  logistik:   { label: "Logistik",   emoji: "🚛", color: "#4CAF7D" },
  idé:        { label: "Idé",        emoji: "💡", color: "#E8A81A" },
  material:   { label: "Material",   emoji: "📦", color: "#9B59B6" },
  övrigt:     { label: "Övrigt",     emoji: "📋", color: "#6B7280" }
};

// PRIORITETER
const PRIOS = {
  hög:   { label: "HÖG",   color: "#E8521A" },
  medel: { label: "MEDEL", color: "#E8A81A" },
  låg:   { label: "LÅG",   color: "#4CAF7D" }
};

// STATUS för anteckningar
const STATS = {
  ny:     "Ny",
  pågår:  "Pågår",
  klar:   "Klar"
};

// MATERIAL-STATUSAR
const MAT_STATS = {
  tillgänglig: { label: "Tillgänglig",  emoji: "✅", color: "#4CAF7D" },
  uthyrd:      { label: "Uthyrd",       emoji: "📤", color: "#2E7DC4" },
  tvätt:       { label: "Tvätt behövs", emoji: "🧼", color: "#E8A81A" },
  reparation:  { label: "Reparation",   emoji: "🔧", color: "#E8521A" }
};

// TASK-STATUSAR
const TASK_STATS = {
  ny:    { label: "Ny",    color: "#6B7280" },
  pågår: { label: "Pågår", color: "#E8A81A" },
  klar:  { label: "Klar",  color: "#4CAF7D" }
};

// ============================================================
// STATE — appens aktiva data (ändras under körning)
// ============================================================
let user       = null;
let isAdmin    = false;
let tab        = "hem";
let notes      = [];
let materials  = [];          // materials_v2 (alla material)
let materialItems = {};       // { materialId: [{id, article_id, status, ...}] }
let materialCounts = {};      // { materialId: { tillgänglig: 5, uthyrd: 2, ... } }
let materialHistory = {};     // { materialId: [{...}] } — laddas vid behov
let borrowedMaterial = {};    // { materialId: [{...inhyrt}] }
let returnsList = [];         // Returer (ej arkiverade) — heter "returnsList" pga "returns" är reserved
let archivedReturns = [];     // Arkiverade returer (admin)
let tasks      = [];          // Aktiva uppgifter
let archivedTasks = [];       // Arkiverade uppgifter (admin)
let taskStatusLogs = {};      // { taskId: [{...}] }
let taskComments = {};        // { taskId: [{...}] }
let materialComments = {};    // { matId: [{...}] } — item_id null = materialkommentar, annars artikelkommentar
let openItemId = null;        // ID på den artikel vars kommentarer är öppna
let trashedNotes = [];
let chat       = [];
let openId     = null;
let comments   = {};

// FILTER & SÖK
let fCat       = "alla";
let fStat      = "alla";
let fAssigned  = "alla";
let searchQuery = "";
let loading    = false;

// MATERIAL-VY STATE
let matSubTab   = "status";   // "status" | "returer"
let openMatId   = null;       // ID på det material vars detaljvy är öppen

// PLAN-VY STATE
let planSubTab  = "aktiva";   // "aktiva" | "arkiv"
let openTaskId  = null;       // ID på den uppgift som är expanderad

// PIN-STATE
let pinBuf     = "";
let selUser    = USERS[0];
let userPins   = {};
let pinSet     = {};

// BILD-STATE
let imgData    = null;
let imgFile    = null;

// FÖRSTA INLOGGNING
let firstPinStep    = 1;
let firstPinNew     = "";
let firstPinConfirm = "";
