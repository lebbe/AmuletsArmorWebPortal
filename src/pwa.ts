// The site as an app: a service worker keeps the pages, scripts and styles for
// offline use (the engine files are kept by src/engine/cache.ts), and persistent
// storage protects both them and the saves from being cleaned up by the browser.
//
// The service worker is only built for production (see vite.config.ts), so in
// `npm run dev` registration is skipped.

/** Registers the service worker. Resolves true once it is active, i.e. the pages work offline. */
export async function registerServiceWorker(): Promise<boolean> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    await navigator.serviceWorker.ready; // resolves after the install step has cached everything
    return true;
  } catch (e) {
    console.warn("Service worker not available:", e);
    return false;
  }
}

/** Is the browser already promising not to clear this site's storage? */
export async function isPersistent(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

/** Ask the browser not to evict this site's storage. Chromium decides silently, Firefox asks the user. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (await isPersistent()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
