# Tenki Core - 情緒與健康風險指數即時偵測平台

## 專案願景

成為用戶首選的「情緒＋健康風險指數」即時偵測與風控平台，透過手機 Face ID 面部微表情＋心率變異(ECG/PPG) 結合讀取穿戴裝置資料以多模態的各種資訊，提供最精準的 TEI（情緒指數），並以簡易可視化提示與自動化行動建議，協助日常與交易決策。

## 專案定位

### 消費者層面
每日情緒與壓力自我管理工具

### 專業層面
金融、健康、運動場景風險預警支援

## 設計理念

**目標**：最準確、最專業、最普及的情緒檢測 APP
**設計風格**：iPhone 極簡、無縫感設計（參考 Apple Design Guidelines）
**視覺參考**：星塵靈魂視覺動效（v25.8.2 版代碼）- 形隨機能

---

## 技術架構

### 前端技術棧
- **框架**: React Native / Flutter（待確認）
- **狀態管理**: Redux / Zustand
- **UI 庫**: React Native Paper / Flutter Material
- **動畫**: Lottie / Rive（星塵靈魂視覺效果）
- **圖表**: Recharts / Victory Native

### 後端技術棧（未來部署）
- **雲端平台**: Google Cloud Run
- **語言**: Python (FastAPI) / Node.js
- **資料庫**: PostgreSQL / Firestore
- **快取**: Redis

### 核心技術
1. **Face ID 面部微表情分析**
   - iOS: ARKit Face Tracking
   - Android: ML Kit Face Detection
   - 表情單元 (Action Units) 識別

2. **心率變異 (HRV) 偵測**
   - PPG (Photoplethysmography): 手機相機 + 閃光燈
   - ECG: Apple Watch / 其他穿戴裝置數據讀取
   - rMSSD, SDNN, pNN50 等指標計算

3. **穿戴裝置整合**
   - Apple HealthKit (iOS)
   - Google Fit / Health Connect (Android)
   - Garmin Connect API
   - 同步 HRV, 心率, 壓力值, 呼吸率數據

4. **多模態數據融合**
   - 面部表情特徵向量
   - HRV 時域/頻域特徵
   - 穿戴裝置歷史數據
   - 機器學習模型融合（Ensemble）

---

## 核心功能規格

### 1. 漸進式精度優化機制 ⭐ 核心特色

#### 初步掃描（2秒）
- **目的**: 快速決策輔助
- **輸出**: 
  - TEI 分數（粗略，範圍 ±10）
  - 視覺反饋（星塵動效開始）
- **數據來源**: 
  - 面部表情初步分析
  - 短時 PPG 信號（10-15 心跳）

#### 標準掃描（15-30秒）
- **目的**: 日常使用平衡點
- **輸出**:
  - TEI 分數（中等精度，範圍 ±5）
  - HRV 基礎指標（SDNN, rMSSD）
  - 自律神經初步評估
- **數據來源**:
  - 完整面部表情分析
  - 30-60 個 RR 間期
  - 穿戴裝置近期數據（如可用）

#### 深度掃描（60秒+）
- **目的**: 專業級精度
- **輸出**:
  - TEI 分數（高精度，範圍 ±2）
  - 完整 HRV 頻域分析（LF, HF, LF/HF）
  - 自律神經詳細報告
  - 壓力恢復建議
- **數據來源**:
  - 多模態數據完整融合
  - 60-90 個有效 RR 間期
  - 歷史趨勢對比

#### 累積優化模式
- 背景持續收集有效 HRV 數據點
- 達到 60/90 個有效點時自動觸發精度升級
- 無縫更新 UI，不中斷使用者體驗

### 2. 校準模式

#### iPhone 特定優化
- **Face ID 深度數據**: TrueDepth 相機 3D 面部特徵
- **Apple Watch 整合**: 
  - ECG 數據（如可用）
  - 高精度 HRV from Apple Health
  - 血氧飽和度（SpO2）
- **CoreMotion**: 加速度計、陀螺儀輔助姿勢偵測

#### 非 iPhone 優化
- **Google Fit / Health Connect**: 
  - 讀取第三方穿戴裝置數據
  - Garmin, Fitbit, Samsung Health 整合
