// Just the parts of Emscripten's `Module` / `FS` that the site uses.

export interface FSStat {
  mode: number;
}

export interface EmFS {
  mkdir(path: string): void;
  mkdirTree(path: string): void;
  mount(type: unknown, opts: object, mountpoint: string): void;
  syncfs(populate: boolean, cb: (err: unknown) => void): void;
  lstat(path: string): FSStat;
  isDir(mode: number): boolean;
  readdir(path: string): string[];
  readFile(path: string): Uint8Array;
  writeFile(path: string, data: Uint8Array | string): void;
  unlink(path: string): void;
  rmdir(path: string): void;
  symlink(target: string, path: string): void;
  filesystems: { IDBFS: unknown };
}

export interface EngineModule {
  canvas: HTMLCanvasElement;
  FS: EmFS;
  print?: (text: string) => void;
  printErr?: (text: string) => void;
  locateFile?: (path: string, prefix: string) => string;
  preRun?: Array<() => void>;
  setStatus?: (text: string) => void;
  monitorRunDependencies?: (left: number) => void;
  onAbort?: (what: unknown) => void;
  addRunDependency(id: string): void;
  removeRunDependency(id: string): void;
}

declare global {
  interface Window {
    createAA?: (config: Partial<EngineModule>) => Promise<EngineModule>;
    webkitAudioContext?: typeof AudioContext;
  }
}
