// The browser music player: hosted tracks, MIDI files played with a soundfont, and
// internet radio streams. It has its own audio (never the game's), and follows Mute
// and the hidden tab like the game does.

import processorUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";
import { isMuted, onMuteChange, plainAudioContext } from "../engine/audio";
import { MUSIC_BASE, type Library } from "./library";

export type Mode = "tracks" | "midi" | "live";
export const MODES: readonly Mode[] = ["tracks", "midi", "live"];

/** One thing that can be played. */
export interface Entry {
  id: string;
  title: string;
  detail?: string;
  /** URL of the audio, MIDI file or stream. */
  url?: string;
  /** A MIDI file the player chose from their own computer. */
  data?: ArrayBuffer;
  /** A radio stream: pausing it drops the connection, and playing again reconnects. */
  live?: boolean;
}

interface Backend {
  play(entry: Entry): Promise<void>;
  /** Keeps the place (for a stream: the entry). */
  pause(): void;
  resume(): Promise<void>;
  /** Gives the backend up for another one. */
  stop(): void;
  /** Silence without losing the place (Mute, hidden tab). */
  suspend(on: boolean): void;
  setVolume(v: number): void;
}

const KEY = "aa.music";

interface Saved {
  mode: Mode;
  volume: number;
  last: Partial<Record<Mode, string>>;
  streamUrl: string;
}

function loadSaved(): Saved {
  const saved: Saved = { mode: "tracks", volume: 0.5, last: {}, streamUrl: "" };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Saved>;
    if (s.mode && MODES.includes(s.mode)) saved.mode = s.mode;
    if (typeof s.volume === "number") saved.volume = Math.min(1, Math.max(0, s.volume));
    if (s.last && typeof s.last === "object") saved.last = s.last;
    if (typeof s.streamUrl === "string") saved.streamUrl = s.streamUrl;
  } catch {
    /* defaults */
  }
  return saved;
}

// ---------- Backends ----------

/** Tracks and radio streams: a plain <audio> element. */
class ElementBackend implements Backend {
  private audio = new Audio();
  private suspended = false;
  private wanted = false; // should be playing, unless suspended
  private live = false;
  private src = "";

  constructor(onEnded: () => void, onError: (message: string) => void) {
    this.audio.preload = "none";
    this.audio.addEventListener("ended", onEnded);
    this.audio.addEventListener("error", () => {
      if (this.wanted && this.audio.getAttribute("src")) onError("This could not be played. The address may be wrong, or the server does not allow it.");
    });
  }

  async play(entry: Entry): Promise<void> {
    this.wanted = true;
    this.live = entry.live === true;
    this.src = entry.url!;
    this.audio.src = this.src;
    await this.start();
  }

  /** Starts playing, unless suspended. A failure gets a message for the player. */
  private async start(): Promise<void> {
    if (this.suspended) return;
    try {
      await this.audio.play();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // replaced by another choice
      if (e instanceof DOMException && e.name === "NotAllowedError") throw new Error("The browser did not allow playback yet. Click play again.");
      throw new Error("This could not be played. The address may be wrong, or the server does not allow it.");
    }
  }

  private drop(): void {
    this.audio.removeAttribute("src");
    this.audio.load(); // ends a stream connection
  }

  pause(): void {
    this.wanted = false;
    this.audio.pause();
    if (this.live) this.drop();
  }

  async resume(): Promise<void> {
    this.wanted = true;
    if (!this.audio.getAttribute("src")) this.audio.src = this.src;
    await this.start();
  }

  stop(): void {
    this.wanted = false;
    this.audio.pause();
    this.drop();
  }

  suspend(on: boolean): void {
    this.suspended = on;
    if (!this.wanted) return;
    if (on) this.audio.pause();
    else void this.audio.play().catch(() => {});
  }

  setVolume(v: number): void {
    this.audio.volume = v;
  }
}

/** MIDI files: SpessaSynth (an AudioWorklet synthesizer) with the soundfont from the library. Loaded when first used. */
class MidiBackend implements Backend {
  private ctx?: AudioContext;
  private gain?: GainNode;
  private seq?: import("spessasynth_lib").Sequencer;
  private ready?: Promise<void>;
  private volume = 0.5;
  private suspended = false;
  private token = 0;
  private library: Library;
  private onEnded: () => void;
  private onStatus: (text: string) => void;

