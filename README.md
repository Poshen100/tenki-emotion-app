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
