"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Sphere, Stars } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const NODE_COUNT = 60;
const RADIUS = 3.5;

function generateNodes() {
  return Array.from({ length: NODE_COUNT }, () => {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = RADIUS * (0.7 + Math.random() * 0.45);
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    );
  });
}

function NeuralNetwork() {
  const groupRef = useRef<THREE.Group>(null);
  const nodes = useMemo(generateNodes, []);

  const edges = useMemo(() => {
    const pairs: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].distanceTo(nodes[j]) < 1.6) pairs.push([nodes[i], nodes[j]]);
      }
    }
    return pairs;
  }, [nodes]);

  const lineGeometry = useMemo(() => {
    const positions: number[] = [];
    edges.forEach(([a, b]) => {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  }, [edges]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.12;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.15;
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color="#5ef0ff" transparent opacity={0.28} />
      </lineSegments>
      {nodes.map((p, i) => (
        <Float key={i} speed={1.4} rotationIntensity={0.3} floatIntensity={0.6}>
          <Sphere args={[0.06 + Math.random() * 0.05, 16, 16]} position={p}>
            <meshStandardMaterial
              emissive={i % 3 === 0 ? "#b18bff" : i % 3 === 1 ? "#5ef0ff" : "#ff6bd6"}
              emissiveIntensity={2}
              color="#0a0d20"
            />
          </Sphere>
        </Float>
      ))}
    </group>
  );
}

function CorePulse() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.1;
    ref.current.scale.set(s, s, s);
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.7, 1]} />
      <meshStandardMaterial
        color="#0a0d20"
        emissive="#5ef0ff"
        emissiveIntensity={1.2}
        wireframe
      />
    </mesh>
  );
}

export default function NeuralScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 55 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#5ef0ff" />
      <pointLight position={[-5, -3, -3]} intensity={1.0} color="#b18bff" />
      <Stars radius={50} depth={40} count={1500} factor={2.5} fade speed={0.6} />
      <NeuralNetwork />
      <CorePulse />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.4}
        enableDamping
      />
    </Canvas>
  );
}
