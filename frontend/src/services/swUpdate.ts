/**
 * Service‑worker update helper.
 *
 * Listens for the custom DOM events dispatched by the registration
 * script in index.html and exposes a simple API for the Svelte UI:
 *
 *   • onUpdateAvailable(cb)  – called when a new SW is installed and waiting.
 *   • applyUpdate()          – tells the waiting SW to activate (triggers page reload).
 */

type UpdateCallback = () => void;

let _registration: ServiceWorkerRegistration | null = null;
const _listeners: UpdateCallback[] = [];

/** Register a callback that fires when a new version is waiting. */
export function onUpdateAvailable(cb: UpdateCallback): () => void {
  _listeners.push(cb);
  return () => {
    const idx = _listeners.indexOf(cb);
    if (idx !== -1) _listeners.splice(idx, 1);
  };
}

/** Tell the waiting service worker to activate (will cause a page reload). */
export function applyUpdate(): void {
  if (_registration?.waiting) {
    _registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Bootstrap – hook into the DOM events dispatched by the inline script in index.html.
if (typeof window !== 'undefined') {
  window.addEventListener('sw-update-available', ((e: CustomEvent<{ registration: ServiceWorkerRegistration }>) => {
    _registration = e.detail.registration;
    _listeners.forEach((cb) => cb());
  }) as EventListener);
}
