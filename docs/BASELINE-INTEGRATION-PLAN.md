# BASELINE-INTEGRATION-PLAN.md — 第一次基線掃描:完美整合 + 爽感升級計畫

> **Status**: Plan v1.0(2026-05-11)
> **Target surface**: `apps/preview/`(Vercel `/preview/`)→ 之後同步 `apps/mobile/`
> **不動**: `apps/web/`
> **依據**:
> - `docs/BASELINE-FLOW-SPEC.md` v1.1(WHAT)
> - 本檔(HOW + 爽感層)
> - Founder 命題:「爽感要提升」

---

## 0. 為什麼有這份 plan

Spec 講「要做什麼」(progressive disclosure、長按 gesture、2×2 dot、副標 fade-swap、不要 sparkline)。本檔講三件 spec 沒講的事:

1. **整合節奏** — 哪幾個 gap 先做、哪些可以併在同一個 commit、哪些必須等 mobile native
2. **爽感框架** — 多感官分層(視覺 / 動效 / 觸覺 / 聲音 / 時間設計),先給原則再給點位
3. **第一次掃描的 magic moment** — onboarding 只發生一次,值得專門設計一個「TENKI 已經記住你了」的告白瞬間

---

## 1. 當前部署狀態盤點(2026-05-11 prod `/preview/`)

### ✅ 已完成(別重做)

| 項目 | 位置 | 狀態 |
|---|---|---|
| 6 步 onboarding stepper | `baseline-onboarding.js:54-61` | 結構完整 |
| Ceremony → result routing(spec §1 的 bug) | `baseline-onboarding.js:1240` `enterTransition()` | **已修**,正確進 `step-result`,不跳 FHZ |
| Result page 三張 metric cards + confidence badge + CTA | `index.html:328-360` | 100% 符合 spec |
| Ceremony stardust + climax flash | `styles.css:1332-1434`,`CLIMAX_MS=1500ms` | 視覺到位 |
| 數字 reveal(`—` → 真值) | `revealBaselineDigits()` @ 1000ms beat | 已有 |
| 即時訊號(coverage/brightness/stability/sqi/bpm) | `camera-scan.js` 30Hz `onSample()` | **資料已現成**,只是沒接到主畫面 |
| Readiness 4 條 meters | `index.html:156-184` | 已用 sample 資料 |

### ❌ Spec v1.1 要、現在沒有

| 項目 | Spec 段落 | 影響 |
|---|---|---|
| 長按圓環 600ms → debug drawer | §2.2、§2.5 | 完全無觸發機制 |
| 左下 2×2 dp 呼吸點(liveness) | §2.4 | 用戶不知相機是否運作 |
| 右下 96×96 相機縮圖(red 時 spring 展開) | §2.4 | 訊號爛時沒有「肉眼校正」管道 |
| 三條品質條 drawer(coverage/stability/signal) | §2.5 | 醫療專業感未整合 |
| 主標永遠 / 副標依 zone 換 | §2.3 | `ceremony-dialog-text` 還是寫死「正在凝聚你的生理基線」 |
| 副標 240ms fade-swap、zone-transition-only | §2.3 | 沒有 zone 狀態追蹤 |
| 圓環顏色 ambient(green/amber/red) | §2.2 | 圓環一直 cyan,不反映品質 |

---

## 2. 爽感框架:5 層感官,排優先序

> **設計原則**:爽感不是堆特效,是「身體先知道,腦袋後懂」。
> 每一層都要能單獨關掉(accessibility + 「老人模式」)而不破壞核心訊息。

### Layer 1 — Sympathetic Pulse(最高槓桿)
**圓環隨真實心跳同步呼吸**。`camera-scan.js` 已經偵測 PPG peak,在每次 peak 給圓環一個 +2% scale 的 spring(80ms attack / 240ms release)。

> 效果:用戶第一次看到自己的心跳被 app「畫出來」,瞬間建立信任。這是「app sees me」的招牌時刻。

**前提**:peak event 要從 camera-scan.js 經 callback 對外曝露(目前只進 BPM 統計,沒事件)。Phase A 第 1 件事。

### Layer 2 — Ambient Quality Mood
圓環底色 + 整個 viewport 漸層,**不告訴**用戶品質好壞,**讓他感覺**:
- Green(sqi≥0.7、stability≥0.7):cyan ring + 深空背景
- Amber(任一維 0.4-0.7):amber ring + 微暖紫背景(用 `--zone-strain` 的反色)
- Red(任一維<0.4):warm-red ring + 整個背景輕微脈動(0.5Hz)催促修正

切換用 **2 秒 ease-in-out**,絕對不要 hard cut。Zone 切換才換,zone 內不動。

### Layer 3 — Choreographed Climax(最戲劇)
1500ms ceremony 已存在,但目前太平。新版時間軸:

```
t=0     :  stardust 開始向圓環中心吸入(已有,保留)
t=400   :  圓環從 cyan-soft → cyan-bright,亮度 1.0→1.6,400ms ease
t=700   :  圓環 scale 1.0 → 1.08 → 1.0(spring bounce)+ 全螢幕極輕白閃(opacity 0.04)
t=900   :  Result cards 從 viewport 底部 stagger 升起(HR→HRV→RR,各間隔 80ms)
t=1100  :  每張卡的數字從「—」翻牌到真值(對齊 1100/1180/1260)
t=1500  :  confidence badge 從卡底 slide-out + CTA 按鈕 fade-in
```

關鍵:**三張卡 stagger,不同步**。同步是廉價,stagger 才有「資料正在落下」的份量感。

