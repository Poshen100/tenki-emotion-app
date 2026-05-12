# TENKI Emotion App

Current collaboration note:

- Active implementation path: `apps/mobile`
- Public Vercel root: `https://tenki-emotion-app.vercel.app/`
- Deployment/source mapping: `docs/DEPLOYMENT_MAP.md`

## What is what

- `apps/mobile`
  Current Expo / React Native app and the main implementation track.
- `apps/web`
  Legacy browser prototype currently served from the Vercel root route.
- `apps/preview`
  Static preview artifacts currently served from the Vercel `/preview/` route.

## Local startup

### Mobile app

Use the portable Node.js environment first, then:

```powershell
cd apps\mobile
npm start
```

Optional:

```powershell
npm run web
npm run android
npm run ios
```

### Public route mapping

- `/` -> `apps/web/index.html`
- `/preview/` -> `apps/preview/index.html`
- `/preview/*` -> `apps/preview/*`

## Important note

Older instructions that say `npm run dev` at the repo root are no longer the primary path for current mobile work. Check `docs/DEPLOYMENT_MAP.md` first when deciding which app, route, or deployment a task refers to.

---

## Brand & Visual Identity

TENKI Core 的完整品牌規範位於 `brand/` 目錄：

- **`brand/LOGO-SPEC.md`** — Logo 系統 v1.0（287 行）
- **`brand/TAGLINE-SYSTEM.md`** — 三層 tagline 系統（Universal / Splash / Trader Mode）
- **`brand/logo/`** — SVG source files（pure wave / with circle / mono black）
- **`brand/icon-ios/`** — 12 個 iOS 標準尺寸
- **`brand/icon-android/`** — 6 個 Android density buckets
- **`brand/favicon/`** — Web favicon set
- **`brand/marketing/`** — Splash, OG card, App Store hero, Trader Mode unlock

Tagline 鎖定詞:
- 主標: `Read your inner weather. Find your turning point.`
- App Store subtitle: `Sense the shift.`
- Trader Mode: `Decision Infrastructure for Traders`

詳見 `brand/LOGO-SPEC.md` 和 `brand/TAGLINE-SYSTEM.md`。
