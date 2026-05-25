// ============================================================
// actions/push.ts — Web Push subscription-flöde (Fas 6.1)
// Beror på: supabase.ts (sb), store.ts (auth), ui.ts (toast,
//   confirmModal)
//
// Tre operationer:
//   enablePush()  — opt-in via gear-meny: be om permission,
//                   subscribe via PushManager, POSTa subscription
//                   till Edge Function save-push-subscription.
//   disablePush() — unsubscribe + DELETE rad i DB.
//   isPushEnabled() — true om current SW har aktiv subscription.
//
// VAPID-public-key hämtas via Edge Function get-vapid-public-key
// så vi inte behöver hårdkoda i frontend (eller re-deploya när
// nyckeln roteras).
// ============================================================

// urlBase64 (RFC 4648 §5) → Uint8Array. Web Push-spec kräver det
// här formatet för applicationServerKey.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const padded = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// ArrayBuffer → urlBase64 (för p256dh + auth-keys vid POST).
function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return sub != null;
}

async function getVapidPublicKey(): Promise<string> {
  const r = await sb<{ key: string }>("/functions/v1/get-vapid-public-key", {
    method: "GET",
  });
  if (!r || !r.key) throw new Error("VAPID public key saknas på servern");
  return r.key;
}

async function enablePush(): Promise<void> {
  if (!pushSupported()) {
    toast("Din webbläsare stöder inte push-notiser", 1);
    return;
  }

  if (Notification.permission === "denied") {
    toast("Notiser är blockerade i webbläsarens inställningar. Aktivera där först.", 1);
    return;
  }

  // Be om permission (no-op om redan 'granted')
  const perm = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  if (perm !== "granted") {
    toast("Notiser nekade", 1);
    return;
  }

  let reg: ServiceWorkerRegistration | undefined;
  try {
    reg = await navigator.serviceWorker.ready;
  } catch (e) {
    toast("Service Worker ej registrerad", 1);
    return;
  }

  try {
    const vapidPublicKey = await getVapidPublicKey();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // PushManager.subscribe's typing kräver BufferSource — Uint8Array.buffer
      // matchar ArrayBuffer-konstrueringen.
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
    });

    // POSTa subscription till backend
    const json = sub.toJSON();
    await sb("/functions/v1/save-push-subscription", {
      method: "POST",
      body: JSON.stringify({
        user_name: auth.user || "",
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh || arrayBufferToBase64(sub.getKey("p256dh")),
        auth: json.keys?.auth || arrayBufferToBase64(sub.getKey("auth")),
        user_agent: navigator.userAgent,
      }),
    });
    toast("🔔 Notiser aktiverade");
  } catch (e) {
    toast("Kunde inte aktivera notiser: " + (e as Error).message, 1);
  }
}

async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  if (!await confirmModal("Stäng av push-notiser på denna enhet?", { confirmLabel: "Stäng av" })) return;

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      // Radera från backend FÖRST så vi inte lämnar dangling rader om unsubscribe failar
      try {
        await sb("/functions/v1/save-push-subscription", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      } catch (e) { /* best-effort */ }
      await sub.unsubscribe();
    }
    toast("🔕 Notiser avstängda");
  } catch (e) {
    toast("Kunde inte stänga av: " + (e as Error).message, 1);
  }
}

// Toggle från gear-menyn. Visar lämpligt label baserat på current state.
async function togglePush(): Promise<void> {
  const enabled = await isPushEnabled();
  if (enabled) {
    await disablePush();
  } else {
    await enablePush();
  }
  // Uppdatera meny-label så användaren ser nytt state
  if (typeof updatePushMenuLabel === "function") void updatePushMenuLabel();
}

// Uppdaterar gear-menyns label ("Aktivera" / "Stäng av") så det
// matchar nuvarande subscription-state.
async function updatePushMenuLabel(): Promise<void> {
  const btn = document.getElementById("hdr-gear-push-btn");
  if (!btn) return;
  if (!pushSupported()) {
    btn.style.display = "none";
    return;
  }
  const enabled = await isPushEnabled();
  btn.textContent = enabled ? "🔕 Stäng av notiser" : "🔔 Aktivera notiser";
}
