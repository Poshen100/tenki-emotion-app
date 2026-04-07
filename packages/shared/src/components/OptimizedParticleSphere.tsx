/**
 * @module components/OptimizedParticleSphere
 * @description 星塵靈魂背景 — 8000 顆粒子自然向前翻滾 + 高潮爆發動畫。
 *
 * 兩種模式：
 * 1. 常態翻滾：沉穩向前滾動感（rollSpeed=0.013 甜蜜點）
 * 2. 高潮模式：掃描完成時 triggerClimax=true → 粒子瞬間爆發再收斂（靈魂覺醒）
 *
 * @usage
 * ```tsx
 * const [climax, setClimax] = useState(false);
 *
 * // 掃描完成時觸發
 * useEffect(() => {
 *   if (scanComplete) {
 *     setClimax(true);
 *     setTimeout(() => setClimax(false), 1500);
 *   }
 * }, [scanComplete]);
 *
 * <Canvas>
 *   <group position={[0, 0, -8]}>
 *     <OptimizedParticleSphere triggerClimax={climax} />
 *   </group>
 * </Canvas>
 * ```
 *
 * @version 3.0
 */

import { useRef, useMemo, useEffect } from 'react';
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
  /** 掃描完成時設為 true → 觸發高潮爆發動畫。 */
  triggerClimax?: boolean;
  /** 高潮動畫持續時間（秒），預設 1.2。 */
  climaxDuration?: number;
  /** 高潮爆發強度倍數，預設 1.8。 */
  climaxIntensity?: number;
}

export default function OptimizedParticleSphere({
  count = 8000,
  rollSpeed = 0.013,
  turbulence = 0.005,
  radius = 4.2,
  triggerClimax = false,
  climaxDuration = 1.2,
  climaxIntensity = 1.8,
}: OptimizedParticleSphereProps) {
  const pointsRef = useRef<THREE.Points>(null!);
  const climaxStartRef = useRef<number | null>(null);

  // 記錄高潮開始時間
  useEffect(() => {
    if (triggerClimax) {
      climaxStartRef.current = null; // 會在下一個 useFrame 設定
    }
  }, [triggerClimax]);

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

  useFrame((state, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;
    const elapsed = state.clock.getElapsedTime();

    // ═══════════════════════════════════════════
    // 常態：自然向前翻滾感
    // ═══════════════════════════════════════════
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // 1. 整體向前滾動（Z 軸朝向觀眾）
      array[i3 + 2] += rollSpeed * 55 * delta;

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

    // ═══════════════════════════════════════════
    // 高潮：粒子爆發 → 收斂（靈魂覺醒）
    // ═══════════════════════════════════════════
    if (triggerClimax) {
      // 第一次進入高潮：記錄開始時間
      if (climaxStartRef.current === null) {
        climaxStartRef.current = elapsed;
      }

      const climaxElapsed = elapsed - climaxStartRef.current;
      const progress = Math.min(1, climaxElapsed / climaxDuration);

      // sin(π·t) → 0→1→0 的爆發收斂曲線
      const intensity = Math.sin(progress * Math.PI) * climaxIntensity;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        // XY 方向大幅爆發
        array[i3]     += (Math.random() - 0.5) * intensity * 0.3;
        array[i3 + 1] += (Math.random() - 0.5) * intensity * 0.3;

        // Z 方向較小幅度（深度感）
        array[i3 + 2] += (Math.random() - 0.5) * intensity * 0.15;
      }

      // 高潮期間加速自轉（能量釋放感）
      points.rotation.y += intensity * 0.02 * delta;
    }

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
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
