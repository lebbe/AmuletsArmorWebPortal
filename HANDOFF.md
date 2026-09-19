# Handoff: building the Amulets & Armor web site

Read this first. It is written for the next agent (or person) who picks up the
**site**. It says what exists, how to get the game engine into the site, what to
build, and which claims are verified versus assumed.

Snapshot date: 2026-09-19.

## 0. Progress log

**Project name: "Amulets and Armor for the Web"; repo: `lebbe/AmuletsArmorWebPortal`**
(<https://github.com/lebbe/AmuletsArmorWebPortal>, **private for now**, `main` pushed; it goes public once the license notice below is in place). The task list
lives in GitHub issues #1-#13 (map loader, music, no-music build, key presets, settings,
saves/profiles, caching, display, touch, gamepad, texture packs, sound packs, multiplayer).
Issues that need a change in the engine fork carry the `engine-change` label: ask the user first.
Hosting is undecided (candidates: GitHub Pages, own site www.lars-erik.no, or a new domain), and a public playable copy is blocked on
written permission from Exiguus Entertainment: see "Legal / licensing" below.

**Site structure now:** `index.html` (static about page, links to the official site
`http://amuletsandarmor.com/`, no https) and `play.html` (static page hosting the game;
its TypeScript is `src/play.ts`). `vite.config.ts` builds both, with `base: './'`, so both
pages must stay at the site root. Verified in the browser: about page renders, "Play the
game" leads to `play.html`, the game starts from there.

**Next (from the user):** load maps; load different default keyboard settings; and an
exploration session about further web-only features.

**2026-09-19 (later):** steps 1-4 of section 10 are done, except that nothing is
committed yet and the repo has no name or remote.

- `git init` done locally (branch `main`, files staged, not committed).
- `public/engine/` is gitignored. `npm run engine` populates it (`scripts/fetch-engine.mjs`):
  with `AA_ENGINE_DIR=<dir> npm run engine -- --update-lock` it copies a local build and
  rewrites `engine.lock.json`; without it, it verifies against the lock and downloads from
  `baseUrl` (still `null`: no release exists yet).
- Engine was rebuilt from fork commit `7f63a6a9` (`emscripten` branch) and locked.
- Milestone 1 code is in `src/engine/{loader,audio,storage}.ts`, `src/main.ts`,
  `src/style.css`. Verified in the in-app browser from `vite build` + `vite preview`:
  engine loads from `/engine/`, "Ready", click-to-play starts the game (canvas renders),
  `/persist` is mounted with `S0000000`, `config.ini`, `CONTROL.TXT` symlinked, and a
  marker file survived a full reload.
- **Not yet verified:** sound through the site, Mute, Fullscreen button + Esc lock,
  mouselook, a real character surviving reload. Ask the user to check these.
- **The folder was moved (2026-09-19) to `D:UsersLars-ErikcodeAA-webAA-emscripten`**: no `&` in the path any more, so npm works normally (the `node node_modules/...` workaround is gone) and the WSL symlink `~/aa-src` points at the new `AmuletsArmor` path.
- **MODULARIZE is done** (user-approved, engine change limited to the Emscripten build):
  the engine fork has two local commits on `emscripten` (`d826d892`, `a0d9628c`, not pushed): 2 link
  flags in `CMakeLists.txt`, a 2-line `shell.html` change, and a README paragraph. The engine
  script now defines a global `createAA(config)` factory; the site's `loader.ts` calls it
  after injecting the script. There is no global `Module` any more. Verified in the
  browser with both the site and the engine's own reference page. `engine.lock.json` was
  updated (only the `.js` hash changed; `.wasm` and `.data` are identical).
- **Rule from the user:** the engine folder is otherwise read-only build input. Do not
  change it without asking; ask first even for small changes.

