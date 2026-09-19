// Populates public/engine/ with the WebAssembly engine build.
//
//   AA_ENGINE_DIR=<dir with amulets-armor.*> npm run engine -- --update-lock
//       Dev: copy a local engine build and (re)write engine.lock.json.
//   npm run engine
//       Clean checkout / CI: verify what is in public/engine against the lock,
//       downloading anything missing or wrong from `baseUrl` in the lock.
//
// Nothing here is committed except engine.lock.json (the artifacts are too big
// for git and are derived from the engine fork).

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(root, "engine.lock.json");
const outDir = join(root, "public", "engine");
const FILES = ["amulets-armor.js", "amulets-armor.wasm", "amulets-armor.data"];

const args = new Set(process.argv.slice(2));
const localDir = process.env.AA_ENGINE_DIR;

const sha256 = (path) =>
  new Promise((ok, fail) => {
    const h = createHash("sha256");
    createReadStream(path)
      .on("data", (d) => h.update(d))
      .on("end", () => ok(h.digest("hex")))
      .on("error", fail);
  });

const readLock = async () => {
  try {
    return JSON.parse(await readFile(lockPath, "utf8"));
  } catch {
    return null;
  }
};

const matches = async (path, entry) => {
  try {
    return (await stat(path)).size === entry.size && (await sha256(path)) === entry.sha256;
  } catch {
    return false;
  }
};

await mkdir(outDir, { recursive: true });
let lock = await readLock();

if (localDir) {
  const files = {};
  for (const name of FILES) {
    const dest = join(outDir, name);
    console.log(`copy ${name}`);
    await copyFile(join(localDir, name), dest);
    files[name] = { size: (await stat(dest)).size, sha256: await sha256(dest) };
  }
  if (args.has("--update-lock")) {
    lock = {
      ...(lock ?? {}),
      engine: {
        repo: process.env.AA_ENGINE_REPO ?? lock?.engine?.repo,
        commit: process.env.AA_ENGINE_COMMIT ?? lock?.engine?.commit,
      },
      baseUrl: lock?.baseUrl ?? null,
      files,
    };
    await writeFile(lockPath, JSON.stringify(lock, null, 2) + "\n");
    console.log("wrote engine.lock.json");
  } else if (lock) {
    for (const name of FILES) {
      if (files[name].sha256 !== lock.files[name]?.sha256)
        console.warn(`warning: ${name} differs from engine.lock.json (use --update-lock to accept)`);
    }
  }
} else {
  if (!lock) throw new Error("engine.lock.json is missing; run once with AA_ENGINE_DIR set and --update-lock");
  for (const name of FILES) {
    const dest = join(outDir, name);
    const entry = lock.files[name];
    if (await matches(dest, entry)) {
      console.log(`ok   ${name}`);
      continue;
    }
    if (!lock.baseUrl) throw new Error(`${name} is missing or wrong and the lock has no baseUrl to download from`);
    const url = `${lock.baseUrl.replace(/\/$/, "")}/${name}`;
    console.log(`get  ${url}`);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
    if (!(await matches(dest, entry))) throw new Error(`${name}: hash mismatch after download`);
  }
}
