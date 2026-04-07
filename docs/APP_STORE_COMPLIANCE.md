# App Store Compliance Playbook — TENKI CORE

> **最後更新**：2026-04-07  
> **版本**：v1.0  
> **狀態**：Active  
> **目標**：在 Health & Fitness 分類下最大化 Apple App Store 審核通過機率

---

## 1. 文件目的

本文件是 TENKI CORE 提交 Apple App Store 審核的**完整操作手冊**。

任何負責 App Store 提交的人員（包括 autonomous agent），在填寫 App Store Connect 之前必須完整讀取本文件。

---

## 2. 產品分類策略

| 項目 | 決策 |
|------|------|
| Primary Category | **Health & Fitness** |
| Secondary Category | Lifestyle |
| Rating | 4+ |
| 含 In-App Purchases | ✅ (Auto-Renewable Subscription) |
| 含 HealthKit | ✅ (HR, HRV 讀取) |
| 含 Camera | ✅ (rPPG 手指掃描) |
| 含 Notifications | ✅ (Readiness 提醒) |

---

## 3. App Store 分類理由

### 3.1 為什麼是 Health & Fitness

1. TENKI 的核心功能是**追蹤壓力、恢復、專注力**，這些是 Health & Fitness 的標準功能
2. 使用 HealthKit 讀取心率、HRV 數據
3. 提供呼吸練習功能
4. 不提供任何金融交易功能
5. 不提供任何醫療診斷功能

### 3.2 為什麼不是 Finance

1. TENKI **不連接任何券商 API**
2. TENKI **不顯示任何股票報價**
3. TENKI **不提供買賣建議**
4. TENKI **不執行任何交易**
5. Trader Mode 是「決策紀律工具」，幫助使用者管理決策前的情緒狀態

### 3.3 為什麼不是 Medical

1. TENKI **不進行醫療診斷**
2. TENKI **不提供治療建議**
3. TENKI **不聲稱可偵測疾病**
4. 所有指標明確標示為「僅供參考」
5. 明確提示使用者如有健康疑慮應諮詢專業醫療人員

---

## 4. 審核風險地圖

| 風險 | 等級 | 觸發蘋因 | 緩解策略 |
|------|------|----------|----------|
| HealthKit 使用 | 🟡 中 | Apple 審核 HealthKit 使用是否合理 | 清楚說明用途、只讀取需要的數據 |
| Camera 使用 | 🟡 中 | 需要合理解釋為何使用相機 | 說明 rPPG 光學感測原理 |
| 健康 claim | 🟠 高 | 任何未經驗證的健康聲稱 | 所有文案加「僅供參考」、不使用診斷語言 |
| Trader Mode 名稱 | 🟠 高 | 審核員可能認為是金融 app | 在 Review Notes 中明確說明定位 |
| AI 洞察 | 🟡 中 | Apple 對 AI 生成建議謹慎 | 強調「觀察」非「建議」，加 disclaimer |
| 訂閱定價 | 🟢 低 | 標準 auto-renewable | 遵循 Apple 訂閱指南 |
| 隱私政策 | 🟡 中 | Apple 檢查隱私合規 | 準備完整 Privacy Policy URL |

---

## 5. 禁用語言 — Red Flag 詞彙

以下詞彙**絕對不能出現**在 App Store metadata、截圖、或審核可見的任何位置：

### 5.1 金融類

| 🚫 禁用 | 原因 |
|---------|------|
| 交易 / Trade / Trading | 暗示金融交易功能 |
| 買 / 賣 / Buy / Sell | 暗示交易執行 |
| 加倉 / 減倉 | 交易術語 |
| 停損 / Stop Loss | 交易術語 |
| 獲利 / Profit | 暗示金融回報 |
| 市場 / Market | 暗示連接金融市場 |
| 股票 / Stock | 金融工具 |
| 投資 / Investment | 金融活動 |
| 策略 / Strategy (用於金融語境) | 暗示交易策略 |
| Portfolio | 投資組合 |

### 5.2 醫療類

| 🚫 禁用 | 原因 |
|---------|------|
| 診斷 / Diagnose | 醫療 claim |
| 治療 / Treat / Cure | 醫療 claim |
| 偵測疾病 / Detect disease | 醫療 claim |
| 處方 / Prescription | 醫療 claim |
| 臨床 / Clinical | 暗示醫療級準確度 |
| 醫療級 / Medical-grade | 需要 FDA 認證 |

### 5.3 確定性語言