- **ML Kit**: 面部表情分析
- **相機 API**: 高頻 PPG 採樣優化

#### 校準流程
1. **初次使用**: 引導使用者完成 3 分鐘基準測試
2. **定期校準**: 每週提醒重新校準（可選）
3. **自適應學習**: 根據使用者反饋持續優化模型
4. **設備對照**: 如有穿戴裝置，自動校準 TEI 基準線

### 3. 多模態數據整合

#### 數據來源優先級
1. **即時數據**（權重 60%）
   - 面部表情
   - PPG 心率/HRV
   
2. **穿戴裝置數據**（權重 30%）
   - Apple Health / Google Fit
   - Garmin Connect
   
3. **歷史趨勢**（權重 10%）
   - 個人基準線
   - 時段特徵（早晨/午後/晚間）

#### 融合策略
- **加權平均**: 根據數據可靠性動態調整權重
- **異常檢測**: 剔除異常值（如運動後立即測量）
- **缺失處理**: 單一數據源缺失時自動降級但不中斷

---

## UI/UX 設計規格

### 主掃描介面（參考 v25.8.2 星塵靈魂視覺）

#### 佈局結構
```
┌─────────────────────────────┐
│      [狀態列/導航列]          │
├─────────────────────────────┤
│                             │
│   ╭───────────────────╮     │
│   │                   │     │
│   │   星塵靈魂動效區    │     │
│   │   (視覺核心)       │     │
│   │                   │     │
│   ╰───────────────────╯     │
│                             │
│   ┌─────────┬─────────┐     │
│   │  TEI    │   HRV   │     │  ← 雙環數字
│   │   87    │   65    │     │
│   └─────────┴─────────┘     │
│                             │
│   [━━━━━━━ 15s ━━━━━━━]     │  ← 計時器功能列
│                             │
│   ╔═══════════════════╗     │
│   ║  Snapshot 區       ║     │  ← 即時數據區
│   ╠═══════════════════╣     │
│   ║ 交感 ━━━━━━━ 72%  ║     │
│   ║ 副交感 ━━━━━ 45%  ║     │
│   ║ 壓力值: 58        ║     │
│   ║ 心率: 72 bpm      ║     │
│   ║ RR: 14 bpm        ║     │
│   ╚═══════════════════╝     │
│                             │
│   [🔵 開始掃描]              │  ← 主操作按鈕
└─────────────────────────────┘
```

#### 星塵靈魂視覺動效（保留 v25.8.2）
- **粒子系統**: 根據 HRV 數值動態變化密度/顏色
- **呼吸動畫**: 同步使用者呼吸節奏（RR interval）
- **情緒色彩映射**:
  - 高 TEI (80+): 冷靜藍/綠
  - 中 TEI (50-79): 溫暖黃/橙
  - 低 TEI (<50): 警示紅/紫
- **流動感**: 平滑的形態變化（Morphing）
- **極簡主義**: 無多餘裝飾，焦點在核心數據

#### 雙環數字設計
```
┌──────────────┬──────────────┐
│   TEI 分數    │   HRV 分數   │
│              │              │
│      87      │      65      │
│   ┌─────┐    │   ┌─────┐    │
│   │ PR99│    │   │     │    │
│   └─────┘    │   └─────┘    │
│              │              │
│  ●●●●●●○○    │  ●●●●○○○○    │  ← 視覺化進度條
└──────────────┴──────────────┘
```
- **TEI 分數**: 1-99 分（PR99 概念，類似 RS Rating）
- **HRV 分數**: 參考 Garmin 演算法（便於對齊穿戴裝置數據）
- **動態更新**: 漸進式優化時數字平滑過渡（不跳動）

#### Snapshot 區（醫療級設計）

##### 自律神經平衡（同步波動圖）
```
交感神經   ┃━━━━━━━━━━━━━━━━━━━┃  72%
副交感神經  ┃━━━━━━━━━━━┃           45%
           └─────────────────────┘
           0s      15s     30s     60s
```
- **即時波形**: 類似 ECG 監視器，顯示交感/副交感動態變化
- **顏色編碼**: 
  - 交感（紅/橙）: 代表活躍/壓力
  - 副交感（藍/綠）: 代表放鬆/恢復
