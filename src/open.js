// Opening a project on the directory: the chosen tile moves to the top
// left of the page, while the other tiles fade away round it; its work is
// then shown beside it. On a phone, where the tile is the page's full
// width, it draws down to its first line, its name and its kind, as it
// goes, and its work is shown under it; on a wider screen it keeps its
// size and all that is on it. A tile that is not in the first column goes across to it first, and
// then up. Closing it, it comes back down as a bar to the foot of its
// place and grows back up into it from there, as the other tiles come
// back.
//
// The tile never leaves its place in the grid, so nothing about the page
// shifts while it goes: it is only drawn elsewhere, moved by a transform
// and cut short from the bottom by a clip, both of which leave the layout
// alone. Pressing it and the pointer passing over it follow where it is
// drawn.

// How long the fading, the move up or down, and the move across take. The
// move up or down eases quick away and slow to settle; the move across
// eases in and out, so it runs on into the move after it rather than
// coming to a stop first.
// Where the page is a single column, as the stylesheet has it, and an open
// tile draws down to a bar.
export const PHONE = "(max-width: 800px)";

const FADE = 300;
const MOVE = 550;
const ACROSS = 400;
// How long a tile takes to grow back into its place on the way home.
const GROW = 500;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const ACROSS_EASE = "ease-in-out";

// Where motion has been turned down, all of it happens at once.
const pace = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1;

// Where a tile is drawn, measured from its place in the grid: how far
// across and down it has been moved, and how much is cut from its foot.
const HOME = { x: 0, y: 0, cut: 0 };
const drawn = ({ x, y, cut }) => ({
  transform: `translate(${x}px, ${y}px)`,
  clipPath: `inset(0 0 ${cut}px 0)`,
});

// Draws a tile from one place to another, at the given pace: 1 as it
// should go, and 0 at once.
const move = async (
  tile,
  from,
  to,
  duration = MOVE,
  easing = EASE,
  speed = pace(),
) => {
  const motion = tile.animate([drawn(from), drawn(to)], {
    duration: duration * speed,
    easing,
    fill: "forwards",
  });
  await motion.finished;
  Object.assign(tile.style, drawn(to));
  motion.cancel();
};

// Takes a tile from its place to the top left, across first if it has
// any way across to go, and then up, cut short as it goes.
const goUp = async (tile, to, speed) => {
  if (Math.abs(to.x) >= 1) {
    const turn = { ...HOME, x: to.x };
    await move(tile, HOME, turn, ACROSS, ACROSS_EASE, speed);
    await move(tile, turn, to, MOVE, EASE, speed);
  } else {
    await move(tile, HOME, to, MOVE, EASE, speed);
  }
};

// Every tile on the page but the chosen one, and the parts of the chosen
// one that go when it draws down: everything below its first line.
const aside = (root, tile, drawsDown) => [
  ...[...root.querySelectorAll(".dir-tile:not(.dir-measuring)")].filter(
    (t) => t !== tile,
  ),
  ...(drawsDown ? tile.querySelectorAll(".dir-fades") : []),
];

// A tile near the foot of a page that scrolls cannot be brought up to the
// top of the window without more page below it than there is, so room is
// made for it there. The room is taken away again once it has been
// scrolled out of sight, when taking it away moves nothing that can be
// seen.
const roomToScroll = (root, by) => {
  const page = document.documentElement;
  if (page.scrollHeight <= window.innerHeight) return;
  const short = by - (page.scrollHeight - window.innerHeight - window.scrollY);
  if (short <= 0) return;
  root.style.paddingBottom = `${short}px`;
  const unseen = () => {
    if (window.scrollY + window.innerHeight > page.scrollHeight - short) return;
    root.style.paddingBottom = "";
    window.removeEventListener("scroll", unseen);
  };
  window.addEventListener("scroll", unseen, { passive: true });
};

// Once it is there, the bar is held to the window where it has come to
// rest, drawn as it is, so it stays at the top while a page that scrolls
// runs the work up under it. It is let go back into its place in the grid,
// where it is drawn in the same spot, before it goes home.
const pin = (tile, bar) => {
  Object.assign(tile.style, {
    // Over the description as well, as that scrolls up under it.
    zIndex: "6",
    position: "fixed",
    top: `${bar.top}px`,
    left: `${bar.left}px`,
    width: `${bar.width}px`,
    height: `${bar.height}px`,
    minHeight: "0",
    overflow: "hidden",
    transform: "",
    clipPath: "",
  });
};
const unpin = (tile, to) => {
  Object.assign(tile.style, {
    zIndex: "5",
    position: "",
    top: "",
    left: "",
    width: "",
    height: "",
    minHeight: "",
    overflow: "",
    ...drawn(to),
  });
};

