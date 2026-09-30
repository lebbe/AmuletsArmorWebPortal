// While the game runs, closing or leaving the page asks first. The default keys
// make this easy by accident: attack (Ctrl) + forward (W) is Ctrl+W, and
// sidestep (Alt) + F4 is Alt+F4. Browsers will not let a page swallow those
// keys, but they do honour a beforeunload prompt.

let armed = false;

window.addEventListener("beforeunload", (e) => {
  if (armed) e.preventDefault();
});

/** From now on, leaving the page asks for confirmation. */
export function guardLeaving() {
  armed = true;
}

/** Reloads the page on purpose, without the prompt. */
export function reloadPage() {
  armed = false;
  location.reload();
}
