// Applies the display options: the size of the picture, pixel smoothing and the
// screen filter. The size is worked out in JS because whole-number scaling needs the
// free space; everything else is CSS driven by data attributes on #frame.

import { frameSize, loadOptions, saveOptions, type DisplayOptions, type Size } from "./options";

type Listener = (options: DisplayOptions, size: Size) => void;

export class Display {
  options = loadOptions();
  size: Size = { width: 0, height: 0 };
  private listeners = new Set<Listener>();

  private stage: HTMLElement;
  private player: HTMLElement;
  private frame: HTMLElement;
  private toolbar: HTMLElement;

  constructor(stage: HTMLElement, player: HTMLElement, frame: HTMLElement, toolbar: HTMLElement) {
    this.stage = stage;
    this.player = player;
    this.frame = frame;
    this.toolbar = toolbar;
    new ResizeObserver(() => this.layout()).observe(stage);
    // The size of the fullscreen box is only known after the browser has resized the window.
    document.addEventListener("fullscreenchange", () => this.layout());
    window.addEventListener("resize", () => this.layout());
    new ResizeObserver(() => this.layout()).observe(player);
    this.layout();
  }

  onChange(fn: Listener): void {
    this.listeners.add(fn);
  }

  set<K extends keyof DisplayOptions>(key: K, value: DisplayOptions[K]): void {
    this.options = { ...this.options, [key]: value };
    saveOptions(this.options);
    this.layout();
  }

  private get fullscreen(): boolean {
    return document.fullscreenElement === this.player;
  }

  /** The space the picture may take: the stage minus its padding and the toolbar, or the whole screen in fullscreen (no toolbar there). */
  private available(): Size {
    if (this.fullscreen) return { width: this.player.clientWidth, height: this.player.clientHeight };
    const gap = parseFloat(getComputedStyle(this.player).rowGap) || 0;
    const toolbar = this.toolbar.offsetHeight + gap;
    const css = getComputedStyle(this.stage);
    const px = (name: string) => parseFloat(css.getPropertyValue(name)) || 0;
    return {
      width: this.stage.clientWidth - px("padding-left") - px("padding-right"),
      height: this.stage.clientHeight - px("padding-top") - px("padding-bottom") - toolbar,
    };
  }

  private layout(): void {
    const o = this.options;
    // In fullscreen the browser makes the player fill the screen (its size cannot be set), so
    // the picture is sized and centred inside it, with black around.
    this.player.style.width = "";
    const free = this.available();
    this.size = frameSize(o, free.width, free.height);
    if (!this.fullscreen) this.player.style.width = `${this.size.width}px`;
    this.frame.style.width = `${this.size.width}px`;
    this.frame.style.height = `${this.size.height}px`;
    this.frame.dataset.smooth = String(o.smooth);
    this.frame.dataset.filter = o.filter;
    this.frame.style.setProperty("--strength", String(o.strength / 100));
    this.listeners.forEach((fn) => fn(o, this.size));
  }
}
