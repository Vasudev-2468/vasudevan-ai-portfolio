"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Line } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const ACCENT = "#8b1ec8";
const ACCENT_SOFT = "#b673e0";
const ACCENT_DEEP = "#5a1480";

function DataPoints() {
  const ref = useRef<THREE.Points>(null!);
  const { positions, count } = useMemo(() => {
    const n = 260;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 4 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55;
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return { positions: arr, count: n };
  }, []);

  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.04;
      ref.current.rotation.x += dt * 0.012;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color={ACCENT}
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function AgentMesh() {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.2;
      ref.current.rotation.x += dt * 0.08;
    }
  });
  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.6}>
      <group ref={ref} position={[3.2, 0.9, -1]}>
        <mesh>
          <icosahedronGeometry args={[1.05, 1]} />
          <meshBasicMaterial color={ACCENT} wireframe transparent opacity={0.55} />
        </mesh>
        <mesh scale={0.6}>
          <icosahedronGeometry args={[1.05, 0]} />
          <meshBasicMaterial color={ACCENT_DEEP} wireframe transparent opacity={0.35} />
        </mesh>
      </group>
    </Float>
  );
}

function VisionLens() {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.25;
  });
  return (
    <Float speed={1} rotationIntensity={0.5} floatIntensity={0.8}>
      <group ref={ref} position={[-3.4, -0.4, 0]}>
        <mesh>
          <torusGeometry args={[0.85, 0.05, 16, 64]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.7} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.6, 0.04, 16, 48]} />
          <meshBasicMaterial color={ACCENT_SOFT} transparent opacity={0.5} />
        </mesh>
        <mesh>
          <octahedronGeometry args={[0.32, 0]} />
          <meshBasicMaterial color={ACCENT_DEEP} wireframe transparent opacity={0.6} />
        </mesh>
      </group>
    </Float>
  );
}

function DevLoop() {
  return (
    <Float speed={1.4} rotationIntensity={1} floatIntensity={0.7}>
      <mesh position={[2.4, -1.7, 0.5]} rotation={[0.3, 0.5, 0]}>
        <torusKnotGeometry args={[0.55, 0.13, 96, 16, 2, 3]} />
        <meshBasicMaterial color={ACCENT_SOFT} wireframe transparent opacity={0.55} />
      </mesh>
    </Float>
  );
}

function DataPlot() {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.18;
  });
  const lines = useMemo(() => {
    const out: [THREE.Vector3, THREE.Vector3][] = [];
    const origin = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const r = 0.9;
      out.push([
        origin.clone(),
        new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r * 0.6, 0),
      ]);
    }
    return out;
  }, []);

  return (
    <Float speed={1.1} rotationIntensity={0.5} floatIntensity={0.5}>
      <group ref={ref} position={[-2.7, 1.6, 0.4]}>
        {lines.map((pts, i) => (
          <Line key={i} points={pts} color={ACCENT} lineWidth={1.2} transparent opacity={0.55} />
        ))}
        <mesh>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={ACCENT_DEEP} />
        </mesh>
      </group>
    </Float>
  );
}

export default function HeroScene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 55 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      dpr={[1, 1.5]}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.6} />
      <DataPoints />
      <AgentMesh />
      <VisionLens />
      <DevLoop />
      <DataPlot />
    </Canvas>
  );
}
