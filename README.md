# TENKI — Multimodal Trading Risk Readiness

TENKI is a **multimodal** readiness scanner designed for trading risk control.
It prioritizes reliability: the system uses strict signal-quality gating and will **HOLD** outputs when conditions are not trustworthy.

## Core principles
- **Quality-gated metrics:** No fake precision. If the signal is bad, we show nothing rather than wrong data.
- **Progressive accuracy:** 
  - 2s: Preview
  - 15s: First usable data
  - 30s: Default mode
  - 60s: Pro mode
- **Privacy-by-default:** No raw video/audio storage; only numeric summaries and optional diagnostic timeseries.

## Current Version Status
- **Visuals:** v25.8.2 (Stable Animation)
- **Core Logic:** v50 (Trading Grade Risk Control)
