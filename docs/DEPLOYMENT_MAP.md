# DEPLOYMENT_MAP.md

> Last updated: 2026-06-28
> Machine-readable companion: `docs/DEPLOYMENT_MAP.json`

## 🚀 白話版（founder 日常只要記這段）

**主規則：手機上的固定網址，只顯示已 merge 進 `main` 的東西。**

1. 手機看效果開這兩個：
   - `https://tenki-emotion-app.vercel.app/v3/` → 最新 v3 UI（Today + 5-Tab）
   - `https://tenki-emotion-app.vercel.app/preview/` → Soul Scan 臉部基線建立（Face ID 式，真實前鏡頭）
   - `https://tenki-emotion-app.vercel.app/preview/finger/` → 舊的 finger PPG baseline onboarding（降為校準層）
   - `https://tenki-emotion-app.vercel.app/story/` → 高質感滾動式敘事 landing page（Hero/Story/Dashboard 預覽，CTA 連回 /preview/ 與 /v3/）
2. 根網址 `/` 永遠是凍結舊版（apps/web），不會更新 — 別用它判斷進度。
3. `apps/mobile` 在任何網址都看不到（RN app，要等實機/TestFlight）。想在手機瀏覽器看到的東西，做在 `apps/preview/`。
4. 分工：**Antigravity（桌機）** 在 `feat/*` 分支做功能畫面 → **Claude Code（手機/雲端）** 開 PR、跑驗證、merge → merge 後 1-2 分鐘固定網址更新。
5. merge 前想先看：手機打開 GitHub PR 頁，Vercel bot 留言裡就有該分支的 preview 連結，點了即看。
6. CI（lint + typecheck + 全部測試）紅燈就不要 merge。

## TL;DR

One domain, multiple routes. The mobile app has no public URL yet.

```
tenki-emotion-app.vercel.app
├── /                         → apps/web/              🔒 Legacy (frozen)
├── /v3/                      → apps/preview/v6/       ✨ v3 entry (founder's pick)
├── /preview/                 → apps/preview/soul-enroll.html  ✨ Soul Scan front door (live camera)
├── /preview/finger/          → apps/preview/index.html        ⚠️ Finger PPG onboarding (calibration layer)
├── /preview/v6/              → apps/preview/v6/       🔧 v6 Today (= /v3/, twin path)
├── /preview/scan-result.html → apps/preview/          ✅ Result page preview
├── /preview/soul-enroll.html → apps/preview/          ✨ Soul Scan (direct path, = /preview/)
├── /story/                   → apps/preview/story.html ✨ Cinematic scroll-narrative landing page
└── /face-baseline/           → apps/mobile/dist/      📱 Real Face Baseline (Expo Web)
```

## Canonical URL Map

| URL | Source | Purpose | Status |
|-----|--------|---------|--------|
| `https://tenki-emotion-app.vercel.app/` | `apps/web/` | Legacy web prototype v51.1 | 🔒 Frozen (legacy 對外門牌) |
| `https://tenki-emotion-app.vercel.app/v3/` | `apps/preview/v6/index.html` | **v3 主入口** — Today + 5-Tab Nav + FDCB,v3 nomenclature 已對齊 (Clear/Neutral/Strain) | ✨ Founder 認可,active dev |
| `https://tenki-emotion-app.vercel.app/preview/` | `apps/preview/soul-enroll.html` | **Soul Scan 臉部基線建立門面**（Face ID 式，真實前鏡頭 + live gates，對應 mobile FSM） | ✨ Front door, active dev |
| `https://tenki-emotion-app.vercel.app/preview/finger/` | `apps/preview/index.html` | Finger PPG baseline onboarding 6-step flow（降為校準層，原 `/preview/` 根） | ⚠️ iOS OOM — hotfix branch ready |
| `https://tenki-emotion-app.vercel.app/preview/scan-result.html` | `apps/preview/scan-result.html` | Scan result page preview | ✅ Active |
| `https://tenki-emotion-app.vercel.app/preview/soul-enroll.html` | `apps/preview/soul-enroll.html` | Soul Scan 直接路徑（內容同 `/preview/` 門面） | ✨ Active dev |
| `https://tenki-emotion-app.vercel.app/preview/v6/` | `apps/preview/v6/index.html` | 同 `/v3/`,並列舊路徑保留以避免 share-link 失效 | 🔧 Active dev |
| `https://tenki-emotion-app.vercel.app/preview/brand/` | `apps/preview/brand/index.html` | TENKI 品牌標誌（Resonance Ensō）預覽 — variants / lockups / 使用規則 | ✅ Active |
| `https://tenki-emotion-app.vercel.app/story/` | `apps/preview/story.html` | 高質感滾動式敘事 landing page — Hero 進場、ScrollTrigger 產品故事、Login→Dashboard 轉場、嵌入 `/v3/` 的 Dashboard 預覽,CTA 連回 `/preview/` 與 `/v3/` | ✨ Active dev |
| `https://tenki-emotion-app.vercel.app/face-baseline/` | `apps/mobile/dist/index.html` | Real Face Baseline flow (Expo Web build) | 📱 Active (Phase 1 phone review) |

## Routing (vercel.json)

```json
{
  "/face-baseline/":     "apps/mobile/dist/index.html",
  "/face-baseline/(.*)": "apps/mobile/dist/$1",
  "/v3/":          "apps/preview/v6/index.html",
  "/v3/(.*)":      "apps/preview/v6/$1",
  "/story/":        "apps/preview/story.html",
  "/story/(.*)":    "apps/preview/$1",
  "/preview/":      "apps/preview/soul-enroll.html",
  "/preview/finger": "apps/preview/index.html",
  "/preview/(.*)":  "apps/preview/$1",
  "/":             "apps/web/index.html",
  "/(.*)":         "apps/web/$1"
}
```

The catch-all `/*` → `apps/web/$1` handles legacy asset loading.

### Why `/v3/` is a shadow route (not root yet)

2026-05-11:Founder review 確認 `apps/preview/v6/` 是 v3 設計方向的最佳載體,
但根 URL `/` 仍指 `apps/web/`(v51.1 legacy)以避免既有 share link 失效。
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
| Public URL | `https://tenki-emotion-app.vercel.app/face-baseline/` |
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
| `/preview/finger/` | iOS Safari OOM crash during finger scan ceremony | Branch `hotfix/oom-ios-safari` — 6 fixes, pending merge |

## External URLs To Register

| URL | Owner | Source | Purpose | Status |
|-----|-------|--------|---------|--------|
| (none registered yet) | | | | |
