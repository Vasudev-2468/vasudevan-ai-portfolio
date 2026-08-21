"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { useReducedMotion } from "@/lib/motion";

/**
 * FloatingGeometry — small self-contained scene used in the About block.
 *
 * A slowly rotating faceted cube-of-cubes with a wire-icosahedron halo. Reads
 * as "structured intelligence" without demanding attention.
 */

function Cluster() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!g.current) return;
    g.current.rotation.y += dt * 0.22;
    g.current.rotation.x += dt * 0.08;
  });
  const positions: [number, number, number][] = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++)
        if (Math.abs(x) + Math.abs(y) + Math.abs(z) !== 0) positions.push([x * 0.55, y * 0.55, z * 0.55]);

  return (
    <group ref={g}>
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.32, 0.32, 0.32]} />
          <meshStandardMaterial
            color="#0d1638"
            emissive={i % 5 === 0 ? "#a894ff" : "#7dd3ff"}
            emissiveIntensity={0.85}
            roughness={0.35}
            metalness={0.6}
          />
        </mesh>
      ))}
      <mesh>
        <icosahedronGeometry args={[1.6, 0]} />
        <meshBasicMaterial color="#7dd3ff" wireframe transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

export default function FloatingGeometry({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <div className={`h-full w-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 4.6], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        dpr={[1, 1.75]}
        frameloop={reduced ? "demand" : "always"}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 4, 4]} intensity={1.2} color="#c9d7ff" />
        <pointLight position={[-3, -2, -2]} intensity={0.7} color="#a894ff" />
        <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.6}>
          <Cluster />
        </Float>
      </Canvas>
    </div>
  );
}