  constructor(library: Library, onEnded: () => void, onStatus: (text: string) => void) {
    this.library = library;
    this.onEnded = onEnded;
    this.onStatus = onStatus;
  }

  private init(): Promise<void> {
    this.ready ??= this.load().catch((e) => {
      this.ready = undefined; // try again next time
      throw e;
    });
    return this.ready;
  }

  private async load(): Promise<void> {
    const font = this.library.soundfont;
    if (!font) throw new Error("This build has no soundfont, so MIDI files cannot be played.");
    this.onStatus("Loading the instrument sounds (about 32 MB, kept in the browser after this)…");
    const [{ WorkletSynthesizer, Sequencer }, bank] = await Promise.all([import("spessasynth_lib"), fetchCached(`${MUSIC_BASE}${font.file}`)]);
    const ctx = plainAudioContext();
    await ctx.audioWorklet.addModule(processorUrl);
    const synth = new WorkletSynthesizer(ctx);
    const gain = ctx.createGain();
    gain.gain.value = this.volume;
    synth.disconnect(); // only through the volume control
    synth.connect(gain);
    gain.connect(ctx.destination);
    await synth.soundBankManager.addSoundBank(bank, "main");
    await synth.isReady;
    const seq = new Sequencer(synth);
    seq.loopCount = 0;
    seq.eventHandler.addEvent("songEnded", "aa-music", () => this.onEnded());
    this.ctx = ctx;
    this.gain = gain;
    this.seq = seq;
    this.onStatus("");
  }

  async play(entry: Entry): Promise<void> {
    const mine = ++this.token;
    await this.init();
    const data = entry.data ?? (await (await fetch(entry.url!)).arrayBuffer());
    if (mine !== this.token) return; // something else was chosen meanwhile
    this.seq!.loadNewSongList([{ binary: data, fileName: entry.title }]);
    this.seq!.loopCount = 0;
    if (!this.suspended) await this.ctx!.resume();
    this.seq!.play();
  }

  pause(): void {
    this.seq?.pause();
  }

  async resume(): Promise<void> {
    if (!this.seq) return;
    if (!this.suspended) await this.ctx!.resume();
    this.seq.play();
  }

  stop(): void {
    this.token++;
    this.seq?.pause();
  }

  suspend(on: boolean): void {
    this.suspended = on;
    if (!this.ctx) return;
    if (on) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.gain) this.gain.gain.value = v;
  }
}

/** Fetches a big file, keeping it in the Cache API so the next visit does not download it again. */
async function fetchCached(url: string): Promise<ArrayBuffer> {
  try {
    const cache = await caches.open("aa-music");
    const hit = await cache.match(url);
    if (hit) return await hit.arrayBuffer();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    void cache.put(url, res.clone()).catch(() => {});
    return await res.arrayBuffer();
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("HTTP")) throw e;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.arrayBuffer();
  }
}

// ---------- Player ----------

export class MusicPlayer {
  library: Library;
  mode: Mode;
  volume: number;
  /** The entry that plays or is paused. */
  current?: { mode: Mode; entry: Entry };
  playing = false;
  /** Text about loading or a problem, for the player to show. */
  message = "";
  streamUrl: string;
  /** MIDI files chosen from the player's own computer, this visit only. */
  userMidi: Entry[] = [];

  private last: Partial<Record<Mode, string>>;
  private backends: Record<Mode, Backend>;
  private listeners = new Set<() => void>();
  private hidden = document.hidden;

  constructor(library: Library) {
    this.library = library;
    const saved = loadSaved();
    this.mode = saved.mode;
    this.volume = saved.volume;
    this.last = saved.last;
    this.streamUrl = saved.streamUrl;

    const element = new ElementBackend(
      () => this.next(),
      (m) => this.fail(m),
    );
    const midi = new MidiBackend(library, () => this.next(), (t) => this.say(t));
    // Tracks and streams share one <audio> element, one plays at a time.
    this.backends = { tracks: element, live: element, midi };
    for (const b of new Set(Object.values(this.backends))) b.setVolume(this.volume);

    onMuteChange(() => this.applySuspend());
    document.addEventListener("visibilitychange", () => {
      this.hidden = document.hidden;
      this.applySuspend();
    });
  }

