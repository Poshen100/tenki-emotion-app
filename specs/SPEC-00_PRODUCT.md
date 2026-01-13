# SPEC-00 — Product (v1)

## Positioning
TENKI is a multimodal readiness scanner for trading risk control (not a medical device).

## Outputs
- **TEI_PR (0–100):** Readiness percentile (calculated against personal baseline space).
- **Confidence:** Low / Medium / High.
- **Mode:** Default (30s) / Pro (60s).
- **Source Roadmap:** 
  1. Face rPPG (Current)
  2. Finger PPG (Day-0 support)
  3. BLE RR-interval (Planned)
  4. Imported baseline (Planned)

## Reliability Rules (The "Quality Gate")
- If quality gate fails, TENKI must **HOLD** TEI/HRV outputs.
- Only "Coaching Hints" (e.g., "Too Dark", "Don't Move") are displayed during HOLD.
- The UI must clearly distinguish between "Measuring" and "Holding".

## Privacy Rules
- **Strict:** Do not store raw video or audio frames.
- **Storage:** Session numeric summaries are stored by default. High-frequency diagnostic timeseries are stored only when manually triggered for debugging.
