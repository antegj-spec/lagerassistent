// ============================================================
// devSeed.ts — DEV-ONLY demo-läge för visuell verifiering.
//
// Aktiveras ENDAST när URL:en innehåller ?demo (t.ex.
// http://localhost:5173/?demo). Då seedas appState med mock-data,
// PIN-skärmen hoppas över och appen renderas UTAN Supabase/realtime.
// Gör ingenting alls i normalläge — säkert att shippa, men främst
// tänkt för lokal utveckling/granskning.
//
// Laddas SIST i index.html (efter alla render/-filer och auth.ts),
// så completeLogin-stegen och alla r*-funktioner finns tillgängliga.
// ============================================================

function _demoISO(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * 3600000).toISOString();
}

function seedDemoData(): void {
  // ---- ANTECKNINGAR ----
  notes.list = [
    {
      id: 1, created_at: _demoISO(-72), text: "Kravallstaket rad 3 har trasig fot — behöver bytas före helgens event i Kungsträdgården.",
      category: "reparation", status: "pågår", priority: "hög",
      created_by: "Andreas", assigned_to: "Andreas", deadline: _demoISO(-50), material_id: 1,
    },
    {
      id: 2, created_at: _demoISO(-30), text: "Elcentral B saknar lock — beställ nytt eller flytta från reservförråd.",
      category: "logistik", status: "ny", priority: "medel",
      created_by: "Per", deadline: _demoISO(10),
    },
    {
      id: 3, created_at: _demoISO(-12), text: "Idé: märk upp alla XLR-kablar med färgtejp per längd.",
      category: "idé", status: "ny", priority: "låg", created_by: "Nicklas",
    },
    {
      id: 4, created_at: _demoISO(-5), text: "Tvätta mattorna från Globen-eventet innan de läggs tillbaka.",
      category: "tvätt", status: "ny", priority: "medel", created_by: "Andreas", deadline: _demoISO(50),
    },
    {
      id: 5, created_at: _demoISO(-200), text: "Inventera LD20-högtalare efter Way Out West.",
      category: "material", status: "klar", priority: "låg", created_by: "Andreas",
    },
  ] as Note[];
  notes.comments = {
    1: [
      { id: 11, note_id: 1, text: "Bytte ena foten, väntar på reservdel till den andra.", created_by: "Andreas", created_at: _demoISO(-20) },
      { id: 12, note_id: 1, text: "Reservdel kommer på fredag.", created_by: "Per", created_at: _demoISO(-4) },
    ],
  };

  // ---- UPPGIFTER (PLAN) ----
  tasks.list = [
    {
      id: 1, created_at: _demoISO(-100), title: "Rigga scen inför festivalhelgen", status: "pågår", priority: "hög",
      deadline: _demoISO(-30), responsible: "Andreas", assigned_to: ["Andreas", "Per"], archived: false, created_by: "Andreas",
    },
    {
      id: 2, created_at: _demoISO(-60), title: "Serva och fetta in alla pumpvagnar", status: "ny", priority: "medel",
      responsible: "Nicklas", assigned_to: ["Nicklas"], archived: false, created_by: "Admin", deadline: _demoISO(60),
    },
    {
      id: 3, created_at: _demoISO(-300), title: "Arkivera förra säsongens följesedlar", status: "klar", priority: "låg",
      archived: false, created_by: "Admin",
    },
  ] as Task[];
  tasks.comments = {
    1: [
      { id: 21, task_id: 1, text: "Halva scenen står, fortsätter imorgon bitti.", created_by: "Andreas", created_at: _demoISO(-6) } as TaskComment,
    ],
  };
  tasks.checklists = {
    1: [
      { id: 31, task_id: 1, text: "Bär ut scengolv", done: true, created_by: "Andreas", created_at: _demoISO(-30) },
      { id: 32, task_id: 1, text: "Montera ben", done: true, created_by: "Per", created_at: _demoISO(-28) },
      { id: 33, task_id: 1, text: "Lägg ut mattor", done: false, created_by: "Andreas", created_at: _demoISO(-26) },
    ],
  };

  // ---- MATERIAL (lagerräknat) ----
  materials.list = [
    { id: 1, created_at: _demoISO(-1000), name: "EPS PRO pall", is_article_based: false, emoji: "📦", unit: "st", category: "Golv", article_number: "EPS-PRO-50", total_count: 50 },
    { id: 2, created_at: _demoISO(-1000), name: "Kravallstaket", is_article_based: false, emoji: "🚧", unit: "st", category: "Staket", total_count: 176 },
  ] as Material[];
  materials.counts = {
    1: { tillgänglig: 40, uthyrd: 8, reparation: 2 },
    2: { tillgänglig: 156, uthyrd: 20 },
  };

  // ---- RETURER ----
  // Retur 1: nya rader (return_items). Retur 2: legacy fritext (content) för
  // att verifiera bakåtkompatibel visning.
  returns.list = [
    {
      id: 1, created_at: _demoISO(-24), return_date: _demoISO(-24).slice(0, 10), archived: false,
      name: "Håkan Hellström Sommarturné", received_by: "Andreas", created_by: "Andreas",
    },
    {
      id: 2, created_at: _demoISO(-120), return_date: _demoISO(-120).slice(0, 10), archived: false,
      name: "Globen — företagsevent", received_by: "Per", created_by: "Per",
      content: "8 pall EPS PRO, scengolv 30 st",
    },
  ] as Return[];
  returns.items = {
    1: [
      { id: 11, return_id: 1, material: "EPS PRO pall", quantity: "20", comment: "2 med böjd fot", sort_order: 0, created_by: "Andreas", created_at: _demoISO(-24) },
      { id: 12, return_id: 1, material: "Kabelskydd", quantity: "40 m", comment: null, sort_order: 1, created_by: "Andreas", created_at: _demoISO(-24) },
      { id: 13, return_id: 1, material: "LD20 line-array", quantity: "4", comment: "1 repig — annars ok", sort_order: 2, created_by: "Andreas", created_at: _demoISO(-24) },
      { id: 14, return_id: 1, material: "Kravallstaket", quantity: "156", comment: null, sort_order: 3, created_by: "Andreas", created_at: _demoISO(-24) },
    ],
  };

  // ---- INFO / FAQ ----
  info.articles = [
    { id: 1, created_at: _demoISO(-500), title: "Rigga LD20 line-array — steg för steg", body: "1. Häng bumpern...\n2. Koppla...\n3. Vinkla efter arenan.", category: "Utrustning", is_pinned: true, created_by: "Andreas" },
    { id: 2, created_at: _demoISO(-300), title: "Felsökning: subbas saknar signal", body: "Kontrollera XLR och förstärkarens kanal.", category: "Utrustning", is_pinned: true, created_by: "Per" },
    { id: 3, created_at: _demoISO(-20), title: "Kabelmärkning XLR — förslag på färgschema", body: "Röd = 1 m, blå = 5 m, gul = 10 m.", category: "Rutiner", is_pinned: false, created_by: "Nicklas" },
    { id: 4, created_at: _demoISO(-200), title: "Skötsel pumpvagnar", body: "Fetta in var tredje månad.", category: "Maskiner", is_pinned: true, created_by: "Admin" },
  ] as InfoArticle[];

  // ---- KÖRJOURNAL ----
  cars.list = [
    { id: "car-1", reg_nr: "ABC123", nickname: "Sprintern", active: true, created_at: _demoISO(-2000) },
    { id: "car-2", reg_nr: "DEF456", nickname: null, active: true, created_at: _demoISO(-2000) },
  ];
  const today = new Date().toISOString().slice(0, 10);
  cars.trips = [
    // Pågående (öppen) resa — visas som banner.
    {
      id: "trip-open", car_id: "car-1", driver: "Andreas", trip_date: today,
      from_loc: "Lager", to_loc: null, purpose: null, odometer_start: 84210, odometer_end: null,
      status: "open", needs_purpose: false, is_private: false, is_fueling: false, created_by: "Andreas", created_at: _demoISO(-2),
    },
    // Avslutade resor med en lucka mellan (84050 → 84097 = 47 km saknas).
    {
      id: "trip-a", car_id: "car-1", driver: "Andreas", trip_date: "2026-06-19",
      from_loc: "Lager", to_loc: "Globen", purpose: "Leverans scengolv", odometer_start: 83760, odometer_end: 84050,
      status: "closed", needs_purpose: false, is_private: false, is_fueling: true, liters: 48, total_price: 920, created_by: "Andreas", created_at: _demoISO(-40),
    },
    {
      id: "trip-b", car_id: "car-1", driver: "Per", trip_date: "2026-06-20",
      from_loc: "Verkstad", to_loc: "Lager", purpose: "Hämta verktyg", odometer_start: 84097, odometer_end: 84210,
      status: "closed", needs_purpose: false, is_private: false, is_fueling: false, created_by: "Per", created_at: _demoISO(-30),
    },
    {
      id: "trip-c", car_id: "car-2", driver: "Nicklas", trip_date: "2026-06-18",
      from_loc: null, to_loc: null, purpose: null, odometer_start: 83600, odometer_end: 83760,
      status: "closed", needs_purpose: false, is_private: true, is_fueling: false, created_by: "Nicklas", created_at: _demoISO(-60),
    },
  ];
}

function bootDemo(): void {
  if (!new URLSearchParams(location.search).has("demo")) return;

  // Fejka inloggad admin.
  auth.user = "Andreas";
  auth.isAdmin = true;

  seedDemoData();

  // Avslöja UI (samma steg som completeLogin, men UTAN initApp/realtime).
  const pinScr = document.getElementById("pin-screen");
  if (pinScr) pinScr.style.display = "none";
  const hdr = document.getElementById("main-header");
  if (hdr) hdr.style.display = "block";
  const nav = document.getElementById("main-nav");
  if (nav) nav.style.display = "flex";
  const main = document.getElementById("main");
  if (main) main.style.display = "block";
  const userDisp = document.getElementById("user-display");
  if (userDisp) userDisp.textContent = auth.user;
  const adminBtn = document.getElementById("admin-btn") as HTMLElement | null;
  if (adminBtn) adminBtn.style.display = "flex";
  const hdrMeta = document.getElementById("header-meta");
  if (hdrMeta) hdrMeta.textContent = "DEMO-LÄGE — mock-data, ingen Supabase";

  render();
  console.info("[devSeed] Demo-läge aktivt — mock-data seedad, ingen Supabase.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootDemo, { once: true });
} else {
  bootDemo();
}
