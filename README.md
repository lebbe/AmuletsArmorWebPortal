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

## Music player

An optional player in the play page toolbar (`src/music/`, `src/ui/music-ui.ts`): open the dialog with the music button, play or pause and skip
with the buttons next to it, and set the volume with the slider. In fullscreen the same controls become a strip at the right edge (dimmed until the
pointer is over it); the dialog is inside `#player` so that it can be shown there too. It has its own audio, separate from the game's, and follows
Mute and a hidden tab. The game plays its own music as well: turn it off in Settings, Sound. Videos recorded with the record button contain only
the game's sound, not this music.

- **Tracks**: ogg/mp3 files hosted by the site. **MIDI**: MIDI files played in the browser by [SpessaSynth](https://github.com/spessasus/spessasynth_lib)
  (Apache-2.0, an AudioWorklet synthesizer) with the GeneralUser GS soundfont; the 32 MB soundfont is fetched when MIDI is first used and kept in the
  Cache API (`aa-music`). A MIDI file from the player's own computer can be played too. **Live radio**: an `<audio>` element on a stream address, from
  the `streams` list or one typed in by the player (kept in `localStorage`). Pausing a stream drops the connection; playing again reconnects.
  Streams must be `https://` on an https site.
- **What is in it, and why**: `music.json` lists every file with its author, licence and source page, and `npm run music` (also run before
  `dev` and `build`) downloads them into `public/music/` (gitignored), checks their sha256 and writes `public/music/index.json`. Today: seven CC0
  tracks and five CC0 MIDI files from [OpenGameArt](https://opengameart.org), and the GeneralUser GS soundfont (its licence allows use in software; the
  author asks that pages host their own copy rather than link his). The credits list in the dialog is made from the same data. That is about 50 MB
  extra to host; it is not part of the game download and is not precached by the service worker.
- **Adding music**: only add what we may host: a licence that allows redistribution (CC0, CC BY with credit), or written permission from the artist.
  Check the licence on the source page of each file (an OpenGameArt collection can mix licences). `streams` in `music.json` is empty on purpose:
  add an internet radio station only with its operator's permission. No dungeon synth Icecast station was found; the dungeon synth 24/7 streams found are
  on YouTube, whose embed rules do not allow hiding the player.

## Layout

- `index.html`, `play.html`: static pages (the settings dialog markup is in `play.html`). `src/style.css`: shared styles.
- `src/play.ts`: the play page. `src/ui/`: toolbar, settings and display dialogs, icons ([Pixelarticons](https://github.com/halfmage/pixelarticons), MIT).
- `src/display/`: display options and layout, screenshots and video.
- `src/settings/`: reading and writing the game's `config.ini` / `control.txt` (`store.ts`), the list of settings (`schema.ts`), key presets (`keys.ts`).
- `src/engine/`: loading the engine (`loader.ts`), its browser cache (`cache.ts`), audio (`audio.ts`), saves in IndexedDB (`storage.ts`).
- `src/music/`, `src/ui/music-ui.ts`, `music.json`, `scripts/fetch-music.mjs`: the music player.
- `src/saves/`: profiles, and reading and writing characters and backups. `src/ui/saves-dialog.ts` is the dialog.
- `src/pwa.ts`, `src/register-sw.ts`, `scripts/sw.js`, `public/manifest.webmanifest`: service worker, persistent storage, installable app.
- `mods.json`, `scripts/fetch-mods.mjs`, `src/mods/`, `src/ui/mods-button.ts`: community quests.
- `scripts/fetch-engine.mjs`, `engine.lock.json`: getting the engine build.
- `HANDOFF.md`: project notes and plans.
