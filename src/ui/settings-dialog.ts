// The settings dialog (markup is in play.html): key presets and the game settings.

import { clearCachedFiles } from "../pwa";
import { PRESETS } from "../settings/keys";
import { SETTINGS } from "../settings/schema";
import type { SettingsStore } from "../settings/store";

// Ranges shown as percentages; everything else shows the plain number.
const PERCENT = new Set(["musicVolume", "sfxVolume", "mouseTurn", "keyTurn"]);

export function setupSettingsDialog(store: SettingsStore, onClose: () => void): void {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dialog = $<HTMLDialogElement>("settings");
  const openButton = $<HTMLButtonElement>("open-settings");
  const restartNote = $("restart-note");
  const presetBox = $("key-presets");
  const inputs = [...dialog.querySelectorAll<HTMLInputElement>("[data-setting]")];

  // Key presets: one radio per preset, and a line when the keys were changed in the game.
  for (const p of PRESETS) {
    const label = document.createElement("label");
    label.className = "preset";
    label.innerHTML = `<input type="radio" name="preset" value="${p.id}" /><span><b></b><small></small></span>`;
    label.querySelector("b")!.textContent = p.name;
    label.querySelector("small")!.textContent = p.description;
    presetBox.append(label);
  }
  const custom = document.createElement("p");
  custom.className = "hint";
  custom.textContent = "Your keys were changed in the game (Esc menu). Choosing a preset replaces them.";
  presetBox.append(custom);

  const showValue = (input: HTMLInputElement, value: number | boolean) => {
    if (input.type === "checkbox") {
      input.checked = Boolean(value);
      return;
    }
    input.value = String(value);
    const out = input.nextElementSibling as HTMLOutputElement | null;
    if (out) out.textContent = PERCENT.has(input.dataset.setting!) ? `${value}%` : String(value);
  };

  const refresh = () => {
    const values = store.values();
    for (const input of inputs) showValue(input, values[input.dataset.setting!]);
    const preset = store.currentPresetId();
    presetBox.querySelectorAll<HTMLInputElement>("input[name=preset]").forEach((r) => (r.checked = r.value === preset));
    custom.hidden = preset !== undefined;
    restartNote.hidden = !store.hasPending;
  };

  const changed = () => {
    restartNote.hidden = !store.hasPending;
  };

  for (const input of inputs) {
    input.addEventListener("input", () => {
      const setting = SETTINGS.find((s) => s.id === input.dataset.setting);
      if (!setting) return;
      const value = input.type === "checkbox" ? input.checked : Number(input.value);
      store.set(setting, value);
      showValue(input, value);
      changed();
    });
  }

  presetBox.addEventListener("change", (e) => {
    const radio = e.target as HTMLInputElement;
    if (radio.name !== "preset") return;
    store.setPreset(radio.value);
    custom.hidden = true;
    changed();
  });

  openButton.addEventListener("click", () => {
    refresh();
    dialog.showModal();
  });
  $("close-settings").addEventListener("click", () => dialog.close());
  // A click on the backdrop (the dialog element itself) closes it.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", onClose);
  $("restart").addEventListener("click", () => location.reload());

  const clearButton = $<HTMLButtonElement>("clear-cache");
  clearButton.addEventListener("click", async () => {
    if (!confirm("Delete the game files stored in this browser? The page reloads and downloads them again, and what you have not saved in the game is lost. Your characters and settings are kept.")) return;
    clearButton.disabled = true;
    try {
      await clearCachedFiles();
    } catch (e) {
      console.warn("Could not clear the stored game files:", e);
    }
    location.reload();
  });

  openButton.disabled = false;
}
