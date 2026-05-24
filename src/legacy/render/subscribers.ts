// ============================================================
// render/subscribers.ts — Wire store-notifications to cross-cutting
// patches (Fas 4.5)
// Beror på: store.ts (subscribe), render/patches.ts (patchHeaderMeta)
//
// Per-aggregate kort-patches (patchNoteCard etc.) anropas explicit
// av actions efter mutation — inte härifrån. Detta skulle annars
// betyda en full iteration över list:an vid varje store-notify,
// vilket är vad granular render försöker undvika.
//
// Här registrerar vi BARA cross-cutting patches som måste hända
// vid varje notes/tasks/materials-ändring oavsett källa (realtime,
// lokal action, eller annan flik):
//  - patchHeaderMeta: header-räknarna + deadline-varningar
//
// initRenderSubscribers() anropas från completeLogin() i auth.ts.
// Listeners förblir registrerade tills logout — då rensar vi via
// teardownRenderSubscribers() så listener-Set:en inte läcker mellan
// sessions.
// ============================================================

const _renderUnsubscribes: Array<() => void> = [];

function initRenderSubscribers(): void {
  // Rensa eventuella gamla (idempotent — säkrar mot dubbel-init).
  teardownRenderSubscribers();

  _renderUnsubscribes.push(subscribe("notes",     patchHeaderMeta));
  _renderUnsubscribes.push(subscribe("tasks",     patchHeaderMeta));
  _renderUnsubscribes.push(subscribe("materials", patchHeaderMeta));
}

function teardownRenderSubscribers(): void {
  while (_renderUnsubscribes.length) {
    const off = _renderUnsubscribes.pop();
    if (off) try { off(); } catch { /* ignore */ }
  }
}
