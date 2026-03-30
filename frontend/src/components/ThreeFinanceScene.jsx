import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, Stars } from '@react-three/drei';

const CoinSwarm = () => {
  const groupRef = useRef(null);

  const coins = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 16,
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 10,
      s: 0.22 + Math.random() * 0.26,
      speed: 0.12 + Math.random() * 0.2,
      offset: Math.random() * Math.PI * 2,
    })),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.045;
      groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.04;
    }

    groupRef.current?.children?.forEach((child, idx) => {
      const c = coins[idx];
      if (!c) return;
      child.position.y = c.y + Math.sin(t * c.speed + c.offset) * 0.45;
      child.rotation.y = t * (0.6 + c.speed);
      child.rotation.x = Math.sin(t * 0.4 + c.offset) * 0.25;
    });
  });

  return (
    <group ref={groupRef}>
      {coins.map((c) => (
        <mesh key={c.id} position={[c.x, c.y, c.z]} scale={c.s}>
          <cylinderGeometry args={[1, 1, 0.16, 24]} />
          <meshStandardMaterial color="#34d399" emissive="#065f46" emissiveIntensity={0.45} metalness={0.8} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
};

const ThreeFinanceScene = () => {
  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 56 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'low-power', alpha: true }}
      performance={{ min: 0.5 }}
    >
      <ambientLight intensity={0.38} />
      <pointLight position={[2, 3, 4]} intensity={1.15} color="#34d399" />
      <pointLight position={[-3, -2, -2]} intensity={0.7} color="#3b82f6" />
      <CoinSwarm />
      <Stars radius={95} depth={45} count={1300} factor={3} saturation={0} fade speed={0.5} />
      <Sparkles count={100} scale={16} size={1.8} speed={0.3} opacity={0.26} color="#34d399" />
      <Sparkles count={90} scale={16} size={1.2} speed={0.24} opacity={0.2} color="#3b82f6" />
    </Canvas>
  );
};

export default ThreeFinanceScene;
