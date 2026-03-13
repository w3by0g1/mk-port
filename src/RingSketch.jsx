import { useRef, useEffect } from "react";
import p5 from "p5";

const FRICTION = 0.95;
const SCROLL_SENSITIVITY = 0.0005;
const RADIUS_LERP = 0.08;
const INITIAL_VELOCITY = 0.6;
const FADE_IN_SPEED = 0.01;
const SNAP_THRESHOLD = 0.01;
const SNAP_LERP = 0.1;

export default function RingSketch({
  projects,
  onHover,
  onSelect,
  isSelected,
}) {
  const containerRef = useRef(null);
  const p5Ref = useRef(null);
  const isSelectedRef = useRef(false);

  useEffect(() => {
    isSelectedRef.current = isSelected;
  }, [isSelected]);

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

      const drawFitted = (image) => {
        p.push();
        p.drawingContext.save();
        p.drawingContext.beginPath();
        p.drawingContext.rect(-rectW / 2, -rectH / 2, rectW, rectH);
        p.drawingContext.clip();
        p.imageMode(p.CENTER);
        p.rotate(p.HALF_PI);
        const imgAspect = image.width / image.height;
        const boxAspect = rectH / rectW;
        let drawW, drawH;
        if (imgAspect > boxAspect) {
          drawH = rectW;
          drawW = rectW * imgAspect;
        } else {
          drawW = rectH;
          drawH = rectH / imgAspect;
        }
        p.image(image, 0, 0, drawW, drawH);
        p.drawingContext.restore();
        p.pop();
      };

      let hoverIndex = -1;
      p.draw = () => {
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

        p.clear();

        // Fade in on load
        if (fadeIn < 1) {
          fadeIn = Math.min(1, fadeIn + FADE_IN_SPEED);
        }

        // Lerp selectFade toward 1 when selected, 0 when not
        const selectTarget = selectedIndex >= 0 ? 1 : 0;
        selectFade = p.lerp(selectFade, selectTarget, 0.15);

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

        p.push();
        p.translate(p.width / 2, p.height / 2);

        for (let i = 0; i < items; i++) {
          const angle = (i / items) * p.TWO_PI - p.HALF_PI + offset;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const rotation = angle + p.HALF_PI;

          p.push();
          p.translate(x, y);
          p.rotate(rotation);
          p.drawingContext.globalAlpha = itemOpacity * fadeIn;

          const targetScale = i === hoverIndex ? 1.05 : 1;
          itemScales[i] += (targetScale - itemScales[i]) * 0.15;
          p.scale(itemScales[i]);

          const targetGray = i === hoverIndex ? 0 : 1;
          itemSaturations[i] += (targetGray - itemSaturations[i]) * 0.1;

          const targetOpac = i === hoverIndex ? 1 : 0.4;
          itemOpacities[i] += (targetOpac - itemOpacities[i]) * 0.15;

          const name = projects[i].name;
          const grayAmount = itemSaturations[i];

          // Always draw grey rect as base
          p.fill(200);
          p.noStroke();
          p.rect(0, 0, rectW, rectH);

          // Draw image on top, fading out when selected
          const imgAlpha = 1 - selectFade;
          if (imgAlpha > 0.01) {
            // Draw grayscale version first
            if (grayAmount > 0.01 && grayImages[name]) {
              p.drawingContext.globalAlpha =
                itemOpacity * fadeIn * imgAlpha * grayAmount * itemOpacities[i];
              drawFitted(grayImages[name]);
            }
            // Draw color version on top
            if (grayAmount < 0.99 && colorImages[name]) {
              p.drawingContext.globalAlpha =
                itemOpacity *
                fadeIn *
                imgAlpha *
                (1 - grayAmount) *
                itemOpacities[i];
              drawFitted(colorImages[name]);
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
        velocity += event.delta * SCROLL_SENSITIVITY;
        return false; // prevent page scroll
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
      p5Ref.current.remove();
    };
  }, [projects]);

  return <div ref={containerRef} />;
}