- **平衡指示器**: 中線顯示理想平衡點

##### 生理指標（同步波動）
```
壓力值  [━━━━━━━━━━━━━━━━] 58/100
心率    [━━━━━ 72 ━━━━━] bpm  
RR      [━━━━━ 14 ━━━━━] bpm
```
- **即時曲線**: 微型趨勢圖（Sparkline）
- **正常範圍提示**: 灰色背景區間標示
- **異常警示**: 超出範圍時顏色變化

##### 其他可視化（條件顯示）
- **血氧 (SpO2)**: 如 Apple Watch 可用
- **皮膚電反應 (GSR)**: 如未來整合專用硬體
- **體溫變化**: 如穿戴裝置支援

#### 計時器功能列
```
[━━━━━━━━━━━━━━━━━━━━━━━━━━] 15s
 2s         15s        30s        60s
 ●           ●          ●          ○
快速       標準       深度       專業
```
- **進度條**: 視覺化掃描進度
- **里程碑**: 標示關鍵精度提升點
- **動態提示**: 
  - 2s: "初步結果準備中..."
  - 15s: "精度提升 20%"
  - 30s: "達到標準精度"
  - 60s: "專業級分析完成"

### 結果頁設計（參考 GO Club App）

#### 整體風格
- **卡片式佈局**: 分層展示不同數據類別
- **漸層背景**: 根據 TEI 分數動態調整
- **微動畫**: 數字滾動進場效果

#### 主要元素
```
┌─────────────────────────────┐
│  ┌─────────────────────┐    │
│  │  TEI 分數: 87       │    │
│  │  ★★★★★ 優秀         │    │
│  │  [圓環進度圖]        │    │
│  └─────────────────────┘    │
│                             │
│  ╔═══════════════════╗      │
│  ║ 自律神經平衡       ║      │
│  ║ [雙軸動態圖表]     ║      │
│  ╚═══════════════════╝      │
│                             │
│  ╔═══════════════════╗      │
│  ║ HRV 詳細分析       ║      │
│  ║ SDNN: 45ms        ║      │
│  ║ rMSSD: 38ms       ║      │
│  ║ LF/HF: 1.2        ║      │
│  ╚═══════════════════╝      │
│                             │
│  ╔═══════════════════╗      │
│  ║ AI 洞察與建議      ║      │
│  ║ • 壓力略高，建議... ║      │
│  ║ • 深呼吸 5 分鐘... ║      │
│  ╚═══════════════════╝      │
│                             │
│  [📊 查看歷史] [📤 分享]   │
└─────────────────────────────┘
```

#### 輔助提醒設計（提高精度）

##### 簡短小字提示
```
💡 提示: 保持靜止可提高準確度
💡 校準: 與 Apple Watch 數據對齊中...
💡 建議: 深呼吸有助於穩定讀數
```

##### 動態迷你圖示
- **呼吸指引**: 擴張/收縮動畫引導深呼吸
- **姿勢提醒**: 簡筆畫顯示理想測量姿勢
- **進度指示**: 微型圓環顯示數據收集進度

---

## 技術實作細節

### HRV 計算演算法

#### 時域指標
```python
# SDNN (Standard Deviation of NN intervals)
# 代表整體 HRV，正常值 > 50ms

# rMSSD (Root Mean Square of Successive Differences)
# 代表副交感神經活性，正常值 > 30ms

# pNN50 (Percentage of NN intervals > 50ms)
# 代表心率變異程度，正常值 > 15%
```

#### 頻域指標
```python
# LF (Low Frequency): 0.04-0.15 Hz
# 交感神經 + 副交感神經

# HF (High Frequency): 0.15-0.4 Hz  
# 副交感神經（呼吸性竇性心律不整）

# LF/HF ratio
# 自律神經平衡，理想值 1.5-2.0
```

#### PPG 信號處理流程
1. **原始信號採集**: 手機相機 30-60 FPS
2. **預處理**: 
   - 去除 DC 偏移
   - 帶通濾波 (0.5-4 Hz)
   - 移動平均平滑
3. **峰值檢測**: Pan-Tompkins 演算法變體
4. **RR 間期計算**: 連續峰值時間差
5. **異常值剔除**: 
   - 生理學閾值 (300-2000ms)
   - 統計學離群值 (±3 SD)
