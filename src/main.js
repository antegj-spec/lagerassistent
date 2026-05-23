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
