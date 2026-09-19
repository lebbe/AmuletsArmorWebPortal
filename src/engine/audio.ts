// The engine creates its own AudioContext. We wrap the constructor *before the
// engine script loads* so we can see the context and suspend/resume it for
// Mute and while the tab is hidden. Whatever the game sends to the speakers is also
// copied to a stream, so a screen recording can have sound.

const contexts: AudioContext[] = [];
const taps = new Map<BaseAudioContext, MediaStreamAudioDestinationNode>();
let muted = false;
const listeners = new Set<(muted: boolean) => void>();

export function installAudioCapture(): void {
  const Native = window.AudioContext ?? window.webkitAudioContext;
  if (!Native) return;
  const Wrapped = function (this: unknown, ...args: ConstructorParameters<typeof AudioContext>) {
    const ctx = new Native(...args);
    contexts.push(ctx);
    taps.set(ctx, ctx.createMediaStreamDestination());
    return ctx;
  } as unknown as typeof AudioContext;
  Wrapped.prototype = Native.prototype;
  window.AudioContext = window.webkitAudioContext = Wrapped;

  // Whoever connects to a captured context's speakers is also connected to its tap.
  const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
  AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
    const result = connect.apply(this, args);
    const target = args[0];
    if (target instanceof AudioDestinationNode) {
      const tap = taps.get(target.context);
      if (tap) connect.call(this, tap);
    }
    return result;
  } as typeof AudioNode.prototype.connect;
  document.addEventListener("visibilitychange", apply);
}

function apply(): void {
  const wantSuspended = muted || document.hidden;
  for (const c of contexts) {
    if (wantSuspended && c.state === "running") void c.suspend();
    else if (!wantSuspended && c.state === "suspended") void c.resume();
  }
}

/** The game's sound as a stream (for recording), once the game has made its audio context. */
export function audioStream(): MediaStream | undefined {
  return taps.values().next().value?.stream;
}

export const isMuted = (): boolean => muted;

export function setMuted(value: boolean): void {
  muted = value;
  apply();
  listeners.forEach((fn) => fn(muted));
}

export function onMuteChange(fn: (muted: boolean) => void): void {
  listeners.add(fn);
}