6. **HRV 指標計算**: 基於乾淨的 RR 序列

### TEI 分數計算模型

#### 輸入特徵向量
```python
features = {
    # HRV 特徵 (40%)
    'sdnn': float,        # 整體變異
    'rmssd': float,       # 副交感活性
    'lf_hf_ratio': float, # 自律神經平衡
    
    # 面部表情特徵 (30%)
    'smile_intensity': float,      # 微笑強度
    'brow_furrow': float,          # 皺眉程度
    'eye_openness': float,         # 眼睛張開度
    'facial_tension': float,       # 面部緊繃度
    
    # 生理指標 (20%)
    'heart_rate': int,             # 心率
    'respiratory_rate': int,       # 呼吸率
    'stress_index': float,         # 壓力指數
    
    # 穿戴裝置數據 (10%, 可選)
    'device_hrv': float,           # 設備 HRV
    'recent_activity': str,        # 近期活動
    'sleep_quality': float,        # 睡眠品質
}
```

#### 評分邏輯（PR99 系統）
```python
def calculate_tei(features, user_baseline):
    """
    TEI 分數 1-99，百分位排名概念
    類似 RS Rating（相對強度指標）
    """
    # 1. 計算原始分數 (0-100)
    raw_score = weighted_sum(features)
    
    # 2. 個人化調整（對比基準線）
    adjusted_score = normalize_to_baseline(
        raw_score, 
        user_baseline
    )
    
    # 3. 轉換為 PR99 (1-99)
    # 50 = 平均狀態
    # 70+ = 良好狀態
    # 85+ = 優秀狀態
    # 95+ = 極佳狀態
    tei_score = percentile_rank(adjusted_score)
    
    return tei_score
```

#### 精度提升機制
```python
class ProgressiveAccuracy:
    def __init__(self):
        self.confidence_levels = {
            2: 0.6,   # 2秒: 60% 信心度
            15: 0.8,  # 15秒: 80% 信心度
            30: 0.9,  # 30秒: 90% 信心度
            60: 0.95, # 60秒: 95% 信心度
        }
    
    def update_tei(self, duration, features):
        confidence = self.get_confidence(duration)
        tei = calculate_tei(features)
        uncertainty = (1 - confidence) * 10
        
        return {
            'tei': tei,
            'range': (tei - uncertainty, tei + uncertainty),
            'confidence': confidence
        }
```

### 多模態數據融合

#### Ensemble 策略
```python
class MultiModalFusion:
    def __init__(self):
        self.models = {
            'face': FaceExpressionModel(),
            'hrv': HRVAnalysisModel(),
            'device': WearableDataModel(),
        }
        
    def fuse(self, data_sources):
        # 動態權重調整
        weights = self.calculate_weights(data_sources)
        
        predictions = {}
        for source, model in self.models.items():
            if source in data_sources:
                predictions[source] = model.predict(
                    data_sources[source]
                )
        
        # 加權融合
        final_tei = sum(
            predictions[s] * weights[s] 
            for s in predictions
        )
        
        return final_tei
    
    def calculate_weights(self, data_sources):
        """根據數據品質動態調整權重"""
        base_weights = {
            'face': 0.3,
            'hrv': 0.6,
            'device': 0.1
        }
        
        # 數據缺失時重新分配權重
        available = [s for s in base_weights if s in data_sources]
        total = sum(base_weights[s] for s in available)
        
        return {
            s: base_weights[s] / total 
            for s in available
        }
```

---

## 可靠性與精準度

### 臨床驗證基準

#### HRV 測量精度
- **目標**: 與醫療級設備相關係數 r > 0.85
- **參考標準**: 
  - Polar H10 (胸帶 ECG)
  - Apple Watch ECG
  - Garmin Fenix (光學 HRV)

#### TEI 分數驗證
- **主觀情緒量表對照**:
  - PANAS (Positive and Negative Affect Schedule)
  - DASS-21 (Depression, Anxiety, Stress Scale)
- **目標相關性**: r > 0.7

