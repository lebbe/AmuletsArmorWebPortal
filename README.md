# Amulets and Armor for the Web

> **Hosting the game on the public web needs permission from Exiguus Entertainment.**
> Amulets & Armor is owned by Exiguus Entertainment. Its own license file says that "sale or distribution" of the game is
> not allowed except by Exiguus Entertainment or by those who have received written permission from them
> ([`Exe/license.txt`, line 4](https://github.com/ExiguusEntertainment/AmuletsArmor/blob/90819a3ff03f80c5bb52657e9e2d22a8c4693d93/Exe/license.txt#L4)).
> This repository contains only the code of the web site, not the game data. But if you build this site with the game and put
> it on a public web server, you are distributing the game. Get written permission first.

A web host for [Amulets & Armor](http://amuletsandarmor.com/), the 1997 fantasy RPG: a static about page
(`index.html`) and a page that runs the game in the browser (`play.html`). The game is
the original code compiled to WebAssembly with Emscripten; this repo contains only the
site around it.

The game engine lives in a separate repo: [lebbe/AmuletsArmor](https://github.com/lebbe/AmuletsArmor), a fork of
[ExiguusEntertainment/AmuletsArmor](https://github.com/ExiguusEntertainment/AmuletsArmor) (GPL-3.0). The Emscripten
build target is on the fork's `main` branch (the branch meant for upstream), and the fork's `master` includes it. Its build
output is not committed here: it includes a 46 MB data file. Instead, `engine.lock.json` pins the expected build (a commit
of the fork's `main`), and `npm run engine` fills `public/engine/`.

To run the site on your own computer, follow **[Running it locally](docs/running-locally.md)**: it covers getting the
fork, building the game with Emscripten and linking it here.

## Develop

The site needs an engine build next to it. [Running it locally](docs/running-locally.md) is the full walkthrough; the short
version, with a build in `<engine>/out/web` and Node 20.19+ or 22.12+:

```sh
npm install
AA_ENGINE_DIR=<engine>/out/web npm run engine -- --update-lock   # copy the build and record its hashes
npm run dev
```

`--update-lock` rewrites `engine.lock.json` to match the files you copied. Use it with any build of your own: a local build
never has the same hashes as the pinned one, and the lock must match the files. Without `AA_ENGINE_DIR`, `npm run engine`
verifies the files against the lock and downloads what is missing from the `baseUrl` in the lock (not set up yet).

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

The download is 46 MB, so the site keeps it in the browser (production build only; `npm run dev` skips the service worker).

- **Engine files** (`src/engine/cache.ts`): the page puts `engine/amulets-armor.{js,wasm,data}` into the Cache API, one cache per file
  named after its sha256 in `engine.lock.json` (`aa-engine-<file>-<hash>`), and hands them to the engine as blob URLs. The first visit
  shows the download progress; later visits skip the network. A new engine build downloads only the files whose hash changed, and
  caches of old builds are deleted afterwards. If the Cache API is missing, or the quota is too small, the game loads the plain way.
- **Site shell** (`scripts/sw.js`): a service worker precaches the pages, scripts, styles and icons. `vite.config.ts` writes it to
  `dist/sw.js` with the file list and a version derived from their contents, so every deploy updates it. It leaves `engine/` and `mods/`
  alone. The community quest zip is cached by `src/mods/mods.ts` in the Cache API too (`aa-mods`, keyed on its sha256).
- **Why not the service worker for the engine?** On the first visit the worker is not in control yet, so the page's own download would
  be fetched a second time by the worker. Doing it from the page also gives exact progress.
- **Starting over**: Settings > Storage > "Delete stored game files" deletes the engine, shell and map pack caches and unregisters the service worker
  (`clearCachedFiles` in `src/pwa.ts`), then reloads. Characters and settings are not touched. It is rarely needed: a new engine build has new hashes in
  `engine.lock.json`, so it is downloaded by itself. Use it to test from a clean state, or if a cache is ever stuck.
- The start screen says "Stored in this browser" once both parts are in place. The page asks for persistent storage
  (`navigator.storage.persist()`) when you click play, which also protects saves from being cleared by the browser.
- **PWA**: `public/manifest.webmanifest` and `public/icons/` (made from `aa-logo.png`) make the site installable. It opens at `play.html`.
- **Compression** (measured on the real `.data`, 46.2 MB): gzip -6 gives 22.4 MB (48%), brotli q5 21.3 MB (46%), brotli q9 20.8 MB
  (45%), brotli q11 18.8 MB (41%, 2 minutes to compress). It compresses well since the music became Ogg Vorbis instead of raw PCM
  (the earlier 111 MB build only reached 74% with gzip). So any host's on-the-fly gzip or brotli is fine, and precompressing at q11 saves
  about 3 MB more. The loader measures progress against the sizes in the lock, so it does not matter which encoding the host uses.
  Check the real host once it is chosen.

## Display, screenshots and video

The monitor button in the play page toolbar opens the display options (`src/display/`, `src/ui/display-dialog.ts`). They only change the page
around the 640x400 canvas, and are kept in `localStorage` (`aa.display`).

- **Size**: fill the window, or whole-number multiples of 640x400 (falls back to filling when the window is smaller than 1x). Shape: 16:10 (the
  canvas as is), 4:3 (pixels 1.2 times as tall, as the 320x200 DOS game looked on a monitor) or stretched to the window. The size is worked out in
  `src/display/options.ts` (`frameSize`) from the free space, also in fullscreen. **Smooth pixels** turns off `image-rendering: pixelated`.
- **Screen filter**: scanlines, or "old monitor" (scanlines, vignette, rounded corners), as a CSS overlay (`#crt`) with an adjustable strength.
  Scanlines are one dark line per two canvas rows, so they are sharpest with whole-number scaling.
- **Fullscreen** shows only the game: centred on black, with the same shape and scaling choices, and no toolbar (the fullscreen request asks the browser
  to hide its own navigation UI, `navigationUI: "hide"`). The browser forces the fullscreen element to fill the screen, so the picture is sized and
  centred inside it (`Display` in `src/display/display.ts`). Exit with Esc (in Chromium, where Esc is kept for the game menu, hold Esc) or F11.
- **Screenshot** saves the canvas as a PNG (640x400, no filter). **Record video** uses `MediaRecorder` on `canvas.captureStream()` (WebM, or MP4
  in Safari) and downloads the file when stopped. The game's sound is included: `src/engine/audio.ts` also connects whatever goes to the
  speakers to a `MediaStreamAudioDestinationNode`. A muted or hidden tab is silent in the video too. A recording is lost if the page is closed.

## Saves and profiles

The save button in the play page toolbar opens the saves dialog (`src/saves/`, `src/ui/saves-dialog.ts`). Characters are
`S0000000/CHDATA00`..`CHDATA03` in the profile's IDBFS directory; the `CHDATA` format is not parsed, the files are treated as opaque.

- **Export / import**: each slot can be exported as a raw file and a file can be imported into any slot. **Back up everything** downloads a zip
  (all characters plus `config.ini` and `CONTROL.TXT`); **Restore a backup** puts it back. The game reads its character list at start, so
  importing and restoring are only possible before the game starts (after that the dialog says so and offers a page reload). Exporting always works.
- **Backup reminder**: the start screen asks for a backup when there are characters and the profile has never been backed up here, or was
  changed since a backup more than a week ago (`backupDue` in `src/saves/saves.ts`). The time of the last backup is kept in `localStorage` (`aa.lastBackup`).
- **Profiles**: every profile is its own IDBFS mount, so its own IndexedDB database. The first ("Default") keeps the original mount point `/persist`, so
  earlier saves are still there; the others use `/persist-<id>`. Characters, keys and settings are per profile. Profiles are listed in `localStorage`
  (`aa.profiles`); switching one reloads the page, because the mount happens once at load. Deleting a profile deletes its database (not for the one in use).
- **Ready-made characters**: if `public/saves/index.json` exists, the dialog lists its characters and adds one to the first free slot (or a chosen one)
  with one click. None are hosted yet. The file looks like this, with the character files next to it:

  ```json
  { "saves": [ { "id": "warrior", "name": "Level 10 warrior", "description": "…", "file": "warrior.CHDATA00", "requires": ["community-quests"] } ] }
  ```

  `requires` lists map pack ids (from `mods.json`); the dialog warns when one is not turned on. Where to host player-made characters, and who may add them, is open.

## Layout

- `index.html`, `play.html`: static pages (the settings dialog markup is in `play.html`). `src/style.css`: shared styles.
- `src/play.ts`: the play page. `src/ui/`: toolbar, settings and display dialogs, icons ([Pixelarticons](https://github.com/halfmage/pixelarticons), MIT).
- `src/display/`: display options and layout, screenshots and video.
- `src/settings/`: reading and writing the game's `config.ini` / `control.txt` (`store.ts`), the list of settings (`schema.ts`), key presets (`keys.ts`).
- `src/engine/`: loading the engine (`loader.ts`), its browser cache (`cache.ts`), audio (`audio.ts`), saves in IndexedDB (`storage.ts`).
- `src/saves/`: profiles, and reading and writing characters and backups. `src/ui/saves-dialog.ts` is the dialog.
- `src/pwa.ts`, `src/register-sw.ts`, `scripts/sw.js`, `public/manifest.webmanifest`: service worker, persistent storage, installable app.
- `mods.json`, `scripts/fetch-mods.mjs`, `src/mods/`, `src/ui/mods-button.ts`: community quests.
- `scripts/fetch-engine.mjs`, `engine.lock.json`: getting the engine build.
- `docs/running-locally.md`: how to get, build and run everything on your own computer.
- `HANDOFF.md`: project notes and plans, written along the way; some parts are out of date.

## License and credits

- **This site's code** is licensed under the [GNU GPL v3](LICENSE) (`GPL-3.0-only`), the same license as the game engine it runs.
  The license covers the code of this repository only. It does not cover the game data, the game logo (`public/aa-logo.png`) and the
  icons made from it (`public/icons/`), which belong to the game's owners (see below). Third-party parts keep their own licenses:
  [fflate](https://github.com/101arrowz/fflate) and [Pixelarticons](https://github.com/halfmage/pixelarticons) are MIT.
- **The game engine** is GPL-3.0 ([ExiguusEntertainment/AmuletsArmor](https://github.com/ExiguusEntertainment/AmuletsArmor) and our
  [fork](https://github.com/lebbe/AmuletsArmor)). The exact commit this site uses is pinned in `engine.lock.json`.
- **The game itself** (art, sound, level data) was made by United Software Artists in 1997 and is owned by Exiguus Entertainment, who
  released it for free in 2013 (see [amuletsandarmor.com](http://amuletsandarmor.com/), which does not support https). The license text
  shipped with the game data ([`Exe/license.txt`](https://github.com/ExiguusEntertainment/AmuletsArmor/blob/90819a3ff03f80c5bb52657e9e2d22a8c4693d93/Exe/license.txt#L4), also in the fork) reserves distribution to Exiguus Entertainment and to those
  they have given written permission. See the notice at the top.
- **Community quests** (Trial of Time, Isle of Thanatos, The Sorcerer's Keep) are by cabbruzzese, from
  [AmuletsAndArmorUserMaps](https://github.com/cabbruzzese/AmuletsAndArmorUserMaps) (GPL-3.0).
- This is an unofficial project.
