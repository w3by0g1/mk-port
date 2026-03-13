import { useEffect, useRef } from "react";
import p5 from "p5";

const SymmetricalPattern = ({ fastSpeed = 0.09 }) => {
  const canvasRef = useRef(null);
  const p5Instance = useRef(null);

  useEffect(() => {
    const sketch = (p) => {
      let cols, rows;
      let resolution = 10;
      let noiseOffsetX, noiseOffsetY;
      let noiseSpeed = 0.001;
      let baseSpeed = 0.005;
      let targetSpeed = 0.005;
      let isSpedUp = false;
      let speedUpEndTime = 0;
      let nextSpeedUpTime = 0;
      let lerpAmount = 0.05;
      const onColor = [183, 183, 183, 255];
      const offColor = [0, 0, 0, 0];
      // Fixed blob size in grid cells — noise is sampled relative to this
      const BLOB_SIZE = 48;
      const NOISE_SCALE = 0.15;

      p.setup = () => {
        p.pixelDensity(1);
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.frameRate(15);

        cols = p.floor(p.width / resolution);
        rows = p.floor(p.height / resolution);

        noiseOffsetX = p.random(1000);
        noiseOffsetY = p.random(1000);

        nextSpeedUpTime = p.millis() + p.random(2000, 8000);
      };

      p.draw = () => {
        let currentTime = p.millis();

        if (!isSpedUp && currentTime >= nextSpeedUpTime) {
          isSpedUp = true;
          targetSpeed = fastSpeed;
          speedUpEndTime = currentTime + 500;
        }

        if (isSpedUp && currentTime >= speedUpEndTime) {
          isSpedUp = false;
          targetSpeed = baseSpeed;
          nextSpeedUpTime = currentTime + p.random(2000, 8000);
        }

        noiseSpeed = p.lerp(noiseSpeed, targetSpeed, lerpAmount);

        noiseOffsetX += noiseSpeed;
        noiseOffsetY += noiseSpeed / 2;

        p.loadPixels();
        const d = p.pixels;
        const w = p.width;
        const h = p.height;

        // Clear to transparent
        d.fill(0);

        // 4 inkblot centers — evenly spaced in a 2x2 grid
        const centers = [
          { cx: cols * 0.25, cy: rows * 0.25 },
          { cx: cols * 0.75, cy: rows * 0.25 },
          { cx: cols * 0.25, cy: rows * 0.75 },
          { cx: cols * 0.75, cy: rows * 0.75 },
        ];

        for (const { cx, cy } of centers) {
          const startI = Math.max(0, Math.floor(cx - BLOB_SIZE));
          const endI = Math.min(cols, Math.ceil(cx + BLOB_SIZE));
          const startJ = Math.max(0, Math.floor(cy - BLOB_SIZE));
          const endJ = Math.min(rows, Math.ceil(cy + BLOB_SIZE));

          for (let i = startI; i < endI; i++) {
            // Distance from center, normalized to blob size
            const localX = Math.abs(i - cx) / BLOB_SIZE;
            // Mirror: sample noise from left half only
            const ni = Math.abs(i - cx);
            const noiseI = ni * NOISE_SCALE + noiseOffsetX;

            for (let j = startJ; j < endJ; j++) {
              const localY = Math.abs(j - cy) / BLOB_SIZE;
              const dist = Math.sqrt(localX * localX + localY * localY);
              if (dist > 1) continue;

              // Radial gradient falloff
              const gradient = 1 - dist;
              // Stretch vertically — taller blobs
              const stretchedY = localY * 0.6;
              const stretchedDist = Math.sqrt(localX * localX + stretchedY * stretchedY);
              const stretchedGradient = Math.max(0, 1 - stretchedDist);

              const noiseJ = Math.abs(j - cy) * NOISE_SCALE + noiseOffsetY;
              const n = p.noise(noiseI, noiseJ);

              const combined = stretchedGradient * (n + 0.5);
              if (combined > 0.7) {
                fillBlock(d, w, h, i, j, resolution, onColor);
              }
            }
          }
        }

        p.updatePixels();
      };

      function fillBlock(pixels, canvasW, canvasH, gridX, gridY, res, color) {
        const startX = gridX * res;
        const startY = gridY * res;
        const endX = Math.min(startX + res, canvasW);
        const endY = Math.min(startY + res, canvasH);
        const r = color[0], g = color[1], b = color[2], a = color[3];
        for (let y = startY; y < endY; y++) {
          let idx = (y * canvasW + startX) * 4;
          for (let x = startX; x < endX; x++) {
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = a;
            idx += 4;
          }
        }
      }

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        cols = p.floor(p.width / resolution);
        rows = p.floor(p.height / resolution);
      };
    };

    p5Instance.current = new p5(sketch, canvasRef.current);

    return () => {
      if (p5Instance.current) {
        p5Instance.current.remove();
      }
    };
  }, [fastSpeed]);

  return (
    <div
      ref={canvasRef}
      className="symmetrical-pattern"
    />
  );
};

export default SymmetricalPattern;
