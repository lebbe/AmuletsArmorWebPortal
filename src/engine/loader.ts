// Injects the engine script (built with MODULARIZE: it defines a global
// `createAA(config)` factory) and starts it with our configuration. The game
// data downloads right away, but main() is held back by a run dependency until start() is called from a click, so the game opens its audio
// device inside a user gesture (browsers require that).

import type { EngineModule } from "./emscripten";
import { setupPersistence } from "./storage";

export interface LoaderEvents {
  onStatus(text: string): void;
  onProgress(fraction: number): void;
  /** Everything is downloaded; only the click gate is left. */
  onReady(): void;
  onAbort(what: string): void;
  onSaveStatus(persisted: boolean): void;
}

export interface Engine {
  /** Call from a user gesture. Sets up saving, then lets main() run. */
  start(): Promise<void>;
}

const ENGINE_DIR = `${import.meta.env.BASE_URL}engine/`;
const GATE = "user-gesture";

export function loadEngine(canvas: HTMLCanvasElement, ev: LoaderEvents): Engine {
  let started = false;
  let gateOpen: () => Promise<void> = async () => {};

  const config: Partial<EngineModule> = {
    canvas,
    locateFile: (path) => ENGINE_DIR + path,
    print: (t) => console.log(t),
    printErr: (t) => console.warn(t),
    preRun: [
      () => {
        const M = config as EngineModule; // the factory fills in this same object
        M.addRunDependency(GATE);
        gateOpen = async () => {
          // The game data is unpacked into /game by now.
          const ok = await setupPersistence(M);
          ev.onSaveStatus(ok);
          M.removeRunDependency(GATE);
        };
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
      // Only our own gate left: everything is downloaded.
      if (left <= 1 && !started) {
        ev.onStatus("Ready.");
        ev.onProgress(1);
        ev.onReady();
      }
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
    async start() {
      if (started) return;
      started = true;
      await gateOpen();
    },
  };
}
