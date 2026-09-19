import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

/** After the build: write dist/sw.js from scripts/sw.js, precaching everything except the engine and the map packs. */
function serviceWorker(): Plugin {
  let outDir = "";
  const list = (dir: string, prefix = ""): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? list(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
    );
  return {
    name: "aa-service-worker",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = list(outDir)
        .filter((f) => !f.startsWith("engine/") && !f.startsWith("mods/") && f !== "sw.js")
        .sort();
      const template = readFileSync(resolve("scripts/sw.js"), "utf8");
      const hash = createHash("sha256").update(template);
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const precache = ["./", ...files];
      const code = template
        .replace("__VERSION__", hash.digest("hex").slice(0, 12))
        .replace("__PRECACHE__", JSON.stringify(precache, null, 2));
      writeFileSync(join(outDir, "sw.js"), code);
    },
  };
}

export default defineConfig({
  // Relative URLs, so the built site works from any host or sub-path.
  // Both pages live at the site root for this to hold.
  base: "./",
  plugins: [serviceWorker()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        play: "play.html",
      },
    },
  },
});
