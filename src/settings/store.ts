// Reads and writes the game's config.ini (and control.txt) in its virtual
// filesystem.
//
// The game reads config.ini once, at start, and rewrites it itself when the
// player changes options in the Esc menu. So the page only writes the file
// while the game is not running. Once the game is running, changes are kept as
// "pending" (localStorage) and applied by the next start, after a page reload.

import type { EmFS } from "../engine/emscripten";
import { syncToBrowser } from "../engine/storage";
import { getIni, setIni } from "./ini";
import { findPreset, keysFromIni, keysToIni, PRESETS, updateControlText } from "./keys";
import { SETTINGS, type Change, type Get, type Setting } from "./schema";

const PENDING_KEY = "aa.pendingSettings";

const decoder = new TextDecoder();

export class SettingsStore {
  private pending: Change[];
  private running = false;
  private fs: EmFS;
  private dir: string; // "/persist" when saving works, else "/game"

  constructor(fs: EmFS, dir: string) {
    this.fs = fs;
    this.dir = dir;
    this.pending = loadPending();
    // Not running yet: bring config.ini up to date with what was chosen last time.
    this.flushPending();
  }

  /** Call when the game has been started: from then on, edits are queued. */
  markRunning(): void {
    this.running = true;
  }

  get hasPending(): boolean {
    return this.pending.length > 0;
  }

  private read(name: string): string {
    try {
      return decoder.decode(this.fs.readFile(`${this.dir}/${name}`));
    } catch {
      return "";
    }
  }

  private write(name: string, text: string): void {
    this.fs.writeFile(`${this.dir}/${name}`, text);
  }

  /** config.ini as the player will see it after the next start. */
  private effectiveIni(): string {
    return this.pending.reduce((text, [s, k, v]) => setIni(text, s, k, v), this.read("config.ini"));
  }

  values(): Record<string, boolean | number> {
    const text = this.effectiveIni();
    const get: Get = (s, k) => getIni(text, s, k);
    return Object.fromEntries(SETTINGS.map((s) => [s.id, s.read(get)]));
  }

  currentKeys(): number[] {
    const text = this.effectiveIni();
    return keysFromIni(getIni(text, "keyboard", "keys1"), getIni(text, "keyboard", "keys2"));
  }

  /** The preset matching the current keys, or undefined if they were changed by hand. */
  currentPresetId(): string | undefined {
    return findPreset(this.currentKeys())?.id;
  }

  set(setting: Setting, value: boolean | number): void {
    this.change(setting.write(value));
  }

  setPreset(id: string): void {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const { keys1, keys2 } = keysToIni(preset.keys);
    this.change([
      ["keyboard", "keys1", keys1],
      ["keyboard", "keys2", keys2],
    ]);
  }

  private change(changes: Change[]): void {
    if (this.running) {
      this.pending.push(...changes);
      savePending(this.pending);
    } else {
      this.apply(changes);
    }
  }

  private flushPending(): void {
    if (!this.pending.length) return;
    this.apply(this.pending);
    this.pending = [];
    savePending(this.pending);
  }

  private apply(changes: Change[]): void {
    let ini = this.read("config.ini");
    for (const [s, k, v] of changes) ini = setIni(ini, s, k, v);
    this.write("config.ini", ini);

    if (changes.some(([s, k]) => s === "keyboard" && k.startsWith("keys"))) {
      const keys = keysFromIni(getIni(ini, "keyboard", "keys1"), getIni(ini, "keyboard", "keys2"));
      this.write("CONTROL.TXT", updateControlText(this.read("CONTROL.TXT"), keys));
    }
    void syncToBrowser();
  }
}

function loadPending(): Change[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Change[]) : [];
  } catch {
    return [];
  }
}

function savePending(changes: Change[]): void {
  try {
    if (changes.length) localStorage.setItem(PENDING_KEY, JSON.stringify(changes));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable: changes made while the game runs are lost on reload */
  }
}
