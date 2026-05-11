// ============================================================
// auth.js — PIN-login, första inloggning och logout
// Beror på: config.js, supabase.js
// ============================================================

// ---- INITIERA ANVÄNDARVAL ----
function initUsers() {
  const dl = document.getElementById("username-list");
  if (dl) dl.innerHTML = USERS.map(u => `<option value="${escAttr(u)}">`).join("");
  const input = document.getElementById("username-input");
  if (input) { input.value = ""; input.focus(); }
  pinBuf = "";
  updDots();
}

function pickUser(u) {
  selUser = u;
  pinBuf = "";
  updDots();
}

// ---- PIN-KNAPPAR ----
function pinPress(d) {
  if (pinBuf.length >= 4) return;
  pinBuf += d;
  updDots();
  if (pinBuf.length === 4) setTimeout(checkPin, 120);
}

function pinDel() {
  pinBuf = pinBuf.slice(0, -1);
  updDots();
}

function updDots() {
  document.querySelectorAll("#pin-dots .pin-dot")
    .forEach((d, i) => d.classList.toggle("filled", i < pinBuf.length));
}

// ---- KONTROLLERA PIN ----
async function checkPin() {
  const inputEl = document.getElementById("username-input");
  const typedName = inputEl ? inputEl.value.trim() : "";
  const matchedUser = USERS.find(u => u.toLowerCase() === typedName.toLowerCase());
  if (!matchedUser) {
    document.getElementById("pin-error").textContent = "Okänt användarnamn — försök igen";
    pinBuf = "";
    updDots();
    setTimeout(() => document.getElementById("pin-error").textContent = "", 1800);
    return;
  }
  selUser = matchedUser;
  if (Object.keys(userPins).length === 0) await loadPins();
  const correctPin = userPins[selUser] || DEFAULT_PINS[selUser];
  if (pinBuf === correctPin) {
    user = selUser;
    // Visa PIN-setup om användaren inte satt en egen PIN än
    const needsFirstPin = !pinSet[selUser];
    if (needsFirstPin && user !== "Admin") {
      showFirstPinScreen();
    } else {
      completeLogin();
    }
  } else {
    const errEl = document.getElementById("pin-error");
    const dotsEl = document.getElementById("pin-dots");
    errEl.textContent = "Fel PIN — försök igen";
    dotsEl.style.animation = "none";
    dotsEl.offsetHeight;
    dotsEl.style.animation = "pinShake .35s ease";
    pinBuf = "";
    updDots();
    setTimeout(() => { errEl.textContent = ""; dotsEl.style.animation = ""; }, 1800);
  }
}

// ---- FÖRSTA INLOGGNING — VÄLJ EGEN PIN ----
function showFirstPinScreen() {
  document.getElementById("pin-screen").style.display = "none";
  const s = document.getElementById("first-pin-screen");
  s.style.display = "flex";
  document.getElementById("first-pin-name").textContent = "Hej, " + user + "!";
  firstPinStep = 1;
  firstPinNew = "";
  firstPinConfirm = "";
  updFirstPinDots();
  document.getElementById("first-pin-step-lbl").textContent = "NY PIN";
  document.getElementById("first-pin-error").textContent = "";
}

function firstPinPress(d) {
  if (firstPinStep === 1) {
    if (firstPinNew.length >= 4) return;
    firstPinNew += d;
    updFirstPinDots();
    if (firstPinNew.length === 4) {
      setTimeout(() => {
        firstPinStep = 2;
        firstPinConfirm = "";
        updFirstPinDots();
        document.getElementById("first-pin-step-lbl").textContent = "BEKRÄFTA PIN";
      }, 200);
    }
  } else {
    if (firstPinConfirm.length >= 4) return;
    firstPinConfirm += d;
    updFirstPinDots();
    if (firstPinConfirm.length === 4) setTimeout(confirmFirstPin, 120);
  }
}

function firstPinDel() {
  if (firstPinStep === 1) firstPinNew = firstPinNew.slice(0, -1);
  else firstPinConfirm = firstPinConfirm.slice(0, -1);
  updFirstPinDots();
}

function updFirstPinDots() {
  const len = firstPinStep === 1 ? firstPinNew.length : firstPinConfirm.length;
  document.querySelectorAll("#first-pin-dots .pin-dot")
    .forEach((d, i) => d.classList.toggle("filled", i < len));
}

async function confirmFirstPin() {
  if (firstPinNew !== firstPinConfirm) {
    document.getElementById("first-pin-error").textContent = "PIN-koderna matchar inte — försök igen";
    firstPinStep = 1;
    firstPinNew = "";
    firstPinConfirm = "";
    updFirstPinDots();
    document.getElementById("first-pin-step-lbl").textContent = "NY PIN";
    setTimeout(() => document.getElementById("first-pin-error").textContent = "", 2000);
    return;
  }
  try {
    await savePin(user, firstPinNew, true);
    document.getElementById("first-pin-screen").style.display = "none";
    completeLogin();
    toast("✓ PIN satt! Välkommen, " + user);
  } catch (e) {
    document.getElementById("first-pin-error").textContent = "Kunde inte spara PIN — försöker ändå";
    setTimeout(() => {
      document.getElementById("first-pin-screen").style.display = "none";
      completeLogin();
    }, 1500);
  }
}

// ---- SLUTFÖR INLOGGNING ----
function completeLogin() {
  isAdmin = user === "Admin";
  document.getElementById("pin-screen").style.display = "none";
  document.getElementById("first-pin-screen").style.display = "none";
  document.getElementById("main-header").style.display = "block";
  document.getElementById("main-nav").style.display = "flex";
  document.getElementById("main").style.display = "block";
  document.getElementById("user-display").textContent = user;
  if (isAdmin) {
    document.getElementById("export-btn").style.display = "flex";
    document.getElementById("trash-btn").style.display = "flex";
  }
  initApp();
}

// ---- LOGGA UT ----
function logout() {
  user = null;
  isAdmin = false;
  pinBuf = "";
  notes = [];
  materials = [];
  trashedNotes = [];
  chat = [];
  comments = {};
  firstPinStep = 1;
  firstPinNew = "";
  firstPinConfirm = "";
  updDots();
  ["main-header", "main-nav", "main"].forEach(id =>
    document.getElementById(id).style.display = "none"
  );
  document.getElementById("export-btn").style.display = "none";
  document.getElementById("trash-btn").style.display = "none";
  document.getElementById("pin-screen").style.display = "flex";
  selUser = USERS[0];
  initUsers();
  const input = document.getElementById("username-input");
  if (input) { input.value = ""; input.focus(); }
}

// ---- BYT PIN (inloggad) ----
function openChangePin() {
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
  setTimeout(() => document.getElementById("cur-pin")?.focus(), 100);
}

async function doChangePin() {
  const cur  = document.getElementById("cur-pin")?.value;
  const np   = document.getElementById("new-pin")?.value;
  const np2  = document.getElementById("new-pin2")?.value;
  const msg  = document.getElementById("pin-msg");
  if (cur !== (userPins[user] || DEFAULT_PINS[user])) { msg.textContent = "Fel nuvarande PIN"; return; }
  if (!np || np.length !== 4 || !/^\d{4}$/.test(np)) { msg.textContent = "Ny PIN måste vara 4 siffror"; return; }
  if (np !== np2) { msg.textContent = "PIN-koderna matchar inte"; return; }
  try {
    await savePin(user, np, true);
    closeModal();
    toast("✓ PIN ändrad");
  } catch (e) {
    msg.textContent = "Kunde inte spara";
  }
}

// ---- BOOT ----
loadPins().then(() => initUsers());
