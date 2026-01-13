# SPEC-40 — Worker Message Contract (v1)

## 1. rPPG Worker (`rppg-worker.js`)
*Responsible for signal processing, FFT/Peak detection, and calculating TEI metrics.*

### Inbound Messages (Main Thread -> Worker)
- `{ type: "start", scanId, t0, meta }`
  - `meta` includes: scanMode ("lock"|"spectrum"), environmental stats (luma, gyro), and prHistory.
- `{ type: "frame", t, r, g, b, metaUpdate? }`
  - Feeds raw RGB averages per frame.
- `{ type: "stop" }`
- `{ type: "reset" }`
- `{ type: "export_request" }`

### Outbound Messages (Worker -> Main Thread)
- `{ type: "started", scanId }`
- `{ type: "metrics", scanId, metrics }`
  - **Critical Payload (`metrics`):**
    - `sqs` (0–100): Signal Quality Score.
    - `grade` (A/B/C/D): Quality grade.
    - `gate`: `{ qualityPass, ibiPass, pass, thrQ, thrIbi }` (The decision logic).
    - `rmssd`, `nIbiUsable`: HRV stats.
    - `hrBpm`, `rrBrpm`: Heart rate and breathing rate.
    - `pr`: `{ hr_pr, hrv_pr, rr_pr, sq_pr, tei_pr }` (Percentile Ranks).
    - `penalties`: Object describing why score is low (light/motion/roi/fps).
- `{ type: "stopped", scanId }`
- `{ type: "export_payload", payload }`

---

## 2. Vision Worker (`vision-worker.js`)
*Responsible for face tracking, ROI extraction, and motion detection.*

### Inbound Messages (Main Thread -> Worker)
- `{ type: "FRAME_DATA", payload: { imageData, faceBox?, timestamp, frameId } }`
  - Note: Uses uppercase type, distinct from rPPG worker.
- `{ type: "GET_SIGNAL_BUFFER" }`
- `{ type: "RESET" }`

### Outbound Messages (Worker -> Main Thread)
- `{ type: "VISION_STATUS", payload: { fps, roiMetrics, frameId, timestamp, signalBufferSize } }`
  - Returns calculated FPS and ROI stability data.
- `{ type: "SIGNAL_BUFFER", payload: { buffer, size, timestamp } }`
- `{ type: "RESET_ACK" }`

---

## 3. Future Alignment (v2 Recommendation)
*To be implemented in future refactoring:*
Unify message types to: `start`, `frame`, `status`, `stop`, `reset`.
