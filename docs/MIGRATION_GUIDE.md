# TENKI Event System — 3-Phase Migration Guide

> **Version**: 1.0.0  
> **Timeline**: 8 weeks  
> **Risk**: Zero breaking changes through Phase 1-2

---

## Overview

```
Phase 1 (Week 1-2): Dual Emission    — 新舊同時發送
Phase 2 (Week 3-4): Feature Flag     — 用戶可選
Phase 3 (Week 5+):  Deprecation      — 移除舊事件
Week 8+:            Complete          — 只保留 tenki:*
```

---

## Phase 1: Dual Emission (Week 1-2)

### Goal
所有新代碼用 `tenki:*` 事件，同時自動發送舊事件。**零破壞性**。

### What Happens

```
EventBridgeV2.emitTEIUpdate(teiResult)
    ├─→ emit 'tenki:tei-progressive'     (NEW ✅)
    ├─→ emit 'tenki:tei-updated'         (LEGACY, auto-derived)
    └─→ emit 'tei:update'               (LEGACY, auto-derived)
```

### Rules for New Code
1. ✅ Only **listen** to `tenki:*` events
2. ✅ Only **emit** through `EventBridgeV2`
3. ❌ Never emit legacy events directly
4. ❌ Never listen to non-`tenki:*` events

### Rules for Existing Code
1. ✅ No changes needed — legacy events still fire
2. ✅ Console will show deprecation warnings
3. ⬜ Optionally migrate listeners to `tenki:*`

### Acceptance Criteria
- [ ] All new modules use `tenki:*` only
- [ ] All old modules still work
- [ ] Console shows migration warnings
- [ ] Zero runtime errors

---

## Phase 2: Feature Flag (Week 3-4)

### Goal
用戶/開發者可以選擇事件模式，收集真實反饋。

### Configuration

```javascript
// localStorage key
'tenki:event-mode'

// Values:
// 'dual'     — 新舊都發 (default)
// 'v2-only'  — 只發新事件
// 'legacy'   — 只發舊事件 (debug only)
```

### Acceptance Criteria
- [ ] Settings UI available (developer options)
- [ ] Mode switching works without reload
- [ ] Metrics collected: % of users on each mode
- [ ] Rollback tested: `legacy` mode fully functional

---

## Phase 3: Deprecation (Week 5+)

### Goal
移除舊事件代碼，只保留一個必要的 alias。

### What Gets Removed
| Event | Action |
|-------|--------|
| `tei:update` | ❌ Removed |
| `tei:updated` | ❌ Removed |
| `ppg:coverage-update` | ❌ Removed |
| `ppg:signal-update` | ❌ Removed |
| `ppg:complete` | ❌ Removed |
| `tenki:tei-updated` | ⚠️ Kept as alias (with `_deprecated: true`) |

### What Stays
| Event | Status |
|-------|--------|
| `tenki:tei-progressive` | ✅ Canonical |
| `tenki:sensor-sample` | ✅ Canonical |
| `tenki:ppg-state` | ✅ Canonical |
| `tenki:ppg-complete` | ✅ Canonical |
| `tenki:trade-recorded` | ✅ Canonical |

---

## Event Mapping Reference

| Legacy Event | Canonical Event | Payload Transform |
|-------------|----------------|-------------------|
| `tenki:tei-updated` `{tei, source, timestamp}` | `tenki:tei-progressive` `{tei_pr99, confidence, level, ...}` | `tei` → `tei_pr99`, add `confidence`, `level`, `range_pr99` |
| `tenki:ppg-calibration` `{state, coverage, ...}` | `tenki:ppg-state` `{state, coverage, quality, hint}` | Rename + add structured fields |
| `ppg:coverage-update` `{coverage, state, hint}` | `tenki:ppg-coverage` `{coverage, hint}` | Direct rename |
| `ppg:signal-update` `{quality, bpm}` | `tenki:ppg-signal` `{quality, bpm}` | Direct rename |
| `ppg:complete` `{metrics, calibration}` | `tenki:ppg-complete` `TenkiPPGCalibrationMetrics` | Structured upgrade |
