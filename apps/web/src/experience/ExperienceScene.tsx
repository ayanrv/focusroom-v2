import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type ProgressRef = {
  current: number;
};

type ExperienceSceneProps = {
  progress?: ProgressRef;
  mode?: "landing" | "auth";
};

function useMediaFlag(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function Rain({ count, paused }: { count: number; paused: boolean }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const a = Math.sin(i * 91.73) * 43758.5453;
      const b = Math.sin(i * 47.21) * 12515.873;
      const c = Math.sin(i * 13.57) * 9917.13;

      values[i * 3] = ((a - Math.floor(a)) - 0.5) * 12;
      values[i * 3 + 1] = (b - Math.floor(b)) * 7 - 2.4;
      values[i * 3 + 2] = -3.2 - (c - Math.floor(c)) * 8;
    }

    return values;
  }, [count]);

  useFrame((_, delta) => {
    if (paused || !ref.current) return;

    const attribute = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;

    for (let i = 1; i < array.length; i += 3) {
      array[i] -= delta * 4.6;

      if (array[i] < -2.5) {
        array[i] = 4.6;
      }
    }

    attribute.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#7de8ff"
        size={0.022}
        transparent
        opacity={0.65}
        depthWrite={false}
      />
    </points>
  );
}

function NeonPanel({
  position,
  color,
  scale,
  flicker = false,
}: {
  position: [number, number, number];
  color: string;
  scale: [number, number, number];
  flicker?: boolean;
}) {
  const material = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (!flicker || !material.current) return;

    const pulse =
      2.3 +
      Math.sin(state.clock.elapsedTime * 7.8) * 0.18 +
      Math.sin(state.clock.elapsedTime * 2.1) * 0.11;

    material.current.emissiveIntensity = pulse;
  });

  return (
    <mesh position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        ref={material}
        color="#080b0e"
        emissive={color}
        emissiveIntensity={2.4}
        toneMapped={false}
      />
    </mesh>
  );
}

