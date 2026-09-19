// Toolbar buttons that do not need the engine's files: mute and fullscreen.

import { isMuted, onMuteChange, setMuted } from "../engine/audio";
import { setIcon } from "./icons";

/** Buttons show their name as a tooltip (data-tip) and to screen readers (aria-label). */
export function setTip(button: HTMLElement, text: string): void {
  button.dataset.tip = text;
  button.setAttribute("aria-label", text);
}

export function setupToolbar(player: HTMLElement, canvas: HTMLCanvasElement): void {
  document.querySelectorAll<HTMLElement>("#toolbar .tool, #settings .tool").forEach((b) => setTip(b, b.dataset.tip ?? ""));

  const mute = document.getElementById("mute") as HTMLButtonElement;
  const showMute = (muted: boolean) => {
    setIcon(mute.firstElementChild as Element, muted ? "volume-x" : "volume");
    setTip(mute, muted ? "Unmute" : "Mute");
    mute.setAttribute("aria-pressed", String(muted));
  };
  mute.addEventListener("click", () => setMuted(!isMuted()));
  onMuteChange(showMute);

  const fullscreen = document.getElementById("fullscreen") as HTMLButtonElement;
  const showFullscreen = () => {
    const on = document.fullscreenElement === player;
    setIcon(fullscreen.firstElementChild as Element, on ? "collapse" : "expand");
    setTip(fullscreen, on ? "Exit fullscreen" : "Fullscreen");
  };
  document.addEventListener("fullscreenchange", showFullscreen);

  // The game uses Esc for its menu, but browsers leave fullscreen on Esc. Where
  // supported (Chromium), ask to keep Esc for the page while fullscreen.
  fullscreen.addEventListener("click", async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await player.requestFullscreen();
    const keyboard = (navigator as Navigator & { keyboard?: { lock(keys: string[]): Promise<void> } }).keyboard;
    try {
      await keyboard?.lock(["Escape"]);
    } catch {
      /* not supported: Esc will leave fullscreen */
    }
    canvas.focus();
  });
}
