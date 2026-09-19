// Pixel icons from Pixelarticons (MIT, https://github.com/halfmage/pixelarticons),
// inlined as SVG so they follow the text colour.

import camera from "pixelarticons/svg/camera.svg?raw";
import close from "pixelarticons/svg/close.svg?raw";
import collapse from "pixelarticons/svg/collapse.svg?raw";
import expand from "pixelarticons/svg/expand.svg?raw";
import forward from "pixelarticons/svg/forward.svg?raw";
import map from "pixelarticons/svg/map.svg?raw";
import monitor from "pixelarticons/svg/monitor.svg?raw";
import music from "pixelarticons/svg/music.svg?raw";
import pause from "pixelarticons/svg/pause.svg?raw";
import play from "pixelarticons/svg/play.svg?raw";
import reload from "pixelarticons/svg/reload.svg?raw";
import save from "pixelarticons/svg/save.svg?raw";
import sliders from "pixelarticons/svg/sliders.svg?raw";
import stop from "pixelarticons/svg/stop-solid.svg?raw";
import video from "pixelarticons/svg/video.svg?raw";
import volume from "pixelarticons/svg/volume-2.svg?raw";
import volumeX from "pixelarticons/svg/volume-x.svg?raw";

const ICONS = {
  camera,
  close,
  collapse,
  expand,
  forward,
  map,
  monitor,
  music,
  pause,
  play,
  reload,
  save,
  sliders,
  stop,
  video,
  volume,
  "volume-x": volumeX,
} as const;

export type IconName = keyof typeof ICONS;

export function setIcon(el: Element, name: IconName): void {
  el.innerHTML = ICONS[name];
  const svg = el.querySelector("svg");
  svg?.setAttribute("aria-hidden", "true");
  svg?.setAttribute("shape-rendering", "crispEdges");
}

/** Fill every `[data-icon]` element in the page. */
export function fillIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-icon]").forEach((el) => setIcon(el, el.dataset.icon as IconName));
}
