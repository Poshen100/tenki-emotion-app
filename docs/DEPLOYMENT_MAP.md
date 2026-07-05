# DEPLOYMENT_MAP.md

> Last updated: 2026-07-05
> Machine-readable companion: `docs/DEPLOYMENT_MAP.json`
> ⚠️ **改本檔必須同步 `DEPLOYMENT_MAP.json`（反之亦然）** — f21bcd2 曾只改 .md 漏改 .json，漂移了三天才被健檢抓到。

## 🚀 白話版（founder 日常只要記這段）

**主規則：手機上的固定網址，只顯示已 merge 進 `main` 的東西。**

1. 手機看效果開這兩個：
   - `https://tenki-emotion-app.vercel.app/v3/` → 最新 v3 UI（Today + 5-Tab）
   - `https://tenki-emotion-app.vercel.app/preview/` → Soul Scan 臉部基線建立（Face ID 式，真實前鏡頭）
   - `https://tenki-emotion-app.vercel.app/story/` → 高質感滾動式敘事 landing page（Hero/Story/Dashboard 預覽，CTA 連回 /preview/ 與 /v3/）🔒 Hero locked（見 SYSTEM.md §8）
2. 根網址 `/` 會 307 redirect 到 `/story/`（Hero 正式門面，隨 `main` 更新）。舊版 apps/web 已退居門面，深層路徑仍由 catch-all `/(.*)` 服務。
3. `apps/mobile` 在任何網址都看不到（RN app，要等實機/TestFlight）。想在手機瀏覽器看到的東西，做在 `apps/preview/`。
4. 分工：**Antigravity（桌機）** 在 `feat/*` 分支做功能畫面 → **Claude Code（手機/雲端）** 開 PR、跑驗證、merge → merge 後 1-2 分鐘固定網址更新。
5. merge 前想先看：手機打開 GitHub PR 頁，Vercel bot 留言裡就有該分支的 preview 連結，點了即看。
6. CI（lint + typecheck + 全部測試）紅燈就不要 merge。

## TL;DR

One domain, multiple routes. The mobile app has no public URL yet.

```
tenki-emotion-app.vercel.app
├── /                         → 307 redirect → /story/  ⭐ Hero front door (apps/web demoted)
├── /v3/                      → apps/preview/v6/       ✨ v3 entry (founder's pick)
├── /preview/                 → apps/preview/soul-enroll.html  ✨ Soul Scan front door (live camera)
├── /preview/v6/              → apps/preview/v6/       🔧 v6 Today (= /v3/, twin path)
├── /preview/soul-enroll.html → apps/preview/          ✨ Soul Scan (direct path, = /preview/)
├── /story/                   → apps/preview/story.html ✨ Cinematic scroll-narrative landing page 🔒 Hero locked
```

## Canonical URL Map

