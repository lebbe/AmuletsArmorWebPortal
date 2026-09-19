// Key bindings. The game stores one physical scan code per action: `keys1`
// (actions 0-33) and `keys2` (actions 34-67) in config.ini, as hex bytes.
// Keys with a 0x80 bit are the "extended" ones (arrows, Home, Delete, ...).
// The in-game help page is control.txt: the game rewrites it itself when the
// player changes keys in the Esc menu, so a preset has to write it too.

/** Scan code -> the name the game prints in control.txt (from the game's own table). */
export const KEY_NAMES = new Map<number, string>([
  [0x01, "ESC"],
  [0x02, "1"],
  [0x03, "2"],
  [0x04, "3"],
  [0x05, "4"],
  [0x06, "5"],
  [0x07, "6"],
  [0x08, "7"],
  [0x09, "8"],
  [0x0A, "9"],
  [0x0B, "0"],
  [0x0C, "-"],
  [0x0D, "="],
  [0x0E, "<--"],
  [0x0F, "TAB"],
  [0x10, "Q"],
  [0x11, "W"],
  [0x12, "E"],
  [0x13, "R"],
  [0x14, "T"],
  [0x15, "Y"],
  [0x16, "U"],
  [0x17, "I"],
  [0x18, "O"],
  [0x19, "P"],
  [0x1A, "["],
  [0x1B, "]"],
  [0x1C, "ENTER"],
  [0x1D, "CTRL"],
  [0x1E, "A"],
  [0x1F, "S"],
  [0x20, "D"],
  [0x21, "F"],
  [0x22, "G"],
  [0x23, "H"],
  [0x24, "J"],
  [0x25, "K"],
  [0x26, "L"],
  [0x27, ";"],
  [0x28, "'"],
  [0x29, "`"],
  [0x2A, "SHIFT"],
  [0x2B, "\\\\"],
  [0x2C, "Z"],
  [0x2D, "X"],
  [0x2E, "C"],
  [0x2F, "V"],
  [0x30, "B"],
  [0x31, "N"],
  [0x32, "M"],
  [0x33, ","],
  [0x34, "."],
  [0x35, "/"],
  [0x36, "SHIFT"],
  [0x37, "*"],
  [0x38, "ALT"],
  [0x39, "SPACE"],
  [0x3A, "CAPLK"],
  [0x3B, "F1"],
  [0x3C, "F2"],
  [0x3D, "F3"],
  [0x3E, "F4"],
  [0x3F, "F5"],
  [0x40, "F6"],
  [0x41, "F7"],
  [0x42, "F8"],
  [0x43, "F9"],
  [0x44, "F10"],
  [0x45, "NUMLK"],
  [0x46, "SCRLK"],
  [0x47, "KPAD7"],
  [0x48, "KPAD8"],
  [0x49, "KPAD9"],
  [0x4A, "KPAD-"],
  [0x4B, "KPAD4"],
  [0x4C, "KPAD5"],
  [0x4D, "KPAD6"],
  [0x4E, "KPAD+"],
  [0x4F, "KPAD1"],
  [0x50, "KPAD2"],
  [0x51, "KPAD3"],
  [0x52, "KPAD0"],
  [0x53, "KPAD."],
  [0x57, "F11"],
  [0x58, "F12"],
  [0x9C, "K_ENT"],
  [0xB5, "KPAD/"],
  [0xC7, "HOME"],
  [0xC8, "UP"],
  [0xC9, "PGUP"],
  [0xCB, "LEFT"],
  [0xCD, "RIGHT"],
  [0xCF, "END"],
  [0xD0, "DOWN"],
  [0xD1, "PGDN"],
  [0xD2, "INS"],
  [0xD3, "DEL"],
  [0xDC, "PAUSE"],
  [0xEF, "MACRO"],
]);

const KEYS1_LENGTH = 34;
const KEYS_TOTAL = 68;

/** The keys the game ships with (WASD). */
export const DEFAULT_KEYS: number[] = parseKeys(
  "111F1E20382A39121DD3D20E9C534F50514B4C4D4748490F4748494B4C4D4F505135",
  "00193C3D3E3F404142434457582902030405060708C9D11422000000000000000000",
);

