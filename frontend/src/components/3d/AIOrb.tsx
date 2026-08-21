"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Line } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useDeviceQuality, useReducedMotion } from "@/lib/motion";

/**
 * AIOrb — the hero AI core.
 *
 * A transparent, faceted intelligence sphere surrounded by a live neural
 * lattice, orbital rings, and drifting data points. Designed to read as
 * "computer vision + deep learning research" — not as a game demo.
 */

const ACCENT = new THREE.Color("#7dd3ff");
const PLUM = new THREE.Color("#a894ff");
const ROSE = new THREE.Color("#ff9ec7");
const DEEP = new THREE.Color("#0b1230");

/* ── Inner nodes + connecting lattice ─────────────────────────────────── */

function InnerLattice({ nodeCount, mouse }: { nodeCount: number; mouse: React.MutableRefObject<{ x: number; y: number }>; }) {
  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef(0);

  const { positions, edges } = useMemo(() => {
    const rand = mulberry(31);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < nodeCount; i++) {
      // Fibonacci-ish distribution on a hollow sphere
      const phi = Math.acos(1 - 2 * (i + 0.5) / nodeCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 1.35 + (rand() - 0.5) * 0.15;
      pts.push(new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi) * r,
        Math.sin(theta) * Math.sin(phi) * r,
        Math.cos(phi) * r,
      ));
    }
    const pairs: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = pts[i].distanceTo(pts[j]);
        if (d < 0.95) pairs.push([pts[i], pts[j]]);
      }
    }
    return { positions: pts, edges: pairs };
  }, [nodeCount]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    g.rotation.y += dt * 0.18;
    g.rotation.x += dt * 0.05;
    // Subtle parallax toward pointer
    g.rotation.y += mouse.current.x * 0.0009;
    g.rotation.x += -mouse.current.y * 0.0006;
    pulseRef.current += dt;
  });

  return (
    <group ref={groupRef}>
      {edges.map(([a, b], i) => (
        <Line
          key={i}
          points={[a, b]}
          color={i % 3 === 0 ? "#a894ff" : "#7dd3ff"}
          lineWidth={0.9}
          transparent
          opacity={0.32}
        />
      ))}
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.045 + (i % 4) * 0.008, 12, 12]} />
          <meshStandardMaterial
            color={DEEP}
            emissive={i % 3 === 0 ? PLUM : ACCENT}
            emissiveIntensity={1.6}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Faceted transparent shell ────────────────────────────────────────── */

function Shell() {
  const ref = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y -= dt * 0.06;
      ref.current.rotation.x += dt * 0.02;
    }
    if (inner.current) inner.current.rotation.y += dt * 0.12;
  });
  return (
    <>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1.9, 1]} />
        <meshPhysicalMaterial
          color="#0d1638"
          transmission={0.85}
          thickness={0.6}
          roughness={0.15}
          metalness={0.05}
          transparent
          opacity={0.22}
          clearcoat={0.7}
          clearcoatRoughness={0.2}
          ior={1.3}
          wireframe={false}
        />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[1.9, 1]} />
        <meshBasicMaterial color="#7dd3ff" wireframe transparent opacity={0.14} />
      </mesh>
    </>
  );
}

/* ── Orbital rings ────────────────────────────────────────────────────── */

function OrbitalRing({ radius, tilt, speed, color, thickness = 0.012 }: {
  radius: number; tilt: [number, number, number]; speed: number; color: string; thickness?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * speed;
  });
  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, thickness, 12, 128]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.1}
        transparent
        opacity={0.85}
        roughness={0.25}
        metalness={0.4}
      />
    </mesh>
  );
}

function OrbitingSatellite({ radius, speed, phase, size, color }: {
  radius: number; speed: number; phase: number; size: number; color: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + phase;
    if (ref.current) {
      ref.current.position.x = Math.cos(t) * radius;
      ref.current.position.z = Math.sin(t) * radius;
      ref.current.position.y = Math.sin(t * 0.8) * (radius * 0.15);
    }
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={DEEP} emissive={color} emissiveIntensity={2.2} />
    </mesh>
  );
}

/* ── Data field around the orb ────────────────────────────────────────── */

function DataField({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3.2 + Math.random() * 2.6;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(p) * Math.cos(t);
      arr[i * 3 + 1] = r * Math.sin(p) * Math.sin(t) * 0.85;
      arr[i * 3 + 2] = r * Math.cos(p);
    }
    return arr;
  }, [count]);

  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.03;
      ref.current.rotation.x += dt * 0.008;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial
        size={0.038}
        color="#a894ff"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ── Scene wrapper with mouse parallax ────────────────────────────────── */

function Scene({ quality }: { quality: "high" | "medium" | "low" }) {
  const mouse = useRef({ x: 0, y: 0 });
  const { size } = useThree();

  // Quality knobs
  const nodeCount = quality === "high" ? 42 : quality === "medium" ? 28 : 18;
  const particleCount = quality === "high" ? 280 : quality === "medium" ? 160 : 80;

  const onMove = (e: React.PointerEvent) => {
    const nx = (e.clientX / size.width) * 2 - 1;
    const ny = (e.clientY / size.height) * 2 - 1;
    mouse.current.x = nx;
    mouse.current.y = ny;
  };

  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    // Very gentle floating
    g.position.y = Math.sin(performance.now() * 0.0008) * 0.06;
    // Overall parallax on the whole scene toward pointer
    g.rotation.y += ((mouse.current.x * 0.35) - g.rotation.y) * dt * 1.4;
    g.rotation.x += ((-mouse.current.y * 0.2) - g.rotation.x) * dt * 1.4;
  });

  return (
    <group ref={groupRef} onPointerMove={onMove}>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 5]} intensity={1.15} color="#c9d7ff" />
      <pointLight position={[-4, -2, -3]} intensity={0.9} color="#a894ff" />
      <pointLight position={[3, -3, 4]} intensity={0.6} color="#7dd3ff" />

      <Float speed={0.9} rotationIntensity={0.15} floatIntensity={0.4}>
        <group>
          <Shell />
          <InnerLattice nodeCount={nodeCount} mouse={mouse} />

          {/* Rings */}
          <OrbitalRing radius={2.35} tilt={[Math.PI / 2.5, 0.2, 0]} speed={0.18} color="#7dd3ff" />
          <OrbitalRing radius={2.75} tilt={[Math.PI / 3, -0.6, 0.4]} speed={-0.12} color="#a894ff" thickness={0.008} />
          <OrbitalRing radius={3.15} tilt={[Math.PI / 6, 0.9, 0]} speed={0.09} color="#ff9ec7" thickness={0.006} />

          {/* Satellites */}
          <OrbitingSatellite radius={2.35} speed={0.55} phase={0.0} size={0.09} color="#7dd3ff" />
          <OrbitingSatellite radius={2.75} speed={-0.42} phase={1.2} size={0.075} color="#a894ff" />
          <OrbitingSatellite radius={3.15} speed={0.28} phase={2.4} size={0.06} color="#ff9ec7" />
        </group>
      </Float>

      <DataField count={particleCount} />
    </group>
  );
}

export default function AIOrb({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  const { quality } = useDeviceQuality();

  return (
    <div className={`relative h-full w-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0.2, 6.2], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, quality === "high" ? 2 : 1.5]}
        frameloop={reduced ? "demand" : "always"}
      >
        <Scene quality={quality} />
      </Canvas>
      {/* Soft accent glow behind the orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 50%, hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.22), transparent 70%)",
        }}
      />
    </div>
  );
}

/* Tiny deterministic PRNG for stable geometry across renders */
function mulberry(seed: number) {
  let t = seed;
  return function () {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
