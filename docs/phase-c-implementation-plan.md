# Phase C — Mobile Frontend Implementation Plan

> Created: 2026-04-13
> Status: Active

## Overview

Initialize the React Native (Expo) mobile app in `apps/mobile/` with 5-tab navigation, Zustand stores, and screen stubs wired to the existing `packages/engine` + `packages/shared` design tokens.

## Architecture

```
apps/mobile/
├── app/                      # Expo Router (file-based)
│   ├── _layout.tsx           # Root layout (SafeArea + theme)
│   └── (tabs)/
│       ├── _layout.tsx       # Bottom tab navigator
│       ├── index.tsx         # Today (daily summary)
│       ├── scan.tsx          # Scan (FHZ entry point)
│       ├── session.tsx       # Session governance
│       ├── timeline.tsx      # History & trends
│       └── lab.tsx           # Growth tools & settings
├── components/
│   ├── EdgeScoreRing.tsx     # Circular score (Skia)
│   ├── ZoneBadge.tsx         # Zone indicator
│   └── ScanButton.tsx        # Primary CTA
├── stores/
│   ├── scan-store.ts
│   ├── user-store.ts
│   ├── session-store.ts
│   └── subscription-store.ts
├── theme/
│   └── index.ts              # RN-adapted design tokens
├── app.json
├── package.json
└── tsconfig.json
```

## Todo List (each = 1 commit)

1. `feat(mobile): initialize Expo project with TypeScript`
2. `feat(mobile): add design tokens theme adapter`
3. `feat(mobile): implement 5-tab bottom navigation`
4. `feat(mobile): create Today screen with Edge Score display`
5. `feat(mobile): create Scan screen with FHZ stubs`
6. `feat(mobile): create Session screen with state machine UI`
7. `feat(mobile): create Timeline screen`
8. `feat(mobile): create Lab screen`
9. `feat(mobile): set up Zustand stores`
10. `chore(mobile): verify build and update MEMORY.md`

## Tech Stack

- Expo SDK 52+ with Expo Router
- TypeScript strict
- Zustand (state management)
- @shopify/react-native-skia (Edge Score ring)
- react-native-reanimated v3 (animations)
- Design tokens from packages/shared/src/design-tokens.ts
