// ============================================================
// public/sw.js — Service Worker  (Fas 6.16 + 6.1)
//
// Två ansvarsområden:
//  1. Offline-stöd (cache-first för statiska assets)
//  2. Push-notifikationer (push + notificationclick events)
//
// Versionera CACHE_VERSION när du ändrar SW — gamla caches rensas
// på activate. Hot-loadar inte automatiskt mellan Vite-builds, men
// nya tabs hämtar uppdaterad version.
// ============================================================

const CACHE_VERSION = "lager-v1";

// Statiska assets som ska serveras från cache när nätet är dött.
// Vite-genererade /assets/*.css och /assets/*.js har innehållshash i
// filnamnet, så vi använder runtime-cache i stället för precache.
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/assets/logo.png",
];

// ---- INSTALL ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ---- ACTIVATE ----
// Rensa gamla cache-versioner.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH ----
// Strategi:
//  - /assets/, /js/, navigations → cache-first (snabbt, fungerar offline)
//  - /rest/v1/, /functions/v1/, /auth/v1/ → network-only (data måste vara färsk)
//  - Allt annat → network-first med cache-fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // API-anrop ska aldrig cachas
  if (
    url.pathname.startsWith("/rest/v1/") ||
    url.pathname.startsWith("/functions/v1/") ||
    url.pathname.startsWith("/auth/v1/") ||
    url.pathname.startsWith("/storage/v1/") ||
    url.host.includes("supabase.co") ||
    url.host.includes("anthropic.com") ||
    url.host.includes("netlify.app/.netlify/")
  ) {
    return; // låt default fetch hantera (network only)
  }

  // Cache-first för statiska assets + navigationsdokument
  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/js/") ||
    url.pathname === "/" ||
    url.pathname === "/index.html";

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          // Cache bara lyckade responses
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return resp;
        }).catch(() => caches.match("/index.html")); // SPA-fallback
      })
    );
    return;
  }

  // Default: network-first med cache-fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// ---- PUSH ----
// Mottar push från Edge Function 'send-push'. Visar notification.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "Lagerassistent", body: event.data?.text() || "Du har en ny påminnelse" };
  }

  const title = payload.title || "Lagerassistent";
  const options = {
    body: payload.body || "",
    icon: "/assets/logo.png",
    badge: "/assets/logo.png",
    tag: payload.tag || "lager-deadline",
    data: {
      url: payload.url || "/",
      kind: payload.kind || null,
      id: payload.id || null,
    },
    requireInteraction: payload.urgent === true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---- NOTIFICATION CLICK ----
// Öppna appen (eller fokusera befintlig tab) när användaren klickar.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Om en tab redan har appen öppen — fokusera den
      for (const client of clients) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      // Annars öppna ny tab
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    })
  );
});
