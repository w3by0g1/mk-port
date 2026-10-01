// Sets the directory's tiles loose: each one becomes a body in a Matter.js
// world, until they are called back. Floating, nothing pulls on them, and
// they drift about the page, knocking into each other and off its edges.
// Under gravity, they fall, tumble and pile up at the foot of the page.
//
// The tiles stay where they are in the page, words, links and all, and are
// only moved by a transform from their place in the grid to where their
// body has got to. So nothing about the page changes shape while they are
// out, and bringing them back is only a matter of easing the transforms
// away, which the stylesheet does.
//
// Matter.js is fetched the first time the tiles are let go, not before, so
// the page carries none of its weight until then.
//
// Every knock of a tile into another, or into an edge, is heard, as hard
// as it was (see glass.js).

import { knock } from "./glass.js";

// How fast a tile drifts once it has been let go, in pixels a step (a step
// being a sixtieth of a second). A tile that has been slowed, by a knock or
// by the air, is brought back up towards this, so they keep drifting
// however long they are left. The air and the knocks keep taking a little
// off, so they settle somewhat under it, at about 50 pixels a second, which
// is lazy enough to read as floating.
const CRUISE = 1;
// How much of the way back to that speed a tile gets each step. It has to
// be well ahead of the air's pull the other way, or the two meet at barely
// half the speed.
const CRUISE_PULL = 0.1;
// A tile thrown with the mouse is let go at no more than this, so it cannot
// go through a wall or another tile in the time of one step.
const MAX_SPEED = 24;
// How bouncy a knock is, how much the air slows a tile, and how much a tile
// turns when it is let go.
const BOUNCE = 0.8;
const AIR = 0.01;
const SPIN = 0.006;
// Under gravity a tile lands rather than bounces, and grips what it lands
// on, so the pile settles. Each is let go with the slightest turn, so they
// tip off one another as things do, rather than dropping straight down in
// their columns.
const FALLING = {
  restitution: 0.15,
  friction: 0.4,
  frictionStatic: 0.6,
  frictionAir: 0.005,
};
const TIP = 0.002;
// A thin tile under a heavy one is pressed into whatever is beneath it
// faster than a step can push them apart, and the two end up overlapping.
// So under gravity each step is taken in a few smaller ones, and a tile's
// weight goes with the square root of its size rather than its size, so
// the big tiles are still the heavier but no longer crush the lines.
const SUBSTEPS = 4;
// The walls round the page are thick, so nothing gets through them however
// hard it is thrown.
const WALL = 400;
// The world is stepped at a fixed rate, which is what keeps it steady, as
// many times a frame as the frame took, up to a limit.
const STEP = 1000 / 60;
const MAX_STEPS = 3;
// How long the tiles take to ease home once they are called back; the same
// as the transition on `.dir-settling .dir-tile` in the stylesheet.
const SETTLE_MS = 1400;

// The wait for the last homecoming to finish, so letting the tiles go again
// in the middle of one does not have it end this one early.
let settling = 0;

// A homecoming of some other kind still under way, and how to end it.
let homecoming = null;
export function homeBy(end) {
  homecoming = end;
}

// Before the tiles go anywhere, any homecoming still under way is ended.
export function unsettle(root) {
  clearTimeout(settling);
  root.classList.remove("dir-settling");
  homecoming?.();
  homecoming = null;
}

// Calls the tiles home: their transforms are taken off under a transition,
// so every tile eases back to its place.
export function settle(root, els) {
  root.classList.add("dir-settling");
  for (const el of els) el.style.transform = "";
  settling = setTimeout(() => root.classList.remove("dir-settling"), SETTLE_MS);
}

// Lets the tiles go, to float or to fall, and gives back a function to call
// them home.
export function float(root, { gravity = false } = {}) {
  let stopped = false;
  let stop = () => {};
  import("matter-js").then(({ default: Matter }) => {
    if (!stopped) stop = run(Matter, root, gravity);
  });
  return () => {
    stopped = true;
    stop();
  };
}

