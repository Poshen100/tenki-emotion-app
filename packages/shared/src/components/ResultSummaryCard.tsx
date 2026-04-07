/**
 * @module components/ResultSummaryCard
 * @description 結果頁總結卡片 — Edge Score + 決策洞察 + 行動按鈕。
 * Premium glassmorphism 設計，搭配 framer-motion 進場動畫。
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 1
 */

import { motion } from 'framer-motion';

interface ResultSummaryCardProps {
  /** Edge Score 0-100. */
  edgeScore: number;
  /** Zone 狀態文字 (e.g., 'Clear state', 'Neutral', 'Elevated strain'). */
  zoneLabel: string;
  /** 壓力指數 0-100. */
  stress: number;
  /** 恢復能量 0-100. */
  recovery: number;
  /** 決策洞察文字. */
  insight: string;
  /** 主要行動按鈕 callback. */
  onPrimaryAction?: () => void;
  /** 次要行動按鈕 callback. */
  onSecondaryAction?: () => void;
}

export default function ResultSummaryCard({
  edgeScore,
  zoneLabel,
  stress,
  recovery,
  insight,
  onPrimaryAction,
  onSecondaryAction,
}: ResultSummaryCardProps) {
  const rankText =
    edgeScore >= 90
      ? '頂尖 1%'
      : edgeScore >= 75
      ? '前 25%'
      : edgeScore >= 60
      ? '前 40%'
      : '需留意';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="bg-gradient-to-br from-slate-900/90 to-purple-900/60 backdrop-blur-xl border border-purple-400/30 rounded-3xl p-6 shadow-2xl"
    >
      {/* Score Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-5xl font-bold text-white tracking-tighter">
            Edge · {edgeScore}
          </span>
          <span className="ml-3 text-emerald-400 font-medium">{zoneLabel}</span>
        </div>
        <div className="text-right">
          <div className="text-xs text-purple-300">Decision Readiness</div>
          <div className="text-sm font-medium text-amber-300">{rankText}</div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-6">
        <div className="bg-white/5 rounded-2xl p-4">
          <div className="text-purple-200">壓力指數</div>
          <div className="text-3xl font-semibold text-white">{stress}/100</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4">
          <div className="text-purple-200">恢復能量</div>
          <div className="text-3xl font-semibold text-emerald-400">{recovery}/100</div>
        </div>
      </div>

      {/* Insight Card */}
      <div className="bg-white/10 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <div className="font-medium text-white mb-1">決策洞察</div>
            <p className="text-slate-200 leading-relaxed">{insight}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onPrimaryAction}
          className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-medium text-white transition"
        >
          執行呼吸校準
        </button>
        <button
          onClick={onSecondaryAction}
          className="flex-1 py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-medium text-white transition"
        >
          查看歷史紀錄
        </button>
      </div>
    </motion.div>
  );
}
