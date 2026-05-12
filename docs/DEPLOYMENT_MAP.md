# DEPLOYMENT_MAP.md

> Last updated: 2026-05-05
> Machine-readable companion: `docs/DEPLOYMENT_MAP.json`

## TL;DR

One domain, multiple routes. The mobile app has no public URL yet.

```
tenki-emotion-app.vercel.app
├── /                         → apps/web/          🔒 Legacy (frozen)
├── /preview/                 → apps/preview/      ⚠️ Baseline onboarding
├── /preview/v6/              → apps/preview/v6/   🔧 v6 Today (active dev)
├── /preview/scan-result.html → apps/preview/      ✅ Result page preview
└── /mobile/                  → apps/mobile/       ❌ Not built yet
```

## Canonical URL Map

| URL | Source | Purpose | Status |
|-----|--------|---------|--------|
| `https://tenki-emotion-app.vercel.app/` | `apps/web/` | Legacy web prototype v51.1 | 🔒 Frozen |
| `https://tenki-emotion-app.vercel.app/preview/` | `apps/preview/index.html` | Baseline onboarding 6-step flow | ⚠️ iOS OOM — hotfix branch ready |
| `https://tenki-emotion-app.vercel.app/preview/scan-result.html` | `apps/preview/scan-result.html` | Scan result page preview | ✅ Active |
| `https://tenki-emotion-app.vercel.app/preview/v6/` | `apps/preview/v6/index.html` | v6 Today + 5 Tab Nav + FDCB | 🔧 Active dev |
| (none) | `apps/mobile/` | Expo/RN mobile app (iOS + Android) | 🚧 No public URL |

## Routing (vercel.json)

```json
{
  "/":             "apps/web/index.html",
  "/preview/":     "apps/preview/index.html",
  "/preview/*":    "apps/preview/*"
}
```

The catch-all `/*` → `apps/web/$1` handles legacy asset loading.

## Mobile App Identity

| Field | Value |
|-------|-------|
| Name | TENKI Core |
| Slug | tenki-core |
| iOS Bundle ID | com.tenki.core |
| Android Package | com.tenki.core |
| URL Scheme | tenki:// |
| Public URL | **None confirmed** |
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
