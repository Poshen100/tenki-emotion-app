# TENKI 2.0 — Development Strategy

## Architecture
TENKI is a biometric trading performance app. Core modules are vanilla JS IIFEs that export globals (`TENKI_*`). Modules communicate via `EventBridge` (pub/sub). Data persists in `localStorage` → `IndexedDB` (3-layer via `StorageManager`).

## Module Map
| Global | File | Purpose |
|--------|------|---------|
| `TENKI_PROGRESSIVE_TEI` | `core/progressive-tei.js` | Milestone TEI (4→15→30→60) |
| `TENKI_SMOOTH_TRANSITION` | `core/smooth-transition.js` | EWMA animation |
| `TENKI_SENSOR_FUSION` | `core/sensor-fusion.js` | Weighted multi-source fusion |
| `TENKI_KALMAN` | `core/kalman-filter.js` | 2D Kalman HR/HRV |
| `TENKI_EXPECTANCY` | `core/expectancy-calculator.js` | Tiered expectancy + t-test |
| `TENKI_TRADE_LOGGER` | `core/trade-logger.js` | TEI-enriched trade log |
| `TENKI_STORAGE` | `integration/storage-manager.js` | 3-layer backup |
| `TENKI_CAMERA` | `core/camera-controller.js` | PPG camera lifecycle |
| `TENKI2` | `core/tenki-2-bootstrap.js` | System integrator |

## Dev Strategy

### ✅ 並行開發 (Parallel Development)
- 5-agent workstreams: TEI Engine, PPG Camera, Sensor Fusion, Expectancy, Integration
- Each agent produces independent modules with clear interfaces
- Bootstrap script wires everything together at the end

### ✅ Opus 4.5 + Thinking
- Use Claude Opus 4.5 with extended thinking for code generation
- Gemini 3 Pro for testing, debugging, and verification

### ✅ Plan Mode 優先
- Always start with `implementation_plan.md` before coding
- Map changes to existing codebase — extend, don't replace

### ✅ 持續更新 CLAUDE.md（最核心）
- This file IS the source of truth for the project
- Update after every significant change
- Keep module map current

### ✅ 自動化工作流 (Slash Commands)
- `/test` → `npx vitest run`
- `/bench` → `npx vitest run tests/benchmark/`
- `/dev` → `npx vite --port 5173`
- `/build` → `npx vite build`

### ✅ Commit Per Todo（強制執行）

> **每個 Plan 裡的 Todo = 一個 Git Commit**

格式規範：
```
<type>(<scope>): <todo描述>

例：
feat(core): implement T3 CANSLIM template
fix(ppg): stabilize camera lifecycle on iOS
test(kalman): add edge case for zero variance
refactor(overlay): extract timer segment logic
```

規則：
1. 完成一個 Todo → 立即 `git add` + `git commit`
2. **不要累積多個 Todo 才 commit**
3. commit message 要對應 plan 裡的原文 Todo
4. 這樣做的好處：翻 log 就能精確找到哪個 Todo 引入 Bug

### ✅ Sub-agents 分工
- Agent-01: Progressive TEI Engine
- Agent-02: PPG Camera Calibration
- Agent-03: Multi-Modal Sensor Fusion
- Agent-04: Expectancy Layer
- Agent-05: Integration + Tests

### ✅ Feedback Loop（品質提升 2-3 倍）
- Write tests BEFORE integration
- Run benchmarks to validate performance targets
- All 23 tests must pass before merge

## Testing
```bash
npx vitest run                          # All tests (23)
npx vitest run tests/progressive-tei    # Unit tests (18)
npx vitest run tests/benchmark          # Perf benchmarks (5)
```

## Performance Targets
| Metric | Target | Actual |
|--------|--------|--------|
| TEI calc | < 5ms | 0.29ms |
| 1000 data points | < 100ms | 0.62ms |
| 1000 Kalman updates | < 10ms | 2.28ms |
| 1000 trades analysis | < 50ms | 1.53ms |

## Key Conventions
- All modules use IIFE pattern with `(function(global) { ... })(window)`
- Export via `global.TENKI_*` namespace
- Japanese/Chinese comments for domain logic
- English for API docs
- Never modify original files — use EventBridge pattern
- CSS uses `--plasma-cyan`, `--void-purple`, `--matrix-green` tokens
