// The about card's icon is a face: a third eye on its forehead, the pale
// circle at the top, and under it a pair of glasses, the pale band round
// the middle. The third eye's pupil, the dark dot, looks towards the
// pointer wherever it is on the page: the further away the pointer, the
// further over the pupil goes, though never far: it glances, rather than
// rolling to the rim. A finger leaves no pointer to follow, so where there
// is nothing to hover with, a phone, the pupil looks about by itself,
// glancing this way and that every second or two, now and then back to the
// middle. Where motion has been turned down, it looks straight out there.
//
// Every few seconds the third eye blinks, now and then twice over, as an
// eye does: its pupil squashed flat and opened again in a moment, wherever
// it is looking. The glasses blink too, in their own time, once at a go,
// and a little slower. Where motion has been turned down, nothing blinks.

// The pale circle's middle, in the drawing's own units, out of its 16.
const SIZE = 16;
const EYE = { x: 8, y: 4.58 };
// The furthest the pupil goes from the middle, in the drawing's units. It
// could go 2.1 before it touched the rim.
const TRAVEL = 1.3;
// How far the pointer is from the eye, in pixels, when the pupil has gone
// half of the way over.
const HALFWAY = 40;
// Looking about by itself: how long it holds each glance, at the least and
// the most, in milliseconds, and how often a glance is straight ahead.
const GLANCE_SOONEST = 700;
const GLANCE_LATEST = 3000;
const AHEAD = 0.25;
// How the third eye and the glasses blink: how long a blink takes, in
// milliseconds; how long between blinks, at the least and the most; and
// how often one blink is followed straight away by another.
const THIRD_EYE = { blink: 160, soonest: 2500, latest: 6000, twice: 0.2 };
const GLASSES = { blink: 240, soonest: 3000, latest: 7000, twice: 0 };

// Has `pupil` follow the pointer, and gives back a function to stop.
export function lookAt(pupil) {
  const drawing = pupil?.ownerSVGElement;
  if (!drawing) return () => {};
  // Only one at a time has the pupil: any before this one is stopped, as
  // one can be left going when the dev server swaps this file mid-edit.
  pupil.stopLooking?.();
  let at = null;
  let frame = 0;

  // Measured each time, as the card can be floating about the page.
  const look = () => {
    frame = 0;
    const box = drawing.getBoundingClientRect();
    const scale = box.width / SIZE;
    const dx = at.x - (box.left + EYE.x * scale);
    const dy = at.y - (box.top + EYE.y * scale);
    const far = Math.hypot(dx, dy);
    const over = far ? (TRAVEL * far) / (far + HALFWAY) : 0;
    const x = far ? (dx / far) * over : 0;
    const y = far ? (dy / far) * over : 0;
    // In a drawing, a pixel of a transform is one of its own units. It is
    // moved by `translate`, so the blink can squash it by `scale` at once.
    pupil.style.translate = `${x.toFixed(3)}px ${y.toFixed(3)}px`;
  };

  const moved = (e) => {
    if (e.pointerType === "touch") return;
    at = { x: e.clientX, y: e.clientY };
    if (!frame) frame = requestAnimationFrame(look);
  };
  // With nothing to hover with, it looks about by itself instead.
  let stopGlancing;
  if (window.matchMedia("(hover: none)").matches) {
    stopGlancing = glancing(pupil);
  } else {
    document.addEventListener("pointermove", moved, { passive: true });
    stopGlancing = () => document.removeEventListener("pointermove", moved);
  }
  const stops = [
    blinking([pupil], THIRD_EYE),
    blinking(drawing.querySelectorAll(".dir-glasses"), GLASSES),
  ];
  const stopBlinking = () => stops.forEach((stop) => stop());
  const stop = () => {
    stopGlancing();
    cancelAnimationFrame(frame);
    stopBlinking();
    pupil.style.translate = "";
    if (pupil.stopLooking === stop) delete pupil.stopLooking;
  };
  pupil.stopLooking = stop;
  return stop;
}

// Has `pupil` look about by itself, a glance at a time, and gives back a
// function to stop.
function glancing(pupil) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }
  let wait = 0;
  const glance = () => {
    const ahead = Math.random() < AHEAD;
    const way = Math.random() * 2 * Math.PI;
    // Anywhere it can look, not bunched in the middle.
    const over = ahead ? 0 : TRAVEL * Math.sqrt(Math.random());
    const x = Math.cos(way) * over;
    const y = Math.sin(way) * over;
    pupil.style.translate = `${x.toFixed(3)}px ${y.toFixed(3)}px`;
    wait = setTimeout(
      glance,
      GLANCE_SOONEST + Math.random() * (GLANCE_LATEST - GLANCE_SOONEST),
    );
  };
  wait = setTimeout(glance, GLANCE_SOONEST);
  return () => clearTimeout(wait);
}

// Blinks `eyes` every so often, all at once, `how` says, and gives back a
// function to stop.
function blinking(eyes, how) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }
  let stopped = false;
  let wait = 0;
  const later = (ms, then) => {
    wait = setTimeout(() => !stopped && then(), ms);
  };
  const shut = () => {
    for (const eye of eyes) {
      eye.animate([{ scale: "1 1" }, { scale: "1 0.1" }, { scale: "1 1" }], {
        duration: how.blink,
        easing: "ease-in-out",
      });
    }
  };
  const next = () =>
    later(how.soonest + Math.random() * (how.latest - how.soonest), () => {
      shut();
      if (Math.random() < how.twice) {
        later(how.blink + 90, () => {
          shut();
          next();
        });
      } else next();
    });
  next();
  return () => {
    stopped = true;
    clearTimeout(wait);
  };
}
