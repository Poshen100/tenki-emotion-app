# 🎭 TENKI v10.5 - AI 情緒檢測應用

## 🎯 功能特性

- ✅ **實時人臉檢測** - 468 個面部特徵點精確追蹤
- ✅ **3D 頭套疊加** - 您的自訂 GLB 3D 模型
- ✅ **AI 情緒識別** - 實時情緒掃描系統
- ✅ **性能監控** - FPS 實時顯示
- ✅ **隱私保護** - 本地處理，無雲端上傳

## 🚀 快速開始

1. **訪問應用**
https://tenki-emotion-app.vercel.app

text

2. **允許相機權限**
- 瀏覽器會要求相機權限

3. **啟動相機**
- 點擊「🎥 啟動相機」按鈕

4. **開始掃描**
- 點擊「開始掃描」進行 3 秒情緒檢測

## 📊 頁面介紹

### 左側 - 視頻區域
- 即時人臉檢測
- 3D 頭套疊加渲染
- FPS 性能計數器

### 右側 - 狀態欄
- **追蹤狀態** - 檢測的面部特徵點數
- **性能** - 實時幀率（FPS）
- **模型狀態** - 3D 模型加載狀態
- **情緒掃描** - 開始掃描按鈕

## 📁 文件結構

tenki-emotion-app/
├── index.html # 主應用程序
├── models/
│ └── 3d-head.glb # 3D 模型檔案
├── README.md # 本檔案
└── package.json # 專案配置

text

## 🛠️ 技術棧

- **Three.js** - 3D 圖形渲染
- **MediaPipe** - 人臉檢測與追蹤
- **Vanilla JavaScript** - 核心邏輯
- **HTML5 Canvas** - 視頻處理

## 🌐 部署

**已自動部署到 Vercel**
- 訪問：https://tenki-emotion-app.vercel.app
- GitHub：https://github.com/Poshen100/tenki-emotion-app

每當您提交代碼到 main 分支，Vercel 會自動重新部署。

## ⚙️ 自訂您的 3D 模型

1. 在 3D AI Studio 生成您的 GLB 模型
2. 上傳到 `models/` 資料夾，名稱為 `3d-head.glb`
3. 應用自動加載新模型

## 📝 更新日誌

### v10.5
- ✅ 優化了 GLB 加載機制
- ✅ 改進的模型狀態指示
- ✅ 更好的錯誤處理

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 許可證

MIT License - 自由使用和修改

---

**Made with ❤️ by Poshen100**
