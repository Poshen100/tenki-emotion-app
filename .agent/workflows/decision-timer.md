---
description: How to develop TENKI Decision Timer features
---

# Decision Timer Development Workflow

## ⚠️ MANDATORY CONSTRAINTS

```
🔒 NEVER MODIFY:
- index.html (except SAFE ZONE)
- app.js (Stardust Soul)
- rpgg.js
- expression.js
```

## Core Architecture

```
EventBridge → DecisionTimer → Overlay UI
     ↑             ↓
  TENKI Core    States: IDLE→PREVIEW→RUNNING→COMPLETE/TIMEOUT
```

## Available States

```javascript
const STATES = {
  IDLE: 'IDLE',
  PREVIEW: 'PREVIEW',
  RUNNING: 'RUNNING', 
  PAUSED: 'PAUSED',
  COMPLETE: 'COMPLETE',
  TIMEOUT: 'TIMEOUT',
  ABORT: 'ABORT'
};
```

## Using Decision Timer

```javascript
// Get timer instance
const timer = DecisionTimer.create();

// Set template
timer.setTemplate('MANCINI_FBD');

// Start with TEI check
timer.start({ tei: 72 });

// Listen for events
timer.onStateChange((newState, data) => {
  console.log('State:', newState);
});

timer.onTick((remaining, progress) => {
  console.log('Remaining:', remaining, 'Progress:', progress);
});
```

## Trading Templates

| ID | Name | Duration | Use Case |
|----|------|----------|----------|
| `CANSILM_GROWTH` | Cansilm 成長股 | 5 min | General |
| `CANSILM_HIGHRS` | High RS | 4 min | Breakout |
| `MANCINI_FBD` | Failed Breakdown | 3 min | Reclaim |
| `FOCUS_SESSION` | Deep Focus | 25 min | Work |
| `RECOVERY_BREAK` | Recovery | 5 min | Health |

## Adding New Template

```javascript
// In decision-timer.js
const NEW_TEMPLATE = {
  id: 'T4_RS_BREAKOUT',
  name: 'RS Breakout',
  duration: 240, // 4 minutes
  segments: [
    { end: 60, label: 'Wait', hint: '等待' },
    { end: 180, label: 'Observe', hint: '觀察' },
    { end: 240, label: 'Entry Window', hint: '進場窗口' }
  ],
  timeoutMessage: 'Patience wins!'
};
```

## EventBridge Integration

```javascript
// Emit timer events
EventBridge.emit('timer:state', { state: 'RUNNING', template: 'T1' });
EventBridge.emit('timer:tick', { remaining: 120, progress: 0.5 });
EventBridge.emit('timer:complete', { outcome: 'TIMEOUT' });

// Listen
EventBridge.on('timer:request', (data) => {
  timer.start(data);
});
```

## Critical Reminders

1. **TIMEOUT = WIN** - System celebrates patience
2. **Overlay Only** - Never touch Stardust DOM
3. **EventBridge** - All communication through events

// turbo-all
