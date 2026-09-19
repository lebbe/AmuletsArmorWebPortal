// The game settings the page exposes. Each one knows how to read its value from
// config.ini and which config.ini keys to write. The controls themselves are in
// play.html (`data-setting="<id>"`); ranges come from the input's min/max/step.
//
// Value ranges, from the game source (Source/CONFIG.C, BANNER.C, COLOR.C):
//   volumes 0-65535, turn speeds 20-200 (%), gamma 0-14 in steps of 2,
//   boboff = 1 means head bob is OFF.

export type Change = [section: string, key: string, value: string];
export type Get = (section: string, key: string) => string | undefined;

export interface Setting {
  id: string;
  read(get: Get): boolean | number;
  write(value: boolean | number): Change[];
}

const flag = (v: string | undefined, fallback: boolean) => (v === undefined ? fallback : Number(v) === 1);
const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v === undefined || Number.isNaN(n) ? fallback : n;
};
const bit = (b: boolean | number) => (b ? "1" : "0");
const percent = (v: string | undefined, fallback: number) => Math.round((num(v, fallback) / 65535) * 100);

export const SETTINGS: Setting[] = [
  {
    // The web build uses the game's SDL sound code, which ignores `musicType` (that
    // only applies to the DOS/MIDI code) and silences music through `musicOn`.
    id: "music",
    read: (get) => flag(get("options", "musicOn"), true),
    write: (on) =>
      on
        ? [
            ["options", "musicType", "1"],
            ["options", "musicOn", "1"],
          ]
        : [["options", "musicOn", "0"]],
  },
  {
    id: "musicVolume",
    read: (get) => percent(get("options", "musicVolume"), 65000),
    write: (p) => [["options", "musicVolume", String(Math.round((Number(p) * 65535) / 100))]],
  },
  {
    id: "sfx",
    read: (get) => flag(get("options", "sfxOn"), true),
    write: (on) => [["options", "sfxOn", bit(on)]],
  },
  {
    id: "sfxVolume",
    read: (get) => percent(get("options", "sfxVolume"), 65000),
    write: (p) => [["options", "sfxVolume", String(Math.round((Number(p) * 65535) / 100))]],
  },
  {
    id: "mouseTurn",
    read: (get) => num(get("options", "mouseturnspeed"), 100),
    write: (v) => [["options", "mouseturnspeed", String(v)]],
  },
  {
    id: "keyTurn",
    read: (get) => num(get("options", "keyturnspeed"), 100),
    write: (v) => [["options", "keyturnspeed", String(v)]],
  },
  {
    id: "invertMouse",
    read: (get) => flag(get("options", "invertmousey"), false),
    write: (on) => [["options", "invertmousey", bit(on)]],
  },
  {
    id: "headBob",
    read: (get) => !flag(get("options", "boboff"), false),
    write: (on) => [["options", "boboff", bit(!on)]],
  },
  {
    id: "dropItems",
    read: (get) => flag(get("options", "dyingdropsitems"), false),
    write: (on) => [["options", "dyingdropsitems", bit(on)]],
  },
  {
    // The game's gamma steps in twos (0-14); the slider shows 0-7.
    id: "gamma",
    read: (get) => Math.round(num(get("video", "gamma"), 0) / 2),
    write: (v) => [["video", "gamma", String(Number(v) * 2)]],
  },
];
