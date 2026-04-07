# Privacy Architecture — TENKI CORE

> **最後更新**：2026-04-07  
> **版本**：v1.0  
> **狀態**：Active  
> **原則**：你的身體數據，永遠是你的。

---

## 1. 文件目的

本文件定義 TENKI CORE 的**完整隱私架構**。

所有工程師、autonomous agent、以及第三方合作夥伴在設計或實作任何與使用者數據相關的功能之前，必須先閱讀並遵守本文件。

---

## 2. 隱私哲學

### 2.1 核心信念

```
生理數據是人最私密的資訊之一。
TENKI 不出租、不販賣、不上傳你的身體數據。
你的數據屬於你，永遠屬於你。
```

### 2.2 設計原則

| 原則 | 定義 |
|------|------|
| **Local-first** | 預設所有敏感數據留在裝置端，雲端是例外而非預設 |
| **Minimal collection** | 只收集產品功能所必需的數據，不多收 |
| **Consent-separated** | 每個數據類別獨立取得同意，不打包 |
| **Zero raw telemetry** | 絕不遙測原始生理訊號 |
| **Transparent** | 使用者隨時可以查看、匯出、刪除自己的數據 |
| **Encrypted at rest** | 裝置端數據使用加密儲存 |
| **Secure in transit** | 必須上傳的數據使用 TLS 1.3+ |
| **Right to forget** | 使用者可以完全刪除所有數據且不可回復 |

---

## 3. 敏感數據分類

### 3.1 分類表

| 類別 | 敏感度 | 範例 |
|------|--------|------|
| **S1 — 極高** | 生理原始數據 | HR/HRV/RR 原始量測值、RR interval 序列 |
| **S2 — 高** | 個人化計算結果 | Edge Score、Baseline Profile、Stress Proxy |
| **S3 — 中** | 使用者自述內容 | 反思日誌、情緒評分、Session 筆記 |
| **S4 — 低** | 使用行為數據 | 掃描次數、Session 完成率、功能使用頻率 |
| **S5 — 非敏感** | 系統設定 | 語言偏好、UI 設定、通知偏好 |

### 3.2 敏感度規則

| 敏感度 | 儲存位置 | 加密 | 可上雲 | 需同意 |
|--------|----------|------|--------|--------|
| S1 | 僅裝置端 | ✅ AES-256 | ❌ 永不 | ✅ |
| S2 | 僅裝置端 | ✅ AES-256 | ❌ 永不 | ✅ |
| S3 | 僅裝置端 | ✅ AES-256 | ❌ 永不 | ✅ |
| S4 | 裝置端 | ✅ | ⚠️ 匿名化後允許 (opt-in) | ✅ |
| S5 | 裝置端/雲端 | — | ✅ | — |

---

## 4. Local-Only 數據

以下數據**絕對只能存在於使用者裝置上**：

| 數據 | 來源 | 儲存 | 加密 |
|------|------|------|------|
| HR 原始值 (BPM) | HealthKit / rPPG | Encrypted SQLite | ✅ |
| HRV RMSSD (ms) | HealthKit / rPPG | Encrypted SQLite | ✅ |
| RR Intervals (ms) | HealthKit / rPPG | Encrypted SQLite | ✅ |
| Respiratory Rate (BrPM) | 推算 | Encrypted SQLite | ✅ |
| Edge Score 歷史 | 引擎計算 | Encrypted SQLite | ✅ |
| Baseline Profile | 引擎計算 | Encrypted SQLite | ✅ |
| Stress Proxy 歷史 | 引擎計算 | Encrypted SQLite | ✅ |
| Session 歷史 | 使用者操作 | Encrypted SQLite | ✅ |
| 反思 / 日誌內容 | 使用者輸入 | Encrypted SQLite | ✅ |
| Gate 結果歷史 | 引擎計算 | Encrypted SQLite | ✅ |
| 個人 Pattern 分析 | 引擎計算 | Encrypted SQLite | ✅ |
| 睡眠數據 | HealthKit | Encrypted SQLite | ✅ |

---

## 5. Cloud-Allowed 數據

以下數據**允許上傳至雲端**，但必須遵守對應規則：