#### 測試協議
```
1. 對照組測試 (n ≥ 30)
   - 同時使用 Tenki + 醫療級設備
   - 記錄相同時段數據
   - 計算相關係數

2. 情緒誘發實驗
   - 觀看情緒誘發影片（快樂/悲傷/壓力）
   - 測量 TEI 變化
   - 驗證敏感度

3. 長期追蹤
   - 用戶每日使用 30 天
   - 記錄主觀情緒日記
   - 分析 TEI 趨勢與情緒相關性
```

### 準確度提升技術

#### 1. 信號品質評估
```python
def assess_signal_quality(ppg_signal):
    """評估 PPG 信號品質"""
    quality_score = 0
    
    # SNR (Signal-to-Noise Ratio)
    snr = calculate_snr(ppg_signal)
    if snr > 10:  # dB
        quality_score += 30
    
    # 波形完整性
    if has_clear_peaks(ppg_signal):
        quality_score += 30
    
    # 穩定性
    if is_stable(ppg_signal):
        quality_score += 40
    
    return quality_score  # 0-100
```

#### 2. 自適應濾波
```python
class AdaptiveFilter:
    def __init__(self):
        self.motion_threshold = 0.1  # g
        self.light_threshold = 0.2   # lux 變化
        
    def filter(self, ppg_signal, motion_data, light_data):
        """根據環境動態調整濾波參數"""
        if motion_data > self.motion_threshold:
            # 強運動偽影，增強濾波
            return bandpass_filter(ppg_signal, 0.8, 3.5)
        elif light_data > self.light_threshold:
            # 光線變化，中度濾波
            return bandpass_filter(ppg_signal, 0.6, 3.8)
        else:
            # 理想條件，保留更多細節
            return bandpass_filter(ppg_signal, 0.5, 4.0)
```

#### 3. 個人化基準線學習
```python
class BaselineLearning:
    def __init__(self, user_id):
        self.user_id = user_id
        self.baseline = self.load_baseline()
        
    def update_baseline(self, new_measurement):
        """滾動更新個人基準線"""
        # 使用指數移動平均
        alpha = 0.1  # 學習率
        self.baseline = (
            alpha * new_measurement + 
            (1 - alpha) * self.baseline
        )
        self.save_baseline()
    
    def normalize_tei(self, raw_tei):
        """基於個人基準線標準化 TEI"""
        return (raw_tei - self.baseline.mean) / self.baseline.std
```

---

## 技術選型與實作路徑

### 階段 1: MVP (本地版本)

#### 技術選擇
- **框架**: React Native（跨平台優先）
  - 理由: 
    - 一套代碼支援 iOS/Android
    - 豐富的健康/感測器套件
    - 快速迭代
    
- **核心套件**:
  ```json
  {
    "react-native-camera": "相機存取",
    "react-native-sensors": "加速度計/陀螺儀",
    "react-native-health": "Apple HealthKit",
    "react-native-google-fit": "Google Fit",
    "lottie-react-native": "星塵動畫",
    "victory-native": "圖表視覺化",
    "react-native-permissions": "權限管理"
  }
  ```

- **數據處理**:
  - 本地 SQLite 儲存歷史記錄
  - AsyncStorage 儲存用戶偏好
  - 本地 TensorFlow Lite 模型推論

#### 開發優先級
1. **Week 1-2**: PPG 心率偵測 + 基礎 HRV
2. **Week 3-4**: 面部表情分析整合
3. **Week 5-6**: 星塵視覺效果 + UI 打磨
4. **Week 7-8**: 穿戴裝置數據讀取
5. **Week 9-10**: TEI 模型訓練 + 校準
6. **Week 11-12**: 測試 + 優化 + Beta 發布

### 階段 2: 雲端版本 (Google Cloud Run)

#### 架構設計
```
┌──────────────┐
│  Mobile App  │
└──────┬───────┘
       │ HTTPS
       ▼
┌──────────────────┐
│  Cloud Run API   │  ← FastAPI / Node.js
│  - TEI 計算      │
│  - 模型推論      │
│  - 數據同步      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Cloud Storage   │  ← 用戶數據
│  Cloud SQL       │  ← PostgreSQL
│  Firestore       │  ← 即時同步
└──────────────────┘
```

