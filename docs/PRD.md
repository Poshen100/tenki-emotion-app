# Product Requirements Document (PRD)

> ⚠️ **本文件為精簡摘要。完整規格見 [ANTIGRAVITY.md](../ANTIGRAVITY.md) — Section 1 (Product Vision), Section 4 (Scan UX Flow), Section 8 (Development Phases)。**

## Product Vision
**Tenki Core** = 世界最精準、最專業、最普及的「情緒 + 健康風險指數」即時偵測 App。
- **消費者層面**：每日情緒與壓力自我管理工具
- **專業層面**：金融交易員、運動員、健康場景的生理風控引擎
- **品牌定位**：Decision Infrastructure for Traders — 多裝置、多模態的「生理 + 紀律引擎」
- **OS Layer 概念**：FDCB 讓 TENKI 成為貼在螢幕底部的「自我紀律引擎」
- **商業模式**：iOS / Android 訂閱制 App（Free / Retail $9 / Pro $22）
- **設計語言**：iPhone 級極簡、無縫感、星塵靈魂動效（形隨機能）

## Core Metric: TEI (Total Energy Index)
- TEI 是 **PR99 (1-99)**，不是絕對分數
- TEI_PR = 78 表示當下狀態優於個人歷史樣本中約 78% 的時刻
- 四級狀態區間：PEAK (80-99) / OPTIMAL (55-79) / NEUTRAL (35-54) / DEGRADED (1-34)
- 完整定義 → [ANTIGRAVITY.md §1.1-1.2](../ANTIGRAVITY.md)
- 工程規格 → [TEI-SPEC.md](./TEI-SPEC.md)

## UX Flow
- 暖機期 (0-2s): 平靜引導語 + 星塵動效
- Glimpse (2s): 初步 TEI 數字（粗略精度）
- Quick 快速檢測 (15s): 15 組心率，TEI 精度提升
- Standard 標準分析 (30s): 精度再提升
- Deep 深度分析 (60s): 最高精度，自動鎖定
- 分數過渡用 EWMA α=0.05（極慢，不跳動）
- 完整流程 → [ANTIGRAVITY.md §4](../ANTIGRAVITY.md)

## Key Deliverables
- Results Page 規格 → [RESULTS-PAGE-SPEC.md](./RESULTS-PAGE-SPEC.md)
- Camera UI 規格 → [CAMERA-UI-SPEC.md](./CAMERA-UI-SPEC.md)
- FDCB 規格 → [FDCB-SPEC.md](./FDCB-SPEC.md)
- 開發階段 → [ANTIGRAVITY.md §8](../ANTIGRAVITY.md)
