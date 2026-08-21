"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, OrbitControls, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Publication } from "@/lib/api";

function PaperCard({
  publication,
  index,
  total,
}: {
  publication: Publication;
  index: number;
  total: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const baseAngle = (index / total) * Math.PI * 2;
  const radius = 3.6;
  const yOffset = ((index % 3) - 1) * 0.6;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime * 0.18 + baseAngle;
    groupRef.current.position.x = Math.cos(t) * radius;
    groupRef.current.position.z = Math.sin(t) * radius;
    groupRef.current.position.y = yOffset + Math.sin(state.clock.elapsedTime + index) * 0.15;
    groupRef.current.lookAt(0, 0, 0);
    groupRef.current.rotateY(Math.PI);
  });

  const color =
    publication.kind === "journal" ? "#7dd3ff" :
    publication.kind === "conference" ? "#a894ff" : "#ff9ec7";

  return (
    <group ref={groupRef}>
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.2}>
        <mesh>
          <planeGeometry args={[1.6, 1.0]} />
          <meshStandardMaterial
            color="#0a0d20"
            emissive={color}
            emissiveIntensity={0.45}
            transparent
            opacity={0.92}
            side={THREE.DoubleSide}
          />
        </mesh>
        <Html
          transform
          distanceFactor={6}
          position={[0, 0, 0.01]}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{ width: 220, color: "#e8ecff" }}
            className="rounded-md p-3 text-center font-sans"
          >
            <div
              style={{ color, letterSpacing: "0.25em" }}
              className="text-[8px] uppercase"
            >
              {publication.kind} · {publication.year}
            </div>
            <div className="mt-1 text-[11px] font-medium leading-tight line-clamp-3">
              {publication.title}
            </div>
          </div>
        </Html>
      </Float>
    </group>
  );
}

function CoreSphere() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.15;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.85, 1]} />
      <meshStandardMaterial color="#04050d" emissive="#7dd3ff" emissiveIntensity={0.9} wireframe />
    </mesh>
  );
}

export default function PaperOrbit({ publications }: { publications: Publication[] }) {
  const items = useMemo(() => publications.slice(0, 9), [publications]);
  if (!items.length) return null;

  return (
    <div className="h-[460px] w-full">
      <Canvas camera={{ position: [0, 1.5, 7.5], fov: 55 }} dpr={[1, 2]}>
        <ambientLight intensity={0.5} />
        <pointLight position={[3, 4, 4]} intensity={1.0} color="#7dd3ff" />
        <pointLight position={[-3, -2, -3]} intensity={0.8} color="#a894ff" />
        <Sparkles count={40} scale={10} size={2} speed={0.4} color="#7dd3ff" />
        <CoreSphere />
        {items.map((p, i) => (
          <PaperCard key={p.id} publication={p} index={i} total={items.length} />
        ))}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.3}
          enableDamping
          maxPolarAngle={Math.PI / 1.6}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
    </div>
  );
}
