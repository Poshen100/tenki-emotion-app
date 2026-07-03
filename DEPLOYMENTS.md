> ⛔ **SUPERSEDED (2026-07-03) — 部署路由的現行 canonical 是 `docs/DEPLOYMENT_MAP.md`(+ 同步的 `.json`)。**
> 本檔停留在 2026-05-05 的路由狀態。保留僅供考古。

# TENKI CORE — 部署網址總整理

> **最後更新**：2026-05-05
> **維護者**：Founder + AI Agents
> **部署平台**：Vercel（自動連結 GitHub `Poshen100/tenki-emotion-app`）

---

## ⚡ 快速查表（AI 請先讀這裡）

**只有 1 個網域**：`tenki-emotion-app.vercel.app`，不同路徑對應不同產品。

| 要看什麼 | 網址 | 原始碼 | 狀態 |
|---------|------|--------|------|
| **Baseline 掃描引導** | [`/preview/`](https://tenki-emotion-app.vercel.app/preview/) | `apps/preview/` | ⚠️ iOS OOM hotfix 待合併 |
| **v6 Today 主視覺** | [`/preview/v6/`](https://tenki-emotion-app.vercel.app/preview/v6/) | `apps/preview/v6/` | 🔧 開發中 |
| **掃描結果頁** | [`/preview/scan-result.html`](https://tenki-emotion-app.vercel.app/preview/scan-result.html) | `apps/preview/scan-result.html` | ✅ 可看 |
| **舊版 Web Prototype** | [`/`](https://tenki-emotion-app.vercel.app/) | `apps/web/` | 🔒 凍結，禁止修改 |
| **Mobile App (Expo)** | 尚無公開 URL | `apps/mobile/` | 🚧 開發中 |

---

## 路由規則 (vercel.json)

```
瀏覽器輸入                        實際對應的檔案
──────────────────────────────────────────────────
/                             →   apps/web/index.html           🔒 舊版
/preview/                     →   apps/preview/index.html       ⚠️ Baseline
/preview/v6/                  →   apps/preview/v6/index.html    🔧 v6 Today
/preview/scan-result.html     →   apps/preview/scan-result.html ✅ 結果頁
/preview/其他                  →   apps/preview/其他
```

---

## 各頁面詳情

### 1. `/preview/` — Baseline Onboarding ⚠️

- **檔案**：`apps/preview/index.html` + `styles.css` + `baseline-onboarding.js` + `camera-scan.js`
- **功能**：6 步驟 Baseline 掃描引導（Intro → Sensor → Readiness → Calibration Ceremony → Result → Next）
- **已知問題**：iOS Safari OOM 崩潰（`hotfix/oom-ios-safari` 分支已修好，等合併）
- **修法摘要**：backdrop-filter release、climax camera stop、particle defer/throttle、iOS canvas downsize

### 2. `/preview/v6/` — v6 Today 主視覺 ⭐

- **檔案**：`apps/preview/v6/index.html`（單一 147KB 全包檔）
- **功能**：Today 結果頁 + 5 Tab Nav + FDCB 浮動控制列
- **包含**：光譜環（Edge Score）、Coach 建議卡、4 Metric Card、Body Battery + ANS、Session 列表
- **狀態**：🔧 當前視覺開發重點

### 3. `/preview/scan-result.html` — 掃描結果頁

- **檔案**：`apps/preview/scan-result.html` + `scan-result.css` + `scan-result.js`
- **功能**：獨立掃描結果頁預覽

### 4. `/` — Web Prototype v51.1 🔒

- **檔案**：`apps/web/index.html` + 28 個 JS/CSS 模組
- **功能**：舊版 web prototype，含掃描模擬、結果頁、星塵粒子動效
- **狀態**：🔒 **凍結** — 不要修改

### 5. Mobile App 📱

- **檔案**：`apps/mobile/`（Expo / React Native）
- **App 名稱**：TENKI Core
- **Bundle ID**：`com.tenki.core`（iOS & Android）
- **狀態**：🚧 開發中，尚未部署公開 URL
- **Note**：v3 引擎（`packages/engine/`）已整合到 scan flow

---

## Git 分支 → 自動部署

| 分支 | 部署類型 | 說明 |
|------|---------|------|
| `main` | ✅ **Production** 自動 | 上面所有正式 URL |
| `hotfix/oom-ios-safari` | ✅ Preview 自動 | iOS OOM 6 修法，待合併 |
| 其他 `claude/*`、`feat/*` | ✅ Preview 自動 | Vercel Dashboard 或 GitHub PR 頁看 Preview URL |

> Preview URL 格式：`tenki-emotion-app-<hash>-poshen100s-projects.vercel.app`

---

## 🤖 AI Agent 規則

1. **使用者說「部署的網站」** → 問清楚是 `/` 還是 `/preview/` 還是 `/preview/v6/`
2. **不要改 `apps/web/`** — 那是凍結的 v51.1
3. **不要假設 Mobile App 有公開 URL** — 目前沒有
4. **v6 視覺開發** → 改 `apps/preview/v6/index.html`
5. **Baseline 掃描** → 改 `apps/preview/baseline-onboarding.js`
6. **Mobile App 開發** → 改 `apps/mobile/`
7. **引擎邏輯** → 改 `packages/engine/`，禁止引入 `any`
8. **新增部署 URL 時** → 同步更新本文件 + `docs/DEPLOYMENT_MAP.json`