  onChange(fn: () => void): void {
    this.listeners.add(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  private say(text: string): void {
    this.message = text;
    this.emit();
  }

  private fail(text: string): void {
    this.playing = false;
    this.say(text);
  }

  private save(): void {
    try {
      const saved: Saved = { mode: this.mode, volume: this.volume, last: this.last, streamUrl: this.streamUrl };
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      /* not remembered */
    }
  }

  private applySuspend(): void {
    const off = isMuted() || this.hidden;
    for (const b of new Set(Object.values(this.backends))) b.suspend(off);
  }

  /** What can be played in a mode. */
  entries(mode: Mode): Entry[] {
    const lib = this.library;
    if (mode === "tracks") {
      return lib.tracks.map((t) => ({ id: t.id, title: t.title, detail: t.author, url: `${MUSIC_BASE}${t.file}` }));
    }
    if (mode === "midi") {
      const hosted = lib.midi.map((t) => ({ id: t.id, title: t.title, detail: t.author, url: `${MUSIC_BASE}${t.file}` }));
      return [...hosted, ...this.userMidi];
    }
    const streams: Entry[] = lib.streams.map((s) => ({ id: s.id, title: s.name, detail: s.note, url: s.url, live: true }));
    if (this.streamUrl) streams.push({ id: "custom", title: "Your own stream", detail: this.streamUrl, url: this.streamUrl, live: true });
    return streams;
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.save();
    this.emit();
  }

  setStreamUrl(url: string): void {
    this.streamUrl = url.trim();
    this.save();
    this.emit();
  }

  addMidiFile(name: string, data: ArrayBuffer): Entry {
    const entry: Entry = { id: `file-${this.userMidi.length}-${name}`, title: name.replace(/\.midi?$/i, ""), detail: "from your computer", data };
    this.userMidi.push(entry);
    this.emit();
    return entry;
  }

  /** Starts an entry; stops what was playing. Errors are shown through `message`. */
  async play(mode: Mode, entry: Entry): Promise<void> {
    const stopped = this.current && this.backends[this.current.mode];
    if (stopped && stopped !== this.backends[mode]) stopped.stop();
    this.mode = mode;
    this.current = { mode, entry };
    this.last[mode] = entry.id;
    this.playing = true;
    this.message = "";
    this.save();
    this.emit();
    try {
      await this.backends[mode].play(entry);
      this.applySuspend();
    } catch (e) {
      this.fail(e instanceof Error ? e.message : String(e));
    }
    this.emit();
  }

  /** Play or pause; starts the last (or first) entry of the current mode if nothing was chosen yet. */
  async toggle(): Promise<void> {
    if (this.playing && this.current) {
      this.playing = false;
      this.backends[this.current.mode].pause();
      this.emit();
      return;
    }
    if (this.current) {
      this.playing = true;
      this.message = "";
      this.emit();
      try {
        await this.backends[this.current.mode].resume();
      } catch (e) {
        this.fail(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    // Nothing chosen yet: the last (or first) entry of the current mode, else of the first mode that has any.
    for (const mode of [this.mode, ...MODES.filter((m) => m !== this.mode)]) {
      const list = this.entries(mode);
      const entry = list.find((e) => e.id === this.last[mode]) ?? list[0];
      if (entry) return this.play(mode, entry);
    }
    this.say("Nothing to play here yet.");
  }

  async next(step = 1): Promise<void> {
    const mode = this.current?.mode ?? this.mode;
    const list = this.entries(mode);
    if (!list.length) return;
    const at = list.findIndex((e) => e.id === this.current?.entry.id);
    await this.play(mode, list[(at + step + list.length) % list.length]);
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    for (const b of new Set(Object.values(this.backends))) b.setVolume(this.volume);
    this.save();
    this.emit();
  }
}
