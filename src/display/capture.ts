// Screenshots and video of the canvas. Both are saved as downloads.

import { audioStream } from "../engine/audio";

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Saves the canvas as a PNG at its own size (640x400), without the screen filter. */
export function takeScreenshot(canvas: HTMLCanvasElement): void {
  canvas.toBlob((blob) => {
    if (blob) download(blob, `amulets-armor-${timestamp()}.png`);
  }, "image/png");
}

// Best first. Safari can only do MP4.
const FORMATS = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
];

export const canRecord = (): boolean =>
  typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";

export class Recorder {
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private ticker = 0;
  private listeners = new Set<() => void>();

  get recording(): boolean {
    return this.recorder !== undefined;
  }

  /** Seconds since the recording began. */
  get seconds(): number {
    return this.recording ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
  }

  /** Called when recording starts or stops, and once a second while it runs. */
  onChange(fn: () => void): void {
    this.listeners.add(fn);
  }

  start(canvas: HTMLCanvasElement): void {
    if (this.recorder) return;
    const video = canvas.captureStream(60);
    const stream = new MediaStream(video.getVideoTracks());
    audioStream()
      ?.getAudioTracks()
      .forEach((t) => stream.addTrack(t));

    const mimeType = FORMATS.find((f) => MediaRecorder.isTypeSupported(f));
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    this.chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    recorder.onstop = () => {
      video.getTracks().forEach((t) => t.stop()); // the audio track belongs to the game, keep it
      const type = recorder.mimeType || mimeType || "video/webm";
      download(new Blob(this.chunks, { type }), `amulets-armor-${timestamp()}.${type.includes("mp4") ? "mp4" : "webm"}`);
      this.chunks = [];
    };
    recorder.start(1000);
    this.recorder = recorder;
    this.startedAt = Date.now();
    this.ticker = window.setInterval(() => this.emit(), 1000);
    this.emit();
  }

  stop(): void {
    if (!this.recorder) return;
    this.recorder.stop();
    this.recorder = undefined;
    clearInterval(this.ticker);
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}
