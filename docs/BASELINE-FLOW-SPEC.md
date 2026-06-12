# BASELINE-FLOW-SPEC.md — Onboarding Baseline Flow v2.0

> **Status**: v2.0 — Canonical. 2026-06-12 founder decision.
> **取代**: v1.1(2026-05-11) — 模型 A（雙基線必做）已廢棄，改為模型 B（臉基線為主）
> **Target surfaces**: `apps/preview/` (中介驗證 → Vercel `/preview/`) → `apps/mobile/` (Phase C 正式實作)
> **Forbidden surface**: `apps/web/`（凍結，本 spec 不在此修）
> **作者**: Founder decision 2026-06-12, written by AI pair

---

## 0. 核心決策：為什麼是模型 B

第一次掃描有三種可能流程模型：

| 模型 | 描述 | 摩擦 | 精準度 |
|------|------|------|--------|
| **A — 雙基線（廢棄）** | 手指基線 → 臉基線，都做 | 最高（~90 秒 + 兩種動作） | 最準（一次拿到校準偏移） |
| **B — 臉基線為主（採用）** | 臉基線必做，手指為可選精準升級 | 最低（一種動作，馬上能用） | 夠用，手指之後補做校準 |
| **C — 使用者選模態** | 選臉或選手指，另一種為後續可選校準 | 中等（多一個決策點） | 依選擇而定 |

**決策：採用模型 B。**

理由：
1. **同模態一致性就夠用**。「偏離你自己的基線」這個核心情緒訊號只需要同模態比較就成立——臉比臉基線在情緒偵測上當下就有效。
2. **手指是升級路徑，不是門檻**。手指 PPG 更適合定位為「想要更精準的 HRV/生理數據時的校準升級」，而不是擋在門口的必經步驟。
3. **普及優先**。模型 B 讓新手流程最短，符合 TENKI 「成為最普及的情緒偵測 App」的願景。
4. **智能提醒補校準**。之後用 smart prompt（適當時機建議補做手指校準）維持精準度提升的路徑，不讓它消失。

---

## 1. 模型 B 流程：Canonical Onboarding

### 1.1 標準流程（臉基線，必做）

```
Step 1: Intro
  ↓
Step 2: Face Permission（相機授權）
  ↓
Step 3: Readiness Check（臉部就位確認）
  ↓
Step 4: Face Baseline Scan（30–60 秒，臉部 rPPG）
  ↓  [ceremony stardust]
Step 5: Result（臉基線已建立）
  ↓
Step 6: Next（進入 Day-to-Day scan）
```

**手指從 onboarding 完整移除。** 手指不出現在步驟 1–6 的任何位置。

### 1.2 路由規則（防止舊 bug 重現）

- `scan` step 結束 → 100% 進入 `result` step
- `result` step 進入 `next` step → 100% 進入 Day-to-Day scan
- **Onboarding flow 是獨立 modal / full-screen stack**，不共用 FHZ 的 scan 路由
- Scan 結束的 callback 只能來自 onboarding state machine，**不掛全域 event bus**
- FHZ purpose 卡片頁（Baseline 條目）完全不被 onboarding 連到

### 1.3 Result Page（Step 5）

標題：**臉部基線已建立**
副標：「這是你的目前基線，不是好壞分數。TENKI 已經學到你的表情、心率和壓力的『正常範圍』」

三張 metric 卡：
- **心率節奏**（HR 範圍，bpm）
- **壓力指數**（HRV 相對值）
- **呼吸節奏**（RR）

Confidence badge + Primary CTA：**繼續**

---

## 2. 手指校準：升級路徑（不在 Onboarding）

手指從 onboarding 移出，改為**升級入口**，出現在以下位置：

### 2.1 觸發時機（Smart Prompt）

| 觸發條件 | 提示內容 | 位置 |
|---------|---------|------|
| 完成臉基線後第 3 天 | 「補做手指校準，讓精準度再提升」 | Today tab banner（可關閉） |
| 掃描結果 Confidence < 0.6 連續 3 次 | 「手指校準可以提升你的結果精準度」 | 結果頁下方（可關閉） |
| 使用者主動進入 Settings → Precision | 完整說明 + 啟動入口 | Settings 頁 |
| Day 7 re-engagement | 「想讓 TENKI 更了解你？補做 60 秒手指校準」 | 推播通知（經 compliance layer） |

### 2.2 手指校準流程（獨立，非 Onboarding）

```
入口（Settings / Banner）
  ↓
說明頁（為什麼 + 需要 60 秒）
  ↓
Finger Scan（60 秒）
  ↓
校準完成（「臉 + 手指交叉校準已啟用，精準度提升」）
```

完成後：
- `baseline.fingerCalibrated = true`
- 後續掃描自動使用交叉校準偏移
- Settings 顯示：「精準模式：臉 + 手指校準 ✓」

### 2.3 文案規則（手指相關）

| ✅ 用 | ❌ 禁 |
|------|------|
| 「精準升級」「校準補強」 | 「你需要手指才能用」「完整版需要手指」 |
| 「讓結果更準確」 | 「手指是必要的」「沒手指基線結果不準」 |
| 「可選的額外校準步驟」 | 任何讓使用者感覺臉基線不夠的語言 |

---

## 3. Scan 畫面 UX：Progressive Disclosure（繼承 v1.1）

