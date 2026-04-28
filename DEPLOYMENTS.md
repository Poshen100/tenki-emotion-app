# TENKI CORE — 部署網址對照表

> **最後更新**：2026-04-28
> **維護者**：Founder + AI Agents
> **部署平台**：Vercel（連結 GitHub repo `Poshen100/tenki-emotion-app`）

---

## 快速對照表

| 網址 | 內容 | 分支 | 用途 |
|------|------|------|------|
| [tenki-emotion-app.vercel.app/](https://tenki-emotion-app.vercel.app/) | `apps/web/` — v51.1 Web Prototype | `main` | 舊版 Web Prototype（含掃描、結果頁、星塵動效），**不要修改** |
| [tenki-emotion-app.vercel.app/preview/](https://tenki-emotion-app.vercel.app/preview/) | `apps/preview/index.html` — Baseline Onboarding | `main` | Baseline 掃描 Onboarding 6 步驟 UX Preview |
| [tenki-emotion-app.vercel.app/preview/v6/](https://tenki-emotion-app.vercel.app/preview/v6/) | `apps/preview/v6/index.html` — Today 主視覺 + 5 Tab | `main` | **v6 Today 結果頁**：光譜環 + 5 Tab Nav + FDCB |

> [!NOTE]
> Vercel 會自動對每個 push 到非 `main` 的分支建立 **Preview Deployment**。
> Preview URL 格式：`tenki-emotion-app-<hash>-poshen100s-projects.vercel.app`
> 在 GitHub PR 頁面或 Vercel Dashboard 可以找到該分支的 Preview URL。

---

## 目錄結構 ↔ 路由對應

```
vercel.json rewrites:
───────────────────────────────────
/                 → apps/web/index.html         ← v51.1 legacy prototype
/preview/         → apps/preview/index.html     ← baseline onboarding
/preview/v6/      → apps/preview/v6/index.html  ← ★ v6 Today 主視覺 (當前開發重點)
/mobile/          → apps/mobile/dist-web/       ← Expo Web build (未來)
```

---

## 各頁面說明

### 1. `/` — Web Prototype v51.1
- **檔案**：`apps/web/index.html` + 28 個 JS/CSS 模組
- **功能**：完整的舊版 web prototype，含掃描模擬、結果頁、星塵粒子動效
- **狀態**：🔒 **凍結** — 不要修改（ANTIGRAVITY.md Section 17.1 Rule 3）
- **手機可看**：✅ 有 viewport-fit=cover，支援 PWA 模式

### 2. `/preview/` — Baseline Onboarding Preview
- **檔案**：`apps/preview/index.html` + `styles.css` + `baseline-onboarding.js`
- **功能**：6 步驟 Baseline 掃描引導 UX（Intro → Sensor → Readiness → Calibration → Result → Next）
- **狀態**：✅ Phase B 完成，可供 review

### 3. `/preview/v6/` — v6 Today 主視覺 ⭐
- **檔案**：`apps/preview/v6/index.html`（單一 147KB 全包檔）
- **功能**：Today 結果頁 + 5 Tab Nav + FDCB 浮動控制列
- **包含**：光譜環（Edge Score）、Coach 建議卡、4 個 Metric Card（HR/HRV/RR/Stress）、Body Battery + ANS、Session 列表、Timeline 圖表、Lab 工具
- **狀態**：🔧 **當前開發重點** — 正在此分支調整視覺

### 4. `/mobile/` — Expo Web Build（未來）
- **檔案**：`apps/mobile/dist-web/`
- **狀態**：❌ 尚未建置（Phase C）

---

## 分支部署策略

| 分支 | Vercel 部署 | 說明 |
|------|------------|------|
| `main` | ✅ Production（自動） | 上面列的所有 URL |
| `claude/*` | ✅ Preview（自動） | 每次 push 都會產生 Preview URL，在 GitHub PR 或 Vercel Dashboard 查看 |
| `feat/*` | ✅ Preview（自動） | 同上 |

---

## AI Agent 注意事項

1. **要看最新修改**：去 Vercel Dashboard 找該分支的 Preview URL，或合併到 `main` 後看 Production URL
2. **不要改 `apps/web/`**：那是凍結的 v51.1 prototype
3. **v6 開發在 `apps/preview/v6/index.html`**：單一檔案，147KB，包含所有 HTML/CSS/JS
4. **手機檢視**：直接用上面的 Vercel URL 在手機瀏覽器打開即可
