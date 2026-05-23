// ============================================================
// auth.ts — PIN-login, första inloggning och logout
// Beror på: config.ts, supabase.ts
// ============================================================

// ---- INITIERA ANVÄNDARVAL ----
function initUsers(): void {
  const dl = document.getElementById("username-list");
  if (dl) dl.innerHTML = USERS.map(u => `<option value="${escAttr(u)}">`).join("");
  const input = document.getElementById("username-input") as HTMLInputElement | null;
  if (input) { input.value = ""; input.focus(); }
  pinBuf = "";
  updDots();
}

function pickUser(u: string): void {
  selUser = u;
  pinBuf = "";
  updDots();
}

// ---- PIN-KNAPPAR ----
function pinPress(d: string): void {
  if (pinBuf.length >= 4) return;
  pinBuf += d;
  updDots();
  // Haptic feedback för handskar/stress (Fas 1, prio 5.10)
  if (navigator.vibrate) navigator.vibrate(20);
  if (pinBuf.length === 4) setTimeout(checkPin, 120);
}

function pinDel(): void {
  pinBuf = pinBuf.slice(0, -1);
  updDots();
}

function updDots(): void {
  document.querySelectorAll("#pin-dots .pin-dot")
    .forEach((d, i) => d.classList.toggle("filled", i < pinBuf.length));
}

// ---- KONTROLLERA PIN (Fas 1: server-side verifiering via verify-pin Edge Function) ----
function showPinError(msg: string): void {
  const errEl = document.getElementById("pin-error");
  const dotsEl = document.getElementById("pin-dots") as HTMLElement | null;
  if (errEl) errEl.textContent = msg;
  if (dotsEl) {
    dotsEl.style.animation = "none";
    void dotsEl.offsetHeight;
    dotsEl.style.animation = "pinShake .35s ease";
  }
  pinBuf = "";
  updDots();
  setTimeout(() => {
    if (errEl) errEl.textContent = "";
    if (dotsEl) dotsEl.style.animation = "";
  }, 1800);
}

interface VerifyPinResponse {
  access_token?: string;
  refresh_token?: string;
  user_name?: string;
  role?: Role;
  expires_at?: number;
  retry_after_seconds?: number;
  error?: string;
}

async function checkPin(): Promise<void> {
  const inputEl = document.getElementById("username-input") as HTMLInputElement | null;
  const typedName = inputEl ? inputEl.value.trim() : "";
  const matchedUser = USERS.find(u => u.toLowerCase() === typedName.toLowerCase());
  if (!matchedUser) {
    showPinError("Okänt användarnamn — försök igen");
    return;
  }
  selUser = matchedUser;

  // POSTa till verify-pin Edge Function — bcrypt-jämför server-side
  try {
    const r = await fetch(SB_URL + "/functions/v1/verify-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SB_KEY,
      },
      body: JSON.stringify({ user_name: matchedUser, pin: pinBuf }),
    });
    const data: VerifyPinResponse = await r.json().catch(() => ({}));

    if (r.status === 200 && data.access_token) {
      // Spara session
      sessionStorage.setItem("lager-token", data.access_token);
      sessionStorage.setItem("lager-refresh", data.refresh_token || "");
      sessionStorage.setItem("lager-user", data.user_name || "");
      sessionStorage.setItem("lager-role", data.role || "user");
      sessionStorage.setItem("lager-expires", String(data.expires_at || 0));
      user = data.user_name || null;
      isAdmin = data.role === "admin";
      // Ladda pinSet i bakgrunden så "Byt PIN"-flöden ser första-gången-läget
      loadPins().catch(() => {});
      completeLogin();
    } else if (r.status === 429) {
      const sec = data.retry_after_seconds || 300;
      const min = Math.ceil(sec / 60);
      showPinError(`Kontot låst — försök igen om ${min} min`);
    } else {
      showPinError("Fel PIN — försök igen");
    }
  } catch (e) {
    showPinError("Nätverksfel — kontrollera anslutning");
  }
}

