// Characters and settings live in IndexedDB via Emscripten's IDBFS, mounted at
// /persist. The game writes S0000000/CHDATA0x, config.ini and CONTROL.TXT
// relative to /game, so those paths become symlinks into /persist. Settings are
// seeded from the packaged defaults the first time.
//
// The IndexedDB database is named after the mount point, so saves are per
// origin. Pick the mount name deliberately: another page on this origin that
// mounts IDBFS at the same path shares the store.

import type { EmFS, EngineModule } from "./emscripten";

const PERSIST = "/persist";
const SETTINGS = ["config.ini", "CONTROL.TXT"];

let fs: EmFS | null = null;
let syncing = false;
let syncAgain = false;

function exists(FS: EmFS, path: string): boolean {
  try {
    FS.lstat(path);
    return true;
  } catch {
    return false;
  }
}

function rmtree(FS: EmFS, path: string): void {
  let st;
  try {
    st = FS.lstat(path);
  } catch {
    return;
  }
  if (FS.isDir(st.mode)) {
    for (const n of FS.readdir(path)) if (n !== "." && n !== "..") rmtree(FS, `${path}/${n}`);
    FS.rmdir(path);
  } else {
    FS.unlink(path);
  }
}

/** Mount IDBFS, load it, and link the game's writable paths into it.
 *  Call after the game data is unpacked and before main() starts. */
export function setupPersistence(Module: EngineModule): Promise<boolean> {
  const FS = Module.FS;
  return new Promise((resolve) => {
    try {
      FS.mkdirTree(PERSIST);
      FS.mount(FS.filesystems.IDBFS, {}, PERSIST);
    } catch {
      resolve(false);
      return;
    }
    FS.syncfs(true, (err) => {
      if (err) return resolve(false);
      try {
        if (!exists(FS, `${PERSIST}/S0000000`)) FS.mkdir(`${PERSIST}/S0000000`);
        for (const f of SETTINGS) {
          if (!exists(FS, `${PERSIST}/${f}`) && exists(FS, `/game/${f}`))
            FS.writeFile(`${PERSIST}/${f}`, FS.readFile(`/game/${f}`));
        }
        rmtree(FS, "/game/S0000000");
        FS.symlink(`${PERSIST}/S0000000`, "/game/S0000000");
        for (const f of SETTINGS) {
          if (exists(FS, `${PERSIST}/${f}`)) {
            rmtree(FS, `/game/${f}`);
            FS.symlink(`${PERSIST}/${f}`, `/game/${f}`);
          }
        }
        fs = FS;
        resolve(true);
      } catch (e) {
        console.warn("Persistence setup failed:", e);
        resolve(false);
      }
    });
  });
}

/** Flush the in-memory /persist to IndexedDB. Calls made while a sync is running are coalesced. */
export function syncToBrowser(): Promise<void> {
  if (!fs) return Promise.resolve();
  if (syncing) {
    syncAgain = true;
    return Promise.resolve();
  }
  syncing = true;
  return new Promise((resolve) => {
    fs!.syncfs(false, (err) => {
      syncing = false;
      if (err) console.warn("Saving to browser storage failed:", err);
      if (syncAgain) {
        syncAgain = false;
        void syncToBrowser().then(resolve);
      } else resolve();
    });
  });
}

/** Sync every few seconds, when the tab is hidden and when it is closed. */
export function startAutoSync(): void {
  setInterval(() => void syncToBrowser(), 5000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void syncToBrowser();
  });
  window.addEventListener("pagehide", () => void syncToBrowser());
}
