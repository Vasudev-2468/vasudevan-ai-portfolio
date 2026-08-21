"use client";

/**
 * AvatarStage — a small, localized neural-network stage that sits behind
 * the AI Avatar section. Distinct from the site-wide GlobalBackdrop:
 * this one has floating nodes with connecting lines that pulse when the
 * avatar is speaking or listening. Particle counts are scaled by device
 * quality; reduced-motion users get demand-frame rendering.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useDeviceQuality, useReducedMotion } from "@/lib/motion";

function Nodes({
  count,
  active,
}: {
  count: number;
  active: boolean;
}) {
  const ptsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const { positions, linePositions } = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribute in a flat-ish shell in front of the avatar plane.
      const r = 3 + Math.random() * 5;
      const t = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.7;
      p[i * 3] = r * Math.cos(phi) * Math.cos(t);
      p[i * 3 + 1] = r * Math.cos(phi) * Math.sin(t);
      p[i * 3 + 2] = r * Math.sin(phi) - 2;
    }

    // Build sparse edges — each node connects to its nearest neighbour
    // within a distance threshold. Keep total < 3n so it doesn't crowd.
    const edges: number[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < count; i++) {
      let bestJ = -1;
      let bestD = Infinity;
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const dx = p[i * 3] - p[j * 3];
        const dy = p[i * 3 + 1] - p[j * 3 + 1];
        const dz = p[i * 3 + 2] - p[j * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) {
          bestD = d;
          bestJ = j;
        }
      }
      if (bestJ >= 0) {
        const key = i < bestJ ? `${i}-${bestJ}` : `${bestJ}-${i}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push(
            p[i * 3], p[i * 3 + 1], p[i * 3 + 2],
            p[bestJ * 3], p[bestJ * 3 + 1], p[bestJ * 3 + 2]
          );
        }
      }
    }
    return { positions: p, linePositions: new Float32Array(edges) };
  }, [count]);

  useFrame((state, dt) => {
    if (ptsRef.current) {
      ptsRef.current.rotation.y += dt * (active ? 0.08 : 0.02);
      ptsRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.15) * 0.06;
    }
    if (linesRef.current) {
      linesRef.current.rotation.y = ptsRef.current?.rotation.y ?? 0;
      linesRef.current.rotation.x = ptsRef.current?.rotation.x ?? 0;
      const mat = linesRef.current.material as THREE.LineBasicMaterial;
      const pulse = 0.15 + Math.abs(Math.sin(state.clock.elapsedTime * (active ? 2 : 0.6))) * (active ? 0.4 : 0.15);
      mat.opacity = pulse;
    }
  });

  return (
    <group>
      <points ref={ptsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={count}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.09}
          color="#7dd3ff"
          transparent
          opacity={0.9}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
            count={linePositions.length / 3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#a894ff"
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

export default function AvatarStage({ active = false }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const { quality } = useDeviceQuality();
  const count = quality === "high" ? 90 : quality === "medium" ? 60 : 40;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 55 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        dpr={[1, 1.5]}
        frameloop={reduced ? "demand" : "always"}
      >
        <Nodes count={count} active={active && !reduced} />
      </Canvas>
    </div>
  );
}
