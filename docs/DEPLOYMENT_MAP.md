# DEPLOYMENT_MAP.md

Last updated: 2026-04-30

This file is the source of truth for TENKI deployment URLs, preview routes, and which code each URL actually represents.

Machine-readable companion: `docs/DEPLOYMENT_MAP.json`

## Fast read

- Active product direction: `apps/mobile`
- Confirmed public host in repo: `https://tenki-emotion-app.vercel.app`
- Important: the public Vercel site is currently routing to web/preview assets, not the Expo mobile app
- If an AI needs to understand "which URL is for what", read this file before guessing from folder names

## Canonical map

| URL / Route | Source in Repo | Purpose | Status | Use It For | Do Not Confuse With |
|---|---|---|---|---|---|
| `https://tenki-emotion-app.vercel.app/` | `apps/web/` via `vercel.json` | Legacy web prototype / browser experience | Confirmed in repo | Reviewing older web UI behavior and browser-only experiments | The active mobile app in `apps/mobile` |
| `https://tenki-emotion-app.vercel.app/preview/` | `apps/preview/index.html` via `vercel.json` | Baseline onboarding preview | Confirmed in repo | Reviewing onboarding flow and browser preview UX | A production mobile build |
| `https://tenki-emotion-app.vercel.app/preview/scan-result.html` | `apps/preview/scan-result.html` | Scan result preview page | Confirmed by route rule | Reviewing the result screen in isolation | The full app shell |
| `https://tenki-emotion-app.vercel.app/preview/v6/index.html` | `apps/preview/v6/index.html` | Archived/manual HTML preview snapshot with 5-tab concept | Confirmed by route rule and `MEMORY.md` | Comparing an older prototype snapshot | The current Expo Router implementation |
| No confirmed public URL in repo | `apps/mobile/` | Active Expo / React Native mobile app | Not publicly mapped here | Current product implementation work | The Vercel root site |

## Routing truth

The current Vercel routing is defined in `vercel.json`:

- `/` rewrites to `apps/web/index.html`
- `/preview/` rewrites to `apps/preview/index.html`
- `/preview/(.*)` rewrites to `apps/preview/$1`

So the public host is one domain with multiple routes, not multiple unrelated apps.

## Practical interpretation

### 1. Public root

`https://tenki-emotion-app.vercel.app/`

- Think of this as the legacy browser prototype
- Useful for older web flow review
- Not the same thing as the current Expo mobile implementation

### 2. Preview route

`https://tenki-emotion-app.vercel.app/preview/`

- Think of this as a focused browser preview lane
- Mainly for onboarding / scan preview experiments
- Better for reviewing specific UX slices than the root app

### 3. Preview subpages

Examples:

- `/preview/scan-result.html`
- `/preview/v6/index.html`

These are route-addressable static preview artifacts under `apps/preview/`.

## Mobile identity markers

The active mobile app metadata currently comes from `apps/mobile/app.json`.

| Field | Value | Meaning |
|---|---|---|
| Expo app name | `TENKI Core` | Human-facing mobile app name |
| Expo slug | `tenki-core` | Internal Expo project slug only; not a confirmed public Expo URL by itself |
| URL scheme | `tenki` | Deep-link / local app scheme |
| iOS bundle ID | `com.tenki.core` | Native iOS app identity |
| Android package | `com.tenki.core` | Native Android app identity |
| Web baseUrl experiment | `/mobile` | Internal Expo web setting, not a confirmed deployed public route |

## What is not confirmed yet

- No `eas.json` found in repo
- No Expo `owner` found in repo
- No Expo `projectId` found in repo
- No confirmed `expo.dev` share URL found in repo
- No TestFlight public invite link found in repo

This means an AI must not invent an Expo share URL or TestFlight URL from the slug alone.

## What each AI should assume

1. If the user says "the deployed site", ask whether they mean root `/` or `/preview/`
2. If the user says "the mobile app", do not assume there is a public deployed mobile URL yet
3. If work is about current product implementation, start from `apps/mobile`
4. If work is about reviewing an existing deployed browser UI, start from `apps/web` or `apps/preview` depending on the route

## URL intake protocol for future AI sessions

When the user pastes a new URL, classify it immediately using this order:

1. Does it belong to the known Vercel host `tenki-emotion-app.vercel.app`?
2. If yes, is it `/`, `/preview/`, or a deeper `/preview/...` artifact?
3. If no, is it one of:
   - Expo share URL
   - EAS build / update URL
   - TestFlight invite
   - Another Vercel preview deployment
   - Temporary demo domain
4. Record the answer in the `External URLs To Register` table below
5. Add source mapping only if it is truly known, not guessed

## Suggested labels

Use one of these labels in conversation and docs:

- `legacy web prototype`
- `preview route`
- `preview artifact`
- `active mobile implementation`
- `external build/distribution link`
- `archived snapshot`

## Collaboration rule

When adding a new deployment or preview URL, always record all four:

1. Full URL
2. Source folder/file in repo
3. Intended audience or review purpose
4. Whether it is legacy, active, or archived

## Known gaps

- This repo confirms one public Vercel host and its route structure
- If there are extra Vercel preview URLs, Expo share URLs, TestFlight links, or temporary demo domains outside the repo, they are not yet registered here
- Add any external-only URL below this section as soon as it becomes relevant

## External URLs To Register

| URL | Owner / Context | Source in Repo | Purpose | Status |
|---|---|---|---|---|
| `TBD` |  |  |  |  |