// Indices of the actions that presets change.
const FORWARD = 0;
const BACKWARD = 1;
const TURN_LEFT = 2;
const TURN_RIGHT = 3;
const SIDESTEP = 4;
const RUN = 5; // in the game this is really the "walk" key: running is the default
const ACTIVATE = 7;
const LOOK_UP = 9;
const LOOK_DOWN = 10;
const CENTER_VIEW = 11;
const TIME_OF_DAY = 57;

export interface KeyPreset {
  id: string;
  name: string;
  description: string;
  keys: number[];
}

function withOverrides(overrides: Record<number, number>): number[] {
  const keys = [...DEFAULT_KEYS];
  for (const [i, code] of Object.entries(overrides)) keys[Number(i)] = code;
  return keys;
}

export const PRESETS: KeyPreset[] = [
  {
    id: "wasd",
    name: "WASD (default)",
    description: "W/S move, A/D turn, E opens and activates.",
    keys: DEFAULT_KEYS,
  },
  {
    id: "arrows",
    name: "Arrow keys",
    description: "Arrow keys move and turn. E still opens and activates.",
    keys: withOverrides({ [FORWARD]: 0xc8, [BACKWARD]: 0xd0, [TURN_LEFT]: 0xcb, [TURN_RIGHT]: 0xcd }),
  },
  {
    id: "esdf",
    name: "ESDF",
    description: "E/D move, S/F turn, R opens and activates.",
    keys: withOverrides({ [FORWARD]: 0x12, [BACKWARD]: 0x20, [TURN_LEFT]: 0x1f, [TURN_RIGHT]: 0x21, [ACTIVATE]: 0x13 }),
  },
  {
    id: "lebbe",
    name: "lebbe's choice",
    description:
      "WASD, but Shift sidesteps (hold it with A/D, instead of the buggy Left Alt) and Q is the walk key. R/F look up/down, T centers the view. Time of day moves to Y.",
    keys: withOverrides({
      [SIDESTEP]: 0x2a, // Shift (was Run)
      [RUN]: 0x10, // Q
      [LOOK_UP]: 0x13, // R
      [LOOK_DOWN]: 0x21, // F
      [CENTER_VIEW]: 0x14, // T
      [TIME_OF_DAY]: 0x15, // Y (T was time of day)
    }),
  },
];

function parseKeys(keys1: string, keys2: string): number[] {
  const out: number[] = [];
  for (const s of [keys1, keys2]) {
    for (let i = 0; i + 1 < s.length; i += 2) out.push(parseInt(s.slice(i, i + 2), 16) || 0);
  }
  while (out.length < KEYS_TOTAL) out.push(0);
  return out.slice(0, KEYS_TOTAL);
}

const hex = (codes: number[]) => codes.map((c) => c.toString(16).toUpperCase().padStart(2, "0")).join("");

/** The two config.ini values for a set of keys. */
export function keysToIni(keys: number[]): { keys1: string; keys2: string } {
  return { keys1: hex(keys.slice(0, KEYS1_LENGTH)), keys2: hex(keys.slice(KEYS1_LENGTH)) };
}

export function keysFromIni(keys1: string | undefined, keys2: string | undefined): number[] {
  return parseKeys(keys1 ?? "", keys2 ?? "");
}

export function findPreset(keys: number[]): KeyPreset | undefined {
  return PRESETS.find((p) => p.keys.every((code, i) => code === keys[i]));
}

// Actions shown in control.txt: the game lists every action that has a label, and
// the "Look mode" key (23) is the only one below 59 without one.
const LISTED_ACTIONS = Array.from({ length: 59 }, (_, i) => i).filter((i) => i !== 23);

/** Rewrite the key names in control.txt. Its action lines follow LISTED_ACTIONS. */
export function updateControlText(text: string, keys: number[]): string {
  let line = 0;
  return text.replace(/^(.*\^009:)(.*)(\^007\r?)$/gm, (whole, head: string, _name: string, tail: string) => {
    const code = keys[LISTED_ACTIONS[line++]];
    return code === undefined ? whole : `${head}${KEY_NAMES.get(code) ?? "NONE"}${tail}`;
  });
}