| URL | Source | Purpose | Status |
|-----|--------|---------|--------|
| `https://tenki-emotion-app.vercel.app/` | 307 → `/story/` | **Hero 正式門面** — root 導向 `/story/` 的 Hero（Read your edge…）。apps/web 已退居，深層路徑仍由 catch-all 服務 | ⭐ Front door |
| `https://tenki-emotion-app.vercel.app/` (legacy) | `apps/web/` | 舊 web prototype v51.1，現僅由 `/(.*)` catch-all 服務深層路徑（root 已導向 Hero） | 🔒 Frozen |
| `https://tenki-emotion-app.vercel.app/v3/` | `apps/preview/v6/index.html` | **v3 主入口** — Today + 5-Tab Nav + FDCB,v3 nomenclature 已對齊 (Clear/Neutral/Strain) | ✨ Founder 認可,active dev |
| `https://tenki-emotion-app.vercel.app/preview/` | `apps/preview/soul-enroll.html` | **Soul Scan 臉部基線建立門面**（Face ID 式，真實前鏡頭 + live gates，對應 mobile FSM） | ✨ Front door, active dev |
| `https://tenki-emotion-app.vercel.app/preview/soul-enroll.html` | `apps/preview/soul-enroll.html` | Soul Scan 直接路徑（內容同 `/preview/` 門面） | ✨ Active dev |
| `https://tenki-emotion-app.vercel.app/preview/v6/` | `apps/preview/v6/index.html` | 同 `/v3/`,並列舊路徑保留以避免 share-link 失效 | 🔧 Active dev |
| `https://tenki-emotion-app.vercel.app/preview/brand/` | `apps/preview/brand/index.html` | TENKI 品牌標誌（Resonance Ensō）預覽 — variants / lockups / 使用規則 | ✅ Active |
| `https://tenki-emotion-app.vercel.app/brand/*` | `brand/`（repo 根目錄） | 品牌靜態資產直達（logo/icon/favicon/marketing，vercel.json rewrites） | ✅ Active |
| `https://tenki-emotion-app.vercel.app/story/` | `apps/preview/story.html` | 高質感滾動式敘事 landing page — Hero 進場（🔒 Hero locked，見 SYSTEM.md §8）、ScrollTrigger 產品故事、Login→Dashboard 轉場、嵌入 `/v3/` 的 Dashboard 預覽,CTA 連回 `/preview/` 與 `/v3/` | ✨ Active dev · 🔒 Hero locked |

## Routing (vercel.json)

```json
{
  "/v3/":          "apps/preview/v6/index.html",
  "/v3/(.*)":      "apps/preview/v6/$1",
  "/story/":        "apps/preview/story.html",
  "/story/(.*)":    "apps/preview/$1",
  "/preview/":      "apps/preview/soul-enroll.html",
  "/preview/(.*)":  "apps/preview/$1",
  "/":             "apps/web/index.html",
  "/(.*)":         "apps/web/$1"
}
```

The catch-all `/*` → `apps/web/$1` handles legacy asset loading.

### Why `/v3/` is a shadow route (not root yet)

2026-05-11:Founder review 確認 `apps/preview/v6/` 是 v3 設計方向的最佳載體,
根 URL `/` 現在 307 redirect 到 `/story/`(Hero 門面);apps/web 深層 share link 仍由 catch-all `/(.*)` 服務,不會失效。
`/v3/` 作為**影子入口**並列存在 1-2 週,確認 v6 沒有遺漏功能後,再獨立 commit
把 `/` 切到 v6。不切根路由是最小不可逆操作策略。

## Mobile App Identity

| Field | Value |
|-------|-------|
| Name | TENKI Core |
| Slug | tenki-core |
| iOS Bundle ID | com.tenki.core |
| Android Package | com.tenki.core |
| URL Scheme | tenki:// |
| Public URL | (retired 2026-07-03 — Expo Web 審查載具退場，無公開網址) |
| EAS / TestFlight | **Not configured** |

## Branch → Deploy Strategy

| Branch Pattern | Vercel Behavior |
|---------------|----------------|
| `main` | Production auto-deploy (all URLs above) |
| `hotfix/*`, `claude/*`, `feat/*` | Preview auto-deploy (unique URL per push) |

Preview URL format: `tenki-emotion-app-<hash>-poshen10s-projects.vercel.app`

## AI Collaboration Rules

1. **"The deployed site"** → ask which route: `/`, `/preview/`, or `/preview/v6/`
2. **Do not modify** `apps/web/` — it's frozen
3. **Do not assume** a public mobile URL exists
4. **Do not invent** Expo share URLs or TestFlight links from the slug
5. **When adding a new URL** → update both this file and `DEPLOYMENT_MAP.json`

## Known Issues

| Route | Issue | Fix |
|-------|-------|-----|
| (none) | | |

## External URLs To Register

| URL | Owner | Source | Purpose | Status |
|-----|-------|--------|---------|--------|
| (none registered yet) | | | | |
