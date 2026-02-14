# EventBridgeV2 API Reference

> **Version**: 1.0.0  
> **Class**: `EventBridgeV2 extends EventTarget`  
> **Global**: `window.EventBridgeV2`

---

## Emission Methods

### `emitSensorSample(sample: TenkiSensorSample)`
Throttled emission of raw sensor data. Buffers and emits in batches at 10Hz.

```javascript
EventBridgeV2.emitSensorSample({
    v: 1,
    ts: Date.now(),
    source: 'rppg',
    hr_bpm: 72,
    hrv_ms: 42,
    quality: 0.78,
    meta: { coverage: 0.92 }
});
// → emits 'tenki:sensor-samples-batch' at 10Hz
```

### `emitTEIUpdate(result: TenkiTEIResult)`
Immediate emission of TEI result. No throttling.

```javascript
EventBridgeV2.emitTEIUpdate({
    v: 1,
    ts: Date.now(),
    tei_pr99: 72,
    confidence: 0.85,
    level: 'standard',
    error_margin_pr99: 6,
    range_pr99: [66, 78],
    inputs: { sources: ['rppg'], samples_used: 30, quality_avg: 0.78 }
});
// → emits 'tenki:tei-progressive'
// → also emits 'tenki:tei-updated' (legacy, Phase 1-2 only)
```

### `emitPPGState(data)`
PPG calibration state change.

```javascript
EventBridgeV2.emitPPGState({
    state: 'ALIGNED',
    coverage: 0.92,
    quality: 0.65,
    hint: '完美！保持穩定'
});
// → emits 'tenki:ppg-state'
```

### `emitPPGComplete(metrics: TenkiPPGCalibrationMetrics)`
PPG calibration complete with metrics.

```javascript
EventBridgeV2.emitPPGComplete({
    v: 1,
    ts: Date.now(),
    session_id: 'sess_abc123',
    time_to_aligned_ms: 3200,
    time_to_signal_lock_ms: 5800,
    final_quality: 0.87,
    bpm_estimate: 72,
    state_transitions: [...],
    coverage_history: [...]
});
// → emits 'tenki:ppg-complete'
```

### `emitTradeRecord(record: TenkiTradeRecord)`
Trade recorded with TEI context.

```javascript
EventBridgeV2.emitTradeRecord({
    v: 1,
    trade_id: 'trade_001',
    ts: Date.now(),
    symbol: 'AAPL',
    direction: 'long',
    outcome: 'win',
    pnl: 150.00,
    r_multiple: 1.5,
    template: 'CANSLIM',
    decision_time_s: 45,
    tei_at_entry: { tei_pr99: 72, confidence: 0.85, range_pr99: [66, 78] }
});
// → emits 'tenki:trade-recorded'
```

---

## Subscription

```javascript
// New canonical events
EventBridgeV2.addEventListener('tenki:tei-progressive', (e) => {
    const { tei_pr99, confidence, level } = e.detail;
});

EventBridgeV2.addEventListener('tenki:ppg-state', (e) => {
    const { state, coverage, quality } = e.detail;
});

EventBridgeV2.addEventListener('tenki:ppg-complete', (e) => {
    const metrics = e.detail;
});

EventBridgeV2.addEventListener('tenki:sensor-samples-batch', (e) => {
    const { samples, count } = e.detail;
});
```

---

## Validation

All emissions are validated before dispatch. Invalid payloads throw errors:

```javascript
// Will throw: "Invalid TEI PR99: 105, must be 1-99"
EventBridgeV2.emitTEIUpdate({ tei_pr99: 105, ... });

// Will throw: "Invalid hr_bpm: 250, must be 40-180"
EventBridgeV2.emitSensorSample({ hr_bpm: 250, ... });
```

---

## Configuration

```javascript
// Event mode (affects legacy emission)
localStorage.setItem('tenki:event-mode', 'dual');    // default
localStorage.setItem('tenki:event-mode', 'v2-only'); // new only
localStorage.setItem('tenki:event-mode', 'legacy');  // old only

// Throttling
EventBridgeV2.sensorThrottleMs = 100; // 10Hz (default)
```

---

## Migration from EventBridge V1

```diff
// Before (V1)
-EventBridge.notifyTEIUpdate(72, 'source');
-EventBridge.onTEIUpdate((data) => { ... });

// After (V2)
+EventBridgeV2.emitTEIUpdate({
+    v: 1, ts: Date.now(),
+    tei_pr99: 72, confidence: 0.85,
+    level: 'standard', ...
+});
+EventBridgeV2.addEventListener('tenki:tei-progressive', (e) => { ... });
```
