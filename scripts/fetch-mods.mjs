// Downloads the community map packs listed in mods.json into public/mods/,
// checks their sha256, and writes public/mods/manifest.json for the site.
//
//   npm run mods              (also runs before `npm run build`)
//   npm run mods -- --lenient (before `npm run dev`: a failed download is only a warning)
//
// The archives are not committed: mods.json is the only thing in git. They are
// fetched here at build time, and hosted by the site itself, because the hosts
// (GitHub release downloads) do not allow cross-origin requests from a browser.
//
// The manifest is derived from the archive contents. For every quest in an
// archive it lists which files belong to it (QUESTn.INI, its DES file, and the
// L<n>.* / S<n>.SRP files of every map the quest uses), so a pack in mods.json
// can also pick some of the quests out of an archive that bundles several.

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "mods");
const lenient = process.argv.includes("--lenient");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const warn = (msg) => console.warn(`warning: ${msg}`);

const config = JSON.parse(await readFile(join(root, "mods.json"), "utf8"));
await mkdir(outDir, { recursive: true });

// ---------- Download ----------

async function readIfExists(path) {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

/** Returns the archive bytes, or null if it could not be had (lenient mode only). */
async function fetchSource(source) {
  const path = join(outDir, `${source.id}.zip`);
  const have = await readIfExists(path);
  if (have && sha256(have) === source.sha256) {
    console.log(`ok   ${source.id}.zip`);
    return have;
  }
  try {
    console.log(`get  ${source.url}`);
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const actual = sha256(bytes);
    if (actual !== source.sha256) {
      // Never lenient: a wrong file is worse than a missing one.
      console.error(`${source.id}: sha256 mismatch (expected ${source.sha256}, got ${actual})`);
      process.exit(1);
    }
    await writeFile(`${path}.tmp`, bytes);
    await rename(`${path}.tmp`, path);
    return bytes;
  } catch (e) {
    if (!lenient) throw new Error(`${source.id}: download failed: ${e.message}`);
    warn(`${source.id}: download failed (${e.message}); continuing without it`);
    await rm(path, { force: true });
    return null;
  }
}

// ---------- Analyse ----------

/** Minimal INI reader: { section: { key: value } }, lower-cased, first value of a repeated key wins. */
function parseIni(text) {
  const out = {};
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const s = /^\[(.+)\]$/.exec(line);
    if (s) {
      section = s[1].toLowerCase();
      out[section] ??= {};
      continue;
    }
    const kv = /^([^=]+?)\s*=\s*(.*)$/.exec(line);
    if (kv && section) out[section][kv[1].toLowerCase()] ??= kv[2];
  }
  return out;
}

/** What the archive contains, grouped by quest. Names are matched ignoring case. */
function analyseArchive(id, bytes) {
  const entries = unzipSync(bytes);
  const names = Object.keys(entries).filter((n) => !n.endsWith("/"));
  const byLower = new Map(names.map((n) => [n.toLowerCase(), n]));
  const text = (n) => new TextDecoder().decode(entries[n]);
  const claimed = new Set();
  const claim = (n) => (claimed.add(n), n);

  const desByMap = new Map(); // first map of a quest -> DES entry
  for (const n of names) {
    if (!/^mapdesc\/des\d+$/i.test(n)) continue;
    const map = parseInt(text(n).split(/\r?\n/)[1], 10);
    if (Number.isNaN(map)) warn(`${id}: ${n} has no map number on its second line`);
    else desByMap.set(map, n);
  }

  const quests = new Map();
  for (const n of names) {
    const m = /^mapdesc\/quest(\d+)\.ini$/i.exec(n);
    if (!m) continue;
    const ini = parseIni(text(n));
    const firstmap = parseInt(ini.main?.firstmap, 10);
    if (Number.isNaN(firstmap)) {
      warn(`${id}: ${n} has no firstmap; skipped`);
      continue;
    }
    let maps = Object.keys(ini)
      .filter((s) => /^map\d+$/.test(s))
      .sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3)))
      .map((s) => parseInt(ini[s].mapnumber, 10))
      .filter((v) => !Number.isNaN(v));
    if (!maps.length) maps = Array.from({ length: parseInt(ini.main.nummaps, 10) || 1 }, (_, i) => firstmap + i);
    if (maps.length !== parseInt(ini.main.nummaps, 10)) warn(`${id}: ${n} says nummaps=${ini.main.nummaps} but lists ${maps.length} maps`);

    const files = [];
    for (const map of maps) {
      for (const ext of ["MAP", "I", "GEN", "LIT"]) {
        const found = byLower.get(`l${map}.${ext}`.toLowerCase());
        if (found) files.push(claim(found));
        else if (ext === "MAP" || ext === "I") throw new Error(`${id}: ${n} needs L${map}.${ext}, which is not in the archive`);
      }
      const script = byLower.get(`s${map}.srp`);
      if (script) files.push(claim(script));
    }
    const desc = desByMap.get(firstmap) ?? null;
    if (!desc) warn(`${id}: no MAPDESC/DES file for the map ${firstmap} of ${n}; it will not be listed in the guild`);
    quests.set(parseInt(m[1], 10), {
      quest: claim(n),
      desc: desc && claim(desc),
      title: (ini.main.title ?? "").replace(/\^\d{3}/g, "").trim(),
      maps,
      files,
    });
  }

  for (const n of names) if (!claimed.has(n) && !/^mapdesc\/des\d+$/i.test(n)) warn(`${id}: ${n} belongs to no quest and is ignored`);
  return quests;
}

// ---------- Run ----------

const sources = {};
const analysed = new Map();
for (const source of config.sources) {
  const bytes = await fetchSource(source);
  if (!bytes) continue;
  sources[source.id] = { file: `${source.id}.zip`, size: (await stat(join(outDir, `${source.id}.zip`))).size, sha256: source.sha256 };
  analysed.set(source.id, analyseArchive(source.id, bytes));
}

const packs = [];
for (const pack of config.packs) {
  const quests = analysed.get(pack.source);
  if (!quests) {
    warn(`pack ${pack.id}: source ${pack.source} is not available; left out`);
    continue;
  }
  // A pack is a whole archive, or just the quests listed in `quests` (numbers as in the archive).
  const wanted = pack.quests ?? [...quests.keys()];
  const chosen = wanted.map((n) => {
    const q = quests.get(n);
    if (!q) throw new Error(`pack ${pack.id}: quest ${n} is not in ${pack.source} (it has ${[...quests.keys()].join(", ")})`);
    console.log(`pack ${pack.id}: quest ${n} "${q.title}", maps ${q.maps.join(", ")}`);
    return { title: q.title, quest: q.quest, desc: q.desc, files: q.files };
  });
  packs.push({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    source: pack.source,
    maps: wanted.flatMap((n) => quests.get(n).maps),
    quests: chosen,
  });
}

// Packs that use the same map would overwrite each other's levels.
const owner = new Map();
for (const p of packs) {
  for (const m of p.maps) {
    if (owner.has(m)) warn(`packs ${owner.get(m)} and ${p.id} both use map ${m}; they cannot be loaded together`);
    else owner.set(m, p.id);
  }
}

await writeFile(join(outDir, "manifest.json"), JSON.stringify({ sources, packs }, null, 2) + "\n");
console.log(`wrote public/mods/manifest.json (${packs.length} packs)`);
