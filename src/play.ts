import { Display } from "./display/display";
import { installAudioCapture } from "./engine/audio";
import { loadEngine } from "./engine/loader";
import { startAutoSync } from "./engine/storage";
import { Mods } from "./mods/mods";
import { registerServiceWorker, requestPersistence } from "./pwa";
import { SettingsStore } from "./settings/store";
import { fillIcons } from "./ui/icons";
import { setupDisplayDialog, setupCapture } from "./ui/display-dialog";
import { setupBackupReminder, setupSavesDialog } from "./ui/saves-dialog";
import { setupMusic } from "./ui/music-ui";
import { setupModsButton } from "./ui/mods-button";
import { setupSettingsDialog } from "./ui/settings-dialog";
import { setupToolbar } from "./ui/toolbar";

// Must run before the engine script loads.
installAudioCapture();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("canvas");
const overlay = $("overlay");
const statusEl = $("status");
const fill = $("barfill");
const playBtn = $<HTMLButtonElement>("play");
const saveNote = $("savenote");
const cacheNote = $("cache-note");

fillIcons();
setupToolbar($("player"), canvas);
const display = new Display($("stage"), $("player"), $("frame"), $("toolbar"));
setupDisplayDialog(display, () => {
  if (started) canvas.focus();
});
const capture = setupCapture(canvas);
void setupMusic(() => {
  if (started) canvas.focus();
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

let store: SettingsStore | undefined;
let started = false;

// The service worker keeps the pages for offline use; the engine files are cached by the loader.
const offline = registerServiceWorker();

// Start fetching the map packs right away, in parallel with the game data.
const modsLoading = Mods.load();
let mods: Mods | undefined;

const engine = loadEngine(canvas, {
  onStatus: (t) => (statusEl.textContent = t),
  onProgress: (f) => (fill.style.width = `${(100 * f).toFixed(1)}%`),
  beforeReady: async (fs) => {
    mods = await modsLoading;
    mods.install(fs);
  },
  onReady: ({ fs, dir, persisted, cached }) => {
    if (mods) setupModsButton(mods, fs, () => started);
    else $("toggle-mods").hidden = true; // the map packs could not be loaded
    store = new SettingsStore(fs, dir);
    const saves = { fs, dir, mods, hasStarted: () => started, onClose: () => started && canvas.focus() };
    setupSavesDialog(saves);
    setupBackupReminder(saves);
    Object.assign(window, { aa: { fs, dir, store } }); // for debugging in the console
    setupSettingsDialog(store, () => {
      if (started) canvas.focus();
    });
    playBtn.disabled = false;
    playBtn.textContent = "Click to play";
    if (persisted) startAutoSync();
    else saveNote.textContent = "Browser storage is unavailable: nothing will be saved.";
    void showOfflineStatus(cached);
  },
  onAbort: (what) => {
    statusEl.textContent = `The game stopped unexpectedly: ${what}`;
    overlay.hidden = false;
  },
});

/** Says on the start screen whether the game now works without a network. */
async function showOfflineStatus(cached: boolean) {
  if (cached && (await offline)) {
    cacheNote.textContent = "Stored in this browser: the game works offline and starts fast next time.";
    cacheNote.hidden = false;
  }
}

playBtn.addEventListener("click", () => {
  if (playBtn.disabled) return;
  playBtn.disabled = true;
  overlay.hidden = true;
  started = true;
  capture.enable();
  mods?.recordStart();
  void requestPersistence();
  store?.markRunning(); // from now on, settings changes wait for the next start
  engine.start();
  canvas.focus();
});

window.addEventListener("error", (e) => {
  statusEl.textContent = `Error: ${e.message}`;
});
