// ============================================================
// realtime.ts — Supabase Realtime subscriptions (Fas 3.5, B19)
// Beror på: config.ts, supabase.ts, auth.ts (getAuthToken, logout)
//
// Rå WebSocket mot Supabase Realtime Phoenix-protokoll. När en annan
// användare ändrar något i en prenumererad tabell laddas motsvarande
// store om (debounced) och nuvarande ui.tab re-rendereras. Inga nya
// beroenden — passar classic-script-paradigmet.
//
// Protokoll-referens:
//   wss://<ref>.supabase.co/realtime/v1/websocket?apikey=<anon>&vsn=1.0.0
//   Join:      {topic:"realtime:<tbl>",event:"phx_join",payload:{config:{...},access_token}}
//   Heartbeat: {topic:"phoenix",event:"heartbeat",payload:{},ref}
//   Receive:   {topic,event:"postgres_changes",payload:{data:{table,type,record,old_record}}}
// ============================================================

// ---- KONFIG ----
// Per tabell: vilken load*()-funktion som ska köras vid ändring,
// och vilken store-key som ska notifieras efteråt (Fas 4.1 Steg 2).
// Flera tabeller mappar mot samma store-key (loadMats laddar fyra
// tabeller i ett svep — debouncen säkerställer att vi inte gör
// fyra omladdningar i rad vid en burst).
interface RtTableEntry {
  reload: () => Promise<void>;
  storeKey: StoreKey;
}

const RT_TABLE_RELOADERS: Record<string, RtTableEntry> = {
  notes:             { reload: async () => { await loadNotes(); },   storeKey: "notes" },
  materials_v2:      { reload: async () => { await loadMats(); },    storeKey: "materials" },
  material_counts:   { reload: async () => { await loadMats(); },    storeKey: "materials" },
  material_items:    { reload: async () => { await loadMats(); },    storeKey: "materials" },
  borrowed_material: { reload: async () => { await loadMats(); },    storeKey: "materials" },
  material_allocations: { reload: async () => { await loadMats(); }, storeKey: "materials" },
  tasks:             { reload: async () => { await loadTasks(); },   storeKey: "tasks" },
  returns:           { reload: async () => { await loadReturns(); }, storeKey: "returns" },
  cars:              { reload: async () => { await loadCars(); },    storeKey: "cars" },
  car_trips:         { reload: async () => { await loadCarTrips(); },storeKey: "cars" },
  // Ekonomi: laddas bara om admin är inloggad. RLS blockerar non-admin
  // ändå men join på kanalen ger error-loggar; vi följer samma mönster
  // som övriga och förlitar oss på RLS.
  economy_entries:   { reload: async () => { await loadEconomy(); }, storeKey: "economy" }
};

// ---- STATE (modul-globalt) ----
let rtWs: WebSocket | null = null;
let rtRef = 0;
let rtHeartbeat: number | null = null;
let rtReconnectTimer: number | null = null;
let rtReconnectAttempts = 0;
let rtClosedByUs = false;
const rtDebounce: Record<string, number | null> = {};

// ---- DEBOUNCED RELOAD ----
function scheduleReload(table: string): void {
  const entry = RT_TABLE_RELOADERS[table];
  if (!entry) return;
  if (rtDebounce[table] != null) clearTimeout(rtDebounce[table]!);
  rtDebounce[table] = window.setTimeout(async () => {
    rtDebounce[table] = null;
    try {
      await entry.reload();
      // Fas 4.1 Steg 2: notifiera store-prenumeranter. render() står
      // kvar som "global subscriber" tills Block C ersätter manuella
      // render()-anrop med store.subscribe().
      notify(entry.storeKey);
      if (typeof render === "function") render();
    } catch (e) {
      console.warn("Realtime reload failed for " + table + ":", e);
    }
  }, 300);
}

// ---- LIVSCYKEL ----
function initRealtime(): void {
  // Stäng eventuell tidigare anslutning (t.ex. efter re-login utan logout)
  closeRealtimeInternal(false);

  const token = getAuthToken();
  if (token === SB_KEY) return; // inte inloggad → ingen realtime

  rtClosedByUs = false;
  const wsUrl = SB_URL.replace(/^https?:\/\//, "wss://")
    + "/realtime/v1/websocket?apikey=" + encodeURIComponent(SB_KEY)
    + "&vsn=1.0.0";

  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    console.warn("Realtime WebSocket konstruktion failed:", e);
    return;
  }
  rtWs = ws;

  ws.onopen = () => {
    rtReconnectAttempts = 0;
    // Joina en kanal per tabell
    for (const table of Object.keys(RT_TABLE_RELOADERS)) {
      const ref = String(++rtRef);
      ws.send(JSON.stringify({
        topic: "realtime:" + table,
        event: "phx_join",
        payload: {
          config: {
            postgres_changes: [{ event: "*", schema: "public", table }]
          },
          access_token: token
        },
        ref,
        join_ref: ref
      }));
    }
    // Heartbeat var 30s (Phoenix timeout är 60s)
    rtHeartbeat = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          topic: "phoenix",
          event: "heartbeat",
          payload: {},
          ref: "hb-" + (++rtRef)
        }));
      }
    }, 30000);
  };

  ws.onmessage = (e: MessageEvent) => {
    try {
      const msg = JSON.parse(e.data);
      // postgres_changes-event har payload.data.table
      if (msg?.event === "postgres_changes") {
        const table = msg.payload?.data?.table;
        if (typeof table === "string") scheduleReload(table);
      }
      // phx_reply med status=error loggas för diagnostik (t.ex. om RLS
      // blockerar prenumeration, eller om tabell saknas i publication)
      if (msg?.event === "phx_reply" && msg?.payload?.status === "error") {
        console.warn("Realtime join error:", msg.topic, msg.payload?.response);
      }
    } catch (err) {
      // Ignorera korrupt frame — heartbeat fortsätter
    }
  };

  ws.onerror = (e: Event) => {
    console.warn("Realtime ws error:", e);
  };

  ws.onclose = () => {
    if (rtHeartbeat != null) { clearInterval(rtHeartbeat); rtHeartbeat = null; }
    if (rtWs === ws) rtWs = null;
    if (rtClosedByUs) return;
    // Reconnect med exponential backoff (max ~30s, max 10 försök)
    if (rtReconnectAttempts < 10 && getAuthToken() !== SB_KEY) {
      const delay = Math.min(1000 * Math.pow(2, rtReconnectAttempts), 30000);
      rtReconnectAttempts++;
      rtReconnectTimer = window.setTimeout(initRealtime, delay);
    }
  };
}

function closeRealtime(): void {
  closeRealtimeInternal(true);
}

function closeRealtimeInternal(byUser: boolean): void {
  rtClosedByUs = byUser;
  if (rtReconnectTimer != null) { clearTimeout(rtReconnectTimer); rtReconnectTimer = null; }
  if (rtHeartbeat != null) { clearInterval(rtHeartbeat); rtHeartbeat = null; }
  if (rtWs) {
    try { rtWs.close(); } catch { /* ignore */ }
    rtWs = null;
  }
  for (const k of Object.keys(rtDebounce)) {
    if (rtDebounce[k] != null) { clearTimeout(rtDebounce[k]!); rtDebounce[k] = null; }
  }
  if (byUser) rtReconnectAttempts = 0;
}
