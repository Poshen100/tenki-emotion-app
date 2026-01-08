# TENKI v50.2 Stardust Fusion 🌟

> **Neural Link + 8K Particle Visualization** - Production-Grade Emotional Intelligence System

[![Version](https://img.shields.io/badge/version-50.2.0-cyan)](https://github.com/Poshen100/tenki-emotion-app)
[![Build](https://img.shields.io/badge/build-2026.01.08-blue)](https://github.com/Poshen100/tenki-emotion-app/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 🚀 What's New in v50.2

**Stardust Fusion** integrates the **8000-particle visualization system** from v25.8.2 into the v50.1 Neural Link framework, creating a unified production-grade experience.

### ✨ Core Features

#### From v50.1 Neural Link
- **Fusion Policy**: Intelligent ROI quality assessment (Eyebrow vs Forehead)
- **BLE Tier System**: 
  - **Tier 1**: Medical-grade chest strap (RR-interval) ⚕️
  - **Tier 2**: Wearable boost (HR only) ⌚
  - **Tier 3**: Camera-first rPPG 📷
- **Baseline CSV Import**: Universal parser with auto-mapping
- **Decision Log**: JSONL export for debugging
- **Draggable Timer**: Movable action timer widget

#### From v25.8.2 Stardust
- **8000 Particle System**: High-fidelity Three.js visualization
- **ANS Spectrum**: Real-time sympathetic/parasympathetic balance
- **Phased Scanning**: Progressive feedback stages

---

## 📊 Architecture

```
Face Mesh Detection → Fusion Policy → Primary Source Selection
                   → Particle System (8K sync)
                   → Physio Metrics (BPM/HRV)
                   → TEI PR Calculation
                   → Zone Classification → User Feedback
```

### Fusion Decision Logic
- **Motion Score**: Nose tip displacement tracking
- **Lux Estimation**: Canvas-based luminance analysis
- **ROI Quality**: Weighted combination (55% lux + 45% motion)
- **Hold Lock**: 1200ms minimum before source switching

### Tier Hierarchy
1. BLE connected → Force Tier 1/2 (medical priority)
2. No BLE → ROI quality decides Eyebrow vs Forehead
3. Fallback → NONE state with user guidance

---

## 🎯 Zone System

| Zone | PR Range | Action | Timer Color |
|------|----------|--------|-------------|
| **Peak** | 80-99 | ⚠️ Reduce size / Check overconfidence | 🟠 Amber |
| **Optimal** | 55-79 | ✅ A+ Setup only | 🔵 Cyan |
| **Neutral** | 35-54 | ⚡ Confirm-only + strict stop | ⚪ Gray |
| **Degraded** | 1-34 | 🔒 Lock trading → Breathing reset | 🟣 Purple |

---

## 💻 Quick Start

### Browser Requirements
- Chrome/Edge 90+ (Web Bluetooth)
- Safari 15+ (iOS/iPadOS)
- MediaPipe Face Mesh (CDN)
- Three.js r128 (CDN)

### Usage
1. **Open** `index.html` in browser (HTTPS required for BLE)
2. **Tap** "HOLD TO SYNC" to start scanning
3. **Optional**: Tap "VISION ONLY" → Connect BLE (Garmin/Polar/Generic HR)
4. **Optional**: Import baseline CSV for PR99 calculation
5. **Drag** timer widget to preferred position

### Baseline CSV Format
```csv
timestamp,rhr,rmssd
2026-01-01,65,58
2026-01-02,67,55
...
```
- **Required**: HR/RHR column (≥10 samples)
- **Optional**: Timestamp, HRV RMSSD
- **Supported**: Comma, semicolon, tab delimiters
- **Auto-mapping**: Intelligent column detection

---

## 📦 Deployment

See [`DEPLOYMENT_GUIDE_v50.2.txt`](DEPLOYMENT_GUIDE_v50.2.txt) for:
- Complete feature list
- Data flow architecture
- Deployment checklist
- Known limitations
- Support resources

---

## 🔧 Technical Details

### Fusion Policy Engine
```javascript
ROI Quality = 0.55 × Lux Score + 0.45 × (1 - Motion Score)
Primary Source = max(BLE, Eyebrow, Forehead) with hold lock
```

### TEI Calculation
```javascript
// HR+HRV mode (high confidence)
TEI = 0.7 × RMSSD_norm + 0.3 × (1 - HR_norm)

// HR-only mode (lower confidence)
TEI = (1 - HR_norm)
```

### Decision Log Format (JSONL)
```json
{"ts":1704672000000,"perf":12345,"primarySource":"rPPG_Eyebrow","confidence":92,"reason":"EYEBROW_SQI_OK","tier":3,"eyebrowQ":88,"foreheadQ":72,"lux":65,"motion":0.15}
```

---

## 🐛 Known Limitations

- Web Bluetooth only works on HTTPS
- iOS Safari needs user interaction for BLE pairing
- Particle count may reduce on low-end devices
- Baseline CSV requires ≥10 valid samples for PR calculation

---

## 📝 Changelog

### v50.2.0 (2026-01-08) - Stardust Fusion
- ✅ Integrated 8000 particle system from v25.8.2
- ✅ Added comprehensive deployment guide
- ✅ Enhanced ANS Spectrum visualization
- ✅ Improved Fusion Policy stability
- ✅ Better BLE error handling

### v50.1.0 (2026-01-07) - Neural Link
- ✅ Fusion Policy (ROI Quality)
- ✅ BLE Tier System (3-tier hierarchy)
- ✅ Baseline CSV Import (universal parser)
- ✅ Decision Log Export (JSONL)
- ✅ Draggable Timer Widget

### v25.8.2 (Previous)
- ✅ 8000 Particle Sync Engine
- ✅ ANS Spectrum UI
- ✅ Phased Scanning Feedback

---

## 🤝 Contributing

Contributions welcome! Please check [Issues](https://github.com/Poshen100/tenki-emotion-app/issues) for current priorities.

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **MediaPipe** for Face Mesh
- **Three.js** for WebGL rendering
- **TailwindCSS** for styling
- **Lucide** for icons

---

**Built with ❤️ for optimal performance and user experience**

🌐 [Live Demo](https://poshen100.github.io/tenki-emotion-app) | 📚 [Documentation](DEPLOYMENT_GUIDE_v50.2.txt) | 🐛 [Report Issues](https://github.com/Poshen100/tenki-emotion-app/issues)
