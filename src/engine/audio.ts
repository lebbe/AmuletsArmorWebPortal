// The engine creates its own AudioContext. We wrap the constructor *before the
// engine script loads* so we can see the context and suspend/resume it for
// Mute and while the tab is hidden.

const contexts: AudioContext[] = [];
let muted = false;
const listeners = new Set<(muted: boolean) => void>();

export function installAudioCapture(): void {
  const Native = window.AudioContext ?? window.webkitAudioContext;
  if (!Native) return;
  const Wrapped = function (this: unknown, ...args: ConstructorParameters<typeof AudioContext>) {
    const ctx = new Native(...args);
    contexts.push(ctx);
    return ctx;
  } as unknown as typeof AudioContext;
  Wrapped.prototype = Native.prototype;
  window.AudioContext = window.webkitAudioContext = Wrapped;
  document.addEventListener("visibilitychange", apply);
}

function apply(): void {
  const wantSuspended = muted || document.hidden;
  for (const c of contexts) {
    if (wantSuspended && c.state === "running") void c.suspend();
    else if (!wantSuspended && c.state === "suspended") void c.resume();
  }
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
