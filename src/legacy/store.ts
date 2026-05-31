// ============================================================
// store.ts — App-state som ett enda objekt, grupperat per domän
// Beror på: config.ts (USERS, TabName etc.)
//
// Fas 4.1: Ersätter de ~30 top-level `let` i config.ts med ett
// strukturerat `appState`. Top-level aliases (auth/ui/notes/...)
// låter andra filer skriva `notes.list = ...` istället för
// `appState.notes.list = ...`. Aliases är `const` — själva
// objektreferensen är immutabel, men properties muteras fritt.
//
// Fas 4.1 (Steg 2): subscribe()/notify()-API läggs till för att
// förbereda granular render i Steg 6. Inga consumers ännu förutom
// realtime.ts.
//
// Dead state som tagits bort härifrån: `pinSet`, `userPins`
// (gamla first-time-PIN-flow är borta).
// ============================================================

// ---- DOMÄN-INTERFACES ----

interface AuthState {
  user: string | null;
  isAdmin: boolean;
}

interface UiState {
  mainTab: MainTabName;
  tab: TabName;
  fCat: string;
  fStat: string;
  fAssigned: string;
  searchQuery: string;
  loading: boolean;
  matSubTab: "status" | "returer" | "åtgärder";
  // Material-listan: basis-flik (lagerräknat/artikelbaserat), kategori-filter
  // (NULL = Alla, "" = Okategoriserad) och fritextsök.
  matBasis: "count" | "article";
  matCatFilter: string | null;
  matSearch: string;
  planSubTab: "aktiva" | "arkiv";
  planPersonFilter: string;
  pinBuf: string;
  selUser: string;
  firstPinStep: 1 | 2;
  firstPinNew: string;
  firstPinConfirm: string;
  imgData: string | null;
  imgFile: File | null;
  // Fas 3.6 (B14): kommentar-bild-upload-staging.
  matCommentImgUrl: string | null;
  itemCommentImgUrl: string | null;
  infoCommentImgUrl: string | null;
}

interface NotesState {
  list: Note[];
  trashed: Note[];
  comments: Record<number, NoteComment[]>;
  openId: number | null;
}

interface MaterialsState {
  list: Material[];                                       // materials_v2 (alla material)
  items: Record<number, MaterialItem[]>;                  // { materialId: [items] }
  counts: Record<number, Partial<Record<MaterialStatus, number>>>;
  history: Record<number, MaterialHistory[]>;             // laddas vid behov
  borrowed: Record<number, BorrowedMaterial[]>;
  comments: Record<number, MaterialComment[]>;            // item_id null = materialkommentar, annars artikelkommentar
  images: Record<number, MaterialImage[]>;
  itemImages: Record<number, MaterialItemImage[]>;
  actionComments: MaterialComment[];                      // material_comments med status 'åtgärd_krävs'
  openId: number | null;
  openItemId: number | null;
}

interface ReturnsState {
  list: Return[];                                         // Aktiva returer (ej arkiverade)
  archived: Return[];                                     // Arkiverade returer (admin)
}

interface TasksState {
  list: Task[];                                           // Aktiva uppgifter
  archived: Task[];                                       // Arkiverade uppgifter (admin)
  statusLogs: Record<number, TaskStatusLog[]>;
  comments: Record<number, TaskComment[]>;
  checklists: Record<number, TaskChecklistItem[]>;
  infoLinks: Record<number, number[]>;                    // task_id → [info_article_id]
  openId: number | null;
}

interface InfoState {
  articles: InfoArticle[];
  images: Record<number, InfoImage[]>;
  pdfs: Record<number, InfoPdf[]>;
  comments: Record<number, InfoComment[]>;
  openId: number | null;
  editMode: null | "new" | "edit";
  editImages: string[];                                   // bild-urls under redigering
  editPdfs: { url: string; name: string }[];              // PDF:er under redigering
}

interface ChatState {
  list: ChatMessage[];
}

