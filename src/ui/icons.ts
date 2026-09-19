// Pixel icons from Pixelarticons (MIT, https://github.com/halfmage/pixelarticons),
// inlined as SVG so they follow the text colour.

import close from "pixelarticons/svg/close.svg?raw";
import collapse from "pixelarticons/svg/collapse.svg?raw";
import expand from "pixelarticons/svg/expand.svg?raw";
import reload from "pixelarticons/svg/reload.svg?raw";
import sliders from "pixelarticons/svg/sliders.svg?raw";
import volume from "pixelarticons/svg/volume-2.svg?raw";
import volumeX from "pixelarticons/svg/volume-x.svg?raw";

const ICONS = {
  close,
  collapse,
  expand,
  reload,
  sliders,
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
