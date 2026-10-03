// A striped tile's stripes step to the right as the pointer comes onto the
// tile, and again each time it is pressed: STEP stripes along, easing to a
// stop. A step taken while one is still going carries on from wherever the
// stripes have got to, however many are taken.
//
// The stripes are a layer behind the words, wider than the tile to the
// left by REACH stripes, and slid along. On the slant, the stripes look the
// same every one stripe across, so before each step, and once it is done,
// the layer is put back by whole stripes, unseen; so it never goes further
// than a step and a stripe, and never runs out. Where motion has been turned
// down, they stay still.

// How many stripes a step goes, and how many stripes wider than the tile
// the layer is, to the left: room for a step from as far as a stripe along.
// REACH is also in the stylesheet, on `.dir-stripes`.
const STEP = 4;
const REACH = STEP + 1;
const STEP_MS = 600;

// Steps the stripes on any striped tile in `root`, and gives back a
// function to stop.
export function stripeSteps(root) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }
  const steps = new WeakMap();

  const step = (tile) => {
    const layer = tile.querySelector(".dir-stripes");
    if (!layer) return;
    const stripe = -parseFloat(getComputedStyle(layer).left) / REACH;
    if (!(stripe > 0)) return;
    // From wherever it has got to, put back by whole stripes.
    const from = new DOMMatrix(getComputedStyle(layer).transform).m41 % stripe;
    const to = from + STEP * stripe;
    steps.get(layer)?.cancel();
    const going = layer.animate(
      [
        { transform: `translateX(${from}px)` },
        { transform: `translateX(${to}px)` },
      ],
      {
        duration: STEP_MS,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "forwards",
      },
    );
    steps.set(layer, going);
    going.finished.then(
      () => {
        // Put back by whole stripes, which looks no different.
        layer.style.transform = `translateX(${to % stripe}px)`;
        going.cancel();
        if (steps.get(layer) === going) steps.delete(layer);
      },
      () => {},
    );
  };

  const striped = (target) => target?.closest?.(".dir-striped");
  const over = (e) => {
    const tile = striped(e.target);
    if (tile && root.contains(tile) && striped(e.relatedTarget) !== tile) {
      step(tile);
    }
  };
  const down = (e) => {
    const tile = striped(e.target);
    if (tile && root.contains(tile)) step(tile);
  };
  root.addEventListener("pointerover", over);
  root.addEventListener("pointerdown", down);
  return () => {
    root.removeEventListener("pointerover", over);
    root.removeEventListener("pointerdown", down);
  };
}