interface CarsState {
  list: Car[];
  trips: CarTrip[];
}

interface EconomyState {
  entries: EconomyEntry[];
  year: number;
  categoryFilter: string;     // "alla" eller en kategori-id
}

interface AppState {
  auth: AuthState;
  ui: UiState;
  notes: NotesState;
  materials: MaterialsState;
  returns: ReturnsState;
  tasks: TasksState;
  info: InfoState;
  chat: ChatState;
  cars: CarsState;
  economy: EconomyState;
}

// ---- CANONICAL STATE ----

const appState: AppState = {
  auth: {
    user: null,
    isAdmin: false,
  },
  ui: {
    mainTab: "hem",
    tab: "hem",
    fCat: "alla",
    fStat: "alla",
    fAssigned: "alla",
    searchQuery: "",
    loading: false,
    matSubTab: "status",
    matBasis: "count",
    matCatFilter: null,
    matSearch: "",
    planSubTab: "aktiva",
    planPersonFilter: "alla",
    pinBuf: "",
    selUser: USERS[0],
    firstPinStep: 1,
    firstPinNew: "",
    firstPinConfirm: "",
    imgData: null,
    imgFile: null,
    matCommentImgUrl: null,
    itemCommentImgUrl: null,
    infoCommentImgUrl: null,
  },
  notes: {
    list: [],
    trashed: [],
    comments: {},
    openId: null,
  },
  materials: {
    list: [],
    items: {},
    counts: {},
    history: {},
    borrowed: {},
    comments: {},
    images: {},
    itemImages: {},
    actionComments: [],
    openId: null,
    openItemId: null,
  },
  returns: {
    list: [],
    archived: [],
  },
  tasks: {
    list: [],
    archived: [],
    statusLogs: {},
    comments: {},
    checklists: {},
    infoLinks: {},
    openId: null,
  },
  info: {
    articles: [],
    images: {},
    pdfs: {},
    comments: {},
    openId: null,
    editMode: null,
    editImages: [],
    editPdfs: [],
  },
  chat: {
    list: [],
  },
  cars: {
    list: [],
    trips: [],
  },
  economy: {
    entries: [],
    year: new Date().getFullYear(),
    categoryFilter: "alla",
  },
};

// ---- TOP-LEVEL ALIASES ----
// Objekt-referenser till varje domän. `const` betyder att aliaset självt
// inte kan omtilldelas (`notes = newObj` är förbjudet), men properties
// muteras fritt (`notes.list = newArr` skriver via referensen tillbaka
// till appState).

const auth = appState.auth;
const ui = appState.ui;
const notes = appState.notes;
const materials = appState.materials;
const returns = appState.returns;
const tasks = appState.tasks;
const info = appState.info;
const chat = appState.chat;
const cars = appState.cars;
const economy = appState.economy;

// ---- RESET HELPERS ----
// Anropas av logout() för att rensa state mellan användare.

function resetAppState(): void {
  // Notes
  notes.list = [];
  notes.trashed = [];
  notes.comments = {};
  notes.openId = null;
  // Materials
  materials.list = [];
  materials.items = {};
  materials.counts = {};
  materials.history = {};
  materials.borrowed = {};
  materials.comments = {};
  materials.images = {};
  materials.itemImages = {};
  materials.actionComments = [];
  materials.openId = null;
  materials.openItemId = null;
  // Returns
  returns.list = [];
  returns.archived = [];
  // Tasks
  tasks.list = [];
  tasks.archived = [];
  tasks.statusLogs = {};
  tasks.comments = {};
  tasks.checklists = {};
  tasks.infoLinks = {};
  tasks.openId = null;
  // Info
  info.articles = [];
  info.images = {};
  info.pdfs = {};
  info.comments = {};
  info.openId = null;
  info.editMode = null;
  info.editImages = [];
  info.editPdfs = [];
  // Chat
  chat.list = [];
  // Cars (Fas 8 Etapp B)
  cars.list = [];
  cars.trips = [];
  // Economy (Fas 8 Etapp C)
  economy.entries = [];
  economy.year = new Date().getFullYear();
  economy.categoryFilter = "alla";
}

