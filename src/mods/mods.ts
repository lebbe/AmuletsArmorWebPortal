// Community map packs (see mods.json and scripts/fetch-mods.mjs).
//
// The build hosts the pack archives next to the site, with a manifest that says
// which files belong to which quest. The game finds quests by scanning
// MAPDESC/QUEST0.INI, QUEST1.INI, ... until one is missing, and maps the same
// way with MAPDESC/DES00000, DES00001, ..., so the numbering must have no gaps.
// Installing a pack therefore writes its quest and description files under the
// next free numbers. Level files (L<n>.*, S<n>.SRP) keep their names: the quest
// files refer to them by map number.
//
// /game lives in memory, so the selected packs are installed on every start
// (before main()), from an archive that is cached in the browser.

import { unzipSync } from "fflate";
import type { EmFS } from "../engine/emscripten";

const BASE = `${import.meta.env.BASE_URL}mods/`;
const SELECTION_KEY = "aa.mods";
const LAST_RUN_KEY = "aa.modsLastRun";
const CACHE_NAME = "aa-mods";

export interface QuestFiles {
  title: string;
  /** Names inside the archive. */
  quest: string;
  desc: string | null;
  files: string[];
}

export interface Pack {
  id: string;
  name: string;
  description: string;
  source: string;
  /** Map numbers (L<n>) the pack uses. */
  maps: number[];
  quests: QuestFiles[];
}

interface Manifest {
  sources: Record<string, { file: string; size: number; sha256: string }>;
  packs: Pack[];
}

/** What happened to a selected pack at install time. */
export interface Outcome {
  pack: Pack;
  /** Set when the pack was installed: the quest numbers it got. */
  questNumbers?: number[];
  /** Set when it was not: what went wrong. */
  problem?: string;
}

// ---------- Selection (what the player wants) ----------

function readLocal<T>(key: string): T | undefined {
  try {
    const text = localStorage.getItem(key);
    return text === null ? undefined : (JSON.parse(text) as T);
  } catch {
    return undefined;
  }
}

function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the choice is not remembered */
  }
}

/** ?mods=a,b in the address wins over what was remembered; ?mods= means none. */
function initialSelection(): string[] {
  const param = new URLSearchParams(location.search).get("mods");
  if (param !== null) return param.split(",").filter(Boolean);
  const saved = readLocal<unknown>(SELECTION_KEY);
  return Array.isArray(saved) ? saved.filter((s): s is string => typeof s === "string") : [];
}