// ---- FÖRSTA INLOGGNING — VÄLJ EGEN PIN ----
function showFirstPinScreen(): void {
  const pinScr = document.getElementById("pin-screen");
  if (pinScr) pinScr.style.display = "none";
  const s = document.getElementById("first-pin-screen");
  if (s) s.style.display = "flex";
  const nameEl = document.getElementById("first-pin-name");
  if (nameEl) nameEl.textContent = "Hej, " + user + "!";
  firstPinStep = 1;
  firstPinNew = "";
  firstPinConfirm = "";
  updFirstPinDots();
  const lblEl = document.getElementById("first-pin-step-lbl");
  if (lblEl) lblEl.textContent = "NY PIN";
  const errEl = document.getElementById("first-pin-error");
  if (errEl) errEl.textContent = "";
}

function firstPinPress(d: string): void {
  if (firstPinStep === 1) {
    if (firstPinNew.length >= 4) return;
    firstPinNew += d;
    updFirstPinDots();
    if (firstPinNew.length === 4) {
      setTimeout(() => {
        firstPinStep = 2;
        firstPinConfirm = "";
        updFirstPinDots();
        const lblEl = document.getElementById("first-pin-step-lbl");
        if (lblEl) lblEl.textContent = "BEKRÄFTA PIN";
      }, 200);
    }
  } else {
    if (firstPinConfirm.length >= 4) return;
    firstPinConfirm += d;
    updFirstPinDots();
    if (firstPinConfirm.length === 4) setTimeout(confirmFirstPin, 120);
  }
}

function firstPinDel(): void {
  if (firstPinStep === 1) firstPinNew = firstPinNew.slice(0, -1);
  else firstPinConfirm = firstPinConfirm.slice(0, -1);
  updFirstPinDots();
}

function updFirstPinDots(): void {
  const len = firstPinStep === 1 ? firstPinNew.length : firstPinConfirm.length;
  document.querySelectorAll("#first-pin-dots .pin-dot")
    .forEach((d, i) => d.classList.toggle("filled", i < len));
}

async function confirmFirstPin(): Promise<void> {
  if (firstPinNew !== firstPinConfirm) {
    const errEl = document.getElementById("first-pin-error");
    if (errEl) errEl.textContent = "PIN-koderna matchar inte — försök igen";
    firstPinStep = 1;
    firstPinNew = "";
    firstPinConfirm = "";
    updFirstPinDots();
    const lblEl = document.getElementById("first-pin-step-lbl");
    if (lblEl) lblEl.textContent = "NY PIN";
    setTimeout(() => {
      const e = document.getElementById("first-pin-error");
      if (e) e.textContent = "";
    }, 2000);
    return;
  }
  try {
    await savePin(user || "", firstPinNew, true);
    const scr = document.getElementById("first-pin-screen");
    if (scr) scr.style.display = "none";
    completeLogin();
    toast("✓ PIN satt! Välkommen, " + user);
  } catch (e) {
    const errEl = document.getElementById("first-pin-error");
    if (errEl) errEl.textContent = "Kunde inte spara PIN — försöker ändå";
    setTimeout(() => {
      const scr = document.getElementById("first-pin-screen");
      if (scr) scr.style.display = "none";
      completeLogin();
    }, 1500);
  }
}

// ---- SLUTFÖR INLOGGNING ----
function completeLogin(): void {
  // OBS: isAdmin sätts redan av checkPin/restoreSession från JWT-role,
  // INTE från user === "Admin". Behåll värdet.
  const pinScr = document.getElementById("pin-screen");
  if (pinScr) pinScr.style.display = "none";
  const fpScr = document.getElementById("first-pin-screen");
  if (fpScr) fpScr.style.display = "none";
  const hdr = document.getElementById("main-header");
  if (hdr) hdr.style.display = "block";
  const nav = document.getElementById("main-nav");
  if (nav) nav.style.display = "flex";
  const main = document.getElementById("main");
  if (main) main.style.display = "block";
  const userDisp = document.getElementById("user-display");
  if (userDisp) userDisp.textContent = user;

  // Admin-only nav-knappar
  const exportBtn = document.getElementById("export-btn") as HTMLElement | null;
  const trashBtn = document.getElementById("trash-btn") as HTMLElement | null;
  const aiBtn = document.getElementById("ai-btn") as HTMLElement | null;
  if (exportBtn) exportBtn.style.display = isAdmin ? "flex" : "none";
  if (trashBtn)  trashBtn.style.display  = isAdmin ? "flex" : "none";
  if (aiBtn)     aiBtn.style.display     = isAdmin ? "flex" : "none";

  // SÄKERHET: om current tab är admin-only och user inte är admin → fallback hem.
  // Förhindrar att t.ex. Andreas hamnar på AI-fliken om Admin var där sist.
  const ADMIN_ONLY_TABS: TabName[] = ["chat", "export", "trash"];
  if (!isAdmin && ADMIN_ONLY_TABS.includes(tab)) {
    tab = "hem";
  }

  initApp();
}

