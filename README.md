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

`npm run build` writes the site to `dist/`, and `npm run preview` serves it. The site uses
relative URLs, so `dist/` can be hosted at any path.

## Layout

- `index.html`, `play.html`: static pages (the settings dialog markup is in `play.html`). `src/style.css`: shared styles.
- `src/play.ts`: the play page. `src/ui/`: toolbar, settings dialog, icons ([Pixelarticons](https://github.com/halfmage/pixelarticons), MIT).
- `src/settings/`: reading and writing the game's `config.ini` / `control.txt` (`store.ts`), the list of settings (`schema.ts`), key presets (`keys.ts`).
- `src/engine/`: loading the engine (`loader.ts`), audio (`audio.ts`), saves in IndexedDB (`storage.ts`).
- `scripts/fetch-engine.mjs`, `engine.lock.json`: getting the engine build.
- `HANDOFF.md`: project notes and plans.
