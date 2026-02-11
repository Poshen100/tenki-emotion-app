# TENKI 2.0 API Reference

## Core Modules

### ProgressiveTEI (`core/progressive-tei.js`)

```javascript
const tei = TENKI_PROGRESSIVE_TEI.create({ baselineHR: 72 });

// Feed data → get milestone results
const result = tei.onNewData({ hr: 70, hrv: 50 }, 0.8);
// result: { score, confidence, errorMargin, range, level, dataPoints }

// Check progress
tei.getProgress(); // { dataPoints, currentLevel, progress }

// Reset
tei.reset();
```

**Milestones:** `quick` (4pts, 40%) → `standard` (15pts, 70%) → `precise` (30pts, 85%) → `ultra` (60pts, 95%)

---

### SmoothTEITransition (`core/smooth-transition.js`)

```javascript
const smoother = TENKI_SMOOTH_TRANSITION.create();
smoother.onUpdate(({ score }) => updateUI(score));
smoother.smoothUpdate(75, 0.85);
```

---

### ExpectancyCalculator (`core/expectancy-calculator.js`)

```javascript
const calc = TENKI_EXPECTANCY.create(storageManager);

// Tiered analysis
const results = await calc.calculate(startDate, endDate);

// What-if
calc.whatIfAnalysis(trades, 70);

// Statistical test
calc.tTest(highTEIpnl, lowTEIpnl);

// Optimize
calc.optimizeThreshold(trades);
```

**Tiers:** PEAK (≥80) · OPTIMAL (55-79) · NEUTRAL (35-54) · DEGRADED (<35)

---

### SensorFusionEngine (`core/sensor-fusion.js`)

```javascript
const fusion = TENKI_SENSOR_FUSION.create();
await fusion.initializeSources();
const fused = await fusion.fuse(); // { hr, hrv, confidence, sources }
```

---

### KalmanFilter (`core/kalman-filter.js`)

```javascript
const kf = TENKI_KALMAN.create();
kf.update({ hr: 72, hrv: 45 }, { hr: 1, hrv: 1 });
```

---

### CameraController (`core/camera-controller.js`)

```javascript
const cam = TENKI_CAMERA.create({ videoElement: videoEl });
await cam.init(); // Starts processing loop
// Listen: ppg:camera-ready, ppg:coverage-update, ppg:signal-update, ppg:complete
cam.destroy();
```

---

## Integration Modules

### StorageManager (`integration/storage-manager.js`)

```javascript
const storage = TENKI_STORAGE.create();
await storage.init();
await storage.save('trades', tradeData);
const trades = await storage.getTrades(startDate, endDate);
const json = await storage.exportAll();
```

### TradeLogger (`core/trade-logger.js`)

```javascript
const logger = TENKI_TRADE_LOGGER.create();
logger.logTrade({ symbol: 'AAPL', outcome: 'win', pnl: 150 });
```
