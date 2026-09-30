// Presses keys for the game from JavaScript. The engine's SDL listens for
// keydown/keyup on `document` and reads the legacy `keyCode`, which a script-made
// KeyboardEvent does not carry, so it is added to each event.
//
// The game polls the key *state* once per frame, so a press has to last a few
// frames to be seen: typed characters are queued and held briefly.

import { KEY_NAMES } from "../settings/keys";

interface BrowserKey {
  keyCode: number;
  key: string;
  location?: number;
}

// Scan codes whose browser key is not simply the letter or digit in KEY_NAMES.
// The keyCodes are the ones the engine's SDL table understands (so "-" is 173 and "=" 61, as in Firefox).
const SPECIAL: Record<number, BrowserKey> = {
  0x01: { keyCode: 27, key: "Escape" },
  0x0c: { keyCode: 173, key: "-" },
  0x0d: { keyCode: 61, key: "=" },
  0x0e: { keyCode: 8, key: "Backspace" },
  0x0f: { keyCode: 9, key: "Tab" },
  0x1a: { keyCode: 219, key: "[" },
  0x1b: { keyCode: 221, key: "]" },
  0x1c: { keyCode: 13, key: "Enter" },
  0x1d: { keyCode: 17, key: "Control" },
  0x27: { keyCode: 59, key: ";" },
  0x28: { keyCode: 222, key: "'" },
  0x29: { keyCode: 192, key: "`" },
  0x2a: { keyCode: 16, key: "Shift" },
  0x2b: { keyCode: 220, key: "\\" },
  0x33: { keyCode: 188, key: "," },
  0x34: { keyCode: 190, key: "." },
  0x35: { keyCode: 191, key: "/" },
  0x36: { keyCode: 16, key: "Shift", location: 2 },
  0x37: { keyCode: 106, key: "*", location: 3 },
  0x38: { keyCode: 18, key: "Alt" },
  0x39: { keyCode: 32, key: " " },
  0x3a: { keyCode: 20, key: "CapsLock" },
  0x45: { keyCode: 144, key: "NumLock" },
  0x47: { keyCode: 103, key: "7", location: 3 },
  0x48: { keyCode: 104, key: "8", location: 3 },
  0x49: { keyCode: 105, key: "9", location: 3 },
  0x4a: { keyCode: 109, key: "-", location: 3 },
  0x4b: { keyCode: 100, key: "4", location: 3 },
  0x4c: { keyCode: 101, key: "5", location: 3 },
  0x4d: { keyCode: 102, key: "6", location: 3 },
  0x4e: { keyCode: 107, key: "+", location: 3 },
  0x4f: { keyCode: 97, key: "1", location: 3 },
  0x50: { keyCode: 98, key: "2", location: 3 },
  0x51: { keyCode: 99, key: "3", location: 3 },
  0x52: { keyCode: 96, key: "0", location: 3 },
  0x53: { keyCode: 110, key: ".", location: 3 },
  0x9c: { keyCode: 13, key: "Enter", location: 3 },
  0xb5: { keyCode: 111, key: "/", location: 3 },
  0xc7: { keyCode: 36, key: "Home" },
  0xc8: { keyCode: 38, key: "ArrowUp" },
  0xc9: { keyCode: 33, key: "PageUp" },
  0xcb: { keyCode: 37, key: "ArrowLeft" },
  0xcd: { keyCode: 39, key: "ArrowRight" },
  0xcf: { keyCode: 35, key: "End" },
  0xd0: { keyCode: 40, key: "ArrowDown" },
  0xd1: { keyCode: 34, key: "PageDown" },
  0xd2: { keyCode: 45, key: "Insert" },
  0xd3: { keyCode: 46, key: "Delete" },
};
for (let f = 1; f <= 12; f++) SPECIAL[f <= 10 ? 0x3a + f : 0x4c + f] = { keyCode: 111 + f, key: `F${f}` };

