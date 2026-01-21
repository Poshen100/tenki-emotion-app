# TENKI Emotion App 🧠

**即時生理狀態監測 · 交易員情緒引擎 · 自律神經健康追蹤**

[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black)](https://tenki-emotion-app.vercel.app)

![TENKI Demo](https://img.shields.io/badge/version-v53.2-blue)

## ✨ 功能特色

### 🔬 即時 rPPG 生物識別
- 透過前鏡頭偵測心率 (HR)、心率變異性 (HRV)、呼吸率 (RR)
- 無需穿戴設備，純手機即可使用
- 60 秒建立個人生理基線

### 📊 TEI 交易員情緒指數
- **PEAK** (80+): 高表現區，嚴守風控
- **OPTIMAL** (55-79): 標準倉位，策略正常
- **NEUTRAL** (35-54): 降低倉位，挑高勝率
- **DEGRADED** (<35): 建議暫停，等待恢復

### 🎯 智慧掃描系統
```
15秒/15組心率 → QUICK 快速檢測
30秒/30組心率 → STANDARD 標準分析  
60秒/60組心率 → DEEP 深度分析 (自動鎖定)
```

### 🧠 持續學習引擎
- 設備間自動校準
- 學習個人晝夜節律
- TEI 權重個性化
- 越用越準確

### 🧘 平靜 UX 設計
- 8 秒暖機期，平靜引導語
- 極慢分數過渡 (EWMA α=0.05)
- 3 秒訊息更新間隔

---

## 🚀 快速開始

### 線上體驗
👉 https://tenki-emotion-app.vercel.app

### 本地開發
```bash
git clone https://github.com/Poshen100/tenki-emotion-app.git
cd tenki-emotion-app

# 使用任何靜態伺服器
npx serve .
# 或
python -m http.server 8080
```

---

## 📁 專案結構

```
tenki-emotion-app/
├── index.html          # 主頁面 + 樣式
├── app.js              # 應用核心邏輯
├── tenki-engine.js     # TEI/ANS 計算引擎
├── rpgg.js             # rPPG 處理模組
├── rpgg-worker.js      # Web Worker
├── expression.js       # 表情分析模組
├── hints.js            # 教練提示系統
└── engine.js           # 舊版引擎 (相容)
```

---

## 🔧 API 參考

### TenkiEngine

```javascript
// 每日掃描
const result = TenkiEngine.ingestDailyScan({
    deviceType: 'face_rppg',
    sqs: { grade: 'A', total: 92 },
    metrics: { hrBpm: 68, hrvRmssdMs: 52, rrBrpm: 14 }
});

// 學習狀態
TenkiEngine.getLearningStatus()
// → { totalScans: 42, personalizationLevel: 80 }

// 個人洞察
TenkiEngine.getInsights()
// → [{ type: 'circadian', message: '晨間狀態較佳...' }]

// 持久化
localStorage.setItem('tenki', TenkiEngine.exportLearned())
TenkiEngine.importLearned(localStorage.getItem('tenki'))
```

---

## 📄 授權

MIT License © 2026 Poshen

---

## 🙏 致謝

- [MediaPipe Face Mesh](https://mediapipe.dev/)
- [Three.js](https://threejs.org/)
- [Lucide Icons](https://lucide.dev/)
