> ⚠️ **HISTORICAL (2026-07-03) — 本檔無現行對應系統，不在任何文件路由表上。**
> 「Ultra Decision Timer」規格未進入 v3 架構;現行 session/timer 邏輯見 `packages/engine/src/session/`。保留僅供考古。

# 🌟 TENKI Ultra Decision Timer Engine

## Complete System Specification v5.1

---

## 🎯 MISSION STATEMENT

**TENKI Ultra Decision Timer Engine** - a decision-risk governor that enforces discipline when humans cannot. This is NOT a simple timer app. This is a behavioral intervention system for traders.

**Core Philosophy:**
> "TENKI's value is not in which trade you took, but in all the moments you didn't act randomly."

---

## 🔒 ARCHITECTURAL CONSTRAINTS (NON-NEGOTIABLE)

### Stardust Soul Protection Protocol

```
🔒 LOCKED FILES - ABSOLUTELY DO NOT TOUCH:
├── index.html (only SAFE ZONE modifications allowed)
├── app.js (8000-particle Stardust Soul system)
├── rpgg.js (RPGG core system)
├── expression.js (Expression system)
└── Any code containing "Stardust" references
```

### Development Rules

1. **Event Bridge Pattern (MANDATORY)** - All features communicate via EventBridge
2. **Overlay UI Pattern (MANDATORY)** - All UI overlays with `.overlay-` prefix
3. **No direct DOM manipulation of Stardust**

---

## 📋 STATE MACHINE

```javascript
const STATES = {
  IDLE: 'IDLE',              // Not in decision mode
  PRE_CHECK: 'PRE_CHECK',    // Emotion/risk verification
  BREATHING: 'BREATHING',     // Physiological calibration
  RUNNING: 'RUNNING',         // Active decision window
  LOCKED: 'LOCKED',           // Action prohibited
  COMPLETE: 'COMPLETE',       // Successfully completed
  TIMEOUT: 'TIMEOUT',         // Patience win (POSITIVE)
  ABORT: 'ABORT'              // Interrupted (penalty)
};
```

> **TIMEOUT IS A WIN, not a failure. The system rewards patience.**

---

## 🎭 SCENARIO MODES

### A. Health & Stress
| Mode | Duration | Trading | Goal |
|------|----------|---------|------|
| Health Stress | 5/15 min | LOCKED | Reset nervous system |
| Night Cooldown | 10/20 min | DISABLED | Pre-sleep neural shutdown |

### B. Focus & Work
| Mode | Type | AI Mode | Purpose |
|------|------|---------|---------|
| Deep Focus | Pomodoro ×4 | PASSIVE | Prevent trading dopamine bleed |

### C. Physical
| Mode | Type | Feedback | Tracking |
|------|------|----------|----------|
| Exercise | Interval | AUDIO_ONLY | Completion rate |

---

## 🎯 TRADING TEMPLATES

### T1: Mancini FBD (Failed Breakdown)
| Phase | Time | Action |
|-------|------|--------|
| Entry Prohibited | 0-60s | WAIT |
| Non-Acceptance | 60-140s | OBSERVE |
| Entry Window | 140-180s | ONLY ENTRY |

### T3: CANSLIM Growth Pullback
- Emotion Score: ≥ 60
- Volume: CONTRACTING
- Duration: 5 minutes

### T4: High RS Breakout
- Structure: Cup & Handle / Pivot
- Window: 4 minutes
- Missed = AUTO TIMEOUT WIN

---

## 🤖 AI AGENTS

| Agent | Role | Authority |
|-------|------|-----------|
| Decision Timer | Timer enforcement | Delay/Deny if emotion low |
| Post-Trade | Process review | No outcome judgment |
| Health Intervention | Behavioral interrupt | Can block trading |

**Prohibited AI phrases:** "You should have...", "If only...", "Next time try..."

---

## 🚀 DEVELOPMENT PHASES

### Phase 1: Core Timer ✅
- [x] Event Bridge
- [x] Basic Decision Timer (T1)
- [x] Overlay UI
- [x] State Machine
- [x] Emotion Score input

### Phase 2: Template System 📋
- [ ] Template Manager
- [ ] T3 Implementation
- [ ] T4 Implementation
- [ ] Template selector UI

### Phase 3: Scenario Modes 🎭
- [ ] Health Stress Mode
- [ ] Night Cooldown
- [ ] Deep Focus
- [ ] Mode switching logic

### Phase 4: AI Integration 🤖
- [ ] Decision Timer Agent hooks
- [ ] Post-trade feedback system
- [ ] Health intervention triggers

### Phase 5: Data & Analytics 📊
- [ ] Micro Timeline
- [ ] Pattern detection
- [ ] Correlation engine
- [ ] Export functionality

---

## 📊 EVENT SCHEMA

```javascript
{
  eventType: 'DECISION_TIMER',
  timestamp: ISO8601,
  context: {
    mode: 'TRADING | HEALTH | FOCUS | PHYSICAL',
    template: 'T1 | T3 | T4 | null',
    emotionScore: 0-100
  },
  outcome: {
    state: 'COMPLETE | TIMEOUT | ABORT',
    duration: seconds,
    decision: 'ENTER | PASS | TIMEOUT'
  }
}
```

---

## 🎨 UI COLOR LANGUAGE

```css
.overlay-idle    { border-color: rgba(0, 255, 200, 0.3); }
.overlay-running { border-color: rgba(255, 215, 0, 0.6); }
.overlay-locked  { border-color: rgba(255, 100, 100, 0.8); }
.overlay-win     { border-color: rgba(0, 255, 136, 0.8); }
```

---

## ⚠️ CRITICAL REMINDERS

1. **TIMEOUT IS A WIN** - System celebrates patience
2. **NO STARDUST MODIFICATIONS** - Event Bridge only
3. **AI IS NOT COACH** - No preachy feedback
4. **SCAN LEVEL IS AUTHORITY** - LOW/MID/HIGH = Suggestion/Boundary/Override

---

**Version:** 5.1 (T2/T5 removed, core-focused)  
**Date:** 2026-02-04  
**Status:** Ready for Implementation
