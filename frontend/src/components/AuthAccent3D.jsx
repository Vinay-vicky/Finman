import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { useRenderProfile } from '../utils/renderProfile';

const AccentMesh = () => {
  const ringRef = useRef(null);
  const coreRef = useRef(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.x = 0.45 + Math.sin(t * 0.8) * 0.08;
      ringRef.current.rotation.y = t * 0.45;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y = -t * 0.55;
      coreRef.current.position.y = Math.sin(t * 1.2) * 0.08;
    }
  });

  return (
    <group>
      <mesh ref={ringRef}>
        <torusKnotGeometry args={[1.2, 0.22, 110, 18]} />
        <meshStandardMaterial color="#34d399" emissive="#065f46" emissiveIntensity={0.4} metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.52, 1]} />
        <meshStandardMaterial color="#3b82f6" emissive="#1e3a8a" emissiveIntensity={0.45} metalness={0.7} roughness={0.35} />
      </mesh>
      <Sparkles count={45} scale={4.5} size={1.8} speed={0.25} opacity={0.2} color="#34d399" />
    </group>
  );
};

const AuthAccent3D = () => {
  const profile = useRenderProfile();

  return (
    <div className="h-28 w-full rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
      <Canvas camera={{ position: [0, 0, 4], fov: 58 }} dpr={profile.isMobile ? [1, 1.2] : [1, 1.5]} gl={{ antialias: false, powerPreference: 'low-power' }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 2, 3]} color="#34d399" intensity={1.2} />
        <pointLight position={[-2, -1, -2]} color="#3b82f6" intensity={0.7} />
        <AccentMesh />
      </Canvas>
    </div>
  );
};

export default AuthAccent3D;
