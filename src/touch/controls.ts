// Touch controls for fullscreen on phones and tablets held sideways: Look, look
// up/down, two strafe buttons and a movement pad left of the picture; the
// keyboard, Escape, Use, Open and Jump are on the right (markup in play.html).
// Everything else is tapped in the game itself, which SDL already turns into mouse clicks.
//
// The controls press the keys bound in config.ini, read again on every touch, so
// they follow the key presets and changes made in the game's own menu.
//
// Shown only in fullscreen, and only while the last pointer used was a finger,
// so a mouse user in fullscreen (or a touchscreen laptop used with a mouse) does
// not get them.

import { ACTIVATE, ATTACK, BACKWARD, FORWARD, JUMP, LOOK_DOWN, LOOK_UP, SIDESTEP, TURN_LEFT, TURN_RIGHT } from "../settings/keys";
import { setIcon } from "../ui/icons";
import { VirtualKeys } from "./virtual-keys";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Fraction of the pad's radius around the centre where nothing is pressed. */
const DEAD_ZONE = 0.25;

// Forward is held when the finger is within this angle of straight up; backward likewise from straight down.
const MOVE_ANGLE = 67.5;

// Turning is analogue, faked by tapping the turn key: the further the finger is
// from straight up or down, the larger the share of each period the key is held.
// Within STRAIGHT degrees there is no turning; from FULL degrees (the sides) the key is simply held.
const STRAIGHT = 8;
const FULL = 80;
const PERIOD_MS = 200;
const MIN_PRESS_MS = 40; // shorter taps may fall between two of the game's frames

// A tap on a button keeps its keys down at least this long. The game looks at the
// keys once per frame (and uses the weapon only on a frame where it is ready), and
// phones draw fewer frames, so a quick tap could come and go unseen.
const MIN_BUTTON_MS = 250;