#### 雲端服務選擇
- **Cloud Run**: 
  - 無伺服器，按需付費
  - 自動擴展
  - 適合 Solo Founder 成本控制
  
- **Cloud SQL (PostgreSQL)**:
  - 結構化數據（用戶、測量記錄）
  - ACID 保證
  
- **Firestore**:
  - 即時數據同步
  - 離線支援
  
- **Cloud Storage**:
  - 原始信號數據
  - 模型檔案

#### 遷移策略
1. 本地版本先穩定
2. 逐步將運算密集任務移到雲端
3. 混合架構：簡單推論本地，複雜分析雲端
4. 使用 Workbox 實現 Progressive Web App

---

## 可持續迭代優化機制

### 1. A/B 測試框架
```python
class ABTestManager:
    def __init__(self):
        self.experiments = {}
        
    def create_experiment(self, name, variants):
        """
        例: 測試不同 HRV 濾波參數
        variants = {
            'A': {'cutoff': 0.5},
            'B': {'cutoff': 0.7}
        }
        """
        self.experiments[name] = {
            'variants': variants,
            'metrics': {}
        }
    
    def assign_variant(self, user_id, experiment):
        """隨機分配用戶到實驗組"""
        return hash(user_id + experiment) % 2
    
    def track_metric(self, experiment, variant, metric, value):
        """記錄指標"""
        # 例: 'hrv_accuracy', 0.87
        pass
```

### 2. 用戶反饋循環
```python
class FeedbackLoop:
    def collect_implicit_feedback(self, user_action):
        """
        隱式反饋:
        - 是否完成完整掃描（信任度）
        - 是否查看詳細結果（滿意度）
        - 是否分享結果（認可度）
        """
        pass
    
    def collect_explicit_feedback(self, user_rating):
        """
        顯式反饋:
        - 結果準確度評分 (1-5 星)
        - "這次測量準確嗎？"
        """
        pass
    
    def retrain_model(self):
        """定期使用反饋數據微調模型"""
        pass
```

### 3. 持續監控指標
```yaml
dashboards:
  - name: "核心指標"
    metrics:
      - 平均測量時長
      - TEI 分數分布
      - HRV 數據品質分數
      - 錯誤率 (信號丟失)
      
  - name: "用戶行為"
    metrics:
      - DAU/MAU
      - 每日平均掃描次數
      - 功能使用率（校準/深度掃描）
      
  - name: "技術健康"
    metrics:
      - API 延遲 (p95)
      - 崩潰率
      - 電池消耗
      - 內存使用
```

### 4. 模型版本管理
```
models/
├── tei_model_v1.0.tflite  (baseline)
├── tei_model_v1.1.tflite  (improved face features)
├── tei_model_v1.2.tflite  (multi-modal fusion)
└── tei_model_v2.0.tflite  (transformer architecture)
```
- 使用 MLflow 追蹤實驗
- A/B 測試新模型 vs 舊模型
- 逐步推出（10% → 50% → 100%）

---

## 開發環境規範 ⚠️

### 環境管理（必須嚴格遵守）

#### Python 開發
- **必須使用 uv**，不要用 pip、venv、conda
- 指令：`uv add numpy pandas scikit-learn tensorflow`
- 不要汙染系統 Python

#### JavaScript/TypeScript 開發
- **必須使用 nvm** 管理 Node 版本
- 當前版本：Node 20 LTS
- 指令：`nvm use 20`、`npm install`

#### 系統套件
- **優先使用 brew**，不要用 apt/yum
- 指令：`brew install ffmpeg imagemagick`

#### GitHub 操作
- **使用 gh CLI**，不需要 GitHub MCP
- 指令：`gh repo create`、`gh pr create`

#### 容器化
- **使用 docker** 和 **docker compose**
- 不要嘗試重新安裝 runtime

#### 禁止行為
- ❌ 不要用 `sudo pip install`
- ❌ 不要全域安裝 Node 套件
- ❌ 不要用 apt/yum 裝開發工具
- ❌ 不要混用套件管理器

### 程式碼規範

#### TypeScript/React Native
- 使用 TypeScript strict mode
- 優先使用函數式組件與 hooks
- 避免使用 `any`，善用型別推論
- 遵循 Airbnb ESLint + Prettier