### Layer 4 — Sound Layer(可關,預設 on)
- 0Hz 環境(scan 期間):極淡 60Hz drone,音量 -42dB,signal stable 時音量 -48dB(越穩越靜)
- 心跳(peak event):極短的軟敲擊(50ms attack triangle wave 220Hz)— 跟 Layer 1 同步
- Climax(t=700):從 220Hz → 880Hz 的 300ms sweep,音量峰值 -28dB
- Reveal(每個數字落定):3 個依序的 woodblock-ish click(220ms 間隔)

**Web 限制**:Web Audio API 在 iOS Safari 需要使用者手勢才能解鎖。Step 0 「TENKI 先學你」CTA 點下去那刻就要 unlock。

### Layer 5 — Haptic(只 mobile,preview 無)
- Peak detection:`Haptics.selectionAsync()`(極輕)— 與 Layer 1 同步
- Zone transition(green↔amber↔red):`Haptics.notificationAsync(Warning)`
- Climax t=700:`Haptics.impactAsync(Medium)`
- Reveal 每張卡:3 個 `Haptics.selectionAsync()` 間隔 80ms

**Phase B 才做**(`expo-haptics`)。Phase A 在 preview 上**完全沒有 haptic**,接受這個事實。

---

## 3. 整合計畫:三階段

### Phase A — Preview 整合(web 可達上限,2-3 天)

| Ticket | 對應 spec | 對應爽感 | 估時 |
|---|---|---|---|
| A1. camera-scan.js 加 `onPeak` callback,emit PPG peak event | — | Layer 1 前置 | 0.5d |
| A2. Sympathetic ring pulse(每 peak +2% scale spring) | — | Layer 1 | 0.5d |
| A3. Quality zone state machine + 主標/副標 hierarchy + 240ms fade-swap | §2.3 | Layer 2(文字) | 1d |
| A4. Ambient zone background gradient(2s ease 切換) | §2.2 | Layer 2(背景) | 0.5d |
| A5. 左下 2×2 呼吸點 + red 時 spring 成 96×96 縮圖 | §2.4 | — | 0.5d |
| A6. 長按圓環 600ms → debug drawer(三條品質條) | §2.5 | — | 0.5d |
| A7. Climax 時間軸重編(t=0/400/700/900/1100/1500 六拍) | — | Layer 3 | 1d |
| A8. Web Audio Layer(peak click + climax sweep + reveal woodblock,默認 on,可關) | — | Layer 4 | 1d |
| A9. Result cards stagger entrance(80ms 間隔) | — | Layer 3 細節 | 0.25d |

**每張 ticket = 一個 commit**(遵守 CLAUDE.md Commit-Per-Todo)。

### Phase B — Mobile native 補完(Phase C 時)

| Ticket | 內容 |
|---|---|
| B1. expo-haptics 接 peak / zone-transition / climax / reveal 四個事件 |
| B2. Skia ring 取代 web 的 CSS conic-gradient(更平滑,可做 60fps 真 spring) |
| B3. Reanimated 3 重寫 Phase A 的 web animation(GPU-bound) |
| B4. Native audio session(避免被靜音鍵切掉)|

### Phase C — First-Time Envelope(獨立 spec,見 §4)

只在「人生第一次掃描」那次發生的 magic moment。

---

## 4. The First-Time Envelope(只發生一次)

Onboarding baseline 只跑一次,**值得單獨設計**。提案:

掃描完 → ceremony climax → result cards → 用戶按 CTA「繼續」之後,**不要直接到 step-next**,而是先插一幀:

```
全螢幕深空 fade-in,300ms
中心一個極小 cyan 點,從 0 → 8px,1.2s ease-out
旁邊一行字 fade-in(opacity 0→1,800ms,從 0.3s 開始):
    「TENKI 已經記住你了」
1.6s 後:
    淡入第二行(下方,字級 -2):
    「下次打開,我會接著你今天的節奏」
3.5s 後:
    底部一個極小「→」按鈕 fade-in,使用者點才走 step-next
    若 6s 無操作,自動推進(避免卡住)
```

關鍵:**這只發生一次**。用 `localStorage.getItem('tenki_baseline_envelope_seen')` gate。第二次掃描就跳過(後續是 day-to-day baseline refresh,不是初次告白)。

**為什麼值得**:onboarding 結束的瞬間,情緒最高、信任最重,這是 retention 黃金 5 秒。一句「TENKI 已經記住你了」會被用戶記到下次打開 app。

---

## 5. Accessibility / 老人模式(預設 off 開關)

| 開關 | 影響 |
|---|---|
| `prefers-reduced-motion` | 關 Layer 1 pulse、Layer 3 stagger 改 fade、Climax flash 改純淡入 |
| 「靜音」按鈕 | 關 Layer 4 全部 |
| 「對比強化」 | 副標永遠顯示具體狀態(不只 zone transition 才換),drawer 圖示常駐 |

所有開關存 `localStorage`,不上雲,符合 v3 privacy-first。

---

## 6. 不做(明確 out of scope)

- 不換掉現有 `camera-scan.js` 的 PPG 演算法(那是獨立優化,不在 UX 整合範圍)
- 不在 preview 做 Skia(等 mobile)
- 不加歷史 sparkline(spec v1.1 §2.5 已決)
- 不加 onboarding 任何「為了好看的步驟」(每一步必須減少而不是增加)
- 不在 onboarding 階段顯示 Edge Score(那是 day-to-day 概念,onboarding 還沒有資格給)

---

## 7. 開工順序建議

最高槓桿的爽感 = **A1+A2(sympathetic pulse)** + **A7(climax 重編)** + **§4 First-time envelope**。

這三件加起來大概 2.5 天,**單獨一支 PR 出去就能讓 founder 感受到質變**。其他 ticket(A3-A6、A8-A9)是把整合補完,可以分批跟進。

建議第一個 PR 就是這三件,標題:`feat(preview): sympathetic pulse + choreographed climax + first-time envelope`。
