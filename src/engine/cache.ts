// Keeps the engine files (111 MB, almost all of it the .data package) in the
// browser's Cache API, so the second visit does not download them again and the
// game works offline.
//
// Each file has its own cache named after its sha256 in engine.lock.json, so a
// new engine build that only changes the small .js keeps the big .data. Caches
// of older builds are deleted once the current files are in place.
//
// The files are handed to the engine as blob URLs, so this works the same on the
// first visit (no service worker in control yet) and offline. Where the Cache API
// is missing (insecure context, some private modes) prepareEngine() returns null
// and the loader downloads the files the plain way.

import lock from "../../engine.lock.json";

const DIR = `${import.meta.env.BASE_URL}engine/`;
const PREFIX = "aa-engine-";
const TYPES: Record<string, string> = { js: "text/javascript", wasm: "application/wasm", data: "application/octet-stream" };

export interface EngineFiles {
  /** File name -> blob URL, for the engine's locateFile and the script tag. */
  urls: Record<string, string>;
  /** True if every file is now in the browser cache (it will work offline). */
  stored: boolean;
  /** True if something had to be downloaded. */
  downloaded: boolean;
}

interface Entry {
  name: string;
  size: number;
  sha256: string;
  cacheName: string;
}

const entries: Entry[] = Object.entries(lock.files).map(([name, f]) => ({
  name,
  size: f.size,
  sha256: f.sha256,
  cacheName: `${PREFIX}${name}-${f.sha256.slice(0, 16)}`,
}));

const typeOf = (name: string) => TYPES[name.slice(name.lastIndexOf(".") + 1)] ?? "application/octet-stream";

async function download(entry: Entry, onBytes: (n: number) => void): Promise<Blob> {
  // The hash in the query keeps an HTTP cache or CDN from serving an older build.
  const res = await fetch(`${DIR}${entry.name}?v=${entry.sha256.slice(0, 16)}`);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${entry.name}`);
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onBytes(value.length);
  }
  // Sizes in the lock are of the decoded file, so this also holds behind gzip/brotli.
  if (loaded !== entry.size) throw new Error(`${entry.name}: got ${loaded} bytes, expected ${entry.size}`);
  return new Blob(chunks as BlobPart[], { type: typeOf(entry.name) });
}

/** Make sure the engine files are in the cache (downloading what is missing) and return blob URLs for them. */
export async function prepareEngine(onProgress: (loaded: number, total: number) => void): Promise<EngineFiles | null> {
  if (typeof caches === "undefined") return null;

  const total = entries.reduce((sum, e) => sum + e.size, 0);
  let loaded = 0;
  const urls: Record<string, string> = {};
  let stored = true;
  let downloaded = false;

  for (const entry of entries) {
    const key = `${DIR}${entry.name}`;
    let blob: Blob | undefined;
    let cache: Cache | undefined;
    try {
      cache = await caches.open(entry.cacheName);
      const hit = await cache.match(key);
      if (hit) {
        const b = await hit.blob();
        if (b.size === entry.size) blob = b.slice(0, b.size, typeOf(entry.name));
        else await cache.delete(key); // damaged or partial: fetch it again
      }
    } catch {
      cache = undefined;
    }

    if (blob) {
      loaded += entry.size;
    } else {
      downloaded = true;
      blob = await download(entry, (n) => onProgress((loaded += n), total));
      try {
        if (!cache) throw new Error("no cache");
        await cache.put(key, new Response(blob, { headers: { "Content-Type": typeOf(entry.name) } }));
      } catch (e) {
        stored = false; // most likely out of quota: play from memory this time
        console.warn(`Could not store ${entry.name} in the browser cache:`, e);
      }
    }
    urls[entry.name] = URL.createObjectURL(blob);
  }
  onProgress(total, total);

  // Only now that everything is in place, drop the caches of older engine builds.
  if (stored) {
    const wanted = new Set(entries.map((e) => e.cacheName));
    try {
      for (const name of await caches.keys()) if (name.startsWith(PREFIX) && !wanted.has(name)) await caches.delete(name);
    } catch {
      /* not fatal */
    }
  }
  return { urls, stored, downloaded };
}
