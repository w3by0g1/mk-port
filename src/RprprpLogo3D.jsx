import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function createLogoShape() {
  const s = 210;
  const rects = [
    [0, 0, 25.2, 210],
    [184.8, 0, 25.2, 210],
    [0, 0, 210, 25.2],
    [0, 184.8, 210, 25.2],
    [92.4, 50.4, 25.2, 109.2],
    [50.4, 92.4, 109.2, 25.2],
  ];

  const shapes = rects.map(([x, y, w, h]) => {
    const shape = new THREE.Shape();
    const cx = s / 2;
    const cy = s / 2;
    shape.moveTo(x - cx, -(y - cy));
    shape.lineTo(x + w - cx, -(y - cy));
    shape.lineTo(x + w - cx, -(y + h - cy));
    shape.lineTo(x - cx, -(y + h - cy));
    shape.closePath();
    return shape;
  });

  return shapes;
}

const LOGO_SHAPES = createLogoShape();
const SCALE = 1 / 105;
const FLOAT_SPEED = 1.5;
const FLOAT_AMPLITUDE = 0.04;
const MOUSE_LERP = 0.05;
const MAX_TILT = 0.4;

function LogoMesh() {
  const groupRef = useRef();
  const targetRotation = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Floating bob
    groupRef.current.position.y = Math.sin(t * FLOAT_SPEED) * FLOAT_AMPLITUDE;

    // Gentle idle wobble
    const idleX = Math.sin(t * 0.7) * 0.05;
    const idleY = Math.cos(t * 0.5) * 0.05;

    // Mouse tracking
    const px = state.pointer.x;
    const py = state.pointer.y;

    targetRotation.current.x = -py * MAX_TILT + idleX;
    targetRotation.current.y = px * MAX_TILT + idleY;

    // Lerp toward target
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotation.current.x,
      MOUSE_LERP,
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotation.current.y,
      MOUSE_LERP,
    );
  });

  return (
    <group ref={groupRef} scale={[SCALE, SCALE, SCALE]}>
      {LOGO_SHAPES.map((shape, i) => (
        <mesh key={i}>
          <extrudeGeometry
            args={[
              shape,
              {
                depth: 20,
                bevelEnabled: true,
                bevelSize: 2,
                bevelThickness: 2,
                bevelSegments: 3,
              },
            ]}
          />
          <meshStandardMaterial color="#FF005A" />
        </mesh>
      ))}
    </group>
  );
}

export default function RprprpLogo3D({ style }) {
  return (
    <div
      style={{
        ...style,
        transition: "opacity 0.3s ease",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 45 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 5]} intensity={1} />
        <directionalLight position={[-2, -1, -3]} intensity={1} />
        <LogoMesh />
      </Canvas>
    </div>
  );
}