| 數據 | 條件 | 目的 |
|------|------|------|
| 訂閱狀態 | 必要 | 驗證付費狀態 |
| 使用者帳號 (email) | 必要 | 帳號管理 |
| Feature Flags | 必要 | 功能開關同步 |
| 匿名 Benchmark 數據 | **Opt-in only** | 與匿名族群比較 |
| Crash Reports | **Opt-in only** | 穩定性監控 |
| 匿名使用統計 | **Opt-in only** | 產品改善 |

### 5.1 匿名 Benchmark 數據格式

上傳的 Benchmark 數據必須經過以下處理：

1. **移除所有個人識別資訊** (PII)
2. **移除原始生理數值**
3. **只保留分桶後的 Zone 分類** (而非精確 Score)
4. **加入 k-anonymity 保護** (每個桶至少 k=50 個使用者)
5. **使用隨機裝置 ID** (不與帳號關聯)

```typescript
// 安全的 Benchmark 上傳格式
interface AnonymousBenchmark {
  deviceIdHash: string;      // SHA256(random_device_id + salt)
  zone: 'clear' | 'neutral' | 'strain';  // 只有 Zone，沒有分數
  timeBucket: 'morning' | 'midday' | 'evening';
  dayOfWeek: number;         // 0-6
  baselineMaturity: 'new' | 'building' | 'ready' | 'mature';
  // ❌ 沒有 Edge Score 數值
  // ❌ 沒有 HR/HRV/RR 數值
  // ❌ 沒有使用者名稱/email
}
```

---

## 6. 加密模型

### 6.1 At Rest (裝置端)

| 儲存層 | 技術 | 用途 |
|--------|------|------|
| Primary Database | **Encrypted SQLite** (SQLCipher / 等效) | 所有 S1–S3 數據 |
| Secrets | **Keychain** (iOS) / **Keystore** (Android) | API tokens, encryption keys |
| Temporary Buffer | **In-memory only** | 掃描中的即時數據流 |

### 6.2 In Transit

| 協定 | 版本 | 用途 |
|------|------|------|
| TLS | 1.3+ | 所有雲端通訊 |
| Certificate Pinning | ✅ | 防止 MITM |

### 6.3 Key Management

| Key | 管理方式 |
|-----|---------|
| SQLite 加密金鑰 | Keychain / Keystore 儲存 |
| API Auth Token | Keychain / Keystore 儲存 |
| Benchmark Device ID Salt | 隨機生成，Keychain 儲存 |

---

## 7. Secure Storage 模型

```
┌─────────────────────────────────────────┐
│          Application Layer               │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Engine       │  │ UI Layer        │   │
│  │ (read/write) │  │ (read only)     │   │
│  └──────┬──────┘  └────────┬────────┘   │
│         │                   │            │
│  ┌──────┴───────────────────┴──────┐     │
│  │      Data Access Layer (DAL)     │     │
│  │   (abstracts all storage)       │     │
│  └────────────┬────────────────────┘     │
│               │                          │
├───────────────┼──────────────────────────┤
│               │     Storage Layer        │
│  ┌────────────┴──────┐  ┌───────────┐   │
│  │ Encrypted SQLite  │  │ Keychain  │   │
│  │  (S1–S4 data)     │  │ (secrets) │   │
│  └───────────────────┘  └───────────┘   │
│  ┌───────────────────┐                   │
│  │    HealthKit      │                   │
│  │  (read only)      │                   │
│  └───────────────────┘                   │
└─────────────────────────────────────────┘
```

---

## 8. Consent 模型

### 8.1 同意類別

| 類別 | 範圍 | 必要性 | 預設 |
|------|------|--------|------|
| **Core App** | 裝置端數據處理 | 必要 (核心功能) | ✅ 接受即同意 |
| **HealthKit** | 讀取 HR/HRV | 可選 | ❌ 需明確同意 |
| **Camera** | rPPG 掃描 | 可選 | ❌ 需明確同意 |
| **Notifications** | 準備度提醒 | 可選 | ❌ 需明確同意 |
| **Benchmark** | 匿名數據分享 | 完全可選 | ❌ 需明確 opt-in |
| **Analytics** | 匿名使用統計 | 完全可選 | ❌ 需明確 opt-in |
| **Crash Reports** | 崩潰報告 | 完全可選 | ❌ 需明確 opt-in |

