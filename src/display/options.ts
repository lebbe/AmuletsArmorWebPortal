// The display choices (size, pixel smoothing, screen filter), kept in localStorage.
// They only concern the page around the 640x400 canvas, never the game itself.

export const GAME_W = 640;
export const GAME_H = 400;

export type Scaling = "fit" | "integer";
export type Aspect = "16:10" | "4:3" | "fill";
export type Filter = "off" | "scanlines" | "crt";

export interface DisplayOptions {
  scaling: Scaling;
  /** 16:10 is the canvas as it is (square pixels), 4:3 is how a CRT monitor showed the DOS game, fill uses the whole window. */
  aspect: Aspect;
  smooth: boolean;
  filter: Filter;
  /** 0-100 */
  strength: number;
}

export const DEFAULTS: DisplayOptions = { scaling: "fit", aspect: "16:10", smooth: false, filter: "off", strength: 40 };

const KEY = "aa.display";

const CHOICES = {
  scaling: ["fit", "integer"],
  aspect: ["16:10", "4:3", "fill"],
  filter: ["off", "scanlines", "crt"],
} as const;

export function loadOptions(): DisplayOptions {
  const options = { ...DEFAULTS };
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<keyof DisplayOptions, unknown>>;
    if ((CHOICES.scaling as readonly unknown[]).includes(stored.scaling)) options.scaling = stored.scaling as Scaling;
    if ((CHOICES.aspect as readonly unknown[]).includes(stored.aspect)) options.aspect = stored.aspect as Aspect;
    if ((CHOICES.filter as readonly unknown[]).includes(stored.filter)) options.filter = stored.filter as Filter;
    if (typeof stored.smooth === "boolean") options.smooth = stored.smooth;
    if (typeof stored.strength === "number") options.strength = Math.min(100, Math.max(0, stored.strength));
  } catch {
    /* no storage or unreadable: use the defaults */
  }
  return options;
}

export function saveOptions(options: DisplayOptions): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(options));
  } catch {
    /* not kept */
  }
}

export interface Size {
  width: number;
  height: number;
}

/** The size of the picture inside the space that is free for it (both in CSS pixels). */
export function frameSize(options: DisplayOptions, availW: number, availH: number): Size {
  availW = Math.max(1, Math.floor(availW));
  availH = Math.max(1, Math.floor(availH));
  const fit = (ratio: number): Size => {
    const width = Math.min(availW, availH * ratio);
    return { width: Math.floor(width), height: Math.floor(width / ratio) };
  };

  // Stretching to the window has no whole-number sizes: the two directions would get different scales.
  if (options.aspect === "fill") return { width: availW, height: availH };

  // 4:3 keeps the width and makes the pixels 1.2 times as tall, like the original 320x200 on a 4:3 screen.
  const heightFactor = options.aspect === "4:3" ? 1.2 : 1;
  if (options.scaling === "integer") {
    const s = Math.floor(Math.min(availW / GAME_W, availH / (GAME_H * heightFactor)));
    if (s >= 1) return { width: GAME_W * s, height: Math.round(GAME_H * heightFactor * s) };
  }
  return fit(options.aspect === "4:3" ? 4 / 3 : GAME_W / GAME_H);
}