| 🚫 禁用 | 原因 |
|---------|------|
| 保證 / Guarantee | 過度承諾 |
| 100% 準確 | 不可能的聲稱 |
| 一定會 / Will | 過度確定性 |
| 預測 / Predict | 暗示預報能力 |
| 科學證實 / Scientifically proven | 需要具體引用 |

---

## 6. 安全替代語言

| 🚫 不安全 | ✅ 安全替代 |
|----------|------------|
| 交易準備度 | 決策準備度 |
| 交易建議 | 決策洞察 |
| 市場時機 | 行動時機 |
| 交易紀律 | 決策紀律 |
| 最佳交易狀態 | 最佳決策狀態 |
| 交易模式 | 決策模式 / 紀律模式 |
| 你應該 | 你可以考慮 |
| 偵測到 | 觀察到 |
| 診斷 | 觀察 / 參考指標 |
| 準確 | 參考 |
| 測量 | 估測 / 觀察 |

---

## 7. Reviewer Notes 模板

> 直接貼入 App Store Connect → App Review → Review Notes

```
Dear Review Team,

Thank you for reviewing TENKI.

TENKI is a cognitive wellness app in the Health & Fitness category.

PURPOSE:
TENKI helps users understand their physiological readiness before making important decisions. It tracks stress, recovery, focus, and emotional balance using heart rate variability (HRV) data from HealthKit and optional camera-based pulse estimation (rPPG).

WHAT TENKI IS:
- A personal wellness and self-awareness tool
- A stress and recovery tracker
- A breathing exercise companion
- A decision readiness indicator (not predictor)

WHAT TENKI IS NOT:
- NOT a medical device or diagnostic tool
- NOT a financial/trading application
- NOT connected to any financial market or platform
- NOT providing medical advice or treatment recommendations

HEALTHKIT USAGE:
TENKI reads heart rate (HR) and heart rate variability (HRV) from HealthKit to help users understand their stress and recovery patterns. This data stays on device and is never uploaded to our servers.

CAMERA USAGE:
TENKI uses the rear camera for optical pulse estimation (rPPG) via fingertip. The camera captures light absorption changes to estimate heart rate. No photos or videos are stored or transmitted.

ABOUT "DECISION MODE":
TENKI includes a feature called "Decision Mode" which provides users with a structured routine before making important decisions. This is a mindfulness and emotional regulation tool — similar to pre-performance routines used by athletes. It provides breathing exercises, readiness checklists, and session timers. It does NOT provide any financial advice, trading signals, or market analysis.

DISCLAIMER:
All metrics shown in TENKI are for personal reference only. Users are advised to consult healthcare professionals for medical concerns. TENKI does not provide medical diagnoses or financial advice.

Test Account:
Email: [test account email]
Password: [test account password]

Please don't hesitate to reach out if you have questions.

Best regards,
TENKI Team
```

---

## 8. App Store Description 草稿

### 8.1 Full Description (4000 chars max)

```
在你做最重要的決定之前，先了解你自己。

TENKI 是你的決策準備度夥伴。透過追蹤你的壓力、恢復、專注力與情緒平衡，TENKI 幫助你理解什麼時候你的身心狀態最適合做出清晰的判斷。

■ 了解你的狀態
透過 Apple Watch 或手指光學感測，TENKI 即時分析你的心率變異(HRV)、呼吸節律和壓力水平，產生個人化的 Edge Score。這個分數反映你當前的身心清明度 — 不是預測工具，而是自我覺察的鏡子。

■ 建立準備流程
在重要決策前進行 30 秒掃描，確認你的身體準備好了沒有。結合引導式呼吸練習和準備度檢核，幫助你建立可重複的決策前 SOP。

■ 追蹤你的模式
觀察自己在不同時段、不同日子的狀態變化。了解什麼時候你通常最清醒、什麼時候最需要恢復。

■ 四種情境模式
• 健康重置 — 壓力管理與恢復追蹤
• 專注模式 — 深度工作準備
• 表現模式 — 身體就緒度追蹤
• 決策模式 — 結構化決策準備流程

■ 隱私第一
你的身體數據永遠留在你的裝置上。TENKI 不會上傳你的心率、HRV 或任何生理數據。你可以隨時刪除所有數據。

■ Premium 功能
• 無限掃描
• 完整歷史紀錄
• 個人模式分析
• 全部情境模式
• 進階 Lab 工具

重要提示：TENKI 提供的所有指標僅供個人參考，不構成醫療診斷或任何專業建議。如有健康疑慮，請諮詢專業醫療人員。
```