### 8.2 同意流程

```
Onboarding Step 3: HealthKit 權限
  → 解釋用途 → 系統權限對話框

Onboarding Step 4: Camera 權限
  → 解釋用途 → 系統權限對話框

Onboarding Step 8: Notifications 權限
  → 解釋用途 → 系統權限對話框

Settings → Privacy → Benchmark
  → 解釋用途 → Toggle (off by default)

Settings → Privacy → Analytics
  → 解釋用途 → Toggle (off by default)
```

### 8.3 撤回同意

| 權限 | 撤回方式 | 效果 |
|------|----------|------|
| HealthKit | 系統設定 | 停止讀取 HealthKit 數據 |
| Camera | 系統設定 | 無法進行 rPPG 掃描 |
| Notifications | 系統設定 | 停止推播 |
| Benchmark | App 內 toggle | 停止上傳匿名數據 |
| Analytics | App 內 toggle | 停止收集使用統計 |

---

## 9. Analytics Opt-in 模型

### 9.1 原則

1. **預設關閉** — Analytics 在安裝時預設為 OFF
2. **明確 opt-in** — 使用者必須主動開啟
3. **完全匿名** — 不包含任何 PII
4. **不含生理數據** — 只追蹤功能使用，不追蹤身體指標
5. **隨時可關** — 使用者可隨時關閉

### 9.2 允許追蹤的事件

| 事件 | 包含 | 不包含 |
|------|------|--------|
| `scan_started` | scan_type, mode | ❌ 任何生理數值 |
| `scan_completed` | duration, signal_grade | ❌ Edge Score 數值 |
| `session_completed` | mode, template_id, duration | ❌ Gate 結果 |
| `feature_used` | feature_id | ❌ 內容 |
| `subscription_event` | event_type | ❌ 金額 |

---

## 10. Anonymous Benchmark Participation 模型

### 10.1 Opt-in 流程

```
Settings → Privacy → Benchmark 參與

"分享匿名數據，與社群比較你的準備度模式。
你的個人資料或生理數值永遠不會被上傳。
只有你的 Zone 分類 (Clear/Neutral/Strain) 和
時段資訊 (上午/下午/晚上) 會被匿名分享。"

[開啟 Benchmark 參與]  [了解更多]
```

### 10.2 上傳頻率

- 每日最多 1 次彙總上傳
- 裝置端先 buffer → 24h 批次上傳
- 網路不可用時不上傳，不補傳

---

## 11. Data Retention Policy

### 11.1 裝置端

| 數據 | 保留期限 | 刪除方式 |
|------|----------|----------|
| HR/HRV/RR 原始數據 | **90 天**自動輪轉 | 超過 90 天自動清除 |
| Edge Score 歷史 | **永久** (使用者可手動刪除) | 使用者刪除 |
| Baseline Profile | **永久** (持續更新) | 使用者重置 |
| Session 歷史 | **永久** | 使用者刪除 |
| 反思日誌 | **永久** | 使用者刪除 |
| 掃描快取 | **7 天** | 自動清除 |
| 臨時運算 buffer | **Session 結束即清** | 自動 |

### 11.2 雲端

| 數據 | 保留期限 | 刪除觸發 |
|------|----------|----------|
| 訂閱狀態 | 訂閱期間 + 30 天 | 帳號刪除 |
| 匿名 Benchmark | **匿名化後 365 天** | 自動輪轉 |
| Crash Reports | **90 天** | 自動輪轉 |
| 匿名使用統計 | **180 天** | 自動輪轉 |

---

## 12. Data Deletion Flow

### 12.1 使用者操作

```
Settings → Privacy → 刪除所有數據

"這將永久刪除此裝置上的所有 TENKI 數據，包括：
• 所有掃描歷史
• 你的個人基線
• 所有 Session 紀錄
• 所有反思日誌
• 所有設定

此操作無法撤銷。"

[永久刪除所有數據]    [取消]
```

### 12.2 技術流程