#### Python (ML/數據處理)
- 使用 Black 格式化
- Type hints 必須完整
- Docstrings 使用 Google Style

#### Git 提交
- 遵循 Conventional Commits
- `feat:` 新功能
- `fix:` 錯誤修復
- `refactor:` 重構
- `docs:` 文件更新
- `test:` 測試相關

---

## 近期開發日誌

### 2026-01-27
- ✅ 完成 CLAUDE.md 初版
- 🎯 下一步：建立 PPG 信號處理模組
- 💡 想法：參考 HeartRate+ app 的 UI 流暢度

### 2026-02-03
- ✅ CLAUDE.md 建檔完成
- 🎯 專案已部署至 Vercel: tenki-emotion-app.vercel.app

### 規劃中
- [ ] 實作漸進式精度優化機制
- [ ] 整合 Apple HealthKit (iOS)
- [ ] 設計校準流程 UX
- [ ] 建立 TEI 計算基準模型
- [ ] 星塵視覺效果移植到 React Native

---

## Boris Cherny 最佳實踐整合 🔥

基於 Claude Code 創始人的 13 個秘訣，本專案採用以下策略：

### 1. 並行開發
- 同時開啟多個 Claude session 處理不同模組
- iOS 開發 + Android 適配 + 數據模型 並行

### 2. 使用 Claude Opus 4.5 + Thinking
- 複雜演算法（HRV 計算、TEI 模型）用 Opus
- 減少人工修正，提升整體效率

### 3. Plan Mode 優先
- 重大功能（多模態融合、校準系統）先進 Plan mode
- 與 Claude 討論架構，確定後再執行

### 4. 持續更新 CLAUDE.md ⭐ 核心
- **每次 Claude 犯錯就更新此文件**
- Commit 到 git，成為專案知識庫
- Code review 時 tag `@.claude` 更新規範

### 5. 自動化工作流
- `/commit-push-pr`: 提交 + 推送 + 開 PR
- `/run-tests`: 執行完整測試套件
- `/deploy-staging`: 部署到測試環境

### 6. Sub-agents 分工
```bash
# 建議的 sub-agents
/agents/
├── code_optimizer.py    # 程式碼簡化與優化
├── test_generator.py    # 自動生成測試
├── ui_analyzer.py       # UI/UX 一致性檢查
└── performance_auditor.py  # 效能分析
```

### 7. 安全權限管理
- 預先設定安全指令白名單
- 避免每次都要確認權限

### 8. 工具整合 (MCP/CLI)
```yaml
tools:
  - Google Cloud SDK (gcloud CLI)
  - Sentry CLI (錯誤監控)
  - Firebase CLI (部署測試)
  - TestFlight CLI (iOS 發布)
```

### 9. Feedback Loop ⭐ 最重要
- **自動化測試**: 每次改動都跑單元測試
- **Linter**: ESLint + Prettier 自動檢查
- **性能基準**: Lighthouse CI for PWA
- **視覺回歸**: Percy.io 截圖對比
- **實機測試**: BrowserStack / Firebase Test Lab

讓 Claude 自己驗證成果，品質提升 2-3 倍！

---

## 驗證方法 (Feedback Loop)

### 自動化測試套件
```bash
# 單元測試
npm test -- --coverage

# E2E 測試
detox test --configuration ios.sim.debug

# 性能測試
npm run perf-test
```

### 關鍵測試場景
1. **HRV 準確度測試**
   ```python
   def test_hrv_accuracy():
       # 使用模擬心跳信號
       synthetic_rr = generate_synthetic_rr(
           mean=800, std=50, count=60
       )
       hrv = calculate_hrv(synthetic_rr)
       assert hrv.sdnn > 40  # 生理合理範圍
   ```

2. **TEI 穩定性測試**
   ```python
   def test_tei_stability():
       # 同一狀態連續測量，TEI 變化應小
       tei_scores = [measure_tei() for _ in range(5)]
       assert np.std(tei_scores) < 5  # 標準差 < 5
   ```

3. **UI 響應性測試**
   ```javascript
   it('updates TEI score within 2 seconds', async () => {
     await startScan();
     await waitFor(
       () => expect(getTEIScore()).toBeDefined(),
       { timeout: 2000 }
     );
   });
   ```

