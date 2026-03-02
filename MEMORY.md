# MEMORY.md — Tenki Core AI Memory

> 此檔案由 AI 助手在每次 session 結束時更新。
> 人類不需要手動維護，但可以隨時修改或刪除任何條目。
> 每個 AI 工具（Antigravity / Claude / Claude Code）都應該讀取並更新此檔案。

---

## 專案決策紀錄

- [2026-02-25] 架構決策：選擇 React Native + Swift Hybrid，非純 Swift（原因：solo founder 效率、tenki-engine.js 零改動、雙平台）
- [2026-02-25] 後端選擇 Supabase（Auth + Postgres + RLS + Edge Functions）
- [2026-02-25] 訂閱計費選擇 RevenueCat（一次搞定 Apple + Google）
- [2026-02-26] FDCB v2.0 spec 完成，整合進 ANTIGRAVITY.md，TENKI 升級為「決策操作系統層」
- [2026-02-28] types.ts 通過 review — 含 SignalQuality 物件型別 + ScanResult + Garmin 對齊型別
- [2026-02-28] tei.ts 通過 review — 三維度加權（HR:0.30 / HRV:0.50 / RR:0.20）、Math.round、rrStd guard
- [2026-02-28] hrv.ts 通過 review — Garmin 對齊（RMSSD 基準、SDNN→RMSSD 轉換 *0.75、5 級 HrvStatus）
- [2026-02-28] stress.ts 通過 review — Garmin 刻度 0-100 對齊（HRV:0.60 / HR:0.40 權重、4 級 StressLevel）
- [2026-02-28] tei.test.ts / hrv.test.ts / stress.test.ts 全部通過 review
- [2026-03-01] baseline.ts + fusion.ts + sqi.ts 及對應測試已建立（Antigravity session）
- [2026-03-01] packages/fdcb/ 完整實作 — types, templates, timer, events, analytics + 單元測試（Antigravity session）
- [2026-03-01] packages/shared/ 建立 — design-tokens, subscription-tiers, zone-config（Antigravity session）
- [2026-03-01] docs/ 補齊 — PRD.md, TEI-SPEC.md, FDCB-SPEC.md（Antigravity session）
- [2026-03-01] 三檔治理系統（ANTIGRAVITY.md / MEMORY.md / RULES.md）正式建立
- [2026-03-01] rr.ts 實作完成 — RSA zero-crossing 演算法 + EWMA 平滑 + 4 級 RrStatus + baseline z-score
- [2026-03-01] **packages/engine/ 全模組完工** — types, tei, hrv, stress, baseline, fusion, sqi, rr 全部到位
- [2026-03-02] **packages/fdcb/ 品質審計完成** — Antigravity 全面審計 + 修正：
  - 新增 constants.ts（FDCB UI 常數、TEI Bucket 邊界、Typography tokens）
  - 全檔 JSDoc 補齊（types/templates/timer/events/analytics/constants）
  - **events.ts 關鍵修正**：addEvent() 加入 entry lock 攔截邏輯（Mancini FBD 前 60s ENTRY 被拒）
  - analytics.ts 修正 bucket key separator（`_` → `::` 避免模板 ID 含底線時 split 錯誤）
  - analytics.ts 新增 teiBucket 欄位到 SessionStats
  - timer.ts 新增 nextState() 狀態機轉換函式
  - templates.ts 新增 getTemplate/getTradingTemplates/getLifestyleTemplates 工具函式
  - types.ts 新增 AddEventResult interface（entry lock 回傳型別）
  - 測試全面重寫：templates 6/6 模板覆蓋 + timer 全函式覆蓋 + events entry lock 攔截測試
  - 新增 analytics.test.ts + constants.test.ts
  - ⚠️ 無法執行 npm test（Windows 無 Node.js），需安裝後驗證

## Founder 偏好（AI 應記住）

- Poshen 偏好先看架構全貌再進細節
- 溝通語言：繁體中文，代碼用英文
- 不喜歡過長的解釋，喜歡表格比較 + 明確結論
- 每次決策要考慮 solo founder 時間效率
- 重視 Garmin 數據對齊（用戶信任感）
- 習慣讓 Gemini/Antigravity 寫代碼、Claude 做 review 的雙 AI 工作流
- 喜歡明確的「貼這段給 Gemini」格式，不用自己重新整理指令
- Mac mini 尚未購買，目前只能做不需要 Mac 的 Phase 0 任務

