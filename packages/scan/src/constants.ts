/**
 * @module constants
 * @description FDCB 模組所有常數定義。
 * 包含 UI 尺寸、動畫時間、TEI Bucket 邊界等。
 */

/** FDCB 收合狀態高度 (px) */
export const FDCB_HEIGHT = 72;

/** FDCB 展開狀態高度 (px) */
export const FDCB_EXPANDED_HEIGHT = 200;

/** FDCB 背景模糊半徑 (px) */
export const FDCB_BLUR_RADIUS = 20;

/** FDCB 背景色 (RGBA) */
export const FDCB_BACKGROUND = 'rgba(28, 28, 30, 0.92)';

/** COMPLETE 狀態閃爍色 */
export const COMPLETE_FLASH_COLOR = '#34C759';

/** COMPLETE → IDLE 自動回歸延遲 (ms) */
export const COMPLETE_AUTO_RESET_MS = 800;

/** 事件圓點：活躍色 */
export const DOT_ACTIVE_COLOR = '#FFFFFF';

/** 事件圓點：非活躍色 */
export const DOT_INACTIVE_COLOR = '#48484A';

/** 事件圓點：✔ 標記色 */
export const DOT_CHECKMARK_COLOR = '#34C759';

/** 所有預設模板 ID 列表 */
export const TEMPLATE_IDS = [
  'CANSLIM_GS',
  'CANSLIM_HIGH_RS',
  'MANCINI_FBD',
  'WORK_FOCUS',
  'HEALTH_STRESS',
  'EXERCISE',
] as const;

/**
 * TEI Bucket 邊界定義，由高到低排列。
 * 用於 analytics 中的 bucket 分類。
 */
export const TEI_BUCKET_BOUNDARIES: ReadonlyArray<{ min: number; label: string }> = [
  { min: 95, label: '95-99' },
  { min: 90, label: '90-95' },
  { min: 85, label: '85-90' },
  { min: 80, label: '80-85' },
  { min: 75, label: '75-80' },
  { min: 70, label: '70-75' },
  { min: 65, label: '65-70' },
  { min: 60, label: '60-65' },
  { min: 55, label: '55-60' },
  { min: 35, label: '35-54' },
  { min: 1, label: '01-34' },
];

/** 計時器顯示字體設定 */
export const FDCB_TIMER_TYPOGRAPHY = {
  fontSize: 28,
  fontWeight: '600' as const,
  fontFamily: 'SF Pro Display',
  fontVariant: ['tabular-nums'] as const,
};

/** FDCB 標籤字體設定 */
export const FDCB_LABEL_TYPOGRAPHY = {
  fontSize: 11,
  fontWeight: '500' as const,
};