### 實機驗證清單
- [ ] iPhone 12 Pro (iOS 17)
- [ ] iPhone 15 Pro Max (iOS 18)
- [ ] Samsung Galaxy S23 (Android 14)
- [ ] Google Pixel 8 (Android 14)
- [ ] 佩戴 Apple Watch 時的數據對齊
- [ ] Garmin Fenix 數據對齊

---

## 參考資源

### 學術論文
- Shaffer, F., & Ginsberg, J. P. (2017). An Overview of Heart Rate Variability Metrics and Norms. *Frontiers in Public Health*, 5, 258.
- Task Force (1996). Heart rate variability: Standards of measurement. *European Heart Journal*, 17(3), 354-381.
- Ekman, P., & Friesen, W. V. (1978). Facial Action Coding System (FACS).

### 商業產品參考
- **Elite HRV**: 專業 HRV 追蹤 app
- **Welltory**: 多模態健康分析
- **Oura Ring**: 恢復與準備度評分
- **Garmin Body Battery**: 能量管理
- **GO Club App**: UI/UX 設計參考

### 開源專案
- **HeartPy**: Python HRV 分析庫
- **hrv-analysis**: R 語言 HRV 工具
- **PyPhysio**: 生理信號處理

### 技術文件
- Apple HealthKit Documentation
- Google Fit REST API
- Garmin Health API
- React Native Performance Optimization

---

## 專案里程碑

### Phase 1: MVP (Month 1-3)
- [x] 需求分析與技術選型
- [ ] PPG 心率偵測實作
- [ ] 基礎 HRV 計算
- [ ] 面部表情分析（簡化版）
- [ ] 星塵視覺效果
- [ ] TEI 分數 v1.0
- [ ] iOS TestFlight Beta

### Phase 2: 多模態整合 (Month 4-6)
- [ ] Apple HealthKit 整合
- [ ] Google Fit 整合
- [ ] Garmin Connect API
- [ ] 校準系統實作
- [ ] TEI 模型 v2.0（多模態融合）
- [ ] Android Beta 發布

### Phase 3: 雲端遷移 (Month 7-9)
- [ ] Cloud Run API 部署
- [ ] 用戶數據同步
- [ ] 進階分析功能（趨勢、洞察）
- [ ] 社交功能（分享、比較）
- [ ] 正式發布（App Store + Google Play）

### Phase 4: 專業版功能 (Month 10-12)
- [ ] 金融交易決策模式
- [ ] 運動表現優化模式
- [ ] 醫療級認證準備（FDA/CE）
- [ ] B2B 企業版（壓力管理平台）

---

## 團隊協作規範（未來擴展）

### CLAUDE.md 更新流程
1. **發現錯誤/改進點**
   - 記錄到 Issue
   - 標記 `claude-learning`

2. **更新 CLAUDE.md**
   - 新增規則到相關章節
   - 提供正確範例
   - 說明原因

3. **Code Review**
   - PR 中 tag `@.claude`
   - Claude 自動檢查是否違反規則
   - 通過後合併

4. **定期審查**
   - 每月檢視 CLAUDE.md
   - 移除過時規則
   - 整合重複內容

---

## 附錄

### A. 技術術語表
- **HRV**: Heart Rate Variability（心率變異）
- **PPG**: Photoplethysmography（光體積描記術）
- **ECG**: Electrocardiogram（心電圖）
- **TEI**: Tenki Emotion Index（Tenki 情緒指數）
- **SDNN**: Standard Deviation of NN intervals
- **rMSSD**: Root Mean Square of Successive Differences
- **LF/HF**: Low Frequency / High Frequency ratio

### B. 聯絡資訊
- **專案負責人**: [Your Name]
- **技術諮詢**: [Tech Advisor]
- **醫療顧問**: [Medical Advisor]

### C. 授權聲明
- 本專案遵循 MIT License
- 健康數據處理符合 HIPAA/GDPR 規範
- 用戶數據隱私優先

---

**文件版本**: v1.0  
**最後更新**: 2026-02-03  
**下次審查**: 2026-03-03

---

## Claude，請遵守以上所有規範開始協助開發！🚀
