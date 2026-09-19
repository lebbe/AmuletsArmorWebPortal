# Running Amulets and Armor for the Web on your own computer

This site is only the web page around the game. The game itself is the original C code, compiled to
WebAssembly, and that code lives in a **separate repository**. So running the site locally takes two
projects side by side:

| Project | What it is | You need it for |
|---|---|---|
| [lebbe/AmuletsArmor](https://github.com/lebbe/AmuletsArmor) (a fork of [ExiguusEntertainment/AmuletsArmor](https://github.com/ExiguusEntertainment/AmuletsArmor)) | The game: C source, the game data (`Exe/`), and the CMake build for Emscripten | Building `amulets-armor.js`, `.wasm` and `.data` |
| [lebbe/AmuletsArmorWebPortal](https://github.com/lebbe/AmuletsArmorWebPortal) (this repo) | The site: start page, play page, settings, saves, caching | Serving those three files in a browser |

```
AmuletsArmor  --(emcmake + cmake)-->  out/web/amulets-armor.{js,wasm,data}
                                             |
                                             |  npm run engine        (copies them, records their hashes)
                                             v
AmuletsArmorWebPortal/public/engine/   +   engine.lock.json
                                             |
                                             |  npm run dev  /  npm run build && npm run preview
                                             v
                                       http://localhost:5173  (or :4173)
```

You do not install the game separately. The fork's `Exe/` folder contains the game data, and the build packs it
into `amulets-armor.data`.

The steps below are what worked on **Windows 11 with WSL2 (Ubuntu 26.04)**, with emsdk 6.0.9, CMake 4.2 and Ninja 1.13.
Linux works the same way without the WSL parts. macOS should work for the engine build too but has not been tried.

## 1. Install the tools

You need:

- **git**
- **Node.js 20.19+ or 22.12+**, with npm (the site is built with Vite 8, which needs one of those)
- To build the engine: **CMake 3.20+**, **Ninja** and **Python 3** (the Emscripten SDK scripts need it). No C compiler
  is needed for the WebAssembly build, because Emscripten brings its own. On Ubuntu or Debian, something like:

  ```sh
  sudo apt install git cmake ninja-build python3 xz-utils curl
  ```

**Windows:** the engine is built inside WSL2 (`wsl --install -d Ubuntu`). A native Windows build of the engine has
not been tried. The site itself (Node) runs fine either in WSL or on Windows.

## 2. Get the game (our fork of A&A)

The site is built for our fork, not for the upstream repository: the fork carries the Emscripten build target and a few
web fixes. Clone it and use the `main` branch (it contains the `emscripten` branch plus the smaller Ogg music files):

```sh
git clone git@github.com:lebbe/AmuletsArmor.git       # or https://github.com/lebbe/AmuletsArmor.git
cd AmuletsArmor
git checkout main
```

The clone is about 240 MB (it holds the game data and every branch).

- **Under WSL, clone into the Linux file system** (for example `~/AmuletsArmor`), not under `/mnt/c/...`. Builds on the
  Windows drives are usually much slower.
- **Avoid an `&` in the path.** CMake's generated shell commands do not quote it, so the build breaks. If your checkout
  has to live in such a path, build through a symlink.

## 3. Install Emscripten

Emscripten compiles the C code to WebAssembly. Install its SDK anywhere (this is a one-time setup):

```sh
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk
./emsdk install 6.0.9        # the version this was built and tested with; `latest` should also work
./emsdk activate 6.0.9
```

In **every new shell** you build in, load it first:

```sh
source ~/emsdk/emsdk_env.sh
emcc --version               # should print 6.0.9
```

SDL 1.2 comes with Emscripten (`-sUSE_SDL=1`), so no other libraries are needed.

## 4. Build the engine for the browser

From the root of the `AmuletsArmor` checkout, with Emscripten loaded:

```sh
emcmake cmake -S . -B out/web -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build out/web --target amulets-armor
```

Use `Release`: it is what the site is meant to run, and debug builds are larger and slower. (`out/` is ignored by git.)

The result is in `out/web/`:

| File | What it is |
|---|---|
| `amulets-armor.js` | The loader. It defines a global `createAA(config)` function. |
| `amulets-armor.wasm` | The game code. |
| `amulets-armor.data` | The game data from `Exe/` (about 46 MB). |
| `amulets-armor.html` | A minimal test page from the engine repo. The site does not use it. |

**Optional check that the engine works on its own**, before involving the site:

```sh
cd out/web
python3 -m http.server 8080
```

Open <http://localhost:8080/amulets-armor.html> and click **Click to play**. The files must be served over HTTP;
opening the `.html` from disk (`file://`) does not work. Stop the server with Ctrl+C when you are done.

## 5. Get and prepare the site

```sh
git clone git@github.com:lebbe/AmuletsArmorWebPortal.git     # or the https:// URL
cd AmuletsArmorWebPortal
npm install
```

## 6. Link the engine build into the site

The site reads the three engine files from `public/engine/` (not in git) and checks them against
`engine.lock.json`. The `engine` script copies your build there **and** records its sizes and sha256 hashes in the lock:

```sh
AA_ENGINE_DIR=/path/to/AmuletsArmor/out/web npm run engine -- --update-lock
```

On **Windows PowerShell**, with the engine built inside WSL and Node running on Windows:

```powershell
$env:AA_ENGINE_DIR = "\\wsl.localhost\Ubuntu\home\<your-user>\AmuletsArmor\out\web"
npm run engine -- --update-lock
```

(Or simply run the site inside WSL too, so everything is in one place.)

**Always pass `--update-lock` with your own build.** The lock in git describes the maintainer's build; a build you
compiled yourself is almost never byte-identical (a different compiler version is enough). If the lock does not match the
files, the loader usually stops with an error like `amulets-armor.data: got N bytes, expected M`. Even when it does
not, the browser cache is keyed on the lock's hashes, so you could keep getting an older cached build. Do not commit the
changed `engine.lock.json` unless you mean to publish that build. To go back to the committed lock:
`git checkout engine.lock.json`.

Running `npm run engine` **without** `AA_ENGINE_DIR` only verifies the files against the lock, and tries to download
missing ones from the lock's `baseUrl`. That is not set up yet, so it fails on a fresh clone. Building the engine
yourself, as above, is the way for now.

## 7. Run the site

There are two ways, and each is useful for something different.

**Development server** (fast, reloads when you edit the code, no service worker and no offline cache):

```sh
npm run dev
```

Open <http://localhost:5173/play.html>, choose your keys and settings in the toolbar, then click to play.

**Production build** (the real thing: service worker, offline cache, installable app):

```sh
npm run build
npm run preview
```

Open <http://localhost:4173/play.html>. This is the one to use when you test caching or offline play.

Notes:

- The first `npm run dev` or `npm run build` downloads the community quest pack (about 1 MB) into `public/mods/`. `npm run dev`
  only warns if that fails (for example when you are offline); `npm run build` stops. Once downloaded, it is reused.
- Each address is its own browser origin, so `localhost:5173` and `localhost:4173` have **separate saved characters and
  settings**. The same is true for a different browser.
- `localhost` counts as a secure context, so the service worker and the Cache API work without https.
- Nothing needs the internet after the first setup, apart from the quest download above.

## 8. Working on the engine or the site

**You changed the C code:** rebuild the engine (step 4), run `npm run engine -- --update-lock` again (step 6), and reload the
page. The browser cache is keyed on the hashes in the lock, so the new build is downloaded by itself and the old one is
deleted afterwards. For the production build, run `npm run build` again as well.

**You changed the site code:** the dev server reloads by itself. For `npm run preview`, run `npm run build` again.

**The page still shows the old version** (production build only): the service worker serves the previous build on the
first reload after a rebuild, so reload twice. If a cache is ever stuck, open **Settings > Storage > Delete stored game
files**. It deletes the downloaded engine, the page cache and the quest pack, and reloads. Your characters and settings are kept.

## 9. If something goes wrong

| Symptom | Cause and fix |
|---|---|
| The page says "got N bytes, expected M" | `engine.lock.json` does not match `public/engine/`. Run `npm run engine -- --update-lock` (step 6). |
| `npm run engine` says the file is missing and there is no `baseUrl` | You ran it without `AA_ENGINE_DIR`. Point it at your build. |
| `emcmake: command not found` or `emcc` is missing | Emscripten is not loaded in this shell: `source ~/emsdk/emsdk_env.sh`. |
| The engine build fails with odd shell errors | Check for an `&` (or other special characters) in the path to the checkout; build through a symlink. |
| The engine build is very slow under WSL | The checkout is probably on a Windows drive (`/mnt/c/...`). Move it into the Linux file system. |
| A blank page when opening the engine's `.html` directly | Files must be served over HTTP (step 4). |
| Nothing changes after a rebuild in `npm run preview` | Reload twice, or use Settings > Storage > Delete stored game files. |
| Left Alt does not sidestep | That was a bug in older engine builds; it is fixed in `emscripten` 8d87d56a and later. Rebuild from current `main`. |
| Characters are gone | Saves are per browser origin (address and port). See the notes in step 7. Export a backup from the save dialog before you clear site data. |

## Where things live

| Path | What |
|---|---|
| `public/engine/` | The three engine files, copied by `npm run engine` (git ignores them) |
| `engine.lock.json` | The pinned engine build: source commit, and size and sha256 of each file |
| `public/mods/` | Community quest packs, downloaded at build time (git ignores them) |
| `mods.json` | Which packs to download |
| `dist/` | The production build, written by `npm run build` |

See the [README](../README.md) for what the site does and how it caches the download.
