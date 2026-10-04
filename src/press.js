// The tiles that ring in a minor key when pressed (see glass.js) darken as
// they are pressed, a shade past their darkening under the pointer, and
// ease back to whatever they should be by then: still darkened, if the
// pointer is on them, or their own grey, if it has gone.

import { MINOR_TILES } from "./glass.js";

const PRESSED = "#a6a6a6";
const BACK_MS = 600;

// Darkens such tiles in `root` as they are pressed, and gives back a
// function to stop.
export function pressDarkens(root) {
  const down = (e) => {
    const tile = e.target.closest?.(MINOR_TILES);
    if (!tile || !root.contains(tile)) return;
    // From the pressed shade back to the tile's own, whatever it is.
    tile.animate([{ "--tile": PRESSED, offset: 0 }], {
      duration: BACK_MS,
      easing: "ease-out",
    });
  };
  root.addEventListener("pointerdown", down);
  return () => root.removeEventListener("pointerdown", down);
}
