// Characters are S0000000/CHDATA00 .. CHDATA03 in the profile's directory (see
// engine/storage.ts). Everything here works on that directory of the virtual
// filesystem. The game reads its character list when it starts, so files are only
// replaced before the game starts.

import { strToU8, unzipSync, zipSync } from "fflate";
import type { EmFS } from "../engine/emscripten";
import { syncToBrowser } from "../engine/storage";
import { lastBackup } from "./profiles";

export const SLOTS = 4;
const SAVE_DIR = "S0000000";
const SETTING_FILES = ["config.ini", "CONTROL.TXT"];
const MAX_SIZE = 1_000_000;
const BACKUP_AFTER_MS = 7 * 24 * 3600 * 1000;

const slotFile = (i: number) => `CHDATA${String(i).padStart(2, "0")}`;
const slotPath = (dir: string, i: number) => `${dir}/${SAVE_DIR}/${slotFile(i)}`;

export interface Slot {
  index: number;
  /** Undefined when the slot is empty. */
  size?: number;
  modified?: Date;
}

export function listSlots(fs: EmFS, dir: string): Slot[] {
  return Array.from({ length: SLOTS }, (_, index) => {
    try {
      const st = fs.stat(slotPath(dir, index));
      return { index, size: st.size, modified: st.mtime };
    } catch {
      return { index };
    }
  });
}

export function readSlot(fs: EmFS, dir: string, i: number): Uint8Array | undefined {
  try {
    return fs.readFile(slotPath(dir, i));
  } catch {
    return undefined;
  }
}

/** Why a file cannot be a character, or undefined if it might be. The format is not checked further. */
export function checkCharacter(bytes: Uint8Array): string | undefined {
  if (bytes.length === 0) return "The file is empty.";
  if (bytes.length > MAX_SIZE) return "The file is too big to be a character.";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "This is a zip file. Use “Restore a backup” for that.";
  return undefined;
}

function ensureDir(fs: EmFS, dir: string): void {
  fs.mkdirTree(`${dir}/${SAVE_DIR}`);
}

export function writeSlot(fs: EmFS, dir: string, i: number, bytes: Uint8Array): void {
  ensureDir(fs, dir);
  fs.writeFile(slotPath(dir, i), bytes);
  void syncToBrowser();
}

/** All characters and the settings (keys, options) as a zip file. */
export function makeBackup(fs: EmFS, dir: string): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < SLOTS; i++) {
    const bytes = readSlot(fs, dir, i);
    if (bytes) files[`${SAVE_DIR}/${slotFile(i)}`] = bytes;
  }
  for (const name of SETTING_FILES) {
    try {
      files[name] = fs.readFile(`${dir}/${name}`);
    } catch {
      /* not there */
    }
  }
  files["README.txt"] = strToU8(
    "A backup of Amulets & Armor characters and settings, made by the web site.\n" +
      "Use \"Restore a backup\" in the site's Saves dialog to put it back.\n",
  );
  return zipSync(files, { level: 6 });
}

export interface Backup {
  slots: Map<number, Uint8Array>;
  settings: Map<string, Uint8Array>;
}

/** Reads a backup zip; throws an Error with a message for the player if it is not one of ours. */
export function readBackup(bytes: Uint8Array): Backup {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error("This is not a zip file.");
  }
  const backup: Backup = { slots: new Map(), settings: new Map() };
  for (const [path, data] of Object.entries(entries)) {
    const name = path.split("/").pop() ?? "";
    const m = /^CHDATA(\d\d)$/i.exec(name);
    if (m && Number(m[1]) < SLOTS) {
      if (checkCharacter(data)) throw new Error(`${path} in the zip does not look like a character.`);
      backup.slots.set(Number(m[1]), data);
    } else {
      const setting = SETTING_FILES.find((f) => f.toLowerCase() === path.toLowerCase());
      if (setting) backup.settings.set(setting, data);
    }
  }
  if (!backup.slots.size && !backup.settings.size) throw new Error("There are no characters or settings in this zip.");
  return backup;
}

export function restoreBackup(fs: EmFS, dir: string, backup: Backup): void {
  ensureDir(fs, dir);
  for (const [i, bytes] of backup.slots) fs.writeFile(slotPath(dir, i), bytes);
  for (const [name, bytes] of backup.settings) fs.writeFile(`${dir}/${name}`, bytes);
  void syncToBrowser();
}

/** True when there are characters that a backup does not cover: never backed up, or changed since a backup over a week ago. */
export function backupDue(fs: EmFS, dir: string, profileId: string): boolean {
  const newest = Math.max(0, ...listSlots(fs, dir).map((s) => s.modified?.getTime() ?? 0));
  if (!newest) return false;
  const last = lastBackup(profileId);
  if (last === undefined) return true;
  return newest > last && Date.now() - last > BACKUP_AFTER_MS;
}

// ---------- Ready-made characters, hosted next to the site ----------

export interface HostedSave {
  id: string;
  name: string;
  description?: string;
  /** Path of the character file, relative to saves/. */
  file: string;
  /** Ids of the map packs (see mods.json) the character has played. */
  requires?: string[];
}

const HOSTED = `${import.meta.env.BASE_URL}saves/`;

/** The list in saves/index.json; empty if the site hosts none. */
export async function loadHosted(): Promise<HostedSave[]> {
  try {
    const res = await fetch(`${HOSTED}index.json`);
    if (!res.ok) return [];
    const list: unknown = (await res.json()).saves;
    if (!Array.isArray(list)) return [];
    return list.filter((s): s is HostedSave => typeof s?.id === "string" && typeof s.name === "string" && typeof s.file === "string");
  } catch {
    return []; // missing, or the dev server answered with the page instead
  }
}

export async function fetchHosted(save: HostedSave): Promise<Uint8Array> {
  const res = await fetch(`${HOSTED}${save.file}`);
  if (!res.ok) throw new Error(`Could not download ${save.file} (HTTP ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}