// ---- LOGGA UT ----
function logout(): void {
  // 1) Rensa session-storage (JWT, refresh, user-info)
  ["lager-token", "lager-refresh", "lager-user", "lager-role", "lager-expires"]
    .forEach(k => sessionStorage.removeItem(k));

  // 2) Rensa identity + roll
  user = null;
  isAdmin = false;

  // 3) Rensa ALL applikations-state så ingen data läcker mellan användare
  notes = [];
  materials = [];
  materialItems = {};
  materialCounts = {};
  materialHistory = {};
  borrowedMaterial = {};
  returnsList = [];
  archivedReturns = [];
  tasks = [];
  archivedTasks = [];
  taskStatusLogs = {};
  taskComments = {};
  taskChecklists = {};
  materialComments = {};
  materialItemImages = {};
  materialImages = {};
  actionComments = [];
  infoArticles = [];
  infoImages = {};
  infoComments = {};
  trashedNotes = [];
  chat = [];
  comments = {};
  userPins = {};
  pinSet = {};

  // 4) Återställ NAVIGATIONS-state (kritiskt — annars hamnar nästa
  //    inloggning på admin-flik om Admin var där sist).
  tab = "hem";
  openId = null;
  openMatId = null;
  openItemId = null;
  openTaskId = null;
  openInfoId = null;
  matSubTab = "status";
  planSubTab = "aktiva";
  planPersonFilter = "alla";
  infoEditMode = null;
  infoEditImages = [];
  searchQuery = "";
  fCat = "alla";
  fStat = "alla";
  fAssigned = "alla";
  imgData = null;
  imgFile = null;

  // 5) Pin-state
  pinBuf = "";
  firstPinStep = 1;
  firstPinNew = "";
  firstPinConfirm = "";
  updDots();

  // 6) DOM — göm appen, visa PIN-skärm
  ["main-header", "main-nav", "main"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  // Töm main-innehåll så Admin-data inte syns en frame innan nästa render
  const mainEl = document.getElementById("main");
  if (mainEl) mainEl.innerHTML = "";
  const exportBtn = document.getElementById("export-btn") as HTMLElement | null;
  const trashBtn = document.getElementById("trash-btn") as HTMLElement | null;
  const aiBtn = document.getElementById("ai-btn") as HTMLElement | null;
  if (exportBtn) exportBtn.style.display = "none";
  if (trashBtn) trashBtn.style.display = "none";
  if (aiBtn) aiBtn.style.display = "none";

  const pinScr = document.getElementById("pin-screen") as HTMLElement | null;
  if (pinScr) pinScr.style.display = "flex";
  selUser = USERS[0];
  initUsers();
  const input = document.getElementById("username-input") as HTMLInputElement | null;
  if (input) { input.value = ""; input.focus(); }
}

// ---- BYT PIN (inloggad) ----
function openChangePin(): void {
  openModal(`
    <div class="modal-title">Byt PIN</div>
    <div class="lbl">NUVARANDE PIN</div>
    <input type="password" inputmode="numeric" maxlength="4" id="cur-pin" placeholder="••••">
    <div class="lbl mt">NY PIN (4 siffror)</div>
    <input type="password" inputmode="numeric" maxlength="4" id="new-pin" placeholder="••••">
    <div class="lbl mt">BEKRÄFTA NY PIN</div>
    <input type="password" inputmode="numeric" maxlength="4" id="new-pin2" placeholder="••••">
    <div id="pin-msg" style="color:var(--accent);font-size:11px;margin-top:8px;min-height:14px"></div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()" style="flex:1">Avbryt</button>
      <button class="btn" onclick="doChangePin()" style="flex:1">Spara</button>
    </div>
  `);
  setTimeout(() => (document.getElementById("cur-pin") as HTMLInputElement | null)?.focus(), 100);
}

async function doChangePin(): Promise<void> {
  const cur  = (document.getElementById("cur-pin") as HTMLInputElement | null)?.value?.trim();
  const np   = (document.getElementById("new-pin") as HTMLInputElement | null)?.value?.trim();
  const np2  = (document.getElementById("new-pin2") as HTMLInputElement | null)?.value?.trim();
  const msg  = document.getElementById("pin-msg");
  if (!msg) return;
  if (!cur || !/^\d{4}$/.test(cur)) { msg.textContent = "Nuvarande PIN måste vara 4 siffror"; return; }
  if (!np || !/^\d{4}$/.test(np))   { msg.textContent = "Ny PIN måste vara 4 siffror"; return; }
  if (np !== np2)                   { msg.textContent = "PIN-koderna matchar inte"; return; }
  if (np === cur)                   { msg.textContent = "Ny PIN måste skilja från nuvarande"; return; }
  try {
    await changePinViaEdge(cur, np);
    if (user) pinSet[user] = true;
    closeModal();
    toast("✓ PIN ändrad");
  } catch (e) {
    const errMsg = (e as Error).message;
    msg.textContent = errMsg === "Invalid current PIN" ? "Fel nuvarande PIN" : "Kunde inte spara";
  }
}

// ---- BOOT ----
// VIKTIGT: initUsers() använder escAttr() som definieras i ui.ts (laddas EFTER
// auth.ts). Vi MÅSTE därför vänta på DOMContentLoaded innan vi anropar
// initUsers/restoreSession — då har alla scripts hunnit laddas och DOM är klar.
//
// Tidigare bugg: direkt-anrop av initUsers() kraschade på "escAttr is not
// defined" → resten av filen kördes inte → restoreSession var aldrig
// definierad → F5 hamnade alltid på PIN-skärmen.

interface JwtUserResponse {
  user_metadata?: {
    user_name?: string;
    role?: Role;
  };
  [k: string]: unknown;
}

async function restoreSession(): Promise<void> {
  const token = sessionStorage.getItem("lager-token");
  const userName = sessionStorage.getItem("lager-user");
  if (!token || !userName) return;

  try {
    const r = await fetch(SB_URL + "/auth/v1/user", {
      headers: {
        "apikey": SB_KEY,
        "Authorization": "Bearer " + token,
      },
    });
    if (!r.ok) {
      // Token ogiltig eller utgången — rensa och visa PIN-skärm
      ["lager-token", "lager-refresh", "lager-user", "lager-role", "lager-expires"]
        .forEach(k => sessionStorage.removeItem(k));
      return;
    }
    // Token är giltig — läs identity från svaret (källan till sanning),
    // INTE från sessionStorage (kan ha trasslats).
    const u: JwtUserResponse = await r.json();
    const claimUser = u?.user_metadata?.user_name;
    const claimRole = u?.user_metadata?.role;

    if (!claimUser) {
      // Token utan claims → korrupt session, rensa
      ["lager-token", "lager-refresh", "lager-user", "lager-role", "lager-expires"]
        .forEach(k => sessionStorage.removeItem(k));
      return;
    }

    user = claimUser;
    isAdmin = claimRole === "admin";
    // Uppdatera sessionStorage så den matchar JWT-claims
    sessionStorage.setItem("lager-user", claimUser);
    sessionStorage.setItem("lager-role", claimRole || "user");

    loadPins().catch(() => {});
    completeLogin();
  } catch (e) {
    // Nätverksfel vid restore — visa PIN-skärm tyst, användaren får logga in på nytt
    console.warn("Session-restore failed:", e);
  }
}

// Boot — vänta tills alla scripts laddats och DOM är klar.
// Om DOM redan är klar (script kommer sist i body), kör direkt på nästa tick.
function boot(): void {
  initUsers();
  restoreSession();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  // DOM redan klar (våra scripts ligger i botten av body)
  setTimeout(boot, 0);
}
