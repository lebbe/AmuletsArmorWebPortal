# Amulets and Armor for the Web

A web host for [Amulets & Armor](http://amuletsandarmor.com/): a static about page
(`index.html`) and a page that runs the game in the browser (`play.html`). The game is
the original code compiled to WebAssembly with Emscripten; this repo contains only the
site around it.

The game engine lives in a separate repo, the `emscripten` branch of
[lebbe/AmuletsArmor](https://github.com/lebbe/AmuletsArmor) (a fork of
[ExiguusEntertainment/AmuletsArmor](https://github.com/ExiguusEntertainment/AmuletsArmor),
GPL-3.0). Its build output is not committed here: it includes a 111 MB data file. Instead,
`engine.lock.json` pins the expected build, and `npm run engine` fills `public/engine/`.

## Develop

```sh
npm install
AA_ENGINE_DIR=<folder with amulets-armor.js/.wasm/.data> npm run engine   # copy a local engine build
npm run dev
```

`npm run engine -- --update-lock` also rewrites `engine.lock.json` after you have built a new
engine. Without `AA_ENGINE_DIR`, `npm run engine` verifies the files against the lock and
downloads what is missing from the `baseUrl` in the lock (not set up yet).

`npm run dev` and `npm run build` also run `npm run mods` first: it downloads the community map packs listed in
`mods.json` into `public/mods/` (gitignored), checks their sha256 and writes `public/mods/manifest.json`. See
"Community quests" below.

`npm run build` writes the site to `dist/`, and `npm run preview` serves it. The site uses
relative URLs, so `dist/` can be hosted at any path.

## Community quests

`mods.json` lists the packs (download URL, sha256). They are downloaded at build time and hosted by the site itself, because
GitHub release downloads do not allow cross-origin requests. The only pack today is *Community quests*: the three known
community quests (Trial of Time, Isle of Thanatos, The Sorcerer's Keep, by cabbruzzese) from one zip.

- Off by default. The map button in the play page toolbar turns them on; the choice is kept in `localStorage`. `?mods=community-quests` in
  the address overrides it for that visit (`?mods=` means none).
- On every start, before `main()`, `src/mods/mods.ts` writes the quest files under the next free `MAPDESC/QUESTn.INI` and
  `DESnnnnn` numbers (the game scans until one is missing) and the level files (`L<n>.*`, `S<n>.SRP`) under their own names. The
  zip is cached with the Cache API. A pack whose map numbers are already taken (by the game or another pack) is skipped, with a note.
- Quest numbers depend on what is loaded, and saves remember their quest by number, so the site warns when the loaded packs differ
  from the last start.

## Offline play and caching

The download is 111 MB, so the site keeps it in the browser (production build only; `npm run dev` skips the service worker).

- **Engine files** (`src/engine/cache.ts`): the page puts `engine/amulets-armor.{js,wasm,data}` into the Cache API, one cache per file
  named after its sha256 in `engine.lock.json` (`aa-engine-<file>-<hash>`), and hands them to the engine as blob URLs. The first visit
  shows the download progress; later visits skip the network. A new engine build downloads only the files whose hash changed, and
  caches of old builds are deleted afterwards. If the Cache API is missing, or the quota is too small, the game loads the plain way.
- **Site shell** (`scripts/sw.js`): a service worker precaches the pages, scripts, styles and icons. `vite.config.ts` writes it to
  `dist/sw.js` with the file list and a version derived from their contents, so every deploy updates it. It leaves `engine/` and `mods/`
  alone. The community quest zip is cached by `src/mods/mods.ts` in the Cache API too (`aa-mods`, keyed on its sha256).
- **Why not the service worker for the engine?** On the first visit the worker is not in control yet, so the page's own download would
  be fetched a second time by the worker. Doing it from the page also gives exact progress.
- The start screen says "Stored in this browser" once both parts are in place. The page asks for persistent storage
  (`navigator.storage.persist()`) when you click play, which also protects saves from being cleared by the browser.
- **PWA**: `public/manifest.webmanifest` and `public/icons/` (made from `aa-logo.png`) make the site installable. It opens at `play.html`.
- **Compression** (measured on the real `.data`, 111.1 MB): gzip -6 gives 82.4 MB (74%), brotli q5 80.7 MB (73%), brotli q9 80.3 MB
  (72%), brotli q11 68.9 MB (62%, 5 minutes to compress). It compresses poorly because 71 MB of it is the raw PCM music. So: serve it
  with brotli precompressed at q11 if the host allows (Cloudflare and Netlify compress on the fly at a lower level), and otherwise gzip
  is fine. The loader measures progress against the sizes in the lock, so it does not matter which encoding the host uses. Check the
  real host once it is chosen.

## Layout

- `index.html`, `play.html`: static pages (the settings dialog markup is in `play.html`). `src/style.css`: shared styles.
- `src/play.ts`: the play page. `src/ui/`: toolbar, settings dialog, icons ([Pixelarticons](https://github.com/halfmage/pixelarticons), MIT).
- `src/settings/`: reading and writing the game's `config.ini` / `control.txt` (`store.ts`), the list of settings (`schema.ts`), key presets (`keys.ts`).
- `src/engine/`: loading the engine (`loader.ts`), its browser cache (`cache.ts`), audio (`audio.ts`), saves in IndexedDB (`storage.ts`).
- `src/pwa.ts`, `src/register-sw.ts`, `scripts/sw.js`, `public/manifest.webmanifest`: service worker, persistent storage, installable app.
- `mods.json`, `scripts/fetch-mods.mjs`, `src/mods/`, `src/ui/mods-button.ts`: community quests.
- `scripts/fetch-engine.mjs`, `engine.lock.json`: getting the engine build.
- `HANDOFF.md`: project notes and plans.
