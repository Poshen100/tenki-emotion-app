import { type SVGProps, type ReactNode } from "react";

/**
 * TENKI Core — Icon System v1.1
 * ---------------------------------------------------------------
 * 統一線性圖示，取代頁面上所有 emoji（含 ✅❌⚠️ 狀態 emoji）。
 *   • 網格 24×24 ・筆畫 1.6px ・圓角 round
 *   • 主色用 currentColor（由外層文字色控制）
 *   • 強調色用 CSS 變數 --tenki-accent（預設極光 teal #5FE9D0）
 *
 * 用法：
 *   <Scan />                          // 預設 24px、跟隨文字色
 *   <Scan size={40} />                // 改尺寸
 *   <Ready className="text-white" />  // 用 className / style 控制主色
 *
 * 換強調色（局部）：在父層設 CSS 變數即可，例如就緒/完成用破曉色：
 *   <span style={{ ['--tenki-accent' as any]: '#FFC68A' }}><Ready /></span>
 *
 * 狀態圖示（StatusOk / StatusFail / StatusWarn）已自帶語意色，
 * 不跟隨 currentColor，可直接用在狀態列：
 *   良好 → StatusOk（青）｜未達標/中性 → StatusFail（灰，不刺眼）｜提醒 → StatusWarn（琥珀）
 * ---------------------------------------------------------------
 */

const ACCENT = "var(--tenki-accent, #5FE9D0)"; // 極光 teal；破曉 amber = #FFC68A

// 狀態語意色（固定，不跟隨 currentColor）
const OK = "#5FE9D0";   // 青 — 良好/達標
const FAIL = "#5E7596"; // 中性灰 — 未達標但非錯誤（刻意不用紅，降低焦慮）
const WARN = "#FFC68A"; // 琥珀 — 提醒/待調整
// 註：真正的「錯誤」才用紅 #FF6B6B，請由呼叫端視情況覆寫 stroke。

export type TenkiIconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...props }: TenkiIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** 感知 — TENKI 先學你的節奏（取代 🧠 ・ Hero / Learn） */
export function Sense(props: TenkiIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="4,12 7.5,12 9.5,7.5 12,15.5 14,11 15.5,12 20,12" stroke={ACCENT} />
    </Svg>
  );
}

/** 基線 — 你的「正常範圍」參考（取代結果頁訊號 ・ Baseline / Reference） */
export function Baseline(props: TenkiIconProps) {
  return (
    <Svg {...props}>
      <polyline points="3,8.5 6,15 8.2,6.5 10.2,13 12,11.8 21,11.8" />
      <circle cx="16" cy="11.8" r="1.5" fill={ACCENT} stroke="none" />
    </Svg>
  );
}

/**
 * 指紋建立 — iOS 線條風 3 圈指紋 + 四角對位框（取代 👆 ・ Finger Method）
 * 造型：與臉部卡同一套掃描框；固定 teal #5FE1D6，stroke-width 2.5。viewBox 120×120。
 */
export function Fingerprint({ size = 24, ...props }: TenkiIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="#5FE1D6"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* Fingerprint loops */}
      <path d="M60 38 C48 38 42 48 42 58 C42 70 50 80 60 80 C70 80 78 70 78 58 C78 48 72 38 60 38" />
      <path d="M60 46 C52 46 48 52 48 58 C48 66 54 72 60 72 C66 72 72 66 72 58 C72 52 68 46 60 46" />
      <path d="M60 54 C56 54 54 56 54 58 C54 62 57 64 60 64 C63 64 66 62 66 58 C66 56 64 54 60 54" />
      {/* Scan frame (same as the face icon) */}
      <path d="M28 40 Q28 28 40 28" />
      <path d="M80 28 Q92 28 92 40" />
      <path d="M92 80 Q92 92 80 92" />
      <path d="M40 92 Q28 92 28 80" />
    </svg>
  );
}

/**
 * 臉部建立 — 線條人臉於 iOS 圓角對位框內（取代 🙂 ・ Face Method · Beta）
 * 造型：描邊臉（頭 + 耳 + 肩）+ 四角掃描框；固定 teal 色 #5FE1D6。
 * 來源 viewBox 120×120。
 */
