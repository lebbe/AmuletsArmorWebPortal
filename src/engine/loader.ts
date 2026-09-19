// Injects the engine script (built with MODULARIZE: it defines a global
// `createAA(config)` factory) and starts it with our configuration. The game
// data downloads right away, but main() is held back by a run dependency until
// start() is called from a click, so the game opens its audio device inside a
// user gesture (browsers require that).
//
// Once the data is unpacked (everything except our gate is done) the saves are
// mounted, before the click, so the page can read and write config.ini while
// the game is not running yet.

import type { EmFS, EngineModule } from "./emscripten";
import { setupPersistence } from "./storage";

export interface ReadyInfo {
  fs: EmFS;
  /** Where config.ini and the saves live: "/persist" if browser storage works, else "/game". */
  dir: string;
  persisted: boolean;
}

export interface LoaderEvents {
  onStatus(text: string): void;
  onProgress(fraction: number): void;
  /** Everything is downloaded and unpacked, and the saves are mounted; only the click gate is left. */
  onReady(info: ReadyInfo): void;
  onAbort(what: string): void;
}

export interface Engine {
  /** Call from a user gesture. Lets main() run. */
  start(): void;
}

const ENGINE_DIR = `${import.meta.env.BASE_URL}engine/`;
const GATE = "user-gesture";

export function loadEngine(canvas: HTMLCanvasElement, ev: LoaderEvents): Engine {
  let gateAdded = false;
  let lastLeft = Infinity; // last reported number of run dependencies
  let checkQueued = false;
  let ready = false;
  let mounted = false; // saves mounted: safe to start
  let started = false;

  const becomeReady = () => {
    if (ready || started) return;
    ready = true;
    ev.onStatus("Ready.");
    ev.onProgress(1);
    const M = config as EngineModule;
    void setupPersistence(M).then((persisted) => {
      mounted = true;
      ev.onReady({ fs: M.FS, dir: persisted ? "/persist" : "/game", persisted });
    });
  };

  const config: Partial<EngineModule> = {
    canvas,
    locateFile: (path) => ENGINE_DIR + path,
    print: (t) => console.log(t),
    printErr: (t) => console.warn(t),
    preRun: [
      () => {
        gateAdded = true;
        (config as EngineModule).addRunDependency(GATE);
      },
    ],
    setStatus: (text) => {
      const m = /(.+) \((\d+(?:\.\d+)?)\/(\d+)\)/.exec(text);
      if (m) {
        ev.onStatus(`${m[1]}…`);
        ev.onProgress(Number(m[2]) / Number(m[3]));
      } else if (text) {
        ev.onStatus(text);
      }
    },
    monitorRunDependencies: (left) => {
      // The data package is itself a run dependency, and its preRun may run after
      // ours, so "only the gate is left" cannot be judged inside this call. Look at
      // the last count one tick later, when every preRun has registered its own.
      lastLeft = left;
      if (checkQueued) return;
      checkQueued = true;
      setTimeout(() => {
        checkQueued = false;
        if (gateAdded && lastLeft <= 1) becomeReady();
      }, 0);
    },
    onAbort: (what) => ev.onAbort(String(what)),
  };

  const script = document.createElement("script");
  script.src = `${ENGINE_DIR}amulets-armor.js`;
  script.async = true;
  script.onload = () => window.createAA?.(config);
  script.onerror = () => ev.onAbort(`Could not load ${script.src}. Run "npm run engine".`);
  document.body.append(script);

  return {
    start() {
      if (started || !mounted) return;
      started = true;
      (config as EngineModule).removeRunDependency(GATE);
    },
  };
}