```
1. 顯示確認對話框
2. 使用者確認
3. 清除 Encrypted SQLite 整個 database
4. 清除 Keychain 中的加密金鑰
5. 清除所有 UserDefaults
6. 清除所有快取
7. 如有雲端數據 → 發送刪除請求至後端
8. 重設 app 至初始狀態
9. 導航至 Onboarding
```

---

## 13. Data Export Flow

### 13.1 使用者操作

```
Settings → Privacy → 匯出我的數據

"匯出你在 TENKI 上的所有數據。
數據將以 JSON 格式下載到你的裝置。"

[匯出數據]
```

### 13.2 匯出格式

```json
{
  "export_version": "1.0",
  "exported_at": "2026-04-07T10:00:00Z",
  "user_id": "local_device_hash",
  "data": {
    "scans": [ /* Edge Score + Zone + Timestamp */ ],
    "sessions": [ /* Mode + Template + Duration + Gate */ ],
    "reflections": [ /* Content + Timestamp */ ],
    "baseline": { /* Current profile snapshot */ },
    "settings": { /* All preferences */ }
  }
}
```

### 13.3 不包含在匯出中

- 原始 HR/HRV/RR 數值 (使用者可從 Apple Health 匯出)
- 加密金鑰
- Internal computation states

---

## 14. HealthKit Data Handling

### 14.1 讀取的數據類型

| HealthKit 類型 | 用途 | 寫入 |
|---------------|------|------|
| `HKQuantityType.heartRate` | 壓力/恢復評估 | ❌ 不寫入 |
| `HKQuantityType.heartRateVariabilitySDNN` | 自律神經平衡評估 | ❌ 不寫入 |
| `HKCategoryType.sleepAnalysis` | 恢復品質評估 | ❌ 不寫入 |

### 14.2 處理規則

1. **只讀取，不寫入** HealthKit
2. 讀取後**立即轉換為內部格式**
3. 內部格式存入 **Encrypted SQLite**
4. **不保留 HealthKit 原始 identifier**
5. **不建立 HealthKit 數據快取** — 每次需要時重新讀取

### 14.3 HealthKit 不可用時的降級

| 情境 | 行為 |
|------|------|
| 使用者拒絕 HealthKit 權限 | 僅使用 rPPG 手指掃描 |
| HealthKit 數據不足 | 降低 Confidence，正常計算 |
| 兩者都不可用 | 顯示「需要至少一種數據來源」提示 |

---

## 15. Reflection / Journal Data Handling

### 15.1 規則

1. **存入 Encrypted SQLite**
2. **永不上傳雲端** — 即使 opt-in benchmark 也不上傳文字內容
3. **使用者可逐一刪除或全部清除**
4. **不進行 NLP 分析或情緒偵測** — 反思是私人空間
5. **不在推播或任何外部系統中引用反思內容**

---

## 16. Subscription & Auth Data Handling

### 16.1 訂閱數據

| 數據 | 儲存 | 說明 |
|------|------|------|
| Subscription status | 裝置端 + 雲端 | 需要雲端驗證 |
| Purchase receipt | 裝置端 + Apple/Google | 標準 IAP 流程 |
| Subscription expiry | 裝置端 + 雲端 | 需要雲端驗證 |

### 16.2 帳號數據

| 數據 | 儲存 | 說明 |
|------|------|------|
| Email | 雲端 | 帳號識別 (如有帳號系統) |
| Auth token | Keychain | 認證令牌 |
| Device ID | Keychain | 裝置識別 (UUID) |

### 16.3 無帳號模式

TENKI 支援**無帳號使用**。使用者可以在不建立帳號的情況下使用所有 Free 功能。帳號僅在以下情境需要：

1. 啟用 Premium 訂閱
2. 跨裝置訂閱恢復

---

## 17. Threat Model Overview