---

## 9. Subtitle Options

限 30 字元：

| 選項 | 字元數 |
|------|--------|
| `Know Yourself Before You Decide` | 32 — 太長 |
| `Decision Readiness & Wellness` | 30 ✅ |
| `Stress, Recovery & Focus` | 26 ✅ |
| `Your Body Knows First` | 22 ✅ |
| `Focus · Stress · Recovery` | 27 ✅ |

**推薦**：`Decision Readiness & Wellness`

---

## 10. Promo Text Options

限 170 字元，可隨時更新：

| 選項 |
|------|
| `在做重要決定前，花 30 秒確認你的身心準備度。TENKI 追蹤你的壓力、恢復和專注力，幫助你做出更清晰的判斷。` |
| `Your body knows before you do. Track stress, recovery, and focus to make clearer decisions.` |

---

## 11. Keywords 方向

限 100 字元，逗號分隔：

```
HRV,stress,recovery,focus,wellness,meditation,breathing,mindfulness,readiness,biometric
```

**避免的 keywords**：trading, stock, market, investment, medical, diagnosis

---

## 12. In-App Disclaimer Copy

### 12.1 首次啟動 Disclaimer

```
TENKI 提供的所有指標和觀察僅供個人健康參考。
本應用程式不是醫療設備，不提供醫療診斷或治療建議。
如有任何健康疑慮，請諮詢專業醫療人員。
你的生理數據只儲存在你的裝置上。
```

### 12.2 App Store Review Disclaimer (嵌入 Settings)

```
TENKI is a wellness and self-awareness tool. All metrics are 
estimates for personal reference only. TENKI does not provide 
medical diagnoses, treatment recommendations, or financial advice. 
Consult a healthcare professional for medical concerns.
```

### 12.3 底部固定免責 (每個結果頁)

```
僅供個人參考，非醫療或專業建議
```

---

## 13. Permission Prompt Copy

### 13.1 Camera

```
Title: TENKI 需要使用相機
Body: 將手指輕放在鏡頭上，TENKI 透過光學感測估算你的心率和壓力水平。
不會拍攝照片或影片，也不會儲存任何影像。
```

### 13.2 HealthKit

```
Title: 連接 Apple Health
Body: TENKI 讀取你的心率和心率變異(HRV)數據，用來分析你的壓力和恢復狀態。
這些數據只在你的裝置上處理，絕不會上傳到我們的伺服器。
```

### 13.3 Notifications

```
Title: 啟用準備度提醒
Body: TENKI 會在偵測到你的身心狀態特別好（或需要注意）的時候提醒你。
你隨時可以在設定中關閉提醒。
```

---

## 14. 推播通知措辭規則

### 14.1 允許

| ✅ 安全 |
|--------|
| 你的身體準備好了 — 現在是保持專注的好時機 |
| 建議暫停一下 — 做幾次深呼吸再繼續 |
| 今天的恢復表現不錯 — 來看看你的進展 |
| 你已經有 3 天沒有掃描了 — 花 30 秒確認自己的狀態 |

### 14.2 禁止

| 🚫 不安全 | 原因 |
|----------|------|
| 市場開盤了，你準備好了嗎？ | 暗示金融交易 |
| 你的壓力是 85，不要做重要決定！ | 具體數值 + 指令性語言 |
| 你的 Edge Score 快到高點了！ | 催促性語言 |
| 立刻打開 TENKI | 催促 |

---

## 15. 截圖 / Metadata 指引

### 15.1 安全展示的功能

| 功能 | 截圖建議 |
|------|----------|
| Edge Score 圓環 | ✅ 核心視覺，必須展示 |
| Zone 狀態 (Clear/Neutral/Strain) | ✅ 直觀易理解 |
| 呼吸練習 | ✅ 強化 wellness 定位 |
| 掃描流程 | ✅ 展示核心互動 |
| 壓力/恢復指標 | ✅ 標準 Health & Fitness |
| Timeline 趨勢圖 | ✅ 自我追蹤 |
| Finger Heat Zone | ✅ 獨特且視覺吸引力高 |

### 15.2 需謹慎框架的功能

| 功能 | 框架方式 |
|------|----------|
| Trader Mode / Decision Mode | 截圖中標示為「Decision Mode」，不出現「Trader」 |
| Session 計時器 | 框架為「專注計時」 |
| 模板列表 | 截圖中使用 Health/Focus 模板，不顯示 FBD/CANSLIM |

