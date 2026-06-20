// ============================================================
// main.js — Vite entrypoint (Fas 2.1)
//
// I Fas 2.1 hanterar Vite bara HTML + CSS. Legacy-JS-filerna
// ligger i public/js/ och laddas via klassiska <script>-taggar
// i index.html — exakt som tidigare (paritet).
//
// Fas 2.3 flyttar dem hit till src/legacy/ och gör dem till
// ES modules. Fas 2.6–2.11 konverterar dem till TypeScript.
// ============================================================

import '../style.css';

// Fas 6.16: registrera Service Worker för offline-stöd + push.
// Tysta fel — appen funkar utan SW, bara utan push/offline.
// Hoppa över i demo-läge (?demo) så SW-cachen inte serverar gamla assets
// under utveckling/granskning.
if ('serviceWorker' in navigator && !location.search.includes('demo')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW register failed:', err);
    });
  });
}