// A knock is only heard from a tile going at least this fast into whatever
// it meets, in pixels a step, so tiles resting against each other in a
// pile are quiet; and at its hardest from this fast.
const KNOCK_SOFTEST = 0.4;
const KNOCK_HARDEST = 8;

function run(Matter, root, gravity) {
  const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events } =
    Matter;

  unsettle(root);
  root.classList.add("dir-floating");

  // Under gravity the tiles come to rest in a pile, and are let sleep there
  // so it holds still rather than shivering; a few more passes over each
  // step keep the pile from sinking into itself.
  const engine = Engine.create({
    enableSleeping: gravity,
    positionIterations: gravity ? 10 : 6,
  });
  engine.gravity.x = 0;
  engine.gravity.y = gravity ? 1 : 0;

  // A body for every tile. Its home is its place in the grid, measured in
  // the page's own coordinates so it holds however far the page is
  // scrolled; the offsets are taken without any transform, so a tile still
  // easing home from last time is measured from where it belongs. Its body
  // starts where the tile is actually drawn, so nothing jumps.
  const tiles = [...root.querySelectorAll(".dir-tile")].map((el) => {
    const home = {
      x: el.offsetLeft + el.offsetWidth / 2,
      y: el.offsetTop + el.offsetHeight / 2,
    };
    const drawn = el.getBoundingClientRect();
    const body = Bodies.rectangle(
      drawn.left + drawn.width / 2 + root.scrollLeft,
      drawn.top + drawn.height / 2 + root.scrollTop,
      el.offsetWidth,
      el.offsetHeight,
      gravity
        ? FALLING
        : {
            restitution: BOUNCE,
            friction: 0.02,
            frictionStatic: 0,
            frictionAir: AIR,
          },
    );
    if (gravity) {
      Body.setMass(body, Math.sqrt(body.mass));
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 2 * TIP);
      return { el, home, body };
    }
    // Each goes its own way, at around the speed it will keep.
    const heading = Math.random() * Math.PI * 2;
    const speed = CRUISE * (0.6 + Math.random() * 0.8);
    Body.setVelocity(body, {
      x: Math.cos(heading) * speed,
      y: Math.sin(heading) * speed,
    });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 2 * SPIN);
    return { el, home, body };
  });

  // Walls just outside the page all round: the window, or the whole length
  // of the page where it is long enough to scroll.
  let walls = [];
  const build = () => {
    Composite.remove(engine.world, walls);
    const w = root.clientWidth;
    const h = Math.max(root.scrollHeight, root.clientHeight);
    walls = [
      Bodies.rectangle(w / 2, -WALL / 2, w + 2 * WALL, WALL, {
        isStatic: true,
      }),
      Bodies.rectangle(w / 2, h + WALL / 2, w + 2 * WALL, WALL, {
        isStatic: true,
      }),
      Bodies.rectangle(-WALL / 2, h / 2, WALL, h + 2 * WALL, {
        isStatic: true,
      }),
      Bodies.rectangle(w + WALL / 2, h / 2, WALL, h + 2 * WALL, {
        isStatic: true,
      }),
    ];
    Composite.add(engine.world, walls);
  };
  build();
  const watcher = new ResizeObserver(build);
  watcher.observe(root);

  // A tile can be picked up with the mouse and thrown. Matter listens for
  // touches and the wheel as well, and stops the page doing anything with
  // them, which would keep a phone from scrolling the page or following a
  // link, so those are left to the page.
  const mouse = Mouse.create(root);
  root.removeEventListener("wheel", mouse.mousewheel);
  root.removeEventListener("touchmove", mouse.mousemove);
  root.removeEventListener("touchstart", mouse.mousedown);
  root.removeEventListener("touchend", mouse.mouseup);
  // Matter measures the pointer against the window, so a page scrolled
  // within itself is allowed for here.
  const scrolled = () =>
    Mouse.setOffset(mouse, { x: root.scrollLeft, y: root.scrollTop });
  scrolled();
  root.addEventListener("scroll", scrolled, { passive: true });
  const hand = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, damping: 0.1, render: { visible: false } },
  });

  Composite.add(engine.world, [...tiles.map(({ body }) => body), hand]);

  // Before each step: a tile that has slowed is brought gently back up to
  // its drifting speed, in whatever direction it is going, and one going
  // faster than anything should is held to the limit. Under gravity only
  // the limit holds.
  const drift = () => {
    for (const { body } of tiles) {
      if (hand.body === body) continue;
      if (gravity) {
        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        if (speed > MAX_SPEED) {
          Body.setVelocity(body, {
            x: (body.velocity.x / speed) * MAX_SPEED,
            y: (body.velocity.y / speed) * MAX_SPEED,
          });
        }
        continue;
      }
      const { x, y } = body.velocity;
      const speed = Math.hypot(x, y);
      let heading;
      if (speed > 0.01) {
        heading = { x: x / speed, y: y / speed };
      } else {
        const a = Math.random() * Math.PI * 2;
        heading = { x: Math.cos(a), y: Math.sin(a) };
      }
      let next = speed;
      if (speed < CRUISE) next += (CRUISE - speed) * CRUISE_PULL;
      if (speed > MAX_SPEED) next = MAX_SPEED;
      if (next !== speed) {
        Body.setVelocity(body, { x: heading.x * next, y: heading.y * next });
      }
    }
  };
  Events.on(engine, "beforeUpdate", drift);

  // The tiles knocking into each other, and into the edges, are heard: one
  // knock a step, as hard as the hardest of them, by how fast the two were
  // closing on each other.
  const knocked = ({ pairs }) => {
    let hardest = 0;
    for (const { bodyA, bodyB, collision } of pairs) {
      const a = Body.getVelocity(bodyA);
      const b = Body.getVelocity(bodyB);
      const { x, y } = collision.normal;
      const closing = Math.abs((a.x - b.x) * x + (a.y - b.y) * y);
      hardest = Math.max(hardest, closing);
    }
    if (hardest < KNOCK_SOFTEST) return;
    knock(
      Math.min(1, (hardest - KNOCK_SOFTEST) / (KNOCK_HARDEST - KNOCK_SOFTEST)),
    );
  };
  Events.on(engine, "collisionStart", knocked);

  // Each frame, the world is stepped on and every tile is moved from its
  // place in the grid to where its body is.
  let frame = 0;
  let last = performance.now();
  let owed = 0;
  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    owed = Math.min(owed + (now - last), STEP * MAX_STEPS);
    last = now;
    const substeps = gravity ? SUBSTEPS : 1;
    while (owed >= STEP) {
      for (let i = 0; i < substeps; i++) {
        Engine.update(engine, STEP / substeps);
      }
      owed -= STEP;
    }
    for (const { el, home, body } of tiles) {
      const dx = body.position.x - home.x;
      const dy = body.position.y - home.y;
      el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${body.angle.toFixed(4)}rad)`;
    }
  };
  frame = requestAnimationFrame(tick);

  // Calling them home: the world is put away, and the transforms are taken
  // off under a transition, so every tile eases back to its place.
  return () => {
    cancelAnimationFrame(frame);
    watcher.disconnect();
    root.removeEventListener("scroll", scrolled);
    Mouse.clearSourceEvents(mouse);
    root.removeEventListener("mousemove", mouse.mousemove);
    root.removeEventListener("mousedown", mouse.mousedown);
    root.removeEventListener("mouseup", mouse.mouseup);
    Events.off(engine, "beforeUpdate", drift);
    Events.off(engine, "collisionStart", knocked);
    Composite.clear(engine.world, false);
    Engine.clear(engine);

    root.classList.remove("dir-floating");
    settle(
      root,
      tiles.map(({ el }) => el),
    );
  };
}