function CityBlock({
  position,
  scale,
  accent,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  accent: string;
}) {
  const rows = [0.2, 0.55, 0.9, 1.25, 1.6];

  return (
    <group position={position}>
      <mesh scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#070a0e" roughness={0.82} />
      </mesh>

      {rows.map((y, rowIndex) => (
        <group key={y} position={[0, y - scale[1] * 0.44, scale[2] * 0.51]}>
          {[-0.28, 0, 0.28].map((x, index) => (
            <mesh key={x} position={[x * scale[0], 0, 0]}>
              <planeGeometry args={[0.12 * scale[0], 0.07 * scale[1]]} />
              <meshStandardMaterial
                color="#080a0c"
                emissive={rowIndex % 3 === index ? accent : "#15303d"}
                emissiveIntensity={rowIndex % 3 === index ? 1.7 : 0.55}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Monitor() {
  return (
    <group position={[0.35, -0.02, -0.35]}>
      <mesh position={[0, 0.54, 0]}>
        <boxGeometry args={[1.7, 1.08, 0.11]} />
        <meshStandardMaterial color="#101417" metalness={0.15} roughness={0.42} />
      </mesh>

      <mesh position={[0, 0.54, 0.061]}>
        <planeGeometry args={[1.5, 0.86]} />
        <meshStandardMaterial
          color="#071013"
          emissive="#00eaff"
          emissiveIntensity={0.32}
          toneMapped={false}
        />
      </mesh>

      {[0.82, 0.67, 0.52, 0.37].map((y, index) => (
        <mesh key={y} position={[-0.34 + index * 0.05, y, 0.073]}>
          <planeGeometry args={[0.58 + index * 0.12, 0.018]} />
          <meshBasicMaterial
            color={index === 0 ? "#b7ff3c" : index === 3 ? "#ff2bd6" : "#5de7ff"}
            transparent
            opacity={0.72}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.09, 0.3, 0.09]} />
        <meshStandardMaterial color="#252a2d" metalness={0.3} roughness={0.38} />
      </mesh>

      <mesh position={[0, -0.29, 0]}>
        <boxGeometry args={[0.62, 0.055, 0.35]} />
        <meshStandardMaterial color="#252a2d" metalness={0.25} roughness={0.4} />
      </mesh>

      <pointLight
        position={[0.2, 0.5, 0.65]}
        color="#00dfff"
        intensity={2.4}
        distance={2.8}
      />
    </group>
  );
}

function DeskControls() {
  return (
    <group position={[-0.75, -0.52, 0.1]}>
      <mesh>
        <boxGeometry args={[1.3, 0.09, 0.58]} />
        <meshStandardMaterial color="#121619" metalness={0.22} roughness={0.44} />
      </mesh>

      {[-0.42, -0.14, 0.14, 0.42].map((x, index) => (
        <group key={x} position={[x, 0.075, 0]}>
          <mesh>
            <cylinderGeometry args={[0.055, 0.055, 0.04, 16]} />
            <meshStandardMaterial color="#2d3438" metalness={0.45} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.024, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.007, 12]} />
            <meshBasicMaterial
              color={["#00eaff", "#ff2bd6", "#b7ff3c", "#ff7a1a"][index]}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CyberRoom({
  progress,
  mode,
  reducedMotion,
  compact,
}: {
  progress: ProgressRef;
  mode: "landing" | "auth";
  reducedMotion: boolean;
  compact: boolean;
}) {
  const lookAt = useRef(new THREE.Vector3(0, 0.1, -0.7));

  const cameraCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.45, 0.35, 7.4),
        new THREE.Vector3(-0.25, 0.18, 6.1),
        new THREE.Vector3(1.25, 0.32, 5.4),
        new THREE.Vector3(-1.15, 0.45, 5.7),
        new THREE.Vector3(0.1, 0.78, 6.45),
        new THREE.Vector3(0.25, 0.4, 7.15),
      ]),
    [],
  );

  const targetCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.1, -0.6),
        new THREE.Vector3(0.15, -0.25, -0.25),
        new THREE.Vector3(1.4, 0.35, -2.8),
        new THREE.Vector3(-1.4, 0.45, -2.9),
        new THREE.Vector3(0, 0.08, -0.4),
        new THREE.Vector3(0, -0.05, -0.8),
      ]),
    [],
  );

  useFrame((state, delta) => {
    const p =
      mode === "auth"
        ? 0.34
        : reducedMotion
          ? 0.08
          : THREE.MathUtils.clamp(progress.current, 0, 1);

    const desired = cameraCurve.getPointAt(p);
    const target = targetCurve.getPointAt(p);

    const pointerScale = compact ? 0.035 : 0.11;
    desired.x += state.pointer.x * pointerScale;
    desired.y += state.pointer.y * pointerScale * 0.65;

    const ease = 1 - Math.pow(0.001, delta);
    state.camera.position.lerp(desired, ease * 0.42);
    lookAt.current.lerp(target, ease * 0.36);
    state.camera.lookAt(lookAt.current);
  });

  return (
    <>
      <color attach="background" args={["#030508"]} />
      <fog attach="fog" args={["#05070b", 7.8, 17]} />

      <ambientLight color="#33536d" intensity={0.42} />

      <spotLight
        position={[-2.7, 3.6, 3.8]}
        target-position={[-0.8, -0.6, -0.3]}
        color="#ff8a3d"
        intensity={3.3}
        angle={0.48}
        penumbra={0.8}
        distance={8}
      />

      <pointLight position={[2.8, 0.4, -1.2]} color="#ff2bd6" intensity={3.2} distance={5.5} />
      <pointLight position={[-3.2, 0.5, -1]} color="#00dfff" intensity={3.6} distance={5.5} />
      <pointLight position={[0, -1.05, 0.2]} color="#653cff" intensity={1.8} distance={3.5} />

      <group>
        <mesh position={[0, -1.45, 0]}>
          <boxGeometry args={[8.4, 0.16, 7.2]} />
          <meshStandardMaterial color="#0b0f12" metalness={0.12} roughness={0.88} />
        </mesh>

        <mesh position={[-4.1, 0.45, -0.2]}>
          <boxGeometry args={[0.16, 4.2, 6.4]} />
          <meshStandardMaterial color="#0b0f12" roughness={0.94} />
        </mesh>

        <mesh position={[4.1, 0.45, -0.2]}>
          <boxGeometry args={[0.16, 4.2, 6.4]} />
          <meshStandardMaterial color="#0a0d10" roughness={0.94} />
        </mesh>

        <mesh position={[-3.15, 0.45, -2.9]}>
          <boxGeometry args={[1.9, 4.2, 0.14]} />
          <meshStandardMaterial color="#0b0e11" roughness={0.92} />
        </mesh>

        <mesh position={[3.15, 0.45, -2.9]}>
          <boxGeometry args={[1.9, 4.2, 0.14]} />
          <meshStandardMaterial color="#0b0e11" roughness={0.92} />
        </mesh>

        <mesh position={[0, 2.06, -2.9]}>
          <boxGeometry args={[4.4, 0.98, 0.14]} />
          <meshStandardMaterial color="#0b0e11" roughness={0.92} />
        </mesh>

        <mesh position={[0, -1.05, -2.9]}>
          <boxGeometry args={[4.4, 0.78, 0.14]} />
          <meshStandardMaterial color="#0b0e11" roughness={0.92} />
        </mesh>

        <group position={[0, 0.4, -2.82]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.07, 3.05, 0.09]} />
            <meshStandardMaterial color="#32373a" metalness={0.32} roughness={0.38} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[4.35, 3.05]} />
            <meshPhysicalMaterial
              color="#0b151d"
              transparent
              opacity={0.18}
              roughness={0.18}
              metalness={0.05}
              transmission={0.35}
            />
          </mesh>
        </group>

        <group position={[0, -0.72, -0.05]}>
          <mesh>
            <boxGeometry args={[4.1, 0.16, 1.55]} />
            <meshStandardMaterial color="#161b1d" metalness={0.18} roughness={0.58} />
          </mesh>

          <mesh position={[-1.7, -0.67, 0.58]}>
            <boxGeometry args={[0.11, 1.4, 0.11]} />
            <meshStandardMaterial color="#23292c" metalness={0.45} />
          </mesh>

          <mesh position={[1.7, -0.67, 0.58]}>
            <boxGeometry args={[0.11, 1.4, 0.11]} />
            <meshStandardMaterial color="#23292c" metalness={0.45} />
          </mesh>

          <Monitor />
          <DeskControls />

          <mesh position={[1.42, 0.12, 0.2]}>
            <cylinderGeometry args={[0.15, 0.13, 0.34, 20]} />
            <meshStandardMaterial color="#182024" metalness={0.22} roughness={0.5} />
          </mesh>

          <mesh position={[1.42, 0.31, 0.2]}>
            <torusGeometry args={[0.12, 0.025, 10, 20, Math.PI * 1.35]} />
            <meshStandardMaterial color="#333b3f" metalness={0.4} roughness={0.4} />
          </mesh>
        </group>

        <group position={[-1.68, -0.25, -0.45]}>
          <mesh position={[0, 0.48, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.88, 14]} />
            <meshStandardMaterial color="#8f9695" metalness={0.45} roughness={0.34} />
          </mesh>
          <mesh position={[0.22, 0.86, 0]} rotation={[0, 0, -0.63]}>
            <cylinderGeometry args={[0.045, 0.045, 0.65, 14]} />
            <meshStandardMaterial color="#8f9695" metalness={0.45} roughness={0.34} />
          </mesh>
          <mesh position={[0.43, 1.08, 0.02]} rotation={[0, 0, -0.63]}>
            <coneGeometry args={[0.24, 0.38, 24]} />
            <meshStandardMaterial color="#b4afa5" metalness={0.2} roughness={0.46} />
          </mesh>
          <pointLight position={[0.43, 0.96, 0.22]} color="#ff944d" intensity={4.4} distance={3.6} />
        </group>

        <mesh position={[0, -1.34, 0.1]}>
          <boxGeometry args={[3.6, 0.015, 0.055]} />
          <meshBasicMaterial color="#7b48ff" transparent opacity={0.7} toneMapped={false} />
        </mesh>
      </group>

      <group>
        <CityBlock position={[-4.8, -0.2, -7.4]} scale={[2.4, 5.1, 1.8]} accent="#00eaff" />
        <CityBlock position={[-2.25, 0.65, -8.2]} scale={[1.55, 6.6, 1.4]} accent="#ff2bd6" />
        <CityBlock position={[2.15, 0.2, -8.4]} scale={[1.85, 5.7, 1.55]} accent="#ff7a1a" />
        <CityBlock position={[4.45, -0.45, -7.1]} scale={[2.6, 4.7, 1.8]} accent="#7b48ff" />

        <NeonPanel position={[-1.65, 1.0, -5.4]} color="#ff2bd6" scale={[0.95, 2.5, 0.06]} flicker />
        <NeonPanel position={[1.8, 0.15, -5.1]} color="#00eaff" scale={[1.35, 0.28, 0.06]} />
        <NeonPanel position={[2.35, 1.45, -6.2]} color="#b7ff3c" scale={[0.45, 1.2, 0.05]} />

        <pointLight position={[-1.7, 1.2, -4.4]} color="#ff2bd6" intensity={4} distance={5.5} />
        <pointLight position={[1.9, 0.2, -4.35]} color="#00eaff" intensity={4.2} distance={5.5} />
      </group>

      <Rain count={compact ? 230 : 520} paused={reducedMotion} />
    </>
  );
}

export function ExperienceScene({
  progress = { current: 0 },
  mode = "landing",
}: ExperienceSceneProps) {
  const reducedMotion = useMediaFlag("(prefers-reduced-motion: reduce)");
  const compact = useMediaFlag("(max-width: 760px)");

  return (
    <div className={`experience-canvas experience-canvas--${mode}`} aria-hidden="true">
      <Canvas
        dpr={compact ? 1 : [1, 1.45]}
        camera={{ position: [0.45, 0.35, 7.4], fov: compact ? 48 : 40 }}
        gl={{
          antialias: !compact,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <CyberRoom
          progress={progress}
          mode={mode}
          reducedMotion={reducedMotion}
          compact={compact}
        />
      </Canvas>
    </div>
  );
}