// Opens a tile, and gives back what closing it will need. Where the tile
// will come to rest is known before it starts to move, and is handed to
// `planned` then, so what goes with it can be got ready while it goes.
//
// Opened `atOnce`, as when the page is arrived at by the project's own
// address, it is simply there, with nothing seen to move or fade.
export async function openTile(
  root,
  tile,
  planned = () => {},
  { atOnce = false, below = 0 } = {},
) {
  const speed = atOnce ? 0 : pace();
  // A long page on a phone scrolls, as the window rather than as the
  // directory; the tile goes to the top of it either way.
  root.scrollTo({ top: 0 });
  window.scrollTo({ top: 0 });

  // From its place, to the grid's own top left corner, cut down to its
  // padding and one line, as wide as it was.
  const place = tile.getBoundingClientRect();
  const grid = getComputedStyle(root.querySelector(".dir-grid"));
  const style = getComputedStyle(tile);
  const drawsDown = window.matchMedia(PHONE).matches;
  const firstLine = drawsDown
    ? parseFloat(style.lineHeight) +
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth)
    : place.height;
  // How far down the window it comes to rest: the grid's own top margin,
  // or, where the page asks for another, that. A phone's is further down,
  // clear of the point near the top of the window that Safari takes its
  // own bar's colour from.
  // On a wider screen, it and what is `below` it, the description, a gap
  // under it, are set in the middle of the window, top to bottom, though
  // no higher than that.
  const gap = parseFloat(grid.rowGap);
  const fromTop =
    parseFloat(getComputedStyle(root).getPropertyValue("--bar-top")) ||
    parseFloat(grid.paddingTop);
  const together = firstLine + (below ? gap + below : 0);
  const top = drawsDown
    ? fromTop
    : Math.max(fromTop, (window.innerHeight - together) / 2);
  const to = {
    x: parseFloat(grid.paddingLeft) - place.left,
    y: top - place.top,
    cut: place.height - firstLine,
  };

  // Where the tile will end up on the page, and the grid's gap, so what
  // goes with it can be set under it.
  const bar = {
    top,
    left: parseFloat(grid.paddingLeft),
    width: place.width,
    height: firstLine,
    gap,
  };
  planned(bar);

  // Drawn over the work that will come up under it, and away from its
  // place at once, as the others begin to fade.
  tile.style.zIndex = "5";
  const faded = aside(root, tile, drawsDown).map((el) =>
    el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: FADE * speed,
      easing: "ease",
      fill: "forwards",
    }),
  );
  await Promise.all([goUp(tile, to, speed), ...faded.map((a) => a.finished)]);

  pin(tile, bar);
  return { root, tile, faded, to, bar };
}

// Closes an open tile, and settles once everything is back. It comes down
// as it is, a bar, to the foot of its place. Then it grows back up into its
// place from there, its foot staying where it is and its first line rising
// to the top, with the rest of it coming up into sight under that; if it
// has any way across to go it goes across as it grows. The other tiles
// fade back in round it while it grows.
//
// A bar at the foot of its place is one moved down by as much as it is cut
// short; moving it back up and cutting it less by the same amount together
// is what keeps its foot still.
//
// On a page long enough to scroll, it is first scrolled so the tile's place
// is in the middle of the window, so the tile comes home in sight; the bar
// is held where it is drawn as the page goes under it. A tile too tall to
// fit in the window has its top at the top, where the bar is.
export async function closeTile({ root, tile, faded, to, bar }) {
  // On a phone, the work runs on down the page, and may have been scrolled
  // through. It has gone by the next frame, and the page is back to its own
  // length, and back at the top, where the bar is.
  await new Promise((done) => requestAnimationFrame(done));
  window.scrollTo({ top: 0 });
  unpin(tile, to);

  const middle = Math.max(
    bar.top,
    (window.innerHeight - tile.offsetHeight) / 2,
  );
  const by = bar.top - to.y - middle;
  roomToScroll(root, by);
  const scrolled = () => window.scrollY + root.scrollTop;
  const was = scrolled();
  window.scrollBy({ top: by });
  root.scrollBy({ top: by - (scrolled() - was) });
  const at = { ...to, y: to.y + (scrolled() - was) };
  Object.assign(tile.style, drawn(at));

  const foot = { x: to.x, y: to.cut, cut: to.cut };
  await move(tile, at, foot);
  // The others fade back at the pace they should, even where they went at
  // once, as when the page was arrived at by the project's address.
  for (const a of faded) {
    const duration = FADE * pace();
    a.effect.updateTiming({ duration });
    a.currentTime = duration;
    a.reverse();
  }
  await Promise.all([
    move(tile, foot, HOME, GROW),
    ...faded.map((a) => a.finished),
  ]);

  // Home, and nothing is left holding anything.
  for (const a of faded) a.cancel();
  tile.style.transform = "";
  tile.style.clipPath = "";
  tile.style.zIndex = "";
}
