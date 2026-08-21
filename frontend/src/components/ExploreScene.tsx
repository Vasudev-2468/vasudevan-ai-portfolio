"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Float,
  OrbitControls,
  RoundedBox,
  Sparkles,
  Stars,
  Text,
} from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

type Portal = {
  key: string;
  label: string;
  caption: string;
  href: string;
  position: [number, number, number];
  color: string;
};

const PORTALS: Portal[] = [
  { key: "about", label: "About", caption: "the mathematician", href: "/#about", position: [-4.5, 0.7, 0], color: "#7df9ff" },
  { key: "work", label: "Work", caption: "teaching · mentoring", href: "/#experience", position: [-2.2, 1.6, -3], color: "#b18bff" },
  { key: "research", label: "Research", caption: "9 publications · 1 patent", href: "/#research", position: [0, 0.7, -4.5], color: "#ff6bd6" },
  { key: "projects", label: "Projects", caption: "production ML systems", href: "/#projects", position: [2.2, 1.6, -3], color: "#7df9ff" },
  { key: "skills", label: "Skills", caption: "the full stack", href: "/#skills", position: [4.5, 0.7, 0], color: "#b18bff" },
  { key: "assistant", label: "AI", caption: "talk to the avatar", href: "/#avatar", position: [2.2, -0.6, 3], color: "#ff6bd6" },
  { key: "contact", label: "Contact", caption: "say hello", href: "/#contact", position: [-2.2, -0.6, 3], color: "#7df9ff" },
];

function Portal({
  portal,
  onSelect,
  active,
}: {
  portal: Portal;
  onSelect: (p: Portal | null) => void;
  active: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const baseY = portal.position[1];

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = baseY + Math.sin(state.clock.elapsedTime + portal.position[0]) * 0.12;
    ref.current.rotation.y += active ? 0.012 : 0.004;
  });

  return (
    <Float speed={1.0} rotationIntensity={0.18} floatIntensity={0.25}>
      <group
        ref={ref}
        position={portal.position}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onSelect(portal);
        }}
        onPointerOut={() => {
          // Restore whatever cursor value the page had before we entered
          // this portal. Setting "none" here would leak onto other routes
          // if the user navigates away mid-hover.
          document.body.style.cursor = "";
          onSelect(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          window.location.href = portal.href;
        }}
      >
        <RoundedBox args={[1.5, 1.0, 0.12]} radius={0.06} smoothness={4}>
          <meshStandardMaterial
            color="#04050d"
            emissive={portal.color}
            emissiveIntensity={active ? 1.0 : 0.35}
            metalness={0.4}
            roughness={0.25}
          />
        </RoundedBox>
        <Text
          position={[0, 0.13, 0.07]}
          fontSize={0.22}
          color="#e8ecff"
          anchorX="center"
          anchorY="middle"
        >
          {portal.label}
        </Text>
        <Text
          position={[0, -0.15, 0.07]}
          fontSize={0.07}
          color={portal.color}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.18}
        >
          {portal.caption.toUpperCase()}
        </Text>
        {/* Ring around active */}
        {active && (
          <mesh rotation={[0, 0, 0]} position={[0, 0, -0.08]}>
            <ringGeometry args={[0.95, 1.0, 64]} />
            <meshBasicMaterial color={portal.color} transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    </Float>
  );
}

function Core() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.25;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.65, 1]} />
      <meshStandardMaterial
        color="#04050d"
        emissive="#7df9ff"
        emissiveIntensity={1.4}
        wireframe
      />
    </mesh>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
      <planeGeometry args={[60, 60, 60, 60]} />
      <meshStandardMaterial
        color="#0a0d20"
        emissive="#7df9ff"
        emissiveIntensity={0.04}
        wireframe
      />
    </mesh>
  );
}

function CameraOrbit() {
  const { camera } = useThree();
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.05;
    camera.position.x = Math.cos(t) * 0.4;
    camera.lookAt(0, 0.4, 0);
  });
  return null;
}

export default function ExploreScene() {
  const [hover, setHover] = useState<Portal | null>(null);
  const portals = useMemo(() => PORTALS, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-ink-950">
      <Canvas camera={{ position: [0, 1.4, 8], fov: 55 }} dpr={[1, 2]}>
        <fog attach="fog" args={["#04050d", 8, 28]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[4, 5, 4]} intensity={1.4} color="#7df9ff" />
        <pointLight position={[-4, 3, -4]} intensity={1.0} color="#b18bff" />
        <Stars radius={60} depth={45} count={2500} factor={3} fade speed={0.4} />
        <Sparkles count={60} scale={14} size={2} speed={0.3} color="#7df9ff" />
        <Core />
        <Ground />
        {portals.map((p) => (
          <Portal key={p.key} portal={p} onSelect={setHover} active={hover?.key === p.key} />
        ))}
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={4}
          maxDistance={14}
          autoRotate
          autoRotateSpeed={0.25}
          enableDamping
          maxPolarAngle={Math.PI / 1.8}
          minPolarAngle={Math.PI / 3}
        />
        <CameraOrbit />
      </Canvas>

      {/* Overlay HUD */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 md:p-10">
        <header className="flex items-start justify-between font-mono text-[11px] uppercase tracking-[0.32em] text-ink-100/70">
          <div>
            <p className="text-accent">// vasudevan.ai · explore</p>
            <p className="mt-1 text-ink-100/45">drag to orbit · scroll to zoom · click a portal</p>
          </div>
          <a
            href="/"
            className="pointer-events-auto rounded-full border border-ink-100/15 bg-ink-950/50 px-3 py-1.5 text-ink-100/80 backdrop-blur transition hover:border-accent/60 hover:text-accent"
          >
            ← classic
          </a>
        </header>

        <footer className="font-mono text-[11px] uppercase tracking-[0.32em] text-ink-100/55">
          {hover ? (
            <>
              <span className="text-accent">▍</span> {hover.label} — {hover.caption}
            </>
          ) : (
            <>
              <span className="text-accent">▍</span> hover a portal to inspect
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