// ---------- Downloading (with a cache) ----------

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function fetchArchive(source: Manifest["sources"][string]): Promise<Uint8Array> {
  const url = `${BASE}${source.file}`;
  // The hash is part of the key, so a new archive under the same name is fetched anew.
  const key = new Request(`${url}?sha256=${source.sha256}`);
  let cache: Cache | undefined;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(key);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch {
    /* Cache API unavailable (private mode, insecure context): download every time */
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const bytes = await res.arrayBuffer();
  // crypto.subtle only exists in secure contexts (https and localhost).
  if (crypto.subtle && hex(await crypto.subtle.digest("SHA-256", bytes)) !== source.sha256)
    throw new Error(`${source.file} does not match its checksum`);
  try {
    if (cache) {
      for (const old of await cache.keys()) if (old.url.startsWith(url) && old.url !== key.url) await cache.delete(old);
      await cache.put(key, new Response(bytes));
    }
  } catch {
    /* not cached: fine */
  }
  return new Uint8Array(bytes);
}

// ---------- Installing ----------

const has = (FS: EmFS, path: string) => {
  try {
    FS.lstat(path);
    return true;
  } catch {
    return false;
  }
};

/** Lower-cased names in a directory. */
const listing = (FS: EmFS, dir: string) => new Set(FS.readdir(dir).map((n) => n.toLowerCase()));

/** First number n (from 0) for which name(n) is not taken: what the game's scan will stop at. */
function nextFree(taken: Set<string>, name: (n: number) => string): number {
  let n = 0;
  while (taken.has(name(n).toLowerCase())) n++;
  return n;
}

export class Mods {
  private archives = new Map<string, Uint8Array | Error>();
  private written: string[] = [];
  /** Selected pack ids, in the order of the manifest. */
  selected: string[];
  outcomes: Outcome[] = [];
  /** Selected ids that this build does not know. */
  unknown: string[] = [];
  /** Things the player should know about before starting. */
  warnings: string[] = [];

  private manifest: Manifest | null;

  private constructor(manifest: Manifest | null, selection: string[]) {
    this.manifest = manifest;
    this.selected = selection;
  }

  /** Reads the manifest and starts downloading what is selected. */
  static async load(): Promise<Mods> {
    let manifest: Manifest | null = null;
    try {
      const res = await fetch(`${BASE}manifest.json`);
      const parsed: unknown = res.ok ? await res.json() : null;
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as Manifest).packs)) manifest = parsed as Manifest;
    } catch {
      /* no manifest: this build has no packs (run `npm run mods`) */
    }
    const mods = new Mods(manifest, initialSelection());
    mods.normalise();
    if (!manifest) return mods;
    if (mods.selected.length === 0 && !new URLSearchParams(location.search).has("mods") && readLocal<unknown>(SELECTION_KEY) === undefined) {
      mods.selected = manifest.packs.map((pack) => pack.id);
      mods.normalise();
      writeLocal(SELECTION_KEY, mods.selected);
    }
    await mods.download();
    return mods;
  }

  get packs(): Pack[] {
    return this.manifest?.packs ?? [];
  }

  private normalise(): void {
    const chosen = new Set(this.selected);
    this.unknown = this.selected.filter((id) => !this.packs.some((p) => p.id === id));
    this.selected = this.packs.filter((p) => chosen.has(p.id)).map((p) => p.id);
  }

  private async download(): Promise<void> {
    if (!this.manifest) return;
    const sources = new Set(this.packs.filter((p) => this.selected.includes(p.id)).map((p) => p.source));
    await Promise.all(
      [...sources]
        .filter((id) => !this.archives.has(id))
        .map(async (id) => {
          try {
            this.archives.set(id, await fetchArchive(this.manifest!.sources[id]));
          } catch (e) {
            this.archives.set(id, e instanceof Error ? e : new Error(String(e)));
          }
        }),
    );
  }

  /** Remember a new selection. Call install() again afterwards if the game has not started. */
  async select(ids: string[]): Promise<void> {
    this.selected = ids;
    this.normalise();
    writeLocal(SELECTION_KEY, this.selected);
    // The address no longer says what is selected.
    const url = new URL(location.href);
    if (url.searchParams.has("mods")) {
      url.searchParams.delete("mods");
      history.replaceState(null, "", url);
    }
    await this.download();
  }

  /** Write the selected packs into the game's filesystem. Undoes an earlier install first. */
  install(FS: EmFS): void {
    this.uninstall(FS);
    this.outcomes = [];

    // Level numbers already taken by the game, and by the packs installed before this one.
    const mapOwner = new Map<number, string>();
    for (const n of FS.readdir("/game")) {
      const m = /^l(\d+)\.map$/i.exec(n);
      if (m) mapOwner.set(Number(m[1]), "the game");
    }
    const taken = listing(FS, "/game/MAPDESC");

    for (const pack of this.packs.filter((p) => this.selected.includes(p.id))) {
      const archive = this.archives.get(pack.source);
      if (!archive || archive instanceof Error) {
        this.outcomes.push({ pack, problem: `could not be downloaded${archive ? ` (${archive.message})` : ""}` });
        continue;
      }
      const clash = pack.maps.find((m) => mapOwner.has(m));
      if (clash !== undefined) {
        this.outcomes.push({ pack, problem: `uses map ${clash}, which ${mapOwner.get(clash)} already uses` });
        continue;
      }

      const wanted = new Set(pack.quests.flatMap((q) => [q.quest, q.desc, ...q.files]).filter((n): n is string => n !== null));
      const entries = unzipSync(archive, { filter: (f) => wanted.has(f.name) });
      const put = (path: string, data: Uint8Array) => {
        FS.writeFile(path, data);
        this.written.push(path);
      };

      const questNumbers: number[] = [];
      for (const q of pack.quests) {
        const quest = nextFree(taken, (n) => `quest${n}.ini`);
        taken.add(`quest${quest}.ini`);
        questNumbers.push(quest);
        put(`/game/MAPDESC/QUEST${quest}.INI`, entries[q.quest]);
        if (q.desc) {
          const desc = nextFree(taken, (n) => `des${String(n).padStart(5, "0")}`);
          taken.add(`des${String(desc).padStart(5, "0")}`);
          put(`/game/MAPDESC/DES${String(desc).padStart(5, "0")}`, entries[q.desc]);
        }
        for (const f of q.files) put(`/game/${f.toUpperCase()}`, entries[f]);
      }
      for (const m of pack.maps) mapOwner.set(m, pack.name);
      this.outcomes.push({ pack, questNumbers });
    }
    this.warnings = this.compareWithLastRun();
  }

  private uninstall(FS: EmFS): void {
    for (const path of this.written) if (has(FS, path)) FS.unlink(path);
    this.written = [];
  }

  // ---------- Saves ----------
  // A character remembers its quest by number, and the numbers depend on which
  // packs are loaded. We cannot look inside the saves, so we remember what was
  // loaded the last time the game started and warn when that differs.

  /** Call when the game starts. */
  recordStart(): void {
    writeLocal(
      LAST_RUN_KEY,
      this.outcomes.filter((o) => o.questNumbers).map((o) => ({ id: o.pack.id, quests: o.questNumbers })),
    );
  }

  private compareWithLastRun(): string[] {
    const last = readLocal<Array<{ id: string; quests: number[] }>>(LAST_RUN_KEY);
    if (!Array.isArray(last)) return [];
    const now = new Map(this.outcomes.filter((o) => o.questNumbers).map((o) => [o.pack.id, o.questNumbers!]));
    const out: string[] = [];
    for (const { id, quests } of last) {
      const name = this.packs.find((p) => p.id === id)?.name ?? id;
      const numbers = now.get(id);
      if (!numbers) out.push(`${name} was loaded last time but is not now. Characters saved during its quests may not work.`);
      else if (numbers.join() !== quests.join())
        out.push(`${name} now has different quest numbers than last time. Characters saved during its quests may end up in the wrong quest.`);
    }
    return out;
  }
}
