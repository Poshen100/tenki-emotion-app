# Garmin Body Battery — Real Integration Roadmap

> Status: **planning**. The Energy · 體能 (Body Battery) card in `apps/preview/v6/` is a clearly-labelled
> *shaped demo* today. This doc is the phased plan to make it real, and the prerequisites the founder must
> start. Aligns with CLAUDE.md: **Local-first + Cloud-minimal, raw biometric never leaves the device.**

## The one hard truth (read first)

**Body Battery is a Garmin-proprietary metric. It is NOT exposed through Apple HealthKit or Android Health
Connect.** Garmin writes steps / heart rate / sleep into Apple Health, but **not** Body Battery, Stress, or
Pulse Ox. So:

- You **cannot** get real Body Battery from HealthKit. The **only** source is the **Garmin Health API**.
- The Garmin Health API is **B2B and approval-gated** (you apply as a developer/partner; approval can take
  **weeks**). It is **server-to-server**: after a user OAuths, Garmin **pushes** their daily wellness
  (incl. Body Battery) to **your backend webhook** ("Ping"/"Push" service).
- This repo currently has **no backend** — it's static Vercel (preview/web) + a local-first Expo app, all
  synthetic data today. So real Body Battery requires building a small backend.

Because of that gate, we **phase** the work: do everything that needs no Garmin approval first, and keep the
Body Battery demo until the partnership + backend land.

---

## Phase 0 — Prerequisites (founder / external — these gate Phase 2)

1. **Apply for Garmin Health API access** at the Garmin Developer Program (Health API, not Connect IQ).
   This is the long-lead item — start now. You receive a `consumer key` / `consumer secret` on approval.
2. **Decide the backend host.** Recommendation: **Vercel Functions** (the repo already deploys on Vercel) +
   **Supabase** (Postgres) for the user-token store. Minimal, cheap, fits cloud-minimal.
3. **Confirm the privacy stance** for derived metrics: we will store only the **derived Body Battery value
   (0–100) + timestamp** server-side (to receive Garmin's push), and only the derived value reaches the
   device. **No raw samples** anywhere (the domain schema already rejects `raw*` keys).

Nothing in Phases 1–3 can ship real Body Battery until Phase 0 #1 is approved.

---

## Phase 1 — Achievable NOW (no Garmin approval): real HealthKit / Health Connect

Delivers real wearable signal into the engine immediately, without waiting on Garmin.

- **Mobile (`apps/mobile`):** add `react-native-health` (iOS HealthKit) / Health Connect (Android) and read
  **HR, HRV (RMSSD; or SDNN→RMSSD), sleep duration/quality, steps**. (If the user syncs Garmin Connect →
  Apple Health, these specific metrics *do* flow through — just not Body Battery.)
- **Engine wiring (already has the slot):** feed sleep into the existing `SleepRecoveryInput`
  (`packages/engine/src/common/types.ts`); harmonise HRV with the existing `harmonizeHrv` (SDNN→RMSSD,
  `packages/engine/src/biometric/hrv.ts`). No new Edge factor needed yet.
- **UI:** make **Lab → Devices** real (`apps/mobile/app/(tabs)/lab.tsx:81` is a placeholder with
  `onPress: undefined`) — a connect/permission flow + connection status.
- **Body Battery stays the shaped demo** (clearly labelled), unchanged, until Phase 2.

Deliverable: HealthKit/Health Connect HR/HRV/sleep visibly influence the Edge Score on a real device.

---

## Phase 2 — Real Body Battery (after Phase 0 #1 approval): backend + OAuth + webhook

- **Backend (new):**
  - `api/garmin/oauth` (Vercel Function) — OAuth token exchange; store the user's Garmin tokens in Supabase.
  - `api/garmin/webhook` (Vercel Function) — receive Garmin **Ping/Push** wellness payloads; extract the
    **derived Body Battery (0–100) + timestamp**; upsert into Supabase keyed by user. **Discard raw.**
- **Secrets:** Garmin consumer key/secret + Supabase keys as Vercel env vars (never in the repo).
- **Mobile:** "Connect Garmin" launches the OAuth web flow (expo-auth-session / expo-web-browser); after
  connect, the app **pulls the latest derived Body Battery** for the user. Only the 0–100 value + timestamp
  persists on-device (local-first; the privacy schema already blocks raw).

---

## Phase 3 — Engine + UI binding

- **Engine:** extend `BiometricSource` (`packages/engine/src/common/types.ts`) with `'garmin'`; add Body
  Battery as a **`WearableReadinessInput`** (or a `bodyBattery` field on `SleepRecoveryInput`). Either fold
  it into the existing recovery sub-score, or add an explicit **9th Edge factor** (weight TBD) via
  `EdgeWeights` (`packages/engine/src/scoring/types.ts`) + a `calcWearableReadiness()` (map 0–100, or
  z-score vs the user's own Body Battery history). Add tests (engine ≥90% per CLAUDE.md).
- **Privacy contract:** the derived value flows through `domain/src/schemas/scan-schema.ts` validation —
  which already rejects `raw*` keys, so only the 0–100 number is persistable.
- **UI:** the `apps/preview/v6/` Energy bars (and the eventual mobile Energy card) bind to the **real**
  Body Battery value + its recent history instead of the shaped demo array.

---

## Reuse anchors (don't reinvent)

| Need | Existing code |
| --- | --- |
| Data source enum | `packages/engine/src/common/types.ts` — `BiometricSource` |
| Sleep/recovery input slot | `packages/engine/src/common/types.ts` — `SleepRecoveryInput` |
| HRV cross-source harmonisation | `packages/engine/src/biometric/hrv.ts` — `harmonizeHrv` (SDNN→RMSSD) |
| Edge Score input / weights | `packages/engine/src/scoring/edge-score.ts`, `scoring/types.ts` |
| Multi-modal blend pattern | `packages/engine/src/baseline/multi-modal-blend.ts` |
| Raw-data rejection (privacy) | `domain/src/schemas/scan-schema.ts` (`DISALLOWED_PERSISTED_KEYS`, `raw*`) |
| Local store boundary | `domain/contracts/ILocalStorage.ts` |
| Devices UI placeholder | `apps/mobile/app/(tabs)/lab.tsx:81` |
| Source toggle (UI only today) | `apps/preview/v6/index.html` `selectSource()` |

## Compliance / privacy guardrails

- Only **derived** metrics (Body Battery 0–100, HRV trend, sleep summary) are stored. **No raw sensor
  samples** server-side or on-device (enforced by `scan-schema.ts`).
- Privacy controls stay outside the paywall (v3 rule). Right-to-forget via `ILocalStorage.wipeAllData`.
- No medical/financial claims — Body Battery is shown as an energy/readiness signal, not a diagnosis.

## Suggested order of work

1. **Now:** Phase 1 (HealthKit HR/HRV/sleep → engine; real Devices screen) — ships value without Garmin.
2. **In parallel:** founder does Phase 0 (apply for Garmin Health API; stand up Supabase).
3. **On approval:** Phase 2 (backend OAuth + webhook) → Phase 3 (engine factor + bind the Energy bars).
