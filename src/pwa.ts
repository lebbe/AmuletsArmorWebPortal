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

// The caches the site creates: the engine files (src/engine/cache.ts), the page shell
// (scripts/sw.js) and the map packs (src/mods/mods.ts).
const CACHE_PREFIXES = ["aa-engine-", "aa-shell-", "aa-mods"];

/**
 * Forgets everything the site has downloaded (engine files, page shell, map packs) and
 * unregisters the service worker, so the next load fetches it all again. Saves (IndexedDB)
 * and settings (localStorage) are not touched.
 */
export async function clearCachedFiles(): Promise<void> {
  if (typeof caches !== "undefined") {
    for (const name of await caches.keys()) {
      if (CACHE_PREFIXES.some((prefix) => name.startsWith(prefix))) await caches.delete(name);
    }
  }
  if ("serviceWorker" in navigator) {
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
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