## 已知地雷（AI 應避免）

- 不要動 apps/web/ 裡的任何檔案
- TEI 狀態區間已定案（PEAK 80-99 / OPTIMAL 55-79 / NEUTRAL 35-54 / DEGRADED 1-34），不要建議修改
- FDCB 模板規則（ANTIGRAVITY.md Section 5.4）已定案，6 個模板不要自行修改
- 星塵動效的「感覺」不能改，重建時保持 v25.8.2 的視覺體驗
- FDCB 是 OS Layer，永遠可見，不是隱藏功能

## 技術偏好與標準

- TypeScript strict mode，不允許 any
- 測試用 Jest + ts-jest
- 狀態管理用 Zustand（不用 Redux），FDCB 有獨立 store
- 常數要導出且具名（TEI_WEIGHTS, STRESS_WEIGHTS, STRESS_LEVELS, SOURCE_PRIORITY 等）
- PR 計算用 Math.round 而非 Math.floor（避免系統性偏低）
- 基線 guard 要檢查 sampleCount === 0 和所有 std === 0
- 每個 function 必須有 JSDoc
- engine/ 和 fdcb/ 測試覆蓋率 ≥ 90%

## Review 中發現過的常見問題（AI 應避免重蹈）

- Gemini 第一版 tei.ts 漏掉了 RR 呼吸率作為第三維度 → 已修正
- Gemini 第一版用 Math.floor 導致 PR 系統性偏低 → 改為 Math.round
- Gemini 第一版的「一致性測試」只是跑 100 次同樣輸入（純函數永遠一樣）→ 改為隨機擾動分布測試
- baseline guard 容易漏掉 rrStd === 0 的檢查
- [2026-03-02] FDCB events.ts 原版缺少 entry lock 攔截 → 已修正（addEvent 新增 template 參數）
- [2026-03-02] FDCB analytics.ts 用 `_` 做 key separator 會被含底線的模板 ID 搞壞 → 改為 `::`

## 上次 Session 結束點

- **日期**: 2026-03-02
- **最後完成**: 
  - `packages/engine/` — types ✅ tei ✅ hrv ✅ stress ✅ baseline ✅ fusion ✅ sqi ✅ rr ✅ **全部完工**
  - `packages/fdcb/` — types ✅ constants ✅ templates ✅ timer ✅ events ✅ analytics ✅ + 全測試 **品質審計完成**
  - `packages/shared/` — design-tokens ✅ subscription-tiers ✅ zone-config ✅
  - `docs/` — PRD ✅ TEI-SPEC ✅ FDCB-SPEC ✅
  - 三檔治理系統 — ANTIGRAVITY.md ✅ MEMORY.md ✅ RULES.md ✅
- **Review 狀態**:
  - ✅ 已 review：types.ts, tei.ts, hrv.ts, stress.ts (engine)
  - ⏳ 待 review：baseline.ts, fusion.ts, sqi.ts, rr.ts（engine）
  - ✅ 品質審計完成：packages/fdcb/ 全部檔案（已修正所有問題）
  - ⏳ 待 review：packages/shared/ 全部檔案
- **下一步**: 
  1. 安裝 Node.js → 執行 `npm test` 驗證 fdcb 全部測試通過
  2. Founder review engine 剩餘 4 模組（baseline/fusion/sqi/rr）
  3. Founder review shared/
  4. 等 Mac 到手 → Phase 1: Expo init + 相機掃描 MVP
- **Phase 0 進度**: ~98% (差 npm test 驗證 + shared review)

## 各 AI 工具的角色分工

| 工具 | 角色 | 目前使用狀態 |
|------|------|-------------|
| Antigravity (Gemini 2.5 Pro) | 主力代碼生成 | ✅ 使用中（Claude 額度用完時的替代） |
| Claude (claude.ai) | 架構決策、代碼 review、文件制定 | ✅ 使用中 |
| Claude Code | Terminal 任務、Expo init、Native Module | ❌ 等 Mac 到手 + 額度恢復 |

---

*Last updated: 2026-03-02 10:00*
*Updated by: Antigravity (FDCB quality audit + remediation session)*
