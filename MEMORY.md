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
- [2026-03-02] **packages/fdcb/ 品質審計完成** — entry lock 攔截、analytics key fix、JSDoc、constants、測試全面重寫
- [2026-03-02] **🎉 Phase 0 完工** — 全部模組測試通過：
  - Engine: 7 suites / 79 tests / 99.53% coverage ✅
  - FDCB: 5 suites / 96 tests / 97.93% coverage ✅
  - Shared: JSDoc 補齊，數據與 ANTIGRAVITY.md spec 完全一致 ✅
  - Node.js v22.14.0 portable 安裝於 Windows（MSI 需 admin，改用 zip）
- [2026-03-02] 新增 docs/CAMERA-UI-SPEC.md — 相機 UI 7 種設計模式，MVP 採用選項 1+6，v2.0 採用選項 3+5
- [2026-03-02] 新增 docs/RESULTS-PAGE-SPEC.md v4.2 — Results Page 完整工程規格書，設計已鎖定
- [2026-03-02] 新增 docs/assets/results-reference.png — 結果頁視覺參考圖
- [2026-03-02] **GitHub default branch 修正** — 發現 GitHub 顯示舊的 `master`（15 commits），所有新工作在 `main` 上（396 commits）。已在 GitHub Settings 將 default branch 從 `master` 切換為 `main`，repo 首頁現在正確顯示所有內容
- [2026-03-03] **Workspace clone 到新機器** — 從 GitHub clone 到 `C:\Users\reader\.gemini\antigravity\scratch\tenki-emotion-app`，驗證所有 packages/docs/tests 完整。Git: `C:\Users\reader\AppData\Local\Programs\Git\cmd\git.exe`（不在 PATH）

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
- Results Page 設計已鎖定（RESULTS-PAGE-SPEC.md v4.2 FINAL），不可自行發揮
- 不要用 SVG 畫環，用 Skia
- 不要用 Animated (legacy)，只用 Reanimated 3
- TEI 數字不從 0 爬升，首幀直接跳入附近值

## 技術偏好與標準

- TypeScript strict mode，不允許 any
- 測試用 Jest + ts-jest
- 狀態管理用 Zustand（不用 Redux），FDCB 有獨立 store
- 常數要導出且具名（TEI_WEIGHTS, STRESS_WEIGHTS, STRESS_LEVELS, SOURCE_PRIORITY 等）
- PR 計算用 Math.round 而非 Math.floor（避免系統性偏低）
- 基線 guard 要檢查 sampleCount === 0 和所有 std === 0
- 每個 function 必須有 JSDoc
- engine/ 和 fdcb/ 測試覆蓋率 ≥ 90%
- Node.js 安裝位置：`$env:LOCALAPPDATA\Programs\nodejs\node-v22.14.0-win-x64`（portable）
- 動畫用 Reanimated 3（不用 legacy Animated）
- 環形圖用 Skia（不用 SVG）
- EWMA α=0.05 極慢收斂
- 心跳同步 pulse period = 60/HR 秒

## Review 中發現過的常見問題（AI 應避免重蹈）

- Gemini 第一版 tei.ts 漏掉了 RR 呼吸率作為第三維度 → 已修正
- Gemini 第一版用 Math.floor 導致 PR 系統性偏低 → 改為 Math.round
- Gemini 第一版的「一致性測試」只是跑 100 次同樣輸入（純函數永遠一樣）→ 改為隨機擾動分布測試
- baseline guard 容易漏掉 rrStd === 0 的檢查
- [2026-03-02] FDCB events.ts 原版缺少 entry lock 攔截 → 已修正（addEvent 新增 template 參數）
- [2026-03-02] FDCB analytics.ts 用 `_` 做 key separator 會被含底線的模板 ID 搞壞 → 改為 `::`

## 上次 Session 結束點

- **日期**: 2026-03-04
- **最後完成**: Claude Opus 完整 repo 審計（zip 解壓 + TypeScript 編譯 + 137 項功能驗證）
  - TypeScript 編譯：engine ✅ / fdcb ✅ / shared ✅（strict mode, 零錯誤）
  - 功能驗證：137/137 PASSED, 0 FAILED
  - 修正事項：
    - `templates/cansilm-*.json` → 重命名為 `canslim-*.json`（拼寫修正）
    - `docs/PRD.md` 從 14 行 stub 展開為完整摘要 + ANTIGRAVITY.md 交叉引用
    - `docs/TEI-SPEC.md` 從 15 行 stub 展開為完整摘要 + 工程實作引用
    - `docs/FDCB-SPEC.md` 從 14 行 stub 展開為完整摘要 + 6 模板表格 + tier gating
    - `templates/README.md` 新增 legacy 標記（JSON 為舊版，正式版在 packages/fdcb/）
  - 發現事項：
    - core/ + integration/ + ui/ 是 Antigravity 擴充的 web prototype 2.0 模組（28+7+11 檔，~20K 行 JS），與 packages/ TypeScript 模組平行存在
    - templates/mancini-fbd.json 段落時間與 FDCB spec 不一致（JSON: 0/60/140/180 vs FDCB: 0/60/120/180）→ 已標記 JSON 為 legacy
    - node_modules 是 Windows 平台安裝的，含 vitest（但 Jest 配置在 package.json）
    - shared/ 沒有獨立測試（Phase 5 前要補）
- **Phase 0 狀態**: ✅ **100% 完工**（經 Claude Opus 獨立驗證）
- **下一步**: Phase 1（需要 Mac mini）
  1. 購買 Mac mini → 安裝 Xcode + Expo CLI
  2. Expo init + Router + 相機掃描 MVP
  3. 2 秒出粗略 TEI → 漸進精化
  4. 基礎 TEI 雙環 UI

## 各 AI 工具的角色分工

| 工具 | 角色 | 目前使用狀態 |
|------|------|-------------|
| Antigravity (Gemini 2.5 Pro) | 主力代碼生成 | ✅ 使用中 |
| Claude (claude.ai) | 架構決策、代碼 review、文件制定 | ✅ 使用中 |
| Claude Code | Terminal 任務、Expo init、Native Module | ❌ 等 Mac 到手 + 額度恢復 |

---

*Last updated: 2026-03-03 19:30*
*Updated by: Antigravity (Workspace clone 到新機器 + GitHub push)*