**Map loader (issue #1) done, 2026-09-19:** see README "Community quests". Findings: the only community quests
that exist are the three on the wiki's Community Maps page, and they come as *one* zip (quests 7-9, maps 80-83, 90-92, 100-104),
so there is a single "Community quests" toggle rather than three packs (`mods.json` can still list several packs, or pick
quests out of an archive). The GitHub release download has no CORS headers, hence build-time download. The town scans
`QUESTn.INI` with `FileExist` (goes through the case-insensitive `open` wrapper); the guild's `DESnnnnn` list goes through
`ResourceFind`, which falls back to disk files (RESOURCE.C undefines NDEBUG for that block). `MAPDESC/MAPINDEX` is not read
by the game. Verified in the browser: files land in /game, toggling reinstalls, the cache is used, collisions are skipped.
**Not verified:** that the quests really show up and play in town (needs a character; ask the user).

**Caching / offline (issue #7) done, 2026-09-19:** see README "Offline play and caching". Engine files live in the Cache API
(from the page, blob URLs to the engine, cache names keyed on the lock hashes); a service worker (`scripts/sw.js`, written to
`dist/sw.js` by a plugin in `vite.config.ts`) precaches the shell; manifest and icons make it installable; `storage.persist()` is asked
for on the play click. Verified in the in-app browser on `vite preview`: first download with progress, 2nd visit ready in ~1.5 s with no
engine requests, **game starts with the server stopped**, a wrong/old cache is cleaned up, only a missing file is re-fetched.
Gotcha found: hosts that send `Vary: Origin` make the precached module scripts miss in the worker unless `ignoreVary` is set.
Compression measured: see README (with the Ogg music, gzip 48% and brotli q11 41%; the first measurement, on the 111 MB build with raw PCM music, gave 74% and 62%).
**Not verified:** `persist()` being granted (it was refused in the in-app browser: localhost, no engagement), the install prompt, and
another browser than Chromium. Packs from the map issue should reuse the `aa-mods` cache pattern in `src/mods/mods.ts` (already done for the quest zip).

**Display options (issue #8) done, 2026-09-19:** see README "Display, screenshots and video". Verified in the in-app browser on `vite preview`:
sizes for every option combination, the CSS filter, choices restored after reload, a PNG download, and a WebM download with a VP9 video track
and an Opus audio track. **Not verified:** that the recorded audio actually contains the game's sound (the track exists), fullscreen layout
(the pane cannot go fullscreen), the filter on a real high-DPI monitor, MP4 in Safari, and mouse coordinates on a scaled canvas. Gotcha: the
service worker serves the previous build on the first reload after a deploy, so reload twice when testing changes.

**Saves and profiles (issue #6) done, 2026-09-19:** see README "Saves and profiles". Verified in the in-app browser on `vite preview`:
importing a file into a slot, exporting it (bytes identical), backup zip and restore, a bad zip and a zip given as a character are refused,
the dialog locks imports once the game runs, a hosted character (test `saves/index.json`, removed again) lands in the first free slot with its
"needs a pack" warning, a new profile gets its own IndexedDB database (`/persist-<id>`, empty), switching back finds the first profile's files,
deleting a profile removes its database. **Not verified:** with a real character (the `CHDATA` files used were random bytes, so nothing
checks that the game accepts an imported file), the native file pickers (the tests set `input.files` from a script), and
several tabs open at once. Pending settings changes are now kept per profile (`aa.pendingSettings:<mount>`; the first profile keeps the old key).

## 0b. Findings from reading the game source (2026-09-19, read-only; nothing here was changed in the engine)

**Music.** `aamusic\<NAME>.MUS` files are streamed by `ISoundStartStreamIO` (`Source/SOUND.C`):
raw **16-bit signed mono PCM at 22050 Hz**, no header, looped by seeking to 0. `AAMUSIC/` holds 9
tracks (`TITLE`, `MUSIC1`-`6`, `DANCE`, `EGG`), **71 MB of the 111 MB data package** (PICS.RES is
28 MB). Which song plays is the first word of the level's `L<n>.I` file (e.g. `MUSIC4`), and
`TITLE` on the title screen. So:
- **Correction (found by the user, then read in the source):** `musicType` (0 none, 1 stream, 2 MIDI)
  only applies to the DOS/MIDI code in `SOUND.C`. The web build uses the SDL sound code further down
  the file, which ignores it and always loads `AAMUSIC\<song>.MUS`. Music is silenced by `musicOn = 0`
  (or `musicVolume = 0`): `BannerInitSoundOptions` calls `SoundSetBackgroundVolume(0)` at start, and the
  mixer multiplies music by that volume. So the site writes `musicOn`. The `.MUS` file is still loaded
  and decoded (the game only opens it if it exists: `FileOpen != FILE_BAD`).
- Replacing a track = write a raw PCM file with the same name to `/game/AAMUSIC/` before start.
  A mod can also ship a *new* song name and point its `L<n>.I` at it.
- A browser-side player would need to know the scene. Idea (untested): wrap `Module.FS.open`; the
  game opening `AAMUSIC/X.MUS` or `L<n>.MAP` tells the site the current song/level.
- Saving the 71 MB would need the data split into separate packages: an engine build change.

**Quests and maps.** The town's quest list scans `MAPDESC/QUEST0.INI`, `QUEST1.INI`, ... until one is
missing (`TownUI`). The guild's map list scans `MAPDESC/DES00000`, `DES00001`, ... (`GUILDUI.C`).
Level data is `L<n>.MAP/.I/.GEN/.LIT` and scripts `S<n>.SRP`; `QUESTn.INI` has `firstmap`,
`nummaps`. Installing a pack therefore means: add its files, and **renumber its QUEST/DES files
to the next free numbers** (the sequence must have no gaps). Map-id collisions between packs
(`L<n>`) are still a risk. `casefile.c` makes opens case-insensitive; the scans use `FileExist`,
so they should be too (unverified).

**Keys.** The bindings are `[keyboard] keys1`/`keys2` in `config.ini`: hex bytes, one per action
(`KeyMapInitialize`), i.e. **physical scan codes**, so they do not depend on the keyboard layout.
`CONTROL.TXT` is only the help text shown in game; a preset must update both.

**Other options in `config.ini`:** `boboff` (head bob), `invertmousey`, `mouseturnspeed`,
`keyturnspeed`, `dyingdropsitems` (a rules switch), `[video] gamma`.

**Mouse.** Mouselook uses `SDL_WM_GrabInput` + relative mouse state (`MOUSEMOD.C`); whether that
reaches the browser's pointer lock is still unverified.

**Synthetic keyboard events** (for touch/gamepad): an attempt with `dispatchEvent` in the in-app
browser was inconclusive; not known whether it works.

**Play page UI (issues #4 and #5 done):** no header nav; the game sits above a bottom toolbar of
square pixel-icon buttons (Pixelarticons, MIT) with tooltips (`data-tip`): Settings at the left, Mute
and Fullscreen at the right. New tools go into `#toolbar` in `play.html` (icons in `src/ui/icons.ts`).
The settings dialog is static markup in `play.html` (`data-setting="<id>"`), wired by
`src/ui/settings-dialog.ts`; settings are defined in `src/settings/schema.ts`, key presets in
`src/settings/keys.ts`, file access in `src/settings/store.ts`. Design rules: the saves (IDBFS) are
mounted as soon as the game data is unpacked (before the click), so config.ini can be edited while the
game is not running; once the game runs, edits are queued in localStorage (`aa.pendingSettings`) and
applied on the next start ("Restart now" reloads the page). Presets write `keys1`/`keys2` in config.ini
and rewrite `CONTROL.TXT` (the game rewrites it itself when keys are changed in its Esc menu).
`window.aa = {fs, dir, store}` is set for debugging in the console.
**Gotcha found:** `monitorRunDependencies(left <= 1)` is not "everything unpacked": the data package is
a run dependency too, and its preRun can run after ours. The loader therefore looks at the last count one
tick after the calls (`src/engine/loader.ts`); mounting too early makes the data unpack *through* the
symlinks into /persist. Not verified in a real game session: that the chosen keys work in game, and that
music really is off with `musicType = 0`.

**Left Alt fix, new engine, license and docs, 2026-09-19:** issue #14 (Left Alt never sidestepped) is fixed in the engine and confirmed in Firefox.
Cause: Left and Right Alt share `KEY_SCAN_CODE_ALT` and `KeyboardUpdate` let each SDL key overwrite the other, so whichever was scanned last won. The
key numbering differs per SDL: native SDL 1.2 scans `SDLK_RALT` first (so on Linux it was Right Alt that was lost), Emscripten's SDL2-style codes scan
`SDLK_LALT` first. Fix: Alt is down if either key is (fork `emscripten` 8d87d56a, merged into `main` as c837e4f0, both pushed). The engine lock now pins
fork `main` c837e4f0, whose build also has the Ogg music: `amulets-armor.data` went from 111 MB to 46 MB. "lebbe's choice" is back to Alt for sidestep (Shift
is the walk key again). New: Settings > Storage > "Delete stored game files" (`clearCachedFiles` in `src/pwa.ts`). The release year is 1997 everywhere in the
site (the engine's own startup banner still says "(C) 1996", the code's copyright line; left alone). README brought up to date and
`docs/running-locally.md` added (get the fork, build it with Emscripten, link it here). **License: the site's code is GPL-3.0** (`LICENSE`,
`"license": "GPL-3.0-only"` in `package.json`; the user's choice, MIT would also have been compatible). The README opens with a notice that hosting the game
publicly needs permission from Exiguus Entertainment.

## 1. The goal

A website that plays **Amulets & Armor** (a 1997 DOS/Windows RPG, GPL-3.0 source)
in the browser, running the real game code compiled to WebAssembly. On top of the
plain game, the site adds things that are easy from JavaScript and impossible or
awkward inside the game itself:

- **Loading mods and maps** (community quests, map packs) with one click.
- **Tweaking from outside the game**: settings and key bindings UIs, save
  management, display options, input options, tooling. See section 7.

The game engine and the website are deliberately **two separate projects**:

| Project | Where | What goes there |
|---|---|---|
| **Engine** (a fork of the game) | `AmuletsArmor/` | Anything that makes the game *run correctly on a platform*: build targets, compatibility fixes. |
| **Site** (this folder) | `site/` | Anything that is a *product around the game*: launcher UI, mods, save management, hosting. |

Rule of thumb: if the change would help anyone who builds the game for the web, it
is an engine change. If it is a feature of our site, it is a site change. Do not
put mod loading, launcher UI or similar into the engine repo.

## 2. Folder layout on this machine

```
D:\Users\Lars-Erik\code\AA-web\A&A-emscripten\
  AmuletsArmor\   the engine fork (a git repo)
  site\           this Vite site (NOT a git repo yet)
```

Windows 11, PowerShell; Node v26.9.0 is installed on Windows. (The parent folder used to be
`A&A-emscripten`; the `&` broke npm and CMake, so it was renamed.)

## 3. The engine repo (`AmuletsArmor/`)

- **What it is:** a fork of <https://github.com/ExiguusEntertainment/AmuletsArmor>.
  - `origin` = `git@github.com:lebbe/AmuletsArmor.git` (the fork).
  - `upstream` = `https://github.com/ExiguusEntertainment/AmuletsArmor.git`.
- **What we added:** a Linux build and an **Emscripten (WebAssembly) build target**.
  The game runs in a browser: title screen, intro, single player, sound, mouse,
  keyboard, and saved characters.
- **Branches** (as of this snapshot; check `git fetch` and `git log` for the truth):
  - `linux-build`: one commit (`f556ed5a`) on top of upstream `master`
    (`90819a3f`). Meant as a stand-alone PR to upstream: Linux support, and it moves
    the macOS-PR Unix header stand-ins to `Include/unix/` so they stop breaking the
    Visual Studio build.
  - `emscripten`: `linux-build` plus the web build target, a page shell, saving,
    and `Build/Emscripten/README.md`. The user pushes this branch independently
    and rewrote a commit on it while this handoff was being written, so always
    `git fetch` before amending or rebasing anything.
  - `backup/*` branches are local safety copies. Ignore them.
- **Read `AmuletsArmor/Build/Emscripten/README.md`.** It documents building,
  serving, saving, and the places where the web build differs from native.
- **The engine repo is considered "done" for now.** Do not keep changing it unless
  the site needs an engine-level change (see section 8).

### What is verified (tested in a browser)

- Builds with emsdk 6.0.9; loads; shows title and intro; no console errors.
- Audio plays (44.1 kHz `AudioContext` running, clock advancing, no starvation
  warnings); the user confirmed sound and the mouse pointer "work 100%".
- Saving works at the mechanism level: a file written into the save directory was
  synced to IndexedDB and was still there after a full page reload.
- Linux native (Debug + ASan) builds and runs. The Visual Studio project builds and
  links with VS2019 given toolchain workarounds (retarget to v142, packing-check
  define, warnings-as-errors off, a 3-line `__iob_func` shim). The result is the
  same `AA.exe` size as upstream `master`. It was never launched.

### What is NOT verified

- **Mouselook** (mouse-driven turning in the 3D view) in a browser.
- A real character saved, page reloaded, character listed (the mechanism was
  tested with a marker file; the user's own end-to-end test was not reported).
- Multiplayer: compiled out (`WIN_IPX=0`); not available on the web.
- macOS: untested (no Mac available).
- Any browser other than the embedded one and Chrome-family behaviour.

## 4. Getting the engine into the site

### The artifacts

Building the engine produces four files (Release, `amulets-armor.*`):

| File | Size | Notes |
|---|---|---|
| `amulets-armor.js` | ~146 KB | Emscripten glue. Modularized: defines a global `createAA(config)` factory (no global `Module`). It also contains the data-package loader. |
| `amulets-armor.wasm` | ~720 KB | The game. |
| `amulets-armor.data` | ~46 MB | The game's data files from `Exe/` (`.exe`, `.bat`, `.dll`, `.386` and the raw `.MUS` music excluded; the music ships as `.OGG`). It was ~111 MB before the Ogg music change. |
| `amulets-armor.html` | ~5 KB | A page produced from `Build/Emscripten/shell.html`. **The site should not use this file.** It exists only as a working reference. |

### Should the built engine be committed to the site repo? No.

The user's instinct is right. `amulets-armor.data` used to be 111 MB, over GitHub's 100 MB per-file push
limit; since the Ogg music change it is **46 MB**, so committing it is technically possible now. It is still
a derived artifact, and every rebuild that changes it would add up to 46 MB to the repository history for good.

Instead:

1. Put the artifacts in **`site/public/engine/`** and add that folder to
   `.gitignore`. Vite copies `public/` verbatim into `dist/`, so the files end up
   at `dist/engine/...` on `npm run build`.
2. Commit only a small **lock file** (for example `engine.lock.json`) recording
   which engine build the site expects: version or git SHA, file names, and sha256
   of each file.
3. Add a script (for example `npm run engine`) that populates `public/engine/`:
   - **Dev mode:** copy from a local engine build (path from an env variable, e.g.
     `AA_ENGINE_DIR`).
   - **CI / clean checkout:** download the pinned artifacts and verify the hashes.
     Suggested home for them: **GitHub Releases on the engine fork** (release
     assets can be up to 2 GiB each, so the 46 MB data file is fine). Tag them
     like `web-engine-vX.Y.Z`.

### Where the built site is hosted matters (open decision)

Since the Ogg music change, `amulets-armor.data` is 46 MB (it was 111 MB) and compresses to about 22 MB with gzip and 19 MB with
brotli q11 (README has the numbers), so per-file limits no longer rule out most static hosts. `dist/` also carries `public/music/`
(48 MB, including a 32 MB soundfont) while that folder exists locally; it is untracked and belongs to the `music-player` branch.

**GitHub Pages is the leading candidate.** From memory, and worth verifying: a published site may be about 1 GB, bandwidth is a soft
100 GB a month (about 2,000 first visits at 46 MB, more if the host compresses the `.data`), a single file must stay under 100 MB, and
Pages from a private repository needs a paid GitHub plan. The engine files are not in git, so a GitHub Actions workflow has to get them:
attach `amulets-armor.{js,wasm,data}` to a GitHub Release, put the release URL in `baseUrl` in `engine.lock.json` (`scripts/fetch-engine.mjs`
already downloads from it and checks the sha256; the download is server-side, so CORS does not matter), then build and deploy with
`actions/deploy-pages`. Not written yet. The site uses relative URLs, so a sub-path like `lebbe.github.io/AmuletsArmorWebPortal/` works.

Saves live per origin: pick the final address before promoting the site, because moving later loses everyone's saves unless they use the
backup export. A custom domain (for example www.lars-erik.no) works with Pages too.

Ask the user which host they want before building the deploy pipeline. Whatever the host, see the permission item below first.

### Legal / licensing (must be settled before public hosting)

- **The site's code is GPL-3.0** (decided 2026-09-19: `LICENSE`, `"license": "GPL-3.0-only"`). Chosen for simplicity: the site and the engine are
  separate files but tightly coupled at run time (`createAA`, `FS`, `wasmTable`), and under the GPL the "is the served site one combined work"
  question does not matter. MIT would also have been compatible (MIT code may go into a GPL-3.0 combination). The license covers the site's
  code only: not the game logo `public/aa-logo.png` or the icons made from it, not the game data, not the engine. Third parties: `fflate` and
  Pixelarticons are MIT; the tracks and soundfont in `public/music/` (music-player branch) have their own licenses and need checking when they go in.
- **The engine is GPL-3.0.** Sending it to visitors' browsers is distributing it, so the site links to the exact corresponding source (the fork, the
  commit is pinned in `engine.lock.json`) and to the license.
- **Community quests** are from `cabbruzzese/AmuletsAndArmorUserMaps`, which is GPL-3.0 (checked 2026-09-19), so they may be hosted with credit.
- **The game data is not settled, and this is the blocker.** Facts found on 2026-09-19:
  - `Exe/license.txt` (permalink in the README) says the game is owned by Exiguus Entertainment and released for free, but no sale or distribution is
    allowed except by Exiguus Entertainment or those who have received written permission.
  - There is no newer license: that file and the GPL `LICENSE` were both added on 2013-07-27 by the owners' accounts and never changed. The
    page the source headers refer to (`amuletsandarmor.com/AALicense.txt`) returns 404 now.
  - The official site (`http://amuletsandarmor.com/`, http only, live) says the owner, after "rights-wrangling", released the game for free in 2013.
    That means free of charge; it says nothing about others hosting copies. Wikipedia calls it freeware and open source (2013).
  - Signs that they would agree: the data has been in their public repository since the first day, the org is active (a community macOS pull request
    was merged in March 2026), and the site's author wants people to play it. But the text asks for written permission.
  - Contacts: `support@amuletsandarmor.com` (listed on the official site), or an issue on `ExiguusEntertainment/AmuletsArmor`, where the maintainer
    is active. **Nobody has been asked yet.** A written reply is enough for the license's wording.
  - The README opens with a notice about this. Keep the site free of charge and ad-free (the license forbids sale), credit the owners, link the official site.
- Do not put a playable copy on the public web until permission is in writing. Making the repository public is fine before that: it does not contain the
  game data (the engine files are gitignored).

### Building the engine yourself (this machine)

The build runs in **WSL2 Ubuntu** (there is no native toolchain on Windows).
Already set up: distro `Ubuntu`, user `lebbe`, emsdk 6.0.9 at `~/emsdk`, cmake and
ninja installed, and a symlink `~/aa-src` pointing at the engine checkout under
`/mnt/d/...` (needed because of the `&` in the path).

```bash
source ~/emsdk/emsdk_env.sh
emcmake cmake -S ~/aa-src -B ~/aa-web -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build ~/aa-web --target amulets-armor
# artifacts: ~/aa-web/amulets-armor.{js,wasm,data,html}
```

Run those from a script **file**, not inline (see pitfalls, section 9).

### How the site talks to the engine

The engine has no JavaScript API of its own yet. It is driven entirely through the
Emscripten `Module` object. **`AmuletsArmor/Build/Emscripten/shell.html` is the
reference implementation. Read it in full and lift from it.** It demonstrates every
hook the site needs:

- **Click-to-play.** The data downloads immediately, but `main()` is held back by
  a run dependency (`Module.preRun` calls `addRunDependency('user-gesture')`; the
  click handler calls `removeRunDependency`). This makes the game open its audio
  device inside a user gesture, which browsers require.
- **Progress.** `Module.setStatus` receives strings like `Downloading data...
  (12345/111101628)`. `Module.monitorRunDependencies(left)` reports `left <= 1`
  when everything except the click gate is ready.
- **Audio control.** The shell wraps `window.AudioContext` *before the engine script
  loads* to capture the context, then calls `suspend()`/`resume()` for Mute and when
  the tab is hidden. The wrapper must be installed before the engine runs.
- **Saving.** At the moment of the click (after the data is unpacked, before
  `main()`), it mounts IDBFS at `/persist`, loads it from IndexedDB, seeds
  `config.ini` and `CONTROL.TXT` from the packaged defaults, and replaces
  `/game/S0000000`, `/game/config.ini` and `/game/CONTROL.TXT` with symlinks into
  `/persist`. It then calls `FS.syncfs(false, ...)` every 5 s, when the tab is
  hidden, and on `pagehide`.
- **What is exported:** `Module.FS` and `Module.wasmTable` (via
  `-sEXPORTED_RUNTIME_METHODS`). `FS` is how the site reads and writes the game's
  virtual filesystem.

Things to handle in Vite that the shell page did not have to:

- The engine's `.wasm` and `.data` are requested **relative to the page** by
  default. Set `Module.locateFile` (for example to `/engine/`) so they resolve
  from `public/engine/`. This is standard Emscripten behaviour; verify it.
- Load `amulets-armor.js` by **injecting a `<script>` after `window.Module` is
  configured**, not with a bundled `import`. It is not an ES module.
- `Module` and the engine globals are untyped; add a small `.d.ts` in `src/`.
- Emscripten's default `Module.print`/`printErr` go to the console; capture them if
  the site wants a log panel.

Where the engine is deliberately awkward: it is **not `MODULARIZE`d** (no
`createAA()` factory). That would be a cleaner interface for the site, and it is a
small engine change if the global-`Module` approach becomes painful. See section 8.

### Where saves live (a correction worth knowing)

IndexedDB data is stored in a database named after the IDBFS mount point
(`/persist`), verified by reading `libidbfs.js` in emsdk 6.0.9. So saves are
**per origin** (scheme + host + port). A different path on the same origin shares
them; a different origin (localhost vs. the real domain) does not. Any other code on
the same origin that mounts an IDBFS at `/persist` shares the store, so pick the
mount name deliberately. (Earlier notes in this project said "tied to the URL path".
That was wrong.)

Clearing site data in the browser deletes the saves.

## 5. The site scaffold (`site/`)

What is there now:

- **Vite 8 + TypeScript 6** (the "vanilla-ts" template), not plain JavaScript as
  originally described. That is fine; keep TypeScript.
- Scripts: `npm run dev`, `npm run build` (`tsc && vite build`), `npm run preview`.
- `src/main.ts` is still the template's counter demo; `index.html` shows a logo
  (`public/aa-logo.png`). `dist/` exists from a test build.
- `.gitignore` already ignores `node_modules` and `dist`. **Add
  `public/engine/`.**
- **It is not a git repository yet.** Initialize one; the user decides the name and
  where it lives (suggested: a repo under their GitHub account).

Suggested structure (a suggestion, not a requirement):

```
site/
  public/engine/              # gitignored: populated by `npm run engine`
  engine.lock.json            # committed: pinned engine version + sha256s
  scripts/fetch-engine.mjs    # populate public/engine (local dir or download+verify)
  src/
    main.ts
    engine/loader.ts          # Module config, click gate, progress, locateFile, inject script
    engine/audio.ts           # AudioContext capture, mute, pause on hidden tab
    engine/storage.ts         # IDBFS /persist + symlinks + sync (from shell.html)
    mods/manifest.ts          # mods.json format + types
    mods/install.ts           # fetch/cache/unzip/write into /game
    ui/                       # launcher, mod picker, settings, save manager
  public/mods/mods.json       # or fetched from somewhere else
```

## 6. Milestones

### Milestone 1: parity with the engine's reference page

Reproduce what `shell.html` does, in the site's own code and styling: engine
loading with progress, click-to-play, mute, suspend on hidden tab, IndexedDB saves
with a visible status note. Definition of done: the site plays the game exactly as
`out/web/amulets-armor.html` does, from a `vite build` + `vite preview`, with saves
surviving a reload.

Also in this milestone:

- **Fullscreen and pointer lock.** Not implemented anywhere yet. The game uses Esc
  for its menu, but browsers exit fullscreen on Esc. In Chromium,
  `navigator.keyboard.lock(['Escape'])` (after entering fullscreen) fixes that;
  Firefox/Safari either accept the limitation or need an alternative menu key.
  Check that mouselook works, and whether the game's `SDL_WM_GrabInput` reaches the
  browser's pointer lock. That is unverified.
- **Scaling.** The game draws at 640x400. The canvas may be CSS-scaled with
  `image-rendering: pixelated`. In *release* builds fractional mouse coordinates are
  truncated silently; only assertion-enabled debug builds abort on them.

### Milestone 2: mods and maps

Known from the project notes (the game's own documentation and wiki, not tested):

- Community quests are **additive**: extracted into the game folder, they appear at
  the bottom of the quest list. Known packs: *Trial of Time*, *Isle of Thanatos*,
  *Sorcerer's Keep*, at
  <https://github.com/cabbruzzese/AmuletsAndArmorUserMaps/releases>.
- Map IDs are coordinated on the wiki (<http://wiki.amuletsandarmor.com>), so
  loading several packs at once can collide. Detect and warn.
- Mods that replace resources (`.RES`) work by later files overwriting earlier ones.

Suggested design:

- A **`mods.json` manifest**: id, name, description, image, download URL, sha256,
  and (once known) the map IDs it uses.
- Fetch the selected zips, unzip in JS (e.g. `fflate`), and write the files with
  `Module.FS.writeFile('/game/...')` **at the same moment the saves setup runs**:
  after the game data is unpacked, before `main()` starts (the click handler, held
  by the run dependency).
- Files in `/game` live in memory and are **not** persisted, so install the selected
  mods on every start from a cached copy (Cache API or IndexedDB) to avoid
  re-downloading.
- **Shareable links:** `?mods=trial-of-time,isle-of-thanatos`.
- The engine's `casefile.c` wrapper makes `open`/`fopen` case-insensitive, so mod
  file name casing should not matter for direct opens. Whether the game *lists*
  quests by scanning the directory, and whether that scan is case-sensitive, is
  **unverified**.

**First investigation task for mods:** find out how the game discovers quests and
maps (search `AmuletsArmor/Source` for how the quest list is built and how `.MAP`
and related files are named/loaded, plus the wiki's map-ID rules). Do this before
designing `mods.json` fields.

Watch for **save compatibility**: a character or campaign saved with a mod loaded may
break if that mod is missing later. Store which mods a save used and warn.

### Milestone 3: tweaking from outside the game

Everything here is an **idea**, labelled by how much is known. None is built.

*Known to be possible (files and browser features we already saw work):*

- **Settings UI:** `config.ini` (video, gamma, sound, etc.) is a plain INI file in
  the persisted filesystem. Edit it from JS before the game starts.
- **Key-binding UI:** `CONTROL.TXT` holds the bindings and is persisted the same way.
- **Save management:** list, export, import, back up and delete the files in
  `/persist/S0000000` (`CHDATA00`..`CHDATA03`). Export/import is the natural next
  feature because clearing site data destroys saves.
- **Screenshots and capture:** `canvas.toBlob`, `MediaRecorder` on the canvas.
- **Display options:** integer scaling, aspect ratio, fullscreen, a CRT/scanline
  overlay drawn by a WebGL/CSS layer over the canvas.
- **Audio options:** volume, mute, per-tab pause (mute and hidden-tab suspend are
  already in the reference shell).
- **Dev panel:** virtual filesystem browser, console log viewer, FPS counter.

*Plausible but needs testing:*

- **Gamepad and touch input** by synthesizing keyboard events. Depends on how
  Emscripten's SDL receives key events; must be tried.
- **Music/sound replacement** by writing files with the same names before start
  (`AAMUSIC/*.MUS`, `SOUNDS.RES`); depends on the formats and how the game reads
  them.
- **Character viewer/editor:** the repo has a native tool
  `Utils/character_dump_json.c` (CMake target `aa-character-dump`) that dumps a
  character to JSON. Compiling it to WebAssembly as a second target would allow a
  character viewer. Save-file format details are unknown to us.
- **Multiple profiles** (several save sets).

*Would need an engine change (exporting C functions to JS):*

- HUD/overlay features that read game state (stats, minimap, etc.).
- Anything that changes game behaviour at runtime.

## 7. Working with the user (from this project so far)

- The user wants to be used as a **"meat proxy"**: hand off installs, GUI checks and
  anything easier for a human, with **exact instructions**, and do so early.
- They like short, direct answers and prefer you to say plainly when something
  wasn't tested or was wrong.
- Ask before publishing or anything outward-facing (forking, pushing, PRs, hosting).
  Local commits on branches were fine when asked.
- Keep engine-repo changes minimal and PR-friendly; keep site features in the site.
- Do not put roadmap items in the engine repo's README (a mistake already made once).

## 8. If the site needs an engine change

Make it in the engine fork on a branch off `emscripten`, keep it small, rebuild
(section 4), update `engine.lock.json` in the site, and tell the user so they can
decide about a PR. Likely candidates:

- `MODULARIZE=1` plus `EXPORT_NAME=createAA`, replacing the global-`Module`
  convention with a factory.
- `EXPORTED_FUNCTIONS` for a C-to-JS bridge.
- Whatever pointer lock or mouselook turns out to need.

The current engine output still has the reference `shell.html` baked into
`amulets-armor.html`. If the site takes over the page fully, consider moving
`shell.html` out of the engine or reducing it to a minimal sample.

## 9. Pitfalls we already hit (save yourself the time)

- **`wsl -d Ubuntu -- bash -c '...'` from PowerShell/Git Bash mangles `$` and `|`**
  (an outer shell expands them first). Put commands in a script file with **LF**
  line endings (a file written with Windows tooling gets CRLF and bash chokes) and
  run `wsl -d Ubuntu -- bash /mnt/c/.../script.sh`.
- **The `&` in the folder name** breaks the generated CMake commands under ninja.
  Always build through the `~/aa-src` symlink.
- **Asyncify vs. `SDL_Delay`.** Emscripten aliases `SDL_Delay` to `emscripten_sleep`
  but Asyncify does not treat the alias as a yielding call, so the caller keeps
  running while the stack unwinds. Symptoms: `unreachable`, `null function`,
  `invalid state`. The engine's `delay()` macro already calls `emscripten_sleep`
  directly. Any *new* blocking call added to the game must do the same.
- **Cache.** After rebuilding, a static server plus the browser may serve the old
  page. Reload with a new query string (`?v=2`) or use a no-cache dev server. Also
  `shell.html` is baked in at link time, so changing it needs a relink (the CMake
  file already tracks it).
- **Debug loop that worked:** a tiny runner page that records `window.onerror`,
  `unhandledrejection` and `console.*` into arrays, `Error.stackTraceLimit = 200`,
  and an `-O0` engine build for real stack frames. Release builds inline the whole
  game into `SDL_main`, which makes traces useless. UBSan's runtime does not work
  under WebAssembly here; ASan runs.
- **Assertion-enabled builds abort on fractional mouse coordinates** if the canvas
  is CSS-scaled. Release builds do not.
- **The game keeps playing after you look away.** The embedded browser kept the
  music running after work stopped. Provide Mute and pause on hidden tab.
- **Native game + `timeout`:** the game's SIGTERM handler calls `exit()` inside the
  handler and can hang; use `kill -9` in scripts.
- **You cannot hear audio.** Verify it through the `AudioContext` (state, advancing
  `currentTime`) and ask the user to listen.
- Multiple background HTTP servers were used on different ports during debugging;
  make sure none are left running when you start.

## 10. Suggested first steps for the next agent

1. `git init` the site (ask the user for the repo name/location). Add
   `public/engine/` to `.gitignore`.
2. Build the engine (section 4) and copy the four artifacts into
   `site/public/engine/`. Write `scripts/fetch-engine.mjs` and
   `engine.lock.json` (hashes of the local build for now).
3. Read `AmuletsArmor/Build/Emscripten/shell.html` and `README.md`.
4. Milestone 1: engine loader + audio + storage modules, styled UI, tested with
   `vite build` + `vite preview` in the browser. Confirm saves survive a reload with a
   real character (ask the user to create one).
5. Ask the user to decide: hosting target (file size limits), whether to contact the
   game's developers about data redistribution, and repo names.
6. Only then start Milestone 2 (start with the discovery investigation).

## 11. Open questions for the user

- Where will the site be hosted? (GitHub Pages is the candidate; see the hosting section. The 46 MB data file no longer forces a special setup.)
- Repo name and location for the site.
- Permission to redistribute the game data: write to Exiguus Entertainment (nobody has been asked yet; see Legal / licensing). The community
  quests are GPL-3.0 and need no separate permission.
- Is `MODULARIZE` worth doing in the engine now, or does the global-`Module`
  approach suffice?
- Preferred styling / branding for the launcher.
