# docs/brand.md — Internal Brand & Language System

> Internal reference. This document defines the full product narrative and language system, including
> the internal physiological rationale that must **not** leak into user-facing copy.
> Public-facing identity lives in `README.md` and `SYSTEM.md` (safe-language versions of the same concepts).
> Locked taglines, logo, and visual identity are governed separately by `brand/TAGLINE-SYSTEM.md` and
> `brand/LOGO-SPEC.md` — those files are immutable without the founder's explicit request (see
> `ANTIGRAVITY.md` § 18). This document does not override them; see § Relationship to Locked Brand Assets below.

---

## 1. Core Product Definition

Tenki Core is:

→ **Decision Infrastructure**
→ A **Human State Calibration System**

It helps users (traders and non-traders) detect, regulate, and recalibrate internal states using:

- Emotional awareness (Emotional Radar)
- Physiological signals (HRV, heart rate, breathing)
- Dopamine state modeling (above baseline / below baseline / baseline) — **internal model only**, see § 5
- Behavioral timing and decision tracking

## 2. What Tenki Core Is NOT

- NOT a trading signal app
- NOT a prediction engine
- NOT a meditation-only app
- NOT a passive mood tracker

## 3. What Tenki Core Does

- Detects internal state (Emotional Radar)
- Identifies deviation from baseline
- Guides users back to baseline (breathing, audio, regulation tools)
- Enables behavioral turning points (decision clarity)

## 4. Core Language System

These four terms are the canonical vocabulary for this concept space across the entire codebase, docs, and
AI-collaboration framing. Use them consistently.

### 4.1 Emotional Radar

**Definition:** A system that detects the user's current emotional and physiological state.

### 4.2 Baseline

**Definition:** The optimal regulation state for decision-making. Represents dopamine equilibrium.

**States (internal model — do not use this exact clinical phrasing in user-facing copy, see § 5):**

| State | Internal description |
|-------|----------------------|
| Above Baseline | Overstimulated (FOMO, impulsive) |
| At Baseline | Regulated (clear decision state) |
| Below Baseline | Withdrawal (low energy, craving) |

### 4.3 Calibration

**Definition:** The process of returning the user to baseline using interventions:
- breathing
- HRV regulation
- audio (e.g. binaural beats)

### 4.4 Turning Point

**Definition:** A moment where behavior shifts from reactive to intentional.

## 5. Internal-Only Language vs. Public-Safe Language

`CLAUDE.md`'s hard rules forbid medical-diagnosis or financial-advice-sounding wording in anything user-facing
(App copy, push notifications, marketing pages, App Store listing, website). The dopamine/withdrawal/craving/FOMO
framing in § 4.2 is a useful internal mental model for engineers and AI collaborators reasoning about *why* a
feature exists — it must **not** appear verbatim in:

- `README.md` (public-facing)
- In-app strings, onboarding copy, push notifications
- App Store text, marketing pages, social copy

Translation table (internal → public-safe):

| Internal (this doc) | Public-safe (README.md, app copy, SYSTEM.md) |
|---|---|
| Overstimulated / FOMO / impulsive | "elevated," "above baseline," "a lot going on right now" |
| Withdrawal / craving / low energy | "depleted," "below baseline," "running low" |
| Dopamine equilibrium | "baseline," "regulated state" |

This mirrors the existing `packages/engine/src/compliance/` review layer's job for the current Edge Score
zone copy (`packages/shared/src/zone-config.ts` guidance strings) — any future Baseline-state copy must pass
through the same compliance review before shipping.

## 6. Brand Messaging

### 6.1 Narrative framing line (this language system)

Primary framing headline (for internal docs, AI-collaboration context, and section headers introducing the
Radar/Baseline/Calibration concept):

> "Calibrate Your Emotional Radar"

Supporting lines:

> "Return to baseline. Find your turning point."
> "Turn reactions into turning points."

### 6.2 Relationship to locked brand assets

`brand/TAGLINE-SYSTEM.md` already locks the **public-facing Tier 1 (Universal)** tagline used on the App Store,
website, and press:

> "Read your inner weather. Find your turning point." (Hero) / "Sense the shift." (subtitle)

That tagline is the canonical *external* headline and is unaffected by this document — do not replace it on
public surfaces without the founder's explicit request, per the immutability rule in `ANTIGRAVITY.md` § 18.

Note the overlap that already exists: `brand/TAGLINE-SYSTEM.md` Tier 2 (in-app splash) already uses
**"Return to baseline. Find your turning point."** — i.e. "Baseline" and "Turning Point" are not new brand
vocabulary, this document formalizes and extends concepts that were already present in the locked tagline
system. "Calibrate Your Emotional Radar" in § 6.1 is a *narrative/section-header* line for this language
system specifically (docs, AI framing, internal decks) — it is not a proposed replacement for the locked
Tier 1 public headline.

## 7. Naming Migration (open question — not yet executed)

The current scoring engine implements a Decision Edge Score (0-100) with three zones, defined in
`packages/shared/src/zone-config.ts` and `EdgeZone` in `packages/engine/src/scoring/types.ts`:

```
clear   (70-100)
neutral (40-69)
strain  (0-39)
```

The long-term direction (per founder decision) is for this to read as Baseline-state language instead.
This is **flagged as a follow-up engineering task, not yet executed**, because the mapping is not a simple
1:1 relabel:

- The existing Edge Score zones are a **single linear axis** (higher score = better state).
- The Baseline model in § 4.2 is a **deviation-from-center axis** (both "above" and "below" baseline are
  suboptimal; only the middle is good).

Concretely, `strain` (low Edge Score) could plausibly map to *either* "above baseline" (overstimulation/stress)
or "below baseline" (depletion) depending on what's actually driving the low score — the current engine doesn't
capture that directional information. Resolving this requires either:

(a) a product decision that the engine's single score is a proxy for *distance* from baseline regardless of
    direction (so `clear` → "at baseline", and both `neutral`/`strain` collapse toward "off baseline" without
    claiming a direction), or
(b) an engine change so the score (or a companion signal) captures direction, enabling a true
    above/at/below mapping.

**Do not auto-apply a guessed mapping in code.** Until a dedicated PR resolves this with explicit founder
sign-off, use Baseline/Radar/Calibration/Turning Point language in new docs and narrative content, and leave
`zone-config.ts`, `EdgeZone`, and any persisted field names untouched.

## 8. Source of Truth Hierarchy

1. `CLAUDE.md` — Claude Code hard engineering rules (wins on any code-level conflict).
2. `SYSTEM.md` — cross-AI product framing and language rules.
3. `docs/brand.md` (this file) — full internal language system and rationale.
4. `brand/TAGLINE-SYSTEM.md`, `brand/LOGO-SPEC.md` — locked public brand assets (immutable without founder request).
5. `README.md` — public-facing summary, must stay consistent with all of the above.
