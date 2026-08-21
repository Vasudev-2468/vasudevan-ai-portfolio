"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useDeviceQuality, useReducedMotion } from "@/lib/motion";

/**
 * GlobalBackdrop
 *
 * A single fixed-position canvas that lives behind the entire site.
 * Renders a very sparse particle cloud with a subtle depth field — the goal
 * is atmospheric depth, not attention. Content stays readable.
 */

function ParticleCloud({ count, size }: { count: number; size: number }) {
  const ref = useRef<THREE.Points>(null);

  const { positions, sizes } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.random() * 18;
      const t = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(phi) * Math.cos(t);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(t);
      p[i * 3 + 2] = r * Math.cos(phi) - 5;
      s[i] = 0.3 + Math.random() * 0.9;
    }
    return { positions: p, sizes: s };
  }, [count]);

  useFrame((state, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.012;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} count={count} />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color="#a894ff"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function AccentPoints({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.random() * 12;
      const t = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(phi) * Math.cos(t);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(t);
      p[i * 3 + 2] = r * Math.cos(phi) - 4;
    }
    return p;
  }, [count]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y -= dt * 0.018;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        color="#7dd3ff"
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Scene({ quality }: { quality: "high" | "medium" | "low" }) {
  const cloud = quality === "high" ? 900 : quality === "medium" ? 500 : 260;
  const accents = quality === "high" ? 80 : quality === "medium" ? 45 : 24;
  return (
    <>
      <ParticleCloud count={cloud} size={0.05} />
      <AccentPoints count={accents} />
    </>
  );
}

export default function GlobalBackdrop() {
  const reduced = useReducedMotion();
  const { quality } = useDeviceQuality();
  return (
    <div className="global-3d" aria-hidden>
      <div className="absolute inset-0 bg-aurora" />
      <div className="absolute inset-0 grid-overlay opacity-60" />
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        dpr={[1, 1.5]}
        frameloop={reduced ? "demand" : "always"}
      >
        <Scene quality={quality} />
      </Canvas>
      {/* Soft vignette darkens the edges to boost content contrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 30%, transparent 40%, rgb(var(--bg) / 0.55) 100%)",
        }}
      />
    </div>
  );
}
