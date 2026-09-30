import { useRef, useEffect } from "react";
import p5 from "p5";

const FRICTION = 0.95;
const SCROLL_SENSITIVITY = 0.0005;
const RADIUS_LERP = 0.08;
const INITIAL_VELOCITY = 0.667;
const FADE_IN_SPEED = 0.01;
const SNAP_THRESHOLD = 0.01;
const SNAP_LERP = 0.1;
const SPIN_UP_FRAMES = 36;
const EXPLODE_SPIN_VELOCITY = 0.32;
const SPIN_ACCEL = 0.075;

// Rigid-body sim for the cards once they leave the ring. Units are px and seconds.
const PHYS_GRAVITY = 2600;
const PHYS_SUBSTEPS = 4;
const PHYS_ITERATIONS = 8;
const PHYS_RESTITUTION = 0.15;
const PHYS_FRICTION = 0.62;
const PHYS_BAUMGARTE = 0.3;
const PHYS_SLOP = 0.5;
const PHYS_LINEAR_DAMPING = 0.999;
const PHYS_ANGULAR_DAMPING = 0.995;
const SLEEP_LINEAR = 12;
const SLEEP_ANGULAR = 0.12;
const SLEEP_FRAMES = 30;
const LAUNCH_TANGENTIAL_SCALE = 0.24;
const LAUNCH_SPIN_SCALE = 0.35;
const LAUNCH_UPWARD_KICK = 200;

// Extra cards that rain in from above once the ring has burst apart.
const EXTRA_CARD_COUNT = 4;
const EXTRA_SPAWN_DELAY = 34;
const EXTRA_SPAWN_INTERVAL = 16;
const EXTRA_FADE_SPEED = 0.028;

// Once cards drop into the sim they morph from the ring's portrait rectangle into a
// square, shrinking to MORPH_SHRINK of their size as they go.
const MORPH_SHRINK = 0.75;
const MORPH_SPEED = 0.028;

// The four world-space corners of an oriented box.
function boxCorners(b) {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const axx = c * b.hw;
  const axy = s * b.hw;
  const ayx = -s * b.hh;
  const ayy = c * b.hh;
  return [
    { x: b.x + axx + ayx, y: b.y + axy + ayy },
    { x: b.x - axx + ayx, y: b.y - axy + ayy },
    { x: b.x - axx - ayx, y: b.y - axy - ayy },
    { x: b.x + axx - ayx, y: b.y + axy - ayy },
  ];
}

function pointInBox(px, py, b) {
  const dx = px - b.x;
  const dy = py - b.y;
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  return (
    Math.abs(dx * c + dy * s) <= b.hw + 0.01 &&
    Math.abs(-dx * s + dy * c) <= b.hh + 0.01
  );
}

// Impulse at a world point produces both linear and angular response — this is what
// makes a card landing on one corner tip over onto its face instead of balancing.
function applyImpulse(b, px, py, ix, iy) {
  b.vx += ix * b.invMass;
  b.vy += iy * b.invMass;
  b.av += b.invInertia * ((px - b.x) * iy - (py - b.y) * ix);
}

function solveStaticContact(b, px, py, nx, ny) {
  const rx = px - b.x;
  const ry = py - b.y;
  const vn = (b.vx - b.av * ry) * nx + (b.vy + b.av * rx) * ny;
  if (vn > 0) return;
  const rn = rx * ny - ry * nx;
  const kn = b.invMass + b.invInertia * rn * rn;
  if (kn <= 0) return;
  const jn = Math.max(0, (-(1 + PHYS_RESTITUTION) * vn) / kn);
  applyImpulse(b, px, py, jn * nx, jn * ny);

  const tx = -ny;
  const ty = nx;
  const vt = (b.vx - b.av * ry) * tx + (b.vy + b.av * rx) * ty;
  const rt = rx * ty - ry * tx;
  const kt = b.invMass + b.invInertia * rt * rt;
  if (kt <= 0) return;
  const max = PHYS_FRICTION * jn;
  const jt = Math.max(-max, Math.min(max, -vt / kt));
  applyImpulse(b, px, py, jt * tx, jt * ty);
}

