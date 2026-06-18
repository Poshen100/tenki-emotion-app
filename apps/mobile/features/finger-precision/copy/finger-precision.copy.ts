/**
 * @module finger-precision/copy/finger-precision.copy
 * @description Localization dictionary for Finger PPG Precision Flow (EN and ZH-TW).
 *
 * @version 1.0
 */

export const FINGER_PRECISION_COPY = {
  en: {
    intro: {
      title: 'Add a Finger Precision Scan',
      subtitle: 'This helps TENKI refine your signal with heart rhythm data.',
      cta: 'Start',
      notNow: 'Not now',
      privacyNote: 'All processing stays on your device',
    },
    permission: {
      title: 'Camera Access Required',
      body: 'TENKI needs camera and flash access to illuminate and detect changes in blood flow in your finger.',
      cta: 'Allow Camera',
      secondary: 'Cancel',
    },
    readiness: {
      title: 'Place your finger to begin',
      cover: 'Cover',
      still: 'Still',
      pressure: 'Pressure',
      waiting: 'Waiting for contact',
    },
    placement: {
      instruction: 'Place your fingertip gently over the camera and flash',
      tips: [
        'Cover lens fully',
        "Don't press hard",
        'Keep hand supported',
      ],
    },
    locking: {
      instruction: 'Hold still',
      status: 'Locking signal...',
    },
    estimate: {
      instruction: 'Initial signal captured',
      subtitle: 'Refining for higher precision...',
    },
    build: {
      instruction: 'Keep steady',
      instructionStable: 'Relax your hand',
      instructionStrong: 'Maintain light pressure',
      ctaDone: 'Done',
      ctaDoneOptional: 'Done (optional)',
    },
    recovery: {
      pressure_high: 'Ease pressure slightly',
      finger_moved: 'Finger moved',
      contact_lost: 'Return finger to lens',
      ambient_light: 'Move to a dimmer spot',
      signal_unstable: 'Hold still',
      progressKept: (beats: number) => `${beats} beats kept`,
    },
    processing: {
      instruction: 'Signal confirmed',
      subtitle: 'Blending with your personal baseline...',
    },
    complete: {
      title: 'Precision upgraded',
      uplift: (pct: number) => `Confidence: +${pct}%`,
      beats: (count: number) => `${count} valid beats`,
      tier: (tierName: string) => `Tier: ${tierName}`,
      blendMode: {
        high_confidence_blend: 'High confidence blend with face baseline',
        signal_added: 'Signal added to baseline',
        face_only: 'Partial signal captured',
      },
      cta: 'Done',
    },
    retry: {
      title: 'Calibration needed',
      body: 'The scan was interrupted or could not acquire a stable signal.',
      cta: 'Retry',
      exit: 'Exit',
    },
    disclaimer: 'This scan helps refine your personal baseline. It does not provide medical measurements. All processing stays on your device.',
  },
  zh: {
    intro: {
      title: '新增手指精準掃描',
      subtitle: '這將協助 TENKI 結合心率特徵以優化你的訊號品質。',
      cta: '開始',
      notNow: '稍後再說',
      privacyNote: '所有數據處理均於本機安全完成',
    },
    permission: {
      title: '需要使用相機權限',
      body: 'TENKI 需要使用你的相機與閃光燈來透射手指微血管，藉此辨識血流變化。',
      cta: '允許使用相機',
      secondary: '取消',
    },
    readiness: {
      title: '放上手指以開始',
      cover: '覆蓋率',
      still: '穩定度',
      pressure: '接觸壓力',
      waiting: '等待手指接觸鏡頭',
    },
    placement: {
      instruction: '將指尖輕放在鏡頭與閃光燈上',
      tips: [
        '完整覆蓋鏡頭',
        '請勿用力按壓',
        '支撐手部以保持穩定',
      ],
    },
    locking: {
      instruction: '保持不動',
      status: '鎖定訊號中...',
    },
    estimate: {
      instruction: '已捕捉初步訊號',
      subtitle: '正在優化以提升精準度...',
    },
    build: {
      instruction: '維持穩定',
      instructionStable: '放鬆手部',
      instructionStrong: '維持輕觸',
      ctaDone: '完成',
      ctaDoneOptional: '完成 (可選)',
    },
    recovery: {
      pressure_high: '稍微減輕壓力',
      finger_moved: '手指移動了',
      contact_lost: '將手指放回鏡頭',
      ambient_light: '移至較暗的地方',
      signal_unstable: '保持不動',
      progressKept: (beats: number) => `已保留 ${beats} 次心搏進度`,
    },
    processing: {
      instruction: '訊號已確認',
      subtitle: '正在與你的個人基線進行融合計算...',
    },
    complete: {
      title: '精度已升級',
      uplift: (pct: number) => `信心度提升: +${pct}%`,
      beats: (count: number) => `有效心搏: ${count} 次`,
      tier: (tierName: string) => `精準等級: ${tierName}`,
      blendMode: {
        high_confidence_blend: '已與臉部基線高信心融合',
        signal_added: '訊號已加入基線',
        face_only: '已捕捉部分訊號',
      },
      cta: '完成',
    },
    retry: {
      title: '需要重新校準',
      body: '掃描被中斷或無法獲得足夠穩定的脈搏訊號。',
      cta: '重試',
      exit: '退出',
    },
    disclaimer: '此掃描協助優化你的個人基線。不提供醫療量測。所有處理皆在你的裝置上完成。',
  },
} as const;

export type FingerPrecisionCopy = typeof FINGER_PRECISION_COPY;
