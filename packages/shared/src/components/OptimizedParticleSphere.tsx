/**
 * @module components/OptimizedParticleSphere
 * @description 星塵靈魂背景 — 8000 顆粒子自然向前翻滾效果。
 * 用於結果頁背景層，營造 premium 沉浸感。
 *
 * 效果：整體向前滾動（像能量球朝你滾來），個別粒子輕微擾動 + 球體自轉。
 * 使用 React Three Fiber + BufferAttribute 確保 60fps 效能。
 *
 * @usage
 * ```tsx
 * <Canvas>
 *   <OptimizedParticleSphere
 *     count={8000}
 *     rollSpeed={0.013}    // 甜蜜點：沉穩又有未來感
 *     turbulence={0.005}
 *   />
 * </Canvas>
 * ```
 *
 * @version 3.0
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface OptimizedParticleSphereProps {
  /** 粒子數量（預設 8000）。 */
  count?: number;
  /** 整體向前翻滾速度（推薦 0.013，甜蜜點）。 */
  rollSpeed?: number;
  /** 個別粒子擾動強度。 */
  turbulence?: number;
  /** 球體半徑。 */
  radius?: number;
}

export default function OptimizedParticleSphere({
  count = 8000,
  rollSpeed = 0.013,
  turbulence = 0.005,
  radius = 4.2,
}: OptimizedParticleSphereProps) {
  const pointsRef = useRef<THREE.Points>(null!);

  // 初始位置與顏色（球體分布）
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = radius + (Math.random() - 0.5) * 0.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // 紫藍色系星塵感
      col[i * 3]     = 0.55 + Math.random() * 0.45;
      col[i * 3 + 1] = 0.65 + Math.random() * 0.35;
      col[i * 3 + 2] = 0.95 + Math.random() * 0.05;
    }
    return [pos, col];
  }, [count, radius]);

  useFrame((_state, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    // === 核心：自然向前翻滾感 ===
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // 1. 整體向前滾動（Z 軸朝向觀眾）
      array[i3 + 2] += rollSpeed * 55 * delta;   // 55 是讓 60fps 感覺最順的係數

      // 2. 輕微個別擾動（讓翻滾看起來有機）
      array[i3]     += (Math.random() - 0.5) * turbulence;
      array[i3 + 1] += (Math.random() - 0.5) * turbulence;

      // 3. 維持球體形狀（防止粒子飛散）
      const x = array[i3];
      const y = array[i3 + 1];
      const z = array[i3 + 2];
      const dist = Math.sqrt(x * x + y * y + z * z);
      if (dist > 0) {
        const factor = radius / dist;
        array[i3]     *= factor;
        array[i3 + 1] *= factor;
        array[i3 + 2] *= factor;
      }
    }

    // 4. 整體緩慢自轉（增加翻滾立體感）
    points.rotation.y += 0.008 * delta;

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          itemSize={3}
          count={count}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          itemSize={3}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.028}
        vertexColors
        transparent
        opacity={0.92}
        sizeAttenuation
        depthTest={false}
        blending={THREE.AdditiveBlending}   // 讓星塵更夢幻
      />
    </points>
  );
}