function solvePairContact(a, b, px, py, nx, ny) {
  const rax = px - a.x;
  const ray = py - a.y;
  const rbx = px - b.x;
  const rby = py - b.y;
  const rvx = b.vx - b.av * rby - (a.vx - a.av * ray);
  const rvy = b.vy + b.av * rbx - (a.vy + a.av * rax);
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return;
  const ran = rax * ny - ray * nx;
  const rbn = rbx * ny - rby * nx;
  const kn =
    a.invMass + b.invMass + a.invInertia * ran * ran + b.invInertia * rbn * rbn;
  if (kn <= 0) return;
  const jn = Math.max(0, (-(1 + PHYS_RESTITUTION) * vn) / kn);
  applyImpulse(b, px, py, jn * nx, jn * ny);
  applyImpulse(a, px, py, -jn * nx, -jn * ny);

  const tx = -ny;
  const ty = nx;
  const rvx2 = b.vx - b.av * rby - (a.vx - a.av * ray);
  const rvy2 = b.vy + b.av * rbx - (a.vy + a.av * rax);
  const vt = rvx2 * tx + rvy2 * ty;
  const rat = rax * ty - ray * tx;
  const rbt = rbx * ty - rby * tx;
  const kt =
    a.invMass + b.invMass + a.invInertia * rat * rat + b.invInertia * rbt * rbt;
  if (kt <= 0) return;
  const max = PHYS_FRICTION * jn;
  const jt = Math.max(-max, Math.min(max, -vt / kt));
  applyImpulse(b, px, py, jt * tx, jt * ty);
  applyImpulse(a, px, py, -jt * tx, -jt * ty);
}

