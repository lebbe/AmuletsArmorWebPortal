// The toolbar button that turns the community map packs on and off, and the
// note on the start screen that says what is loaded.

import type { EmFS } from "../engine/emscripten";
import type { Mods } from "../mods/mods";
import { setTip } from "./toolbar";

/** Shows the button (if this build has packs) and keeps it and the note in step with the selection. */
export function setupModsButton(mods: Mods, fs: EmFS, hasStarted: () => boolean): void {
  if (!mods.packs.length && !mods.unknown.length) return;
  const button = document.getElementById("toggle-mods") as HTMLButtonElement;
  const note = document.getElementById("mods-note") as HTMLElement;
  const saveNote = document.getElementById("savenote") as HTMLElement;

  const show = () => {
    const on = mods.selected.length > 0;
    button.hidden = !mods.packs.length;
    button.setAttribute("aria-pressed", String(on));
    setTip(button, on ? "Community quests: on (click to turn off)" : "Community quests: off (click to turn on)");

    const lines: string[] = [];
    for (const o of mods.outcomes) {
      if (o.questNumbers) lines.push(`${o.pack.name}: ${o.pack.quests.map((q) => q.title).join(", ")}.`);
      else lines.push(`${o.pack.name} was not loaded: ${o.problem}.`);
    }
    if (mods.unknown.length) lines.push(`This build does not have: ${mods.unknown.join(", ")}.`);
    if (!on && mods.packs.length) lines.push("Community quests are off. The map button adds them to the quest list in town.");
    lines.push(...mods.warnings);
    note.textContent = lines.join("\n");
    note.hidden = lines.length === 0;
  };

  button.addEventListener("click", async () => {
    button.disabled = true;
    await mods.select(mods.selected.length ? [] : mods.packs.map((p) => p.id));
    if (hasStarted()) {
      // The game has already scanned its quests: the change waits for the next start.
      saveNote.textContent = "Community quests change the next time the game starts (reload the page).";
    } else {
      mods.install(fs);
    }
    show();
    button.disabled = false;
  });

  show();
  button.disabled = false;
}