| 威脅 | 風險 | 緩解 |
|------|------|------|
| 裝置遺失/被盜 | S1-S3 數據暴露 | Encrypted SQLite + 系統級加密 |
| 中間人攻擊 | 雲端通訊被截獲 | TLS 1.3 + Certificate Pinning |
| Cloud breach | 匿名數據暴露 | 只存匿名化數據，k-anonymity |
| Malicious SDK | 數據洩漏 | 嚴格審查第三方依賴 |
| Backup restore | 舊加密數據暴露 | 加密金鑰存 Keychain (不隨備份) |
| Jailbreak/Root | 加密被繞過 | 偵測 jailbreak 並警告 |
| 截圖 / 螢幕錄影 | 敏感數據被擷取 | 結果頁加 `secureTextEntry` 考量 |

---

## 18. 隱私工程 Checklist

### 18.1 每個新功能上線前

| # | 檢查項 | 通過 |
|---|--------|------|
| 1 | 此功能收集的數據分類是什麼？(S1–S5) | ☐ |
| 2 | 數據儲存在裝置端還是雲端？ | ☐ |
| 3 | 如果儲存在裝置端，是否使用 Encrypted SQLite？ | ☐ |
| 4 | 如果上傳雲端，數據是否已匿名化？ | ☐ |
| 5 | 是否需要新的同意類別？ | ☐ |
| 6 | 使用者是否可以刪除此功能產生的數據？ | ☐ |
| 7 | 使用者是否可以匯出此功能產生的數據？ | ☐ |
| 8 | 此功能是否在Data Deletion Flow中被正確清除？ | ☐ |
| 9 | 是否有任何原始生理數據離開裝置？ | ☐ |
| 10 | Privacy Policy 是否需要更新？ | ☐ |

### 18.2 每次 release 前

| # | 檢查項 | 通過 |
|---|--------|------|
| 1 | 所有 network calls 使用 TLS 1.3+ | ☐ |
| 2 | 沒有任何 S1/S2 數據在 log 中輸出 | ☐ |
| 3 | 沒有任何原始生理數據在 crash report 中 | ☐ |
| 4 | Data deletion flow 正常運作 | ☐ |
| 5 | Data export flow 正常運作 | ☐ |
| 6 | Analytics 預設 OFF | ☐ |
| 7 | Benchmark 預設 OFF | ☐ |
| 8 | 權限說明文字正確 | ☐ |

---

## 19. 產品文案要求

### 19.1 隱私相關文案

所有面向使用者的隱私相關文案必須遵守：

| 規則 | 說明 |
|------|------|
| 具體 | 不說「我們重視你的隱私」，而說「你的心率數據只存在你的手機上」 |
| 行動導向 | 不說「數據被保護」，而說「你可以隨時刪除所有數據」 |
| 不嚇人 | 不強調威脅，強調使用者的控制權 |
| 簡潔 | 用最少的文字傳達最關鍵的資訊 |

### 19.2 Settings → Privacy 頁面結構

```
隱私控制

📱 裝置端數據
  你的生理數據和掃描歷史只存在這個裝置上

🏥 HealthKit 連線
  [已連線 / 未連線]
  管理 → 開啟系統設定

📊 匿名 Benchmark 參與
  [關閉]
  分享匿名 Zone 分類以與社群比較

📈 使用統計
  [關閉]
  匿名使用數據幫助我們改善產品

🗑️ 刪除所有數據
  永久刪除此裝置上的所有 TENKI 數據

📦 匯出我的數據
  以 JSON 格式下載你的所有數據
```

---

## 20. Open Questions / Future Guardrails

| # | 問題 | 影響 | 狀態 |
|---|------|------|------|
| 1 | iCloud Backup 是否應包含加密數據？ | 換機體驗 vs 安全性 | 待定 |
| 2 | 是否需要 biometric auth (Face ID / Touch ID) 保護 app？ | 額外安全層 | 待定 |
| 3 | 多裝置同步策略？ | 使用者體驗 vs privacy | 暫不實作 |
| 4 | GDPR Data Processing Agreement？ | 歐盟合規 | 需法律顧問 |
| 5 | 是否需要 Privacy Impact Assessment？ | 合規性 | 需法律顧問 |
| 6 | HealthKit data 之外的 Health Connect (Android) 策略？ | Android 對等 | Phase C |
| 7 | 兒童隱私 (COPPA) 適用性？ | 年齡限制 | 設定為 17+ |

---

*— END OF PRIVACY ARCHITECTURE v1.0 —*