// Separating-axis test between two oriented boxes; normal points from a toward b.
function collideBoxes(a, b) {
  const ca = Math.cos(a.angle);
  const sa = Math.sin(a.angle);
  const cb = Math.cos(b.angle);
  const sb = Math.sin(b.angle);
  const axes = [
    { x: ca, y: sa },
    { x: -sa, y: ca },
    { x: cb, y: sb },
    { x: -sb, y: cb },
  ];
  let bestDepth = Infinity;
  let bestAxis = null;
  for (const ax of axes) {
    const ra =
      Math.abs(ca * ax.x + sa * ax.y) * a.hw +
      Math.abs(-sa * ax.x + ca * ax.y) * a.hh;
    const rb =
      Math.abs(cb * ax.x + sb * ax.y) * b.hw +
      Math.abs(-sb * ax.x + cb * ax.y) * b.hh;
    const d = (b.x - a.x) * ax.x + (b.y - a.y) * ax.y;
    const overlap = ra + rb - Math.abs(d);
    if (overlap <= 0) return null;
    if (overlap < bestDepth) {
      const sign = d < 0 ? -1 : 1;
      bestDepth = overlap;
      bestAxis = { x: ax.x * sign, y: ax.y * sign };
    }
  }
  const points = [];
  for (const c of boxCorners(a)) if (pointInBox(c.x, c.y, b)) points.push(c);
  for (const c of boxCorners(b)) if (pointInBox(c.x, c.y, a)) points.push(c);
  if (!points.length) {
    points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return { nx: bestAxis.x, ny: bestAxis.y, depth: bestDepth, points };
}

export default function RingSketch({
  projects,
  onHover,
  onSelect,
  isSelected,
  explodeSignal,
}) {
  const containerRef = useRef(null);
  const p5Ref = useRef(null);
  const isSelectedRef = useRef(false);
  const explodeSignalRef = useRef(explodeSignal);

  useEffect(() => {
    isSelectedRef.current = isSelected;
  }, [isSelected]);

  useEffect(() => {
    explodeSignalRef.current = explodeSignal;
  }, [explodeSignal]);

  useEffect(() => {
    const sketch = (p) => {
      const items = projects.length;
      let offset = 0;
      let velocity = INITIAL_VELOCITY;
      let fadeIn = 0;
      const colorImages = {};
      const grayImages = {};
      let radius, targetRadius, baseRadius, expandedRadius, rectW, rectH;
      let selectedIndex = -1;
      let explosionPhase = "ring"; // "ring" | "spinup" | "falling"
      let spinupTimer = 0;
      let itemPhysics = [];
      let sleepCounter = 0;
      let worldAsleep = false;
      let extrasRemaining = 0;
      let extraSpawnTimer = 0;
      let morph = 0;
      let lastHandledExplodeSignal = explodeSignalRef.current;
      let prevHoverIndex = -1;
      let selectFade = 0;
      const itemScales = new Array(projects.length).fill(1);
      const itemSaturations = new Array(projects.length).fill(0);
      const itemOpacities = new Array(projects.length).fill(0.8);

      const makeGrayscale = (img) => {
        const g = p.createImage(img.width, img.height);
        g.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
        g.filter(p.GRAY);
        g.loadPixels();
        for (let i = 0; i < g.pixels.length; i += 4) {
          g.pixels[i] = Math.min(255, g.pixels[i]);
          g.pixels[i + 1] = Math.min(255, g.pixels[i + 1]);
          g.pixels[i + 2] = Math.min(255, g.pixels[i + 2]);
        }
        g.updatePixels();
        return g;
      };

      p.setup = async () => {
        p.pixelDensity(1);
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.frameRate(60);
        for (const proj of projects) {
          if (proj.image) {
            const img = await p.loadImage(proj.image);
            colorImages[proj.name] = img;
            grayImages[proj.name] = makeGrayscale(img);
          }
        }
        const size = Math.min(p.windowWidth, p.windowHeight);
        p.textAlign(p.CENTER, p.CENTER);
        p.textFont("system-ui");
        p.colorMode(p.HSL, 360, 100, 100);
        p.rectMode(p.CENTER);

        baseRadius = size * 0.35;
        expandedRadius = size * 0.6;
        radius = baseRadius;
        targetRadius = baseRadius;
        rectH = size * 0.3;
        rectW = rectH * 0.75;
      };

      // Card dimensions at the current point of the rectangle -> square morph. Both
      // edges converge on the long edge, scaled down, so the settled card is square.
      const morphedSize = () => {
        const scale = 1 + (MORPH_SHRINK - 1) * morph;
        return {
          w: (rectW + (rectH - rectW) * morph) * scale,
          h: rectH * scale,
        };
      };

      // A card as a rigid body. `alpha` lets later arrivals fade in as they drop.
      const makeBody = (opts) => {
        const { w, h } = morphedSize();
        return {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          angle: 0,
          av: 0,
          hw: w / 2,
          hh: h / 2,
          invMass: 1,
          invInertia: 12 / (w * w + h * h),
          alpha: 1,
          name: null,
          ...opts,
        };
      };

      const drawFitted = (image, boxW = rectW, boxH = rectH) => {
        p.push();
        p.drawingContext.save();
        p.drawingContext.beginPath();
        p.drawingContext.rect(-boxW / 2, -boxH / 2, boxW, boxH);
        p.drawingContext.clip();
        p.imageMode(p.CENTER);
        p.rotate(p.HALF_PI);
        const imgAspect = image.width / image.height;
        const boxAspect = boxH / boxW;
        let drawW, drawH;
        if (imgAspect > boxAspect) {
          drawH = boxW;
          drawW = boxW * imgAspect;
        } else {
          drawW = boxH;
          drawH = boxH / imgAspect;
        }
        p.image(image, 0, 0, drawW, drawH);
        p.drawingContext.restore();
        p.pop();
      };

      let hoverIndex = -1;
      p.draw = () => {
        // Detect a new click on the "receiving comms." button and kick off the explosion
        if (explodeSignalRef.current !== lastHandledExplodeSignal) {
          lastHandledExplodeSignal = explodeSignalRef.current;
          explosionPhase = "spinup";
          spinupTimer = SPIN_UP_FRAMES;
          morph = 0;
          selectedIndex = -1;
          targetRadius = baseRadius;
          if (onSelect) onSelect(null);
        }

        // Animate radius
        radius = p.lerp(radius, targetRadius, RADIUS_LERP);

        // Fade out when expanded
        const expandT = p.constrain(
          p.map(radius, baseRadius, expandedRadius, 0, 1),
          0,
          1,
        );
        const itemOpacity = p.lerp(1, 0.3, expandT);

        hoverIndex = -1;
        if (explosionPhase === "ring") {
          p.push();
          p.translate(p.width / 2, p.height / 2);
          for (let i = 0; i < items; i++) {
            const angle = (i / items) * p.TWO_PI - p.HALF_PI + offset;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const rotation = angle + p.HALF_PI;
            const mx = p.mouseX - p.width / 2;
            const my = p.mouseY - p.height / 2;
            const dx = mx - x;
            const dy = my - y;
            const cosR = Math.cos(-rotation);
            const sinR = Math.sin(-rotation);
            const localX = dx * cosR - dy * sinR;
            const localY = dx * sinR + dy * cosR;
            if (Math.abs(localX) < rectW / 2 && Math.abs(localY) < rectH / 2) {
              hoverIndex = i;
            }
          }
          p.pop();
        }

        p.clear();

        // Fade in on load
        if (fadeIn < 1) {
          fadeIn = Math.min(1, fadeIn + FADE_IN_SPEED);
        }

        // Lerp selectFade toward 1 when selected, 0 when not
        const selectTarget = selectedIndex >= 0 ? 1 : 0;
        selectFade = p.lerp(selectFade, selectTarget, 0.15);

        if (explosionPhase === "spinup") {
          // Accelerate up to full speed rather than snapping there, morphing the cards
          // into squares along the way, then launch them
          velocity += (EXPLODE_SPIN_VELOCITY - velocity) * SPIN_ACCEL;
          offset -= velocity;
          morph = Math.min(1, morph + MORPH_SPEED);
          spinupTimer--;
          if (spinupTimer <= 0) {
            // Release each card with the tangential velocity and spin it actually had
            // on the wheel, so the fling direction reads as a consequence of the spin.
            const spinPerSecond = velocity * 60;
            itemPhysics = [];
            for (let i = 0; i < items; i++) {
              const angle = (i / items) * p.TWO_PI - p.HALF_PI + offset;
              const tangential =
                radius *
                spinPerSecond *
                LAUNCH_TANGENTIAL_SCALE *
                (0.85 + Math.random() * 0.3);
              itemPhysics.push(
                makeBody({
                  x: Math.cos(angle) * radius,
                  y: Math.sin(angle) * radius,
                  vx: Math.sin(angle) * tangential,
                  vy: -Math.cos(angle) * tangential - LAUNCH_UPWARD_KICK,
                  angle: angle + p.HALF_PI,
                  av:
                    -spinPerSecond *
                    LAUNCH_SPIN_SCALE *
                    (0.6 + Math.random() * 0.8),
                  name: projects[i].name,
                }),
              );
            }
            extrasRemaining = EXTRA_CARD_COUNT;
            extraSpawnTimer = EXTRA_SPAWN_DELAY;
            sleepCounter = 0;
            worldAsleep = false;
            explosionPhase = "falling";
          }
        } else if (explosionPhase === "ring") {
          const step = p.TWO_PI / items;
          if (Math.abs(velocity) > SNAP_THRESHOLD) {
            velocity *= FRICTION;
            offset -= velocity;
          } else {
            velocity = 0;
            // Snap to nearest lock point
            const snapTarget = Math.round(offset / step) * step;
            offset = p.lerp(offset, snapTarget, SNAP_LERP);
          }
        }

        p.push();
        p.translate(p.width / 2, p.height / 2);

        if (explosionPhase === "falling") {
          const floorY = p.height / 2;
          const leftX = -p.width / 2;
          const rightX = p.width / 2;

          // Extra cards fade in at the middle of the screen and are flung outward,
          // joining the same simulation as everything else.
          if (extrasRemaining > 0) {
            extraSpawnTimer--;
            if (extraSpawnTimer <= 0) {
              extraSpawnTimer = EXTRA_SPAWN_INTERVAL;
              const index = EXTRA_CARD_COUNT - extrasRemaining;
              extrasRemaining--;
              const dir = Math.random() * p.TWO_PI;
              const speed = 180 + Math.random() * 260;
              itemPhysics.push(
                makeBody({
                  x: (Math.random() * 2 - 1) * rectW * 0.4,
                  y: (Math.random() * 2 - 1) * rectH * 0.25,
                  vx: Math.cos(dir) * speed,
                  vy: Math.sin(dir) * speed - 260,
                  angle: (Math.random() * 2 - 1) * 0.9,
                  av: (Math.random() * 2 - 1) * 5,
                  alpha: 0,
                  name: projects[index % items].name,
                }),
              );
              sleepCounter = 0;
              worldAsleep = false;
            }
          }

          const card = morphedSize();
          for (const b of itemPhysics) {
            if (b.alpha < 1) b.alpha = Math.min(1, b.alpha + EXTRA_FADE_SPEED);
            b.hw = card.w / 2;
            b.hh = card.h / 2;
            b.invInertia = 12 / (card.w * card.w + card.h * card.h);
          }

          if (!worldAsleep) {
            const h = 1 / 60 / PHYS_SUBSTEPS;
            for (let step = 0; step < PHYS_SUBSTEPS; step++) {
              for (const b of itemPhysics) {
                b.vy += PHYS_GRAVITY * h;
                b.vx *= PHYS_LINEAR_DAMPING;
                b.vy *= PHYS_LINEAR_DAMPING;
                b.av *= PHYS_ANGULAR_DAMPING;
                b.x += b.vx * h;
                b.y += b.vy * h;
                b.angle += b.av * h;
              }

              // Contacts against the screen edges, per penetrating corner, so a card
              // touching down on one corner gets a torque about that corner.
              const staticContacts = [];
              for (const b of itemPhysics) {
                b.pushDown = 0;
                b.pushLeft = 0;
                b.pushRight = 0;
                for (const c of boxCorners(b)) {
                  if (c.y > floorY) {
                    staticContacts.push({ b, px: c.x, py: c.y, nx: 0, ny: -1 });
                    b.pushDown = Math.max(b.pushDown, c.y - floorY);
                  }
                  if (c.x < leftX) {
                    staticContacts.push({ b, px: c.x, py: c.y, nx: 1, ny: 0 });
                    b.pushLeft = Math.max(b.pushLeft, leftX - c.x);
                  }
                  if (c.x > rightX) {
                    staticContacts.push({ b, px: c.x, py: c.y, nx: -1, ny: 0 });
                    b.pushRight = Math.max(b.pushRight, c.x - rightX);
                  }
                }
              }

              // Card-on-card contacts, so they collide in mid-air and stack properly
              const manifolds = [];
              for (let i = 0; i < itemPhysics.length; i++) {
                for (let j = i + 1; j < itemPhysics.length; j++) {
                  const m = collideBoxes(itemPhysics[i], itemPhysics[j]);
                  if (m) manifolds.push({ a: itemPhysics[i], b: itemPhysics[j], m });
                }
              }

              for (let it = 0; it < PHYS_ITERATIONS; it++) {
                for (const c of staticContacts) {
                  solveStaticContact(c.b, c.px, c.py, c.nx, c.ny);
                }
                for (const { a, b, m } of manifolds) {
                  for (const pt of m.points) {
                    solvePairContact(a, b, pt.x, pt.y, m.nx, m.ny);
                  }
                }
              }

              // Positional correction, applied once per body/pair so overlapping
              // corner contacts don't compound into an oversized push-out.
              for (const b of itemPhysics) {
                b.y -= Math.max(b.pushDown - PHYS_SLOP, 0) * PHYS_BAUMGARTE;
                b.x += Math.max(b.pushLeft - PHYS_SLOP, 0) * PHYS_BAUMGARTE;
                b.x -= Math.max(b.pushRight - PHYS_SLOP, 0) * PHYS_BAUMGARTE;
              }
              for (const { a, b, m } of manifolds) {
                const corr =
                  (Math.max(m.depth - PHYS_SLOP, 0) * PHYS_BAUMGARTE) /
                  (a.invMass + b.invMass);
                a.x -= m.nx * corr * a.invMass;
                a.y -= m.ny * corr * a.invMass;
                b.x += m.nx * corr * b.invMass;
                b.y += m.ny * corr * b.invMass;
              }
            }

            // Once the whole pile has been quiet for a while, freeze it so resting
            // cards don't jitter against each other forever.
            const quiet =
              extrasRemaining === 0 &&
              itemPhysics.every(
                (b) =>
                  Math.hypot(b.vx, b.vy) < SLEEP_LINEAR &&
                  Math.abs(b.av) < SLEEP_ANGULAR,
              );
            sleepCounter = quiet ? sleepCounter + 1 : 0;
            if (sleepCounter > SLEEP_FRAMES) {
              for (const b of itemPhysics) {
                b.vx = 0;
                b.vy = 0;
                b.av = 0;
              }
              worldAsleep = true;
            }
          }

          // Draw back-to-front: cards resting nearer the true floor are drawn first
          // (behind); cards piled higher on top of others are drawn last, in front.
          const drawOrder = itemPhysics
            .map((_, idx) => idx)
            .sort((a, b) => itemPhysics[b].y - itemPhysics[a].y);

          for (const i of drawOrder) {
            const item = itemPhysics[i];
            p.push();
            p.translate(item.x, item.y);
            p.rotate(item.angle);
            p.drawingContext.globalAlpha = fadeIn * item.alpha;
            p.fill("#c8c8c8");
            p.noStroke();
            p.rect(0, 0, item.hw * 2, item.hh * 2);
            if (grayImages[item.name]) {
              p.drawingContext.globalAlpha = fadeIn * item.alpha * 0.4;
              drawFitted(grayImages[item.name], item.hw * 2, item.hh * 2);
            }
            p.pop();
          }
        } else {
          // Cards square off during the spin-up, so the ring draws the morphing size
          const ringCard = morphedSize();
          for (let i = 0; i < items; i++) {
            const angle = (i / items) * p.TWO_PI - p.HALF_PI + offset;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const rotation = angle + p.HALF_PI;

            p.push();
            p.translate(x, y);
            p.rotate(rotation);
            p.drawingContext.globalAlpha = itemOpacity * fadeIn;

            const isMobile = "ontouchstart" in window;
            const targetScale = i === hoverIndex ? 1.05 : 1;
            itemScales[i] += (targetScale - itemScales[i]) * 0.15;
            p.scale(itemScales[i]);

            const targetGray = isMobile || i === hoverIndex ? 0 : 1;
            itemSaturations[i] += (targetGray - itemSaturations[i]) * 0.1;

            const targetOpac = isMobile || i === hoverIndex ? 1 : 0.4;
            itemOpacities[i] += (targetOpac - itemOpacities[i]) * 0.15;

            const name = projects[i].name;
            const grayAmount = itemSaturations[i];

            // Always draw grey rect as base
            p.fill("#c8c8c8");
            p.noStroke();
            p.rect(0, 0, ringCard.w, ringCard.h);

            // Draw image on top, fading out when selected
            const imgAlpha = 1 - selectFade;
            if (imgAlpha > 0.01) {
              // Draw grayscale version first
              if (grayAmount > 0.01 && grayImages[name]) {
                p.drawingContext.globalAlpha =
                  itemOpacity * fadeIn * imgAlpha * grayAmount * itemOpacities[i];
                drawFitted(grayImages[name], ringCard.w, ringCard.h);
              }
              // Draw color version on top
              if (grayAmount < 0.99 && colorImages[name]) {
                p.drawingContext.globalAlpha =
                  itemOpacity *
                  fadeIn *
                  imgAlpha *
                  (1 - grayAmount) *
                  itemOpacities[i];
                drawFitted(colorImages[name], ringCard.w, ringCard.h);
              }
            }

            p.pop();
          }

          // Draw center rectangle and connecting line when item is selected
          if (selectFade > 0.01) {
            if (selectedIndex >= 0) {
              const selAngle =
                (selectedIndex / items) * p.TWO_PI - p.HALF_PI + offset;
              const selX = Math.cos(selAngle) * radius;
              const selY = Math.sin(selAngle) * radius;

              // Draw connecting line to center of screen
              const projColor = projects[selectedIndex].color || "#f5fcc7";
              p.drawingContext.globalAlpha = selectFade * fadeIn;
              p.stroke(projColor);
              p.strokeWeight(1);
              p.line(0, 0, selX, selY);

              // Small square at ring item center
              const sqSize = 10;
              p.fill(projColor);
              p.noStroke();
              p.rectMode(p.CENTER);
              p.rect(selX, selY, sqSize, sqSize);
            }
          }
        }

        p.pop();

        if (hoverIndex !== prevHoverIndex) {
          if (onHover) {
            onHover(hoverIndex >= 0 ? projects[hoverIndex] : null);
          }
          if (!isSelectedRef.current) {
            p.cursor(hoverIndex >= 0 ? p.HAND : p.ARROW);
          }
          prevHoverIndex = hoverIndex;
        }
      };

      p.mouseClicked = () => {
        if (explosionPhase !== "ring") return;
        if (hoverIndex >= 0) {
          if (hoverIndex !== selectedIndex) {
            // select new item
            selectedIndex = hoverIndex;
            targetRadius = expandedRadius;
            if (onSelect) onSelect(projects[hoverIndex].displayName);
          } else {
            // toggle off if clicking same item
            selectedIndex = -1;
            targetRadius = baseRadius;
            if (onSelect) onSelect(null);
          }
        } else if (selectedIndex >= 0) {
          // click outside ring items deselects
          selectedIndex = -1;
          targetRadius = baseRadius;
          if (onSelect) onSelect(null);
        }
      };

      p.mouseWheel = (event) => {
        if (explosionPhase !== "ring") return false;
        velocity += event.delta * SCROLL_SENSITIVITY;
        return false; // prevent page scroll
      };

      // Touch swipe support — spin like a wheel based on angular movement
      let touchPrevAngle = null;
      let touchLastAngularVel = 0;

      const canvas = containerRef.current;

      const getTouchAngle = (touch) => {
        const cx = p.width / 2;
        const cy = p.height / 2;
        return Math.atan2(touch.clientY - cy, touch.clientX - cx);
      };

      const onTouchStart = (e) => {
        if (e.touches.length === 1) {
          touchPrevAngle = getTouchAngle(e.touches[0]);
          touchLastAngularVel = 0;
          velocity = 0;
        }
      };

      const onTouchMove = (e) => {
        if (e.touches.length === 1 && touchPrevAngle !== null) {
          e.preventDefault();
          const currentAngle = getTouchAngle(e.touches[0]);
          let delta = currentAngle - touchPrevAngle;
          // Normalize to [-PI, PI] to handle wrapping
          if (delta > Math.PI) delta -= Math.PI * 2;
          if (delta < -Math.PI) delta += Math.PI * 2;
          touchLastAngularVel = delta;
          offset += delta;
          touchPrevAngle = currentAngle;
        }
      };

      const onTouchEnd = () => {
        if (touchPrevAngle !== null) {
          velocity = -touchLastAngularVel;
        }
        touchPrevAngle = null;
        touchLastAngularVel = 0;
      };

      canvas.addEventListener("touchstart", onTouchStart, { passive: true });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });
      canvas.addEventListener("touchend", onTouchEnd);

      p._touchCleanup = () => {
        canvas.removeEventListener("touchstart", onTouchStart);
        canvas.removeEventListener("touchmove", onTouchMove);
        canvas.removeEventListener("touchend", onTouchEnd);
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        const size = Math.min(p.windowWidth, p.windowHeight);
        baseRadius = size * 0.35;
        expandedRadius = size * 0.6;
        targetRadius = selectedIndex >= 0 ? expandedRadius : baseRadius;
        rectH = size * 0.3;
        rectW = rectH * 0.75;
      };
    };

    p5Ref.current = new p5(sketch, containerRef.current);

    return () => {
      if (p5Ref.current._touchCleanup) p5Ref.current._touchCleanup();
      p5Ref.current.remove();
    };
  }, [projects]);

  return <div ref={containerRef} />;
}
