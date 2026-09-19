import { installAudioCapture, isMuted, onMuteChange, setMuted } from "./engine/audio";
import { loadEngine } from "./engine/loader";
import { startAutoSync } from "./engine/storage";

// Must run before the engine script loads.
installAudioCapture();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("canvas");
const frame = $("frame");
const overlay = $("overlay");
const statusEl = $("status");
const fill = $("barfill");
const playBtn = $<HTMLButtonElement>("play");
const muteBtn = $<HTMLButtonElement>("mute");
const fullscreenBtn = $<HTMLButtonElement>("fullscreen");
const saveNote = $("savenote");

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

const engine = loadEngine(canvas, {
  onStatus: (t) => (statusEl.textContent = t),
  onProgress: (f) => (fill.style.width = `${(100 * f).toFixed(1)}%`),
  onReady: () => {
    playBtn.disabled = false;
    playBtn.textContent = "Click to play";
  },
  onAbort: (what) => {
    statusEl.textContent = `The game stopped unexpectedly: ${what}`;
    overlay.hidden = false;
  },
  onSaveStatus: (ok) => {
    saveNote.textContent = ok
      ? "Characters and settings are saved in this browser."
      : "Browser storage is unavailable: nothing will be saved.";
    if (ok) startAutoSync();
  },
});

playBtn.addEventListener("click", () => {
  if (playBtn.disabled) return;
  playBtn.disabled = true;
  overlay.hidden = true;
  void engine.start();
  canvas.focus();
});

muteBtn.addEventListener("click", () => setMuted(!isMuted()));
onMuteChange((m) => {
  muteBtn.textContent = m ? "Unmute" : "Mute";
  muteBtn.setAttribute("aria-pressed", String(m));
});

// The game uses Esc for its menu, but browsers leave fullscreen on Esc. Where
// supported (Chromium), ask to keep Esc for the page while fullscreen.
fullscreenBtn.addEventListener("click", async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await frame.requestFullscreen();
  const keyboard = (navigator as Navigator & { keyboard?: { lock(keys: string[]): Promise<void> } }).keyboard;
  try {
    await keyboard?.lock(["Escape"]);
  } catch {
    /* not supported: Esc will leave fullscreen */
  }
  canvas.focus();
});

window.addEventListener("error", (e) => {
  statusEl.textContent = `Error: ${e.message}`;
});
