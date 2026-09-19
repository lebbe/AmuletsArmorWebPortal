import { installAudioCapture } from "./engine/audio";
import { loadEngine } from "./engine/loader";
import { startAutoSync } from "./engine/storage";
import { SettingsStore } from "./settings/store";
import { fillIcons } from "./ui/icons";
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

fillIcons();
setupToolbar($("player"), canvas);

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

let store: SettingsStore | undefined;
let started = false;

const engine = loadEngine(canvas, {
  onStatus: (t) => (statusEl.textContent = t),
  onProgress: (f) => (fill.style.width = `${(100 * f).toFixed(1)}%`),
  onReady: ({ fs, dir, persisted }) => {
    store = new SettingsStore(fs, dir);
    Object.assign(window, { aa: { fs, dir, store } }); // for debugging in the console
    setupSettingsDialog(store, () => {
      if (started) canvas.focus();
    });
    playBtn.disabled = false;
    playBtn.textContent = "Click to play";
    saveNote.textContent = persisted
      ? "Characters and settings are saved in this browser."
      : "Browser storage is unavailable: nothing will be saved.";
    if (persisted) startAutoSync();
  },
  onAbort: (what) => {
    statusEl.textContent = `The game stopped unexpectedly: ${what}`;
    overlay.hidden = false;
  },
});

playBtn.addEventListener("click", () => {
  if (playBtn.disabled) return;
  playBtn.disabled = true;
  overlay.hidden = true;
  started = true;
  store?.markRunning(); // from now on, settings changes wait for the next start
  engine.start();
  canvas.focus();
});

window.addEventListener("error", (e) => {
  statusEl.textContent = `Error: ${e.message}`;
});
