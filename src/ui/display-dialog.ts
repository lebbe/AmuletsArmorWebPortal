// The display dialog (markup is in play.html) and the screenshot and record buttons.

import { canRecord, Recorder, takeScreenshot } from "../display/capture";
import type { Display } from "../display/display";
import { GAME_H, GAME_W, type DisplayOptions } from "../display/options";
import { setIcon } from "./icons";
import { setTip } from "./toolbar";

export function setupDisplayDialog(display: Display, onClose: () => void): void {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dialog = $<HTMLDialogElement>("display");
  const openButton = $<HTMLButtonElement>("open-display");
  const info = $("display-size");
  const inputs = [...dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-display]")];

  const show = (options: DisplayOptions) => {
    for (const input of inputs) {
      const key = input.dataset.display as keyof DisplayOptions;
      if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = Boolean(options[key]);
      else input.value = String(options[key]);
      if (key === "scaling") input.disabled = options.aspect === "fill";
      if (key === "strength") {
        const out = input.nextElementSibling as HTMLOutputElement;
        out.textContent = `${options.strength}%`;
        input.disabled = options.filter === "off";
      }
    }
  };

  const showSize = () => {
    const { width, height } = display.size;
    const scale = width / GAME_W;
    const factor = Number.isInteger(scale) && height === GAME_H * scale ? ` (${scale}×)` : "";
    info.textContent = `Showing ${width} × ${height} pixels${factor}; the game itself draws ${GAME_W} × ${GAME_H}.`;
  };

  for (const input of inputs) {
    input.addEventListener("input", () => {
      const key = input.dataset.display as keyof DisplayOptions;
      if (input instanceof HTMLInputElement && input.type === "checkbox") display.set("smooth", input.checked);
      else if (key === "strength") display.set("strength", Number(input.value));
      else (display.set as (k: string, v: string) => void)(key, input.value);
    });
  }

  display.onChange((options) => {
    show(options);
    showSize();
  });
  show(display.options);
  showSize();

  openButton.addEventListener("click", () => dialog.showModal());
  $("close-display").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", onClose);
  openButton.disabled = false;
}

/** Screenshot and record buttons: they are enabled by `enable()` once the game runs. */
export function setupCapture(canvas: HTMLCanvasElement): { enable(): void } {
  const screenshot = document.getElementById("screenshot") as HTMLButtonElement;
  const record = document.getElementById("record") as HTMLButtonElement;
  screenshot.addEventListener("click", () => {
    takeScreenshot(canvas);
    canvas.focus();
  });

  if (!canRecord()) {
    record.hidden = true;
    return { enable: () => (screenshot.disabled = false) };
  }

  const recorder = new Recorder();
  const show = () => {
    const on = recorder.recording;
    const s = recorder.seconds;
    setIcon(record.firstElementChild as Element, on ? "stop" : "video");
    record.setAttribute("aria-pressed", String(on));
    setTip(record, on ? `Stop recording (${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")})` : "Record video");
  };
  recorder.onChange(show);
  record.addEventListener("click", () => {
    if (recorder.recording) recorder.stop();
    else recorder.start(canvas);
    canvas.focus();
  });
  // Leaving the page loses a running recording: ask first.
  window.addEventListener("beforeunload", (e) => {
    if (recorder.recording) e.preventDefault();
  });

  return {
    enable: () => {
      screenshot.disabled = false;
      record.disabled = false;
    },
  };
}
