# SYSTEM.md — AI Collaboration Instructions

> Read this file first if you are any AI system (Claude, GPT, Copilot, Gemini, or other) collaborating on this repository.
> This file defines *what the product is* so you frame every suggestion correctly.
> For Claude-Code-specific engineering hard rules (commit discipline, banned APIs, repo layout), read `CLAUDE.md` next — if anything here ever conflicts with `CLAUDE.md` on an engineering rule, `CLAUDE.md` wins. This file governs product framing and language; `CLAUDE.md` governs how Claude Code executes work.
> For the full internal language system and brand rationale, read `docs/brand.md`.

---

## 1. Core Product Definition

Tenki Core is:

→ **Decision Infrastructure**
→ A **Human State Calibration System**

It helps users (traders and non-traders) detect, regulate, and recalibrate their internal state using:

- Emotional awareness (**Radar**)
- Physiological signals (HRV, heart rate, breathing)
- State deviation modeling (above baseline / at baseline / below baseline)
- Behavioral timing and decision tracking

## 2. What Tenki Core Is NOT

- NOT a trading signal app
- NOT a prediction engine
- NOT a meditation-only app
- NOT a passive mood tracker

If you find yourself describing a feature as "predicts the market," "tells you when to buy/sell," or "guided meditation app," stop — that is not this product. Reframe in terms of state detection, regulation, and decision quality (see Section 4).

## 3. What Tenki Core Does

- Detects the user's internal state (**Radar**)
- Identifies deviation from **Baseline**
- Guides the user back to Baseline via **Calibration** (breathing, audio, regulation tools)
- Enables behavioral **Turning Points** (decision clarity)

## 4. Core Language System

Use these four terms consistently in any code comment, docstring, UI copy, or commit message that touches this concept space. Full definitions, including the internal-only physiological/dopamine rationale, are in `docs/brand.md` — do not put that internal rationale in user-facing copy (see Section 6).

| Term | Public-safe definition |
|------|------|
| **Radar** | The system that detects the user's current emotional and physiological state. |
| **Baseline** | The optimal regulation state for decision-making — the reference point Calibration returns the user to. |
| **Calibration** | The process (breathing, HRV regulation, audio) that returns the user to Baseline. |
| **Turning Point** | A moment where behavior shifts from reactive to intentional. |

## 5. Rules for All AI Collaborators

1. **Never describe the product as:**
   - "trading tool"
   - "signal system"
   - "meditation app"

2. **Always frame features in terms of:**
   - state detection
   - state regulation
   - behavioral outcomes

3. **When proposing or adding a feature, place it in one of these four buckets:**
   - **Radar** (detect)
   - **Calibration** (adjust)
   - **Baseline** (reference)
   - **Turning Point** (outcome)

   If a feature doesn't fit any of the four, it's probably out of scope — flag it rather than forcing it in.

4. **Prefer this language:**
   | Prefer | Over |
   |--------|------|
   | "state" | "emotion" |
   | "calibration" | "relaxation" |
   | "decision quality" | "performance" |

5. **Compliance is non-negotiable** (inherited from `CLAUDE.md`): no medical-diagnosis or financial-advice wording in anything user-facing — App copy, push notifications, marketing pages, App Store text. The physiological/dopamine-state model is an internal mental model for engineers and AI collaborators (`docs/brand.md`), not user-facing vocabulary.

## 6. Relationship to the Existing Scoring Engine

The codebase currently implements a Decision Edge Score (0-100) with three zones — `clear` / `neutral` / `strain` — in `packages/shared/src/zone-config.ts` and `packages/engine/src/scoring/types.ts`. That scoring engine and this language system describe the same underlying product, viewed from two angles: the engine measures it, the Radar/Baseline/Calibration/Turning Point vocabulary is how it's *talked about* by humans and AI.

A renaming of the zone labels to Baseline-state language (e.g. `clear` → `at-baseline`) is intentional future direction but is **not yet decided at the code level** — the exact mapping has an open question (see `docs/brand.md` § Naming Migration) and should not be assumed or auto-applied. Until a dedicated PR resolves it:

- Use Radar/Baseline/Calibration/Turning Point language in all **new** docs, comments, and product narrative.
- Do not rename `EdgeZone` values, `zone-config.ts`, or any persisted/serialized field names without an explicit instruction to do so.

## 7. Final Goal

After reading this file, any AI should immediately understand:

This is a system for:
→ detecting human state
→ calibrating it
→ enabling better decisions

**NOT predicting the market.**

## 8. Preserved design assets (locked — do not redesign without founder request)

Some surfaces are founder-approved and **locked**. Any AI (Claude, Antigravity, Copilot,
Gemini, or otherwise) may *polish* them (timing, easing, performance, font loading,
reduced-motion fallbacks) but must **not** redesign, replace, or restructure them without an
explicit founder request — same spirit as the locked brand assets in `ANTIGRAVITY.md` § 18
and `brand/TAGLINE-SYSTEM.md`.

| Asset | Where | What is locked |
|-------|-------|----------------|
| **`/story/` Hero** | `apps/preview/story.html` `#hero` + `apps/preview/story.js` `initHero()` + `apps/preview/v6/stardust.js` | Headline **"Read your edge before it reads you."** (accent on "it reads you."), the scrolling **stardust orb** (`#universe` + `TENKI_STARDUST.playEntrance`), the kicker, the sub ("…a single, honest number — your Decision Edge Score… Everything stays on-device."), and the two CTAs. The orb is the signature brand visual — keep it. |

Note: this `/story/` page headline is a *landing-page* hero and is distinct from the locked
App-Store **Tier-1** tagline in `brand/TAGLINE-SYSTEM.md` ("Read your inner weather. Find your
turning point." / "Sense the shift."). Both are locked; do not cross-replace them.
