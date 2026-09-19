// Profiles: separate sets of characters and settings in one browser.
//
// Each profile is its own IDBFS mount, so its own IndexedDB database (named after
// the mount point). The first profile keeps the original mount point, /persist, so
// saves made before profiles existed are still there. The mount happens once, at
// page load, so switching profiles reloads the page.

const KEY = "aa.profiles";
const FIRST_ID = "default";

export interface Profile {
  id: string;
  name: string;
}

interface Registry {
  active: string;
  profiles: Profile[];
}

const fresh = (): Registry => ({ active: FIRST_ID, profiles: [{ id: FIRST_ID, name: "Default" }] });

function load(): Registry {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Registry> | null;
    const profiles = (parsed?.profiles ?? []).filter(
      (p): p is Profile => typeof p?.id === "string" && /^[a-z0-9]+$/.test(p.id) && typeof p.name === "string",
    );
    if (!profiles.some((p) => p.id === FIRST_ID)) profiles.unshift(fresh().profiles[0]);
    const active = profiles.some((p) => p.id === parsed?.active) ? (parsed!.active as string) : FIRST_ID;
    return { active, profiles };
  } catch {
    return fresh();
  }
}

let registry = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(registry));
  } catch {
    /* storage unavailable: profiles are not kept */
  }
}

export const profiles = (): readonly Profile[] => registry.profiles;
export const activeProfile = (): Profile => registry.profiles.find((p) => p.id === registry.active)!;

/** Where a profile's saves are mounted; also the name of its IndexedDB database. */
export const mountPoint = (id: string): string => (id === FIRST_ID ? "/persist" : `/persist-${id}`);

export const isFirst = (id: string): boolean => id === FIRST_ID;

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 40);
}

export function addProfile(name: string): Profile {
  const profile = { id: `p${Date.now().toString(36)}`, name: cleanName(name) || "Profile" };
  registry.profiles.push(profile);
  save();
  return profile;
}

export function renameProfile(id: string, name: string): void {
  const profile = registry.profiles.find((p) => p.id === id);
  if (!profile) return;
  profile.name = cleanName(name) || profile.name;
  save();
}

/** Takes effect at the next page load. */
export function setActiveProfile(id: string): void {
  if (!registry.profiles.some((p) => p.id === id)) return;
  registry.active = id;
  save();
}

/** Forgets a profile and deletes its saved data. The active profile and the first one cannot be removed. */
export function removeProfile(id: string): Promise<boolean> {
  if (id === registry.active || id === FIRST_ID) return Promise.resolve(false);
  registry.profiles = registry.profiles.filter((p) => p.id !== id);
  save();
  try {
    localStorage.removeItem(`aa.pendingSettings:${mountPoint(id)}`);
    const backups = readBackups();
    delete backups[id];
    writeBackups(backups);
  } catch {
    /* storage unavailable */
  }
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(mountPoint(id));
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
    req.onblocked = () => resolve(false);
  });
}

// ---------- When each profile was last backed up ----------

const BACKUP_KEY = "aa.lastBackup";

function readBackups(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeBackups(backups: Record<string, number>): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
  } catch {
    /* not remembered */
  }
}

/** Milliseconds since the epoch, or undefined if this profile was never backed up here. */
export const lastBackup = (id: string): number | undefined => readBackups()[id];

export function recordBackup(id: string): void {
  writeBackups({ ...readBackups(), [id]: Date.now() });
}
