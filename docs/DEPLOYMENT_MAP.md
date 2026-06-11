# DEPLOYMENT_MAP.md

> Last updated: 2026-05-11
> Machine-readable companion: `docs/DEPLOYMENT_MAP.json`

## TL;DR

One domain, multiple routes. The mobile app has no public URL yet.

```
tenki-emotion-app.vercel.app
├── /                         → apps/web/          🔒 Legacy (frozen)
├── /v3/                      → apps/preview/v6/   ✨ v3 entry (founder's pick)
├── /preview/                 → apps/preview/      ⚠️ Baseline onboarding
├── /preview/v6/              → apps/preview/v6/   🔧 v6 Today (= /v3/, twin path)
├── /preview/scan-result.html → apps/preview/      ✅ Result page preview
└── /face-baseline/           → apps/mobile/dist/  📱 Real Face Baseline (Expo Web)
```

## Canonical URL Map

| URL | Source | Purpose | Status |
|-----|--------|---------|--------|
| `https://tenki-emotion-app.vercel.app/` | `apps/web/` | Legacy web prototype v51.1 | 🔒 Frozen (legacy 對外門牌) |
| `https://tenki-emotion-app.vercel.app/v3/` | `apps/preview/v6/index.html` | **v3 主入口** — Today + 5-Tab Nav + FDCB,v3 nomenclature 已對齊 (Clear/Neutral/Strain) | ✨ Founder 認可,active dev |
| `https://tenki-emotion-app.vercel.app/preview/` | `apps/preview/index.html` | Baseline onboarding 6-step flow (PPG 第一次掃描) | ⚠️ iOS OOM — hotfix branch ready |
| `https://tenki-emotion-app.vercel.app/preview/scan-result.html` | `apps/preview/scan-result.html` | Scan result page preview | ✅ Active |
| `https://tenki-emotion-app.vercel.app/preview/v6/` | `apps/preview/v6/index.html` | 同 `/v3/`,並列舊路徑保留以避免 share-link 失效 | 🔧 Active dev |
| `https://tenki-emotion-app.vercel.app/face-baseline/` | `apps/mobile/dist/index.html` | Real Face Baseline flow (Expo Web build) | 📱 Active (Phase 1 phone review) |

## Routing (vercel.json)

```json
{
  "/face-baseline/":     "apps/mobile/dist/index.html",
  "/face-baseline/(.*)": "apps/mobile/dist/$1",
  "/v3/":          "apps/preview/v6/index.html",
  "/v3/(.*)":      "apps/preview/v6/$1",
  "/preview/":     "apps/preview/index.html",
  "/preview/(.*)": "apps/preview/$1",
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
| `/preview/` | iOS Safari OOM crash during scan ceremony | Branch `hotfix/oom-ios-safari` — 6 fixes, pending merge |

## External URLs To Register

| URL | Owner | Source | Purpose | Status |
|-----|-------|--------|---------|--------|
| (none registered yet) | | | | |