> **Silent when good. Diagnostic when bad. Detailed on demand.**

### 3.1 狀態層

| 訊號狀態 | 主畫面顯示 |
|---------|----------|
| Quality green (`sqi ≥ 0.7`、coverage ≥ 0.8、stability ≥ 0.7) | 原樣：圓環 + 「穩定中…」+ 一條波形，顏色 cyan |
| Quality amber（任一維 0.4–0.7） | 圓環變 amber、底部展開 1 行「最弱維度」提示 |
| Quality red（任一維 < 0.4） | 圓環變 warm-red、**自動展開**三條品質條、相機縮圖出現右下角 |
| 使用者**長按圓環** 600ms | debug drawer（三條品質條 + 縮圖 + raw values） |

### 3.2 副標文案（zone transition 才換，240ms fade-swap）

**主標（永遠）**：`正在學習你的節奏`

| 條件 | 副標 | 顏色 token |
|------|------|------------|
| coverage < 0.5 | 臉沒有對到鏡頭 | warn-red |
| brightness < threshold | 光線太暗，靠近光源 | warn-amber |
| brightness > threshold | 光線太強，稍微遮一下 | warn-amber |
| stability < 0.5 | 放輕鬆，頭別動 | warn-amber |
| sqi 上升中 | 正在對焦 | cyan |
| sqi ≥ 0.7、stability ≥ 0.7 | 穩定中⋯ | cyan |
| 倒數最後 5 秒 | 快好了 | cyan-bright |

> 注意：手指版文案（「手指沒蓋滿鏡頭」）僅用於手指校準流程，不出現在臉基線流程。

### 3.3 相機縮圖規範（臉部版）

- 預設隱藏；左下角 2×2 dp 呼吸點（liveness indicator）
- 訊號 red 時呼吸點 spring 展開為 96×96 縮圖（圓角 16）
- 狀態徽章：`未偵測到臉` / `光線不足` / `動太多`
- 點擊縮圖 → 放大到 viewport 70% 寬
- Green/amber 不自動展開；長按圓環 debug drawer 觸發時一併拉出

### 3.4 三條品質條（drawer）

```
Coverage     ████████░░░░  64%
Stability    ██████████░░  82%
Signal       ██████░░░░░░  47%
```

- 漸層 stops：`--zone-strain` → `--zone-neutral` → `--zone-clear`
- 每條右側百分比 + 底部 micro-copy
- Drawer 用 spring 從圓環區域上推，不擋圓環

---

## 4. 實作位置（v3 對齊）

| 層 | 職責 | 檔案路徑 |
|----|------|----------|
| Domain | 品質維度狀態機定義、狀態 → 文案 mapping | `domain/src/policies/baseline-quality-policy.ts` |
| Engine | coverage / stability / SQI 計算（已存在） | `packages/engine/src/baseline/signal-quality-gate.ts` |
| Shared copy | 狀態文案 + drawer 文案 + 手指升級文案 | `packages/shared/src/copy/baseline-onboarding.ts` |
| Mobile UI | 圓環（Skia）、相機縮圖、drawer、文案綁定 | `apps/mobile/app/baseline/scan.tsx` |
| Preview | 同上 vanilla（快速 founder 驗證） | `apps/preview/baseline-onboarding.js` |
| Settings | 手指校準升級入口 | `apps/mobile/app/settings/precision.tsx` |

---

## 5. 驗收條件

### Onboarding（必須）

- [ ] Onboarding 完整流程 6 步，**不出現手指動作**
- [ ] Step 4 scan 結束 100% 進入 Step 5 result
- [ ] Step 5 顯示：臉部基線已建立 + HR / HRV / RR 三張卡 + confidence badge
- [ ] Step 5 CTA「繼續」→ 進 Step 6，不進 FHZ
- [ ] Step 6 完成 → 進入 Day-to-Day scan（`/v3/` Today）

### 手指校準升級（必須）

- [ ] Onboarding 完全不提及手指校準
- [ ] Day 3 smart prompt 出現在 Today tab（可關閉，不強迫）
- [ ] Settings → Precision 有手指校準啟動入口
- [ ] 手指校準完成後 `baseline.fingerCalibrated = true`，Settings 顯示「精準模式 ✓」

### 文案（必須）

- [ ] 手指校準文案全部通過 compliance layer（無醫療 / 金融語言）
- [ ] 不出現任何讓使用者感覺「臉基線不夠用」的語言

---

## 6. Out of Scope（本 spec 不處理）

- FHZ purposes 頁本身的去留（獨立 spec）
- Result page 的視覺改版（`docs/RESULTS-PAGE-SPEC.md`）
- 3-min long baseline mode（產品決策，等 founder）
- Ceremony 時間軸細節（見 `docs/BASELINE-INTEGRATION-PLAN.md`）
- Haptic / native audio（Phase B，mobile only）

---

## 7. Changelog

| 版本 | 日期 | 內容 |
|------|------|------|
| v2.0 | 2026-06-12 | **採用模型 B**：臉基線為主，手指改為可選升級路徑；完整改寫 §0–6 |
| v1.1 | 2026-05-11 | 模型 A（雙基線）：ceremony routing bug + progressive disclosure spec |

---

*— END OF BASELINE-FLOW-SPEC v2.0 —*