function resetUiState(): void {
  ui.mainTab = "hem";
  ui.tab = "hem";
  ui.fCat = "alla";
  ui.fStat = "alla";
  ui.fAssigned = "alla";
  ui.searchQuery = "";
  ui.loading = false;
  ui.matSubTab = "status";
  ui.matBasis = "count";
  ui.matCatFilter = null;
  ui.matSearch = "";
  ui.planSubTab = "aktiva";
  ui.planPersonFilter = "alla";
  ui.pinBuf = "";
  ui.firstPinStep = 1;
  ui.firstPinNew = "";
  ui.firstPinConfirm = "";
  ui.imgData = null;
  ui.imgFile = null;
  ui.matCommentImgUrl = null;
  ui.itemCommentImgUrl = null;
  ui.infoCommentImgUrl = null;
  // OBS: selUser nollställs separat (`ui.selUser = USERS[0]`) i logout
}

// ============================================================
// PUB/SUB — reactive store-API (Fas 4.1 Steg 2)
//
// Mutationer i appState fortsätter ske direkt från supabase.ts/
// actions.ts. Den här kanalen meddelar bara intresserade prenumeranter
// EFTER en mutation. Hittills enda consumer: render() via realtime.ts.
// Steg 6 (Block C) byter manuella render()-anrop mot subscribers.
// ============================================================

type StoreKey = "notes" | "materials" | "returns" | "tasks"
              | "info" | "chat" | "auth" | "ui" | "cars" | "economy";
type StoreListener = () => void;

const _storeListeners: Partial<Record<StoreKey, Set<StoreListener>>> = {};

function subscribe(key: StoreKey, cb: StoreListener): () => void {
  let set = _storeListeners[key];
  if (!set) { set = new Set(); _storeListeners[key] = set; }
  set.add(cb);
  return () => { _storeListeners[key]?.delete(cb); };
}

function notify(key: StoreKey): void {
  const set = _storeListeners[key];
  if (!set) return;
  set.forEach(cb => {
    try { cb(); }
    catch (e) { console.warn("store listener for " + key + " threw:", e); }
  });
}

// ============================================================
// OPTIMISTIC — local-first updates med rollback (Fas 4.6)
//
// Mönster: ändra appState lokalt, notifiera (så UI patchar
// omedelbart), kör API i bakgrunden, rollback + notify igen
// vid fel. Försnabbar uppfattat svar från ~300ms till <50ms
// på single-user-actions (status-byte, toggle, etc.).
//
// Begränsning: race med realtime mellan apply och api. Om en
// annan användare ändrar samma rad just nu, har vi en kort
// inconsistency-fönster. Acceptabelt — vid nästa realtime-
// reload synkar vi om ändå.
//
// Användning:
//   await optimistic({
//     apply: () => {
//       const prev = notes.list;
//       notes.list = notes.list.map(n => n.id === id ? {...n, status} : n);
//       return prev;                       // snapshot för rollback
//     },
//     rollback: (prev) => { notes.list = prev; },
//     api: () => saveNote({ id, status }),
//     storeKey: "notes",                   // triggas vid både apply OCH rollback
//   });
// ============================================================

interface OptimisticArgs<T> {
  apply: () => T;
  rollback: (snapshot: T) => void;
  api: () => Promise<unknown>;
  storeKey: StoreKey;
  errorToast?: string;
}

async function optimistic<T>(args: OptimisticArgs<T>): Promise<void> {
  const snapshot = args.apply();
  notify(args.storeKey);
  try {
    await args.api();
  } catch (e) {
    args.rollback(snapshot);
    notify(args.storeKey);
    if (typeof toast === "function") {
      toast(args.errorToast ?? "Misslyckades — ångrat", 1);
    }
    // Re-throw så callsite kan logga eller hantera vidare.
    throw e;
  }
}
