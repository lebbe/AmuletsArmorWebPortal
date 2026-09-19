// Downloads the music listed in music.json into public/music/, checks the sha256 of
// every file, and writes public/music/index.json for the music player.
//
//   npm run music              (also runs before `npm run build`)
//   npm run music -- --lenient (before `npm run dev`: a failed download is only a warning)
//
// The files are not committed; music.json (with the licence and author of each one) is.
// They are hosted by the site itself: the sources do not allow cross-origin requests
// from a browser, and the soundfont author asks that pages do not link its file directly.

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "music");
const lenient = process.argv.includes("--lenient");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const config = JSON.parse(await readFile(join(root, "music.json"), "utf8"));
await mkdir(join(outDir, "midi"), { recursive: true });

/** The bytes of a file with a known hash: from disk if it is there, else downloaded. Null if lenient and it failed. */
async function get(url, hash, path) {
  const name = path.slice(outDir.length + 1);
  try {
    const have = await readFile(path).catch(() => null);
    if (have && sha256(have) === hash) {
      console.log(`ok   ${name}`);
      return have;
    }
    console.log(`get  ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const actual = sha256(bytes);
    // Never lenient: a wrong file is worse than a missing one.
    if (actual !== hash) {
      console.error(`${name}: sha256 mismatch (expected ${hash}, got ${actual})`);
      process.exit(1);
    }
    await writeFile(`${path}.tmp`, bytes);
    await rename(`${path}.tmp`, path);
    return bytes;
  } catch (e) {
    if (!lenient) throw new Error(`${name}: download failed: ${e.message}`);
    console.warn(`warning: ${name}: download failed (${e.message}); continuing without it`);
    return null;
  }
}

const credit = (x) => ({ author: x.author, license: x.license, page: x.page });
const index = { tracks: [], midi: [], soundfont: null, streams: config.streams ?? [] };

for (const t of config.tracks) {
  const file = `${t.id}${extname(new URL(t.url).pathname)}`;
  if (await get(t.url, t.sha256, join(outDir, file))) index.tracks.push({ id: t.id, title: t.title, file, ...credit(t) });
}

for (const set of config.midi) {
  const zip = await get(set.archive.url, set.archive.sha256, join(outDir, `midi-${set.archive.sha256.slice(0, 8)}.zip`));
  if (!zip) continue;
  const entries = unzipSync(zip);
  for (const f of set.files) {
    if (!entries[f.entry]) throw new Error(`${f.entry} is not in ${set.archive.url}`);
    await writeFile(join(outDir, "midi", `${f.id}.mid`), entries[f.entry]);
    index.midi.push({ id: f.id, title: f.title, file: `midi/${f.id}.mid`, ...credit(set) });
  }
}

const sf = config.soundfont;
if (sf && (await get(sf.url, sf.sha256, join(outDir, "soundfont.sf2")))) {
  index.soundfont = { name: sf.name, file: "soundfont.sf2", author: sf.author, license: sf.license, page: sf.page };
}

await writeFile(join(outDir, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`wrote public/music/index.json (${index.tracks.length} tracks, ${index.midi.length} midi, ${index.streams.length} streams)`);