export function SoulFace({ size = 24, ...props }: TenkiIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="#5FE1D6"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* Face */}
      <path d="M60 30 C48 30 42 42 42 55 C42 70 50 82 60 82 C70 82 78 70 78 55 C78 42 72 30 60 30Z" />
      {/* Ears */}
      <path d="M42 55 C38 55 38 62 42 62" />
      <path d="M78 55 C82 55 82 62 78 62" />
      {/* Shoulders */}
      <path d="M38 92 C45 78 75 78 82 92" />
      {/* Scan frame (iOS rounded corners) */}
      <path d="M28 40 Q28 28 40 28" />
      <path d="M80 28 Q92 28 92 40" />
      <path d="M92 80 Q92 92 80 92" />
      <path d="M40 92 Q28 92 28 80" />
    </svg>
  );
}

/** 鏡頭 — 對準鏡頭蓋滿邊緣（搭配「先把鏡頭蓋對」步驟 ・ Lens Cover） */
export function Camera(props: TenkiIconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6.5" width="18" height="13" rx="3.2" />
      <path d="M8.6 6.5 l1.4 -2 h4 l1.4 2" />
      <circle cx="12" cy="13" r="3.4" stroke={ACCENT} />
      <circle cx="12" cy="13" r="0.7" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** 對位 — 把指腹移到正中央（取代 ▲▼◀▶ ・ Live Check / Align） */
export function Align(props: TenkiIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="1.5" fill={ACCENT} stroke="none" />
      <polyline points="9,4.4 12,6.8 15,4.4" />
      <polyline points="9,19.6 12,17.2 15,19.6" />
      <polyline points="4.4,9 6.8,12 4.4,15" />
      <polyline points="19.6,9 17.2,12 19.6,15" />
    </Svg>
  );
}

/** 掃描 — 對照基線比較此刻（取代 🔍 ・ First Scan） */
export function Scan(props: TenkiIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="3" stroke={ACCENT} />
      <circle cx="12" cy="12" r="0.7" fill="currentColor" stroke="none" />
      <line x1="12" y1="2.6" x2="12" y2="5.4" />
      <line x1="12" y1="18.6" x2="12" y2="21.4" />
      <line x1="2.6" y1="12" x2="5.4" y2="12" />
      <line x1="18.6" y1="12" x2="21.4" y2="12" />
    </Svg>
  );
}

/** 探索 — 先逛逛各項功能（取代 🧭 ・ Browse） */
export function Explore(props: TenkiIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 5.4 L14 12 L12 12.6 Z" fill={ACCENT} stroke="none" />
      <path d="M12 18.6 L10 12 L12 11.4 Z" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** 就緒 — 訊號品質優良 / 完成（取代 ✓ ・ Confirm / Done） */
export function Ready(props: TenkiIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="7.5,12.5 10.5,15.5 16.5,8.5" stroke={ACCENT} />
    </Svg>
  );
}

/* ============================================================
 * 狀態圖示 — 取代 ✅ ❌ ⚠️
 * 預設自帶語意色；若某項是「真正的錯誤」，可覆寫 stroke：
 *   <StatusFail stroke="#FF6B6B" />
 * ============================================================ */

/** 良好 / 達標（取代 ✅ ・ 青色） */
export function StatusOk({ size = 24, ...props }: TenkiIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={OK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="7.5,12.5 10.5,15.5 16.5,8.5" />
    </svg>
  );
}

/** 未達標 / 中性（取代 ❌ ・ 中性灰，刻意不用紅以降低焦慮） */
export function StatusFail({ size = 24, ...props }: TenkiIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={FAIL} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  );
}

/** 提醒 / 待調整（取代 ⚠️ ・ 琥珀） */
export function StatusWarn({ size = 24, ...props }: TenkiIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={WARN} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7.5" x2="12" y2="13" />
      <circle cx="12" cy="16.2" r="0.5" fill={WARN} stroke="none" />
    </svg>
  );
}

/** 方便動態取用：依 key 取得元件 */
export const TenkiIcons = {
  sense: Sense,
  baseline: Baseline,
  fingerprint: Fingerprint,
  soulFace: SoulFace,
  camera: Camera,
  align: Align,
  scan: Scan,
  explore: Explore,
  ready: Ready,
  statusOk: StatusOk,
  statusFail: StatusFail,
  statusWarn: StatusWarn,
} as const;

export type TenkiIconName = keyof typeof TenkiIcons;