### 15.3 絕不出現在 Metadata 中

| 🚫 禁止 |
|---------|
| 任何包含金融數據的畫面 |
| 任何出現「交易」「買賣」字樣的畫面 |
| FBD / CANSLIM / Mode 2 模板名稱 |
| 任何暗示金融績效的圖表 |
| 任何包含具體醫療聲稱的文字 |

### 15.4 截圖 Caption 範例

| 截圖 | Caption |
|------|---------|
| Edge Score 圓環 | 了解你的決策準備度 |
| 掃描中畫面 | 30 秒了解你的身心狀態 |
| 呼吸練習 | 引導式呼吸，找回平靜 |
| Timeline | 追蹤你的壓力與恢復模式 |
| 結果頁 | 你的今日身心報告 |

---

## 16. 安全展示的功能

見 Section 15.1

---

## 17. 需謹慎框架的功能

見 Section 15.2

---

## 18. 絕不出現在 Metadata 中的內容

見 Section 15.3

---

## 19. 提交 Checklist

| # | 項目 | 狀態 |
|---|------|------|
| 1 | App Store Description 完成 | ☐ |
| 2 | Subtitle 確認 | ☐ |
| 3 | Keywords 確認 | ☐ |
| 4 | Promo Text 確認 | ☐ |
| 5 | 截圖 5 張以上 (每個尺寸) | ☐ |
| 6 | 截圖中無金融/醫療語言 | ☐ |
| 7 | Category = Health & Fitness | ☐ |
| 8 | Rating = 4+ | ☐ |
| 9 | Privacy Policy URL 有效 | ☐ |
| 10 | HealthKit Usage Description 填寫 | ☐ |
| 11 | Camera Usage Description 填寫 | ☐ |
| 12 | Notification Usage Description 填寫 | ☐ |
| 13 | In-App Disclaimer 嵌入 Settings | ☐ |
| 14 | Reviewer Notes 填寫 | ☐ |
| 15 | Test Account 提供 | ☐ |
| 16 | 所有文案通過 safe-copy 驗證 | ☐ |
| 17 | 截圖中 Trader Mode 更名為 Decision Mode | ☐ |
| 18 | FBD/CANSLIM 名稱不出現在可見 UI | ☐ |
| 19 | Subscription 頁面說明清晰 | ☐ |
| 20 | Restore Purchases 按鈕存在 | ☐ |

---

## 20. 被拒後的應對策略

### 20.1 常見被拒原因與回應

#### 原因 A：「你的 app 似乎提供金融建議」

```
回應模板：

Thank you for your review. We'd like to clarify that TENKI is 
a cognitive wellness application in the Health & Fitness category.

TENKI does NOT:
- Connect to any financial markets
- Display stock prices or financial data
- Provide trading signals or buy/sell recommendations
- Execute any financial transactions

The "Decision Mode" feature helps users build pre-decision 
routines using breathing exercises, readiness checklists, and 
session timers — similar to pre-performance routines used by 
athletes and public speakers.

All features focus on stress management, emotional regulation, 
and self-awareness — core aspects of cognitive wellness.

We have updated our app description and in-app copy to further 
clarify this positioning. Please let us know if you need any 
additional information.
```

#### 原因 B：「你的 app 似乎提供醫療功能」

```
回應模板：

Thank you for your feedback. TENKI is a wellness and 
self-awareness tool, not a medical device.

TENKI does NOT:
- Provide medical diagnoses
- Recommend treatments
- Claim to detect diseases
- Replace professional medical advice

All biometric indicators (HRV, stress level, recovery score) 
are clearly labeled as "estimates for personal reference only." 
Users are prompted to consult healthcare professionals for 
medical concerns.

We have added more prominent disclaimer text throughout the 
app. Please let us know if you need further clarification.
```

#### 原因 C：「HealthKit 使用目的不清楚」

```
回應模板：

TENKI reads heart rate (HR) and heart rate variability (HRV) 
from HealthKit to calculate the user's stress and recovery 
patterns. This is consistent with other Health & Fitness apps 
that use HealthKit for wellness tracking.

Specific usage:
1. HR: Used to assess current arousal/stress level
2. HRV: Used to assess autonomic nervous system balance 
   and recovery status

This data is processed locally on device and never uploaded 
to our servers.
```

---

*— END OF APP STORE COMPLIANCE PLAYBOOK v1.0 —*