/** The browser key for one of the game's scan codes (as stored in config.ini). */
export function browserKey(scan: number): BrowserKey | undefined {
  if (SPECIAL[scan]) return SPECIAL[scan];
  const name = KEY_NAMES.get(scan);
  if (name && /^[A-Z0-9]$/.test(name)) return { keyCode: name.charCodeAt(0), key: name.toLowerCase() };
  return undefined;
}

const SHIFT: BrowserKey = { keyCode: 16, key: "Shift" };

// Characters typed with Shift, and the unshifted key they are on (US layout, as the game assumes).
const SHIFTED: Record<string, string> = {
  "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  _: "-", "+": "=", ":": ";", '"': "'", "?": "/", "<": ",", ">": ".", "{": "[", "}": "]", "|": "\\", "~": "`",
};
const PUNCTUATION: Record<string, number> = {
  "-": 0x0c, "=": 0x0d, "[": 0x1a, "]": 0x1b, ";": 0x27, "'": 0x28, "`": 0x29, "\\": 0x2b, ",": 0x33, ".": 0x34, "/": 0x35, " ": 0x39,
};

/** The key (and whether Shift is needed) that types a character, or undefined if the game has none. */
function charKey(ch: string): { key: BrowserKey; shift: boolean } | undefined {
  if (/^[a-z0-9]$/.test(ch)) return { key: { keyCode: ch.toUpperCase().charCodeAt(0), key: ch }, shift: false };
  if (/^[A-Z]$/.test(ch)) return { key: { keyCode: ch.charCodeAt(0), key: ch }, shift: true };
  const base = SHIFTED[ch] ?? ch;
  const scan = /^[0-9]$/.test(base) ? undefined : PUNCTUATION[base];
  const key = scan !== undefined ? SPECIAL[scan] : /^[0-9]$/.test(base) ? { keyCode: base.charCodeAt(0), key: base } : undefined;
  return key && { key, shift: ch in SHIFTED };
}

function send(type: "keydown" | "keyup", k: BrowserKey) {
  const e = new KeyboardEvent(type, { key: k.key, location: k.location ?? 0, bubbles: true, cancelable: true });
  Object.defineProperty(e, "keyCode", { get: () => k.keyCode });
  Object.defineProperty(e, "which", { get: () => k.keyCode });
  document.dispatchEvent(e);
}

const HOLD_MS = 70; // long enough for the game to see a typed key
const GAP_MS = 40;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Keys held down on the game's behalf. Several controls may hold the same key; it is released when the last lets go. */
export class VirtualKeys {
  private held = new Map<number, number>(); // scan code -> number of holders
  private typing: Promise<void> = Promise.resolve();

  hold(scan: number): void {
    const key = browserKey(scan);
    if (!key) return;
    const n = this.held.get(scan) ?? 0;
    this.held.set(scan, n + 1);
    if (n === 0) send("keydown", key);
  }

  release(scan: number): void {
    const n = this.held.get(scan);
    if (!n) return;
    if (n > 1) {
      this.held.set(scan, n - 1);
      return;
    }
    this.held.delete(scan);
    const key = browserKey(scan);
    if (key) send("keyup", key);
  }

  releaseAll(): void {
    for (const scan of [...this.held.keys()]) {
      this.held.set(scan, 1);
      this.release(scan);
    }
  }

  /** Press and let go of a scan code, after anything typed before it. */
  tap(scan: number): void {
    const key = browserKey(scan);
    if (key) this.queue(key, false);
  }

  /** Type text, one key at a time. Characters the game has no key for are skipped. */
  type(text: string): void {
    for (const ch of text) {
      const k = charKey(ch);
      if (k) this.queue(k.key, k.shift);
    }
  }

  private queue(key: BrowserKey, shift: boolean): void {
    this.typing = this.typing.then(async () => {
      if (shift) send("keydown", SHIFT);
      send("keydown", key);
      await sleep(HOLD_MS);
      send("keyup", key);
      if (shift) send("keyup", SHIFT);
      await sleep(GAP_MS);
    });
  }
}