export function setupTouchControls(player: HTMLElement, frame: HTMLElement, gameKeys: () => number[], onLayout: () => void) {
  const keys = new VirtualKeys();
  const pad = $("pad");
  const knob = $("pad-knob");
  const input = $<HTMLInputElement>("touch-input");

  // ----- When to show them -----

  let touching = false; // the last pointer used was a finger
  const update = () => {
    const on = touching && document.fullscreenElement === player;
    if (on === (player.dataset.touch !== undefined)) return;
    if (on) player.dataset.touch = "";
    else {
      delete player.dataset.touch;
      releaseEverything();
      input.blur();
    }
    onLayout(); // the picture makes room for the side columns
  };
  document.addEventListener(
    "pointerdown",
    (e) => {
      touching = e.pointerType === "touch" || e.pointerType === "pen";
      update();
    },
    true,
  );
  document.addEventListener("fullscreenchange", update);

  // Nothing may stay held when the page stops getting events.
  const releaseEverything = () => {
    stopTurn();
    keys.releaseAll();
  };
  window.addEventListener("blur", releaseEverything);
  document.addEventListener("visibilitychange", releaseEverything);

  // ----- Movement pad -----

  let padPointer: number | null = null;
  let padHeld: number[] = []; // movement scan codes the pad holds

  const setMoveKeys = (scans: number[]) => {
    for (const s of padHeld) if (!scans.includes(s)) keys.release(s);
    for (const s of scans) if (!padHeld.includes(s)) keys.hold(s);
    padHeld = scans;
  };

  // The turn key, tapped with a duty cycle of `turnShare` (0-1).
  let turnScan = 0;
  let turnShare = 0;
  let turnDown = false;
  let pulseTimer = 0;
  const pressTurn = (down: boolean) => {
    if (down === turnDown) return;
    turnDown = down;
    if (down) keys.hold(turnScan);
    else keys.release(turnScan);
  };
  const stopTurn = () => {
    clearTimeout(pulseTimer);
    pulseTimer = 0;
    pressTurn(false);
    turnScan = 0;
  };
  const pulse = () => {
    pressTurn(true);
    if (turnShare >= 1) {
      pulseTimer = window.setTimeout(pulse, PERIOD_MS);
      return;
    }
    const press = Math.max(MIN_PRESS_MS, turnShare * PERIOD_MS);
    pulseTimer = window.setTimeout(() => {
      pressTurn(false);
      pulseTimer = window.setTimeout(pulse, PERIOD_MS - press);
    }, press);
  };
  const setTurn = (scan: number, share: number) => {
    if (scan !== turnScan || share <= 0) stopTurn();
    if (!scan || share <= 0) return;
    turnScan = scan;
    turnShare = share;
    if (!pulseTimer) pulse(); // a new share takes effect from the next period
  };

  const releasePad = () => {
    setMoveKeys([]);
    stopTurn();
    delete pad.dataset.dir;
  };

  const movePad = (e: PointerEvent, bound: number[]) => {
    const r = pad.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = e.clientX - (r.left + radius);
    let dy = e.clientY - (r.top + radius);
    const dist = Math.hypot(dx, dy) / radius;
    if (dist > 1) {
      dx /= dist;
      dy /= dist;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (dist < DEAD_ZONE) {
      releasePad();
      return;
    }
    pad.dataset.dir = "";
    const angle = (Math.atan2(Math.abs(dx), -dy) * 180) / Math.PI; // 0 = up, 180 = down, either side
    const move = angle < MOVE_ANGLE ? FORWARD : angle > 180 - MOVE_ANGLE ? BACKWARD : -1;
    setMoveKeys(move < 0 || !bound[move] ? [] : [bound[move]]);
    const fromVertical = Math.min(angle, 180 - angle); // 0-90
    const share = Math.min(1, Math.max(0, (fromVertical - STRAIGHT) / (FULL - STRAIGHT)));
    setTurn(bound[dx > 0 ? TURN_RIGHT : TURN_LEFT] ?? 0, share);
  };

  let padBound: number[] = [];
  pad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (padPointer !== null) return;
    padPointer = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    padBound = gameKeys();
    movePad(e, padBound);
  });
  pad.addEventListener("pointermove", (e) => {
    if (e.pointerId === padPointer) movePad(e, padBound);
  });
  const endPad = (e: PointerEvent) => {
    if (e.pointerId !== padPointer) return;
    padPointer = null;
    releasePad();
    knob.style.transform = "";
  };
  pad.addEventListener("pointerup", endPad);
  pad.addEventListener("pointercancel", endPad);
  pad.addEventListener("lostpointercapture", endPad);

  // ----- Buttons held down: strafe (sidestep + turn), use, open -----

  const holdButton = (button: HTMLElement, actions: number[]) => {
    let pointer: number | null = null;
    let held: number[] = [];
    let downAt = 0;
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (pointer !== null) return;
      pointer = e.pointerId;
      button.setPointerCapture(e.pointerId);
      const bound = gameKeys();
      held = actions.map((a) => bound[a]).filter(Boolean);
      held.forEach((s) => keys.hold(s));
      downAt = performance.now();
      button.dataset.active = "";
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      const release = held;
      held = [];
      delete button.dataset.active;
      // The keys are counted per holder, so a new tap before this runs holds them on.
      setTimeout(() => release.forEach((s) => keys.release(s)), Math.max(0, MIN_BUTTON_MS - (performance.now() - downAt)));
    };
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("lostpointercapture", end);
  };
  holdButton($("strafe-left"), [SIDESTEP, TURN_LEFT]);
  holdButton($("strafe-right"), [SIDESTEP, TURN_RIGHT]);
  holdButton($("touch-look-up"), [LOOK_UP]);
  holdButton($("touch-look-down"), [LOOK_DOWN]);

  // ----- Use (the item in hand), Open (doors, switches), Jump -----

  holdButton($("touch-use"), [ATTACK]);
  holdButton($("touch-open"), [ACTIVATE]);
  holdButton($("touch-jump"), [JUMP]);
  const escapeButton = $("touch-escape");
  escapeButton.addEventListener("pointerdown", (e) => e.preventDefault());
  escapeButton.addEventListener("click", () => keys.tap(0x01));

  // ----- On-screen keyboard -----
  //
  // A hidden text field brings up the device keyboard. What is typed into it is
  // replayed as key presses; its own key events are kept from the game, or keys
  // with a real keyCode (iOS, hardware keyboards) would arrive twice.

  const keyboardButton = $("touch-keyboard");
  // Keep the focus where it is, so a tap can tell whether the keyboard was open.
  keyboardButton.addEventListener("pointerdown", (e) => e.preventDefault());
  keyboardButton.addEventListener("click", () => {
    if (document.activeElement === input) input.blur();
    else input.focus();
  });
  const showKeyboard = () => keyboardButton.setAttribute("aria-pressed", String(document.activeElement === input));
  input.addEventListener("focus", showKeyboard);
  input.addEventListener("blur", showKeyboard);

  // The field always holds one character, so Backspace has something to delete (and is seen).
  const SENTINEL = " ";
  const reset = () => {
    input.value = SENTINEL;
    input.setSelectionRange(1, 1);
  };
  reset();
  input.addEventListener("focus", reset);

  const NAMED: Record<string, number> = { Enter: 0x1c, Backspace: 0x0e, Escape: 0x01, Tab: 0x0f };
  const stop = (e: Event) => e.stopPropagation();
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    const scan = NAMED[e.key];
    if (scan === undefined) return; // text arrives through the input event
    e.preventDefault();
    keys.tap(scan);
    if (e.key === "Enter" || e.key === "Escape") input.blur();
  });
  input.addEventListener("keyup", stop);
  input.addEventListener("keypress", stop);

  const flush = () => {
    const v = input.value;
    if (v.length < SENTINEL.length) keys.tap(0x0e);
    else keys.type(v.slice(SENTINEL.length));
    reset();
  };
  input.addEventListener("input", (e) => {
    if (!(e as InputEvent).isComposing) flush();
  });
  input.addEventListener("compositionend", flush);

  // ----- Look: the next tap on the game is a right-click -----
  //
  // A right-click makes the game describe what is under the cursor (items in the
  // inventory, things in the view). The eye opens with a tap; the next touch on
  // the game is then sent as the right mouse button, and the eye closes again.
  // Registered before the filter below, so it sees the touch first.

  const eye = $("touch-eye");
  const canvas = frame.querySelector("canvas") as HTMLCanvasElement;
  let eyeOpen = false;
  const setEye = (open: boolean) => {
    eyeOpen = open;
    eye.setAttribute("aria-pressed", String(open));
    setIcon(eye.firstElementChild as Element, open ? "eye" : "eye-off");
  };
  eye.addEventListener("pointerdown", (e) => e.preventDefault());
  eye.addEventListener("click", () => setEye(!eyeOpen));

  let rightTouch: number | null = null; // the finger doing the right-click
  let rightAt = 0;
  const rightMouse = (type: string, t: Touch, buttons: number) =>
    canvas.dispatchEvent(
      new MouseEvent(type, { clientX: t.clientX, clientY: t.clientY, button: 2, buttons, bubbles: true, cancelable: true }),
    );
  const rightFinger = (e: TouchEvent) => [...e.changedTouches].find((t) => t.identifier === rightTouch);

  frame.addEventListener(
    "touchstart",
    (e) => {
      if (!eyeOpen || rightTouch !== null || e.target !== canvas) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const t = e.changedTouches[0];
      rightTouch = t.identifier;
      rightAt = performance.now();
      setEye(false);
      rightMouse("mousemove", t, 0);
      rightMouse("mousedown", t, 2);
    },
    { capture: true, passive: false },
  );
  frame.addEventListener(
    "touchmove",
    (e) => {
      const t = rightFinger(e);
      if (!t) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      rightMouse("mousemove", t, 2);
    },
    { capture: true, passive: false },
  );
  for (const type of ["touchend", "touchcancel"] as const) {
    frame.addEventListener(
      type,
      (e) => {
        const t = rightFinger(e);
        if (!t) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        rightTouch = null;
        // Held long enough for the game to see it, as with the buttons.
        setTimeout(() => rightMouse("mouseup", t, 0), Math.max(0, MIN_BUTTON_MS - (performance.now() - rightAt)));
      },
      { capture: true, passive: false },
    );
  }

  // ----- Keep the pad's finger away from the game -----
  //
  // SDL turns the first finger of a touch event into the mouse, and a touch event
  // on the canvas lists every finger on the screen, the one on the pad too. So a
  // tap on the game while walking could click where the pad is. Hand SDL (which
  // listens on the canvas) a copy that only has the fingers on the canvas.

  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
    frame.addEventListener(
      type,
      (e) => {
        const t = e as TouchEvent;
        if (t.touches.length === t.targetTouches.length || typeof TouchEvent === "undefined") return;
        e.stopPropagation();
        e.preventDefault();
        const only = [...t.targetTouches];
        t.target?.dispatchEvent(
          new TouchEvent(type, {
            touches: only,
            targetTouches: only,
            changedTouches: [...t.changedTouches],
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      { capture: true, passive: false },
    );
  }
}
