// The saves dialog (markup is in play.html): profiles, character export and import,
// backups, and the ready-made characters hosted by the site.

import { download, timestamp } from "../download";
import type { EmFS } from "../engine/emscripten";
import type { Mods } from "../mods/mods";
import {
  activeProfile,
  addProfile,
  isFirst,
  lastBackup,
  profiles,
  recordBackup,
  removeProfile,
  renameProfile,
  setActiveProfile,
} from "../saves/profiles";
import {
  backupDue,
  checkCharacter,
  fetchHosted,
  listSlots,
  loadHosted,
  makeBackup,
  readBackup,
  readSlot,
  restoreBackup,
  SLOTS,
  writeSlot,
  type HostedSave,
} from "../saves/saves";

export interface SavesOptions {
  fs: EmFS;
  /** Where the active profile's files are. */
  dir: string;
  hasStarted: () => boolean;
  /** Undefined if this build has no map packs. */
  mods?: Mods;
  onClose: () => void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const fileSafe = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "profile";

function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "text-button";
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;
const when = (d: Date) => d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Saves the zip and notes the time, so the start screen stops asking. */
function downloadBackup({ fs, dir }: SavesOptions): void {
  const name = `amulets-armor-${fileSafe(activeProfile().name)}-${timestamp()}.zip`;
  download(new Blob([makeBackup(fs, dir) as BlobPart], { type: "application/zip" }), name);
  recordBackup(activeProfile().id);
}

/** Shows or hides the reminder on the start screen: on when characters are not backed up. */
function updateReminder({ fs, dir }: SavesOptions): void {
  $("backup-note").hidden = !backupDue(fs, dir, activeProfile().id);
}

/** The reminder on the start screen, and its button. */
export function setupBackupReminder(opts: SavesOptions): void {
  $("backup-now").addEventListener("click", () => {
    downloadBackup(opts);
    updateReminder(opts);
  });
  updateReminder(opts);
}

export function setupSavesDialog(opts: SavesOptions): void {
  const { fs, dir, hasStarted, mods } = opts;
  const dialog = $<HTMLDialogElement>("saves");
  const openButton = $<HTMLButtonElement>("open-saves");
  const message = $("saves-msg");
  const slotList = $("slot-list");
  const profileList = $("profile-list");
  const lockNote = $("saves-lock");
  const fileInput = $<HTMLInputElement>("saves-file");
  const backupStatus = $("backup-status");
  const hostedButtons: HTMLButtonElement[] = [];

  const say = (text: string) => (message.textContent = text);

  /** Importing changes files the game reads at start, so it is only possible before that. */
  const applyLock = () => {
    const locked = hasStarted();
    lockNote.hidden = !locked;
    for (const b of slotList.querySelectorAll<HTMLButtonElement>("button[data-import]")) b.disabled = locked;
    for (const b of hostedButtons) b.disabled = locked;
    $<HTMLButtonElement>("restore").disabled = locked;
  };

  // ----- Characters -----

  const renderSlots = () => {
    slotList.replaceChildren();
    for (const slot of listSlots(fs, dir)) {
      const row = document.createElement("div");
      row.className = "slot";
      const title = document.createElement("span");
      title.textContent = `Slot ${slot.index + 1}`;
      const info = document.createElement("small");
      info.textContent = slot.size ? `${kb(slot.size)}, saved ${when(slot.modified!)}` : "empty";
      const exportButton = button("Export", () => exportSlot(slot.index));
      exportButton.disabled = !slot.size;
      const importButton = button("Import", () => chooseFile({ kind: "slot", slot: slot.index }));
      importButton.dataset.import = "";
      row.append(title, info, exportButton, importButton);
      slotList.append(row);
    }
    const last = lastBackup(activeProfile().id);
    backupStatus.textContent = last ? `Last backup from this browser: ${when(new Date(last))}.` : "No backup made from this browser yet.";
    applyLock();
    updateReminder(opts);
  };

  const exportSlot = (i: number) => {
    const bytes = readSlot(fs, dir, i);
    if (!bytes) return;
    download(new Blob([bytes as BlobPart]), `${fileSafe(activeProfile().name)}-CHDATA0${i}`);
    say(`Slot ${i + 1} saved as a file. Import it into any slot, in this or another browser, to get the character back.`);
  };

  type Target = { kind: "slot"; slot: number } | { kind: "backup" };
  let target: Target | undefined;
  const chooseFile = (what: Target) => {
    target = what;
    fileInput.accept = what.kind === "backup" ? ".zip,application/zip" : "";
    fileInput.value = "";
    fileInput.click();
  };

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    const chosen = target;
    if (!file || !chosen) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (chosen.kind === "slot") importCharacter(chosen.slot, bytes, file.name);
      else importBackup(bytes);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
  });

  /** Asks before replacing characters. */
  const mayOverwrite = (slots: number[]) => {
    const taken = listSlots(fs, dir).filter((s) => s.size && slots.includes(s.index));
    if (!taken.length) return true;
    return confirm(`This replaces the character in slot ${taken.map((s) => s.index + 1).join(", ")}. Continue?`);
  };

  const importCharacter = (slot: number, bytes: Uint8Array, name: string) => {
    const problem = checkCharacter(bytes);
    if (problem) return say(problem);
    if (!mayOverwrite([slot])) return;
    writeSlot(fs, dir, slot, bytes);
    renderSlots();
    say(`${name} is now in slot ${slot + 1}.`);
  };

  const importBackup = (bytes: Uint8Array) => {
    const backup = readBackup(bytes);
    const slots = [...backup.slots.keys()];
    const what = [
      slots.length ? `${slots.length} character${slots.length > 1 ? "s" : ""}` : "",
      backup.settings.size ? "your keys and settings" : "",
    ]
      .filter(Boolean)
      .join(" and ");
    if (!mayOverwrite(slots)) return;
    if (backup.settings.size && !confirm("The backup also replaces your keys and settings. Continue?")) return;
    restoreBackup(fs, dir, backup);
    renderSlots();
    say(`Restored ${what}.`);
  };

  $("backup-all").addEventListener("click", () => {
    downloadBackup(opts);
    renderSlots();
    say("Backup saved as a zip file.");
  });
  $("restore").addEventListener("click", () => chooseFile({ kind: "backup" }));

  // ----- Profiles -----

  const renderProfiles = () => {
    profileList.replaceChildren();
    const active = activeProfile().id;
    for (const p of profiles()) {
      const row = document.createElement("div");
      row.className = "profile";
      const name = document.createElement("span");
      name.textContent = p.name;
      const state = document.createElement("small");
      state.textContent = p.id === active ? "in use" : "";
      row.append(name, state);
      if (p.id !== active) row.append(button("Use", () => useProfile(p.id, p.name)));
      row.append(button("Rename", () => rename(p.id, p.name)));
      if (!isFirst(p.id) && p.id !== active) row.append(button("Delete", () => remove(p.id, p.name)));
      profileList.append(row);
    }
  };

  const useProfile = (id: string, name: string) => {
    if (hasStarted() && !confirm(`Switch to “${name}”? The page reloads, and what you have not saved in the game is lost.`)) return;
    setActiveProfile(id);
    location.reload();
  };

  const rename = (id: string, current: string) => {
    const name = prompt("Name for this profile:", current);
    if (name === null) return;
    renameProfile(id, name);
    renderProfiles();
    renderSlots();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete the profile “${name}” with all its characters and settings? This cannot be undone.`)) return;
    const done = await removeProfile(id);
    renderProfiles();
    say(
      done
        ? `Deleted “${name}”.`
        : `“${name}” was removed from the list, but its data is in use by another tab. Close other tabs with this site and try again.`,
    );
  };

  $("profile-new").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>("profile-name");
    const profile = addProfile(input.value);
    input.value = "";
    renderProfiles();
    say(`Added “${profile.name}”. Choose Use to switch to it.`);
  });

  // ----- Ready-made characters -----

  const hostedSection = $("hosted-section");
  const hostedList = $("hosted-list");
  const hostedSlot = $<HTMLSelectElement>("hosted-slot");

  const hostedRow = (save: HostedSave) => {
    const row = document.createElement("div");
    row.className = "profile hosted";
    const text = document.createElement("span");
    const title = document.createElement("b");
    title.textContent = save.name;
    const detail = document.createElement("small");
    detail.textContent = save.description ?? "";
    text.append(title, detail);
    const add = button("Add", () => addHosted(save));
    hostedButtons.push(add);
    row.append(text, add);
    const missing = (save.requires ?? []).filter((id) => !mods?.selected.includes(id));
    if (missing.length) {
      const warn = document.createElement("small");
      warn.className = "warn";
      const names = missing.map((id) => mods?.packs.find((p) => p.id === id)?.name ?? id);
      warn.textContent = `Needs ${names.join(", ")}: turn it on with the map button first, or its quest will be missing.`;
      row.append(warn);
    }
    return row;
  };

  const addHosted = async (save: HostedSave) => {
    const slot = hostedSlot.value === "free" ? listSlots(fs, dir).find((s) => !s.size)?.index : Number(hostedSlot.value);
    if (slot === undefined) return say("All four slots are used. Choose a slot to replace.");
    try {
      const bytes = await fetchHosted(save);
      const problem = checkCharacter(bytes);
      if (problem) return say(`${save.name}: ${problem}`);
      if (!mayOverwrite([slot])) return;
      writeSlot(fs, dir, slot, bytes);
      renderSlots();
      say(`${save.name} is now in slot ${slot + 1}.`);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
  };

  void loadHosted().then((list) => {
    if (!list.length) return;
    hostedSection.hidden = false;
    hostedSlot.replaceChildren(new Option("First free slot", "free"));
    for (let i = 0; i < SLOTS; i++) hostedSlot.append(new Option(`Slot ${i + 1}`, String(i)));
    for (const save of list) hostedList.append(hostedRow(save));
    applyLock();
  });

  // ----- Dialog -----

  $("saves-reload").addEventListener("click", () => location.reload());
  openButton.addEventListener("click", () => {
    say("");
    renderProfiles();
    renderSlots();
    dialog.showModal();
  });
  $("close-saves").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", opts.onClose);
  openButton.disabled = false;
}
