# TASK.md

Last updated: 2026-05-14

## Current objective

Continue TENKI from the new Windows machine with the active focus on `apps/mobile` Phase C integration and polish.

## Environment ready

- Repo cloned at `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`
- Portable Node.js v20.19.2 (LTS Iron) installed and verified
- Root dependencies installed
- `packages/engine` dependencies installed — **19 suites, 259 tests ALL PASSING**
- `apps/mobile` dependencies installed
- `start_env.bat` updated with correct portable Node.js path

## Important startup rule

Before running npm/expo commands, use `start_env.bat` from repo root or set PATH in PowerShell:

```powershell
$env:PATH = "C:\Users\patron\.gemini\antigravity\scratch\nodejs\node-v20.19.2-win-x64;$env:PATH"
```

Reason: the default system `node.exe` on this machine may resolve to a WindowsApps stub and fail with `Access is denied`.

## Active app path

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

## Immediate next tasks

1. Launch Expo from `apps/mobile` and verify the 5-tab shell on this machine
2. Review current mobile routes, stores, and components against `packages/engine`, `domain`, and `packages/shared`
3. Decide the first concrete Phase C slice:
   - Today screen real data wiring
   - Scan flow real engine integration
   - Session flow real gate/state integration
   - Timeline/Lab polish
4. Update any remaining stale docs that still imply the repo root is the main app entry point

## Known notes

- `README.md` now points to the current mobile workflow and `docs/DEPLOYMENT_MAP.md`
- `apps/mobile/package-lock.json` changed from fresh install on 2026-05-14
- Use compliance-safe copy only
- Do not reintroduce TEI / PR99 naming; stay on Edge Score / Decision Edge / 3-zone vocabulary
- Deployment URL meaning is tracked in `docs/DEPLOYMENT_MAP.md`
