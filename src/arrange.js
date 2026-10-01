// Shuffles the directory's tiles into a new arrangement: each keeps its
// size, and they are fitted together in a random order, the grid's own gap
// apart, across the width of the grid, until they are called back.
//
// As with floating, the tiles stay where they are in the page and are only
// moved by a transform, which the stylesheet eases them along, out to their
// new places and home again.

import { settle, unsettle } from "./float.js";

// How many random orders are tried for one that fits the window before the
// shortest of them is taken instead.
const TRIES = 200;

// Fits tiles together in the order given. Each goes as high as it can, and
// as far left as it can at that height, with the gap kept to the tiles
// beside and above it. The skyline is the top of what has been placed so
// far, as runs across the width, each at the height the next tile there
// could start from.
function pack(sizes, width, gap, order) {
  let sky = [{ x: 0, w: width, y: 0 }];
  const at = [];
  for (const i of order) {
    const { w, h } = sizes[i];
    // A tile can go flush with the left or the right of any run.
    const xs = new Set([width - w]);
    for (const run of sky) {
      xs.add(run.x);
      xs.add(run.x + run.w - w);
    }
    let best = null;
    for (const x of xs) {
      if (x < -0.5 || x + w > width + 0.5) continue;
      let y = 0;
      for (const run of sky) {
        if (run.x < x + w && run.x + run.w > x) y = Math.max(y, run.y);
      }
      if (!best || y < best.y - 0.5 || (y < best.y + 0.5 && x < best.x)) {
        best = { x, y };
      }
    }
    at[i] = best;
    // The skyline rises over the tile, and the gap either side of it,
    // wherever it is not already higher.
    const from = Math.max(0, best.x - gap);
    const to = Math.min(width, best.x + w + gap);
    const top = best.y + h + gap;
    const next = [];
    for (const run of sky) {
      const end = run.x + run.w;
      if (end <= from || run.x >= to) {
        next.push(run);
        continue;
      }
      const a = Math.max(run.x, from);
      const b = Math.min(end, to);
      if (run.x < a) next.push({ x: run.x, w: a - run.x, y: run.y });
      next.push({ x: a, w: b - a, y: Math.max(run.y, top) });
      if (end > b) next.push({ x: b, w: end - b, y: run.y });
    }
    next.sort((a, b) => a.x - b.x);
    sky = [];
    for (const run of next) {
      const last = sky[sky.length - 1];
      if (last && Math.abs(last.y - run.y) < 0.5) {
        last.w += run.w;
        last.y = Math.max(last.y, run.y);
      } else sky.push({ ...run });
    }
  }
  const height = Math.max(...sizes.map(({ h }, i) => at[i].y + h));
  return { at, height };
}

const shuffled = (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Shuffles the tiles, and gives back a function to call them home.
export function arrange(root) {
  unsettle(root);
  root.classList.add("dir-arranged");

  // Only the tiles that are shown; a phone leaves some out.
  const els = [...root.querySelectorAll(".dir-tile")].filter(
    (el) => el.offsetWidth > 0,
  );
  // The order is picked once, the first of the tries to fit in the window,
  // so the arrangement keeps to itself if the window changes size; it is
  // only fitted again.
  let order = null;

  const lay = () => {
    const grid = root.querySelector(".dir-grid");
    const style = getComputedStyle(grid);
    const gap = parseFloat(style.rowGap) || 0;
    const left = grid.offsetLeft + parseFloat(style.paddingLeft);
    const top = grid.offsetTop + parseFloat(style.paddingTop);
    const width =
      grid.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    const room =
      grid.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom);
    // Measured without any transform, from the tiles' places in the grid.
    const sizes = els.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
    const all = els.map((_, i) => i);

    let laid;
    if (order) {
      laid = pack(sizes, width, gap, order);
    } else {
      for (let n = 0; n < TRIES; n++) {
        const tried = shuffled(all);
        const fit = pack(sizes, width, gap, tried);
        if (!laid || fit.height < laid.height) {
          laid = fit;
          order = tried;
        }
        if (fit.height <= room) break;
      }
    }

    // Set in the middle of the room, top to bottom, as the grid is.
    const down = Math.max(0, (room - laid.height) / 2);
    els.forEach((el, i) => {
      const dx = left + laid.at[i].x - el.offsetLeft;
      const dy = top + down + laid.at[i].y - el.offsetTop;
      el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
    });
  };
  lay();
  const watcher = new ResizeObserver(lay);
  watcher.observe(root);

  return () => {
    watcher.disconnect();
    root.classList.remove("dir-arranged");
    settle(root, els);
  };
}
