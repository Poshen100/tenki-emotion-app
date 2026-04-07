# TENKI Icon System Batch 1

## Deliverables

- Spec document: `docs/ICON-SYSTEM-BATCH1.md`
- Outline SVG set: `docs/assets/icons/batch1/outline/*.svg`
- Fill SVG set: `docs/assets/icons/batch1/fill/*.svg`
- Handoff manifest: `docs/assets/icons/batch1/manifest.json`
- Visual preview board: `docs/assets/icons/batch1/preview.html`

## 1. TENKI icon system 總規格摘要

- Canvas 固定 `24×24`，主圖形落在 `20×20 live area` 內，四邊保留至少 `2px` 呼吸空間。
- 預設為 `outline-first`，主 stroke `2px`，使用 `round cap + round join`，不做 hairline、尖角、手繪感端點。
- 幾何語言只使用圓、圓角矩形、直線、少量 `45°` 斜線；避免自由曲線、花瓣形、漫畫式輪廓。
- 每顆 icon 僅允許 `1 個主輪廓 + 1 個次要語意 cue`，避免一顆 icon 同時講兩個故事。
- Optical balance 優先於幾何置中；大多數 icon 的視覺中心會比幾何中心略上移 `0.3–0.8px`。
- Negative space 必須可在 `16px / 20px / 24px` 都成立；內部留白最窄處不小於 `1.5px`。
- Fill 版本不是把 outline 粗暴塗滿，而是保留關鍵 cutout；Selected 版本優先沿用 fill silhouette，不加 glow、不加外發光、不加 3D。
- Disabled 版本只降低對比與存在感，不改幾何；建議 token 為 `rgba(255,255,255,0.32)`。
- 色彩策略為 `monochrome-first`；語意色只在必要狀況啟用：`Warning = amber`、`Confirm = green`、來源 chip 可選 `cyan`，icon 幾何本身不依賴顏色辨識。
- 家族性關鍵字：`premium / geometric / compact / engineered / calm / precise / cockpit-like / biometric-dashboard-friendly`。
- 深色介面預設 icon 色建議：`Default = rgba(255,255,255,0.88)`，`High emphasis = #FFFFFF`，不使用 gradient、inner shadow、skeuomorphic highlight。
- Figma 元件命名建議：`TENKI / Icon / {Category} / {Name}`；Variant property 建議：`style=outline|fill|selected|disabled`、`size=16|20|24`。

---

## 2. 20 顆 icon 逐顆 spec

### 2.1 Heart Rate

- Icon name: `Heart Rate`
- Purpose: 表示即時心率 BPM 與心率卡片主指標。
- Shape concept: 一顆緊湊、低噪音、下端略鈍化的幾何 heart shell。
- Internal structure: 主輪廓控制在約 `14×13`；上方雙肩圓潤，下方尖點以 `2px` 光學圓角處理；不加入 ECG 線，避免和 HRV 混淆。
- Line behavior: 使用單一連續外輪廓；左右肩厚度一致，下半部收束比幾何心形略短，避免可愛感。
- Negative space logic: 上方 cleft 保留約 `2px` 開口；內腔不要過深，確保 16px 時不糊成 blob。
- Visual center: 幾何中心在 `12,12`，視覺中心建議上移到約 `12,11.4`。
- Variant behavior: `outline` 保持單輪廓；`fill` 為實心 heart 並保留上方 cleft cut；`selected` 使用 fill；`disabled` 不改形，只降對比。
- Best use in TENKI: 掃描結果頁 biometrics 卡、live telemetry row、歷史紀錄 biometrics list。

### 2.2 HRV

- Icon name: `HRV`
- Purpose: 表示 Heart Rate Variability，不可和 Heart Rate 混用。
- Shape concept: Heart shell 加上「變動節律 rail」，語意核心是變異性，不是單次 beat。
- Internal structure: 外輪廓沿用 Heart Rate 家族語言，但略縮到約 `13×12`；心形下半部內側放置一條短基線與 `3` 個不等距垂直 tick，節距為「短 / 長 / 短」。
- Line behavior: 外輪廓仍是單一主筆畫；內部 cadence rail 只佔下方 `40%` 高度，避免 icon 過密。
- Negative space logic: 內部 ticks 與外輪廓至少保持 `1.5px` 間距；不允許完整 ECG 波形穿過 heart。
- Visual center: 因內部 rail 讓下方變重，視覺中心上移到約 `12,11.2`。
- Variant behavior: `outline` 為空心 heart + cadence rail；`fill` 讓 heart 實心，內部 cadence rail 改為 knock-out；`selected` 優先 fill；`disabled` 保留 rail。
- Best use in TENKI: HRV 指標卡、Snapshot 區 secondary metric、教練提示中的 HRV references。

### 2.3 Stress

- Icon name: `Stress`
- Purpose: 表示壓力負荷或 stress zone。
- Shape concept: 高區 needle gauge，像 cockpit 的壓力表，不做情緒臉、不做爆炸符號。
- Internal structure: 以約 `14×14` 的開口圓弧為主體，下方留空；中心一個小 hub 點，needle 指向右上高區。
- Line behavior: 外弧厚度均一，needle 長度約為半徑的 `70%`；needle 不碰到外弧，保留精密儀表感。
- Negative space logic: 圓弧下方保持明顯開口，避免被讀成完整 speedometer；hub 周圍留白要乾淨。
- Visual center: 因 needle 指向右上，整體需微微往左下補償；視覺中心約 `11.6,11.5`。
- Variant behavior: `outline` 為開口 gauge；`fill` 可填實外弧並保留中心孔與 needle cutout；`selected` 可使用更明確的實心外弧；`disabled` 不改 needle 角度。
- Best use in TENKI: Stress 卡片、zone chip、風險升高狀態。

### 2.4 Breathing

- Icon name: `Breathing`
- Purpose: 表示呼吸率或呼吸引導相關功能。
- Shape concept: 兩道對稱呼吸弧包圍中心點，語意是 inhale / exhale cycle，不是風、不是真實肺部。
- Internal structure: 左右各一條開放圓弧，圍繞一個中心 dot；弧線控制在 `14×14` 內，中心 dot 直徑約 `2.5px`。
- Line behavior: 左右弧對稱但不要完全閉合；開口朝外，保留氣流進出感。
- Negative space logic: 中心 dot 與外弧至少距離 `2px`；弧線之間不交疊，不畫多重氣流線。
- Visual center: 幾何中心即可，但因中心 dot 會聚焦，整體可上移 `0.2px`。
- Variant behavior: `outline` 使用雙弧 + dot；`fill` 將雙弧做成兩段實心 band，中心 dot 挖空或實心皆可，但需全 family 一致；`selected` 建議保留中心 dot；`disabled` 不削減弧段數。
- Best use in TENKI: 呼吸率卡片、低能區呼吸校準入口、guided breathing 狀態。

### 2.5 Body Battery

- Icon name: `Body Battery`
- Purpose: 表示整體能量儲備，不等同一般裝置電量。
- Shape concept: 精煉化 energy cell，採橫向 battery silhouette，但做得更 calm、更 dashboard。
- Internal structure: 主體為約 `14×10` 的圓角矩形，右側一個短 terminal；內部只有 `1` 條能量 bar，不堆多格。
- Line behavior: 外框為主；內部 bar 與邊框保留 `2px` 左右緩衝，不做多段電池格。
- Negative space logic: terminal 要短且居中，避免像 OS 狀態列電池；內部 bar 不可貼邊。
- Visual center: 因 terminal 讓右側變重，視覺中心稍微左移到約 `11.5,12`。
- Variant behavior: `outline` 為外框 + 單 bar；`fill` 建議電池主體實心、保留 bar cutout；`selected` 用 fill；`disabled` 保持 terminal 可辨識。
- Best use in TENKI: Energy / Recovery dashboard 卡、日內儲備狀態、摘要 chip。

### 2.6 ANS Balance

- Icon name: `ANS Balance`
- Purpose: 表示交感 / 副交感平衡，不可畫成宗教或東方符號。
- Shape concept: 左右對稱雙弧場，中間一條靜態平衡 spine。
- Internal structure: 左右各一個 inward-facing 半圓弧，圍出近似完整圓形；中間一條短垂直 spine，不延伸到邊界。
- Line behavior: 雙弧厚度完全一致，spine 略短於弧高度，強調平衡而非分隔。
- Negative space logic: 中間間隙控制在 `2px` 左右；避免做成 yin-yang、天秤、神經元。
- Visual center: 幾何中心幾乎等於視覺中心，約 `12,12`。
- Variant behavior: `outline` 使用雙弧 + spine；`fill` 讓左右場變成兩塊實心半場，中間 spine 與間隙作為 cutout；`selected` 仍維持左右對稱；`disabled` 不模糊中央分界。
- Best use in TENKI: ANS 平衡圖例、Snapshot 區、教練解讀入口。

### 2.7 Deep Scan

- Icon name: `Deep Scan`
- Purpose: 表示完整掃描 / 深度分析模式。
- Shape concept: 多層 reticle + 主動掃描 sweep，承接 TENKI scan ring 語言。
- Internal structure: 外圈約 `16` 直徑，保留一個小缺口；內圈約 `10` 直徑；下三分之一位置加入一條短 sweep 線。
- Line behavior: 外圈與內圈 stroke 一致；sweep 線比外圈略短，不可穿透外圈。
- Negative space logic: 兩層 ring 間保留清晰間距；缺口位置固定，不可四處斷裂。
- Visual center: 因 sweep 線落在下方，整體需上移約 `0.5px`，視覺中心約 `12,11.5`。
- Variant behavior: `outline` 為雙 ring + sweep；`fill` 可填實外 ring 並保留內 ring 與 sweep cut；`selected` 優先用 fill 以提高 mode recognition；`disabled` 保留 sweep。
- Best use in TENKI: Scan CTA、模式切換、掃描進行狀態。

### 2.8 Signal Quality

- Icon name: `Signal Quality`
- Purpose: 表示訊號品質與感測穩定度。
- Shape concept: 校準過的四階信號 bars，偏儀表板語言，不做 Wi‑Fi。
- Internal structure: `4` 根等寬 vertical bars 立於同一條隱形 baseline，高度由左至右遞增。
- Line behavior: Outline 版本以空心 bars 呈現；bars 寬度一致，頂部圓角一致。
- Negative space logic: bars 間距固定，至少 `1.5px`；不加入波浪線、天線、電波弧。
- Visual center: 因右高左低，整體需略左移與上移，約 `11.6,11.4`。
- Variant behavior: `outline` 為空心 bars；`fill` 為實心 bars；`selected` 使用 fill 最清楚；`disabled` 保留四階層級。
- Best use in TENKI: 感測品質 chip、scan guidance、來源穩定度標記。

### 2.9 Insights

- Icon name: `Insights`
- Purpose: 表示系統洞察、解讀、摘要型分析。
- Shape concept: 小型 data card 裡一條被聚焦的上升 insight line，不用燈泡、不用魔法星星。
- Internal structure: 一個約 `14×14` 的圓角卡片框，內部一條斜向上升線，終點是一個小 dot。
- Line behavior: 卡片框四角圓角一致；內部線只畫一條主線，不加第二條比較線。
- Negative space logic: 內部線離外框至少 `2px`；dot 不貼角，避免像通知 badge。
- Visual center: 內部斜線使右上較重，視覺中心略往左下補償，約 `11.7,12.1`。
- Variant behavior: `outline` 為卡片框 + line；`fill` 卡片可實心，line 與 dot 做 cutout；`selected` 可直接用 fill card；`disabled` 保持 dot。
- Best use in TENKI: 洞察分頁、AI 解讀入口、結果頁 summary CTA。

### 2.10 Expand Details

- Icon name: `Expand Details`
- Purpose: 表示展開更多細節，不是全螢幕 maximize。
- Shape concept: 四個 outward corner brackets，中心留白，語意是「展開內容面積」。
- Internal structure: 在 `16×16` 範圍四角各放一個 `L` 型 bracket，開口朝外，中心區保持完全空白。
- Line behavior: 四個 bracket 長度一致，內角圓角處理；不得畫成箭頭。
- Negative space logic: 中央留白至少 `8×8`，避免變成相機取景框。
- Visual center: 幾何中心即視覺中心，約 `12,12`。
- Variant behavior: `outline` 為四角 bracket；`fill` 版本改為四個實心 corner blocks 並保留內角 cutout；`selected` 建議 fill；`disabled` 不減少 bracket 數量。
- Best use in TENKI: 卡片展開、結果頁細節區、drawer trigger。

### 2.11 Quick Check-in

- Icon name: `Quick Check-in`
- Purpose: 表示一鍵情緒 / 狀態自我回報。
- Shape concept: 單點狀態 bubble，像精簡化自我輸入，不做聊天 app 氣泡。
- Internal structure: 一個約 `14×11` 的圓角 bubble 主體，下方一個極短尾部；內部只放一個居中 dot。
- Line behavior: 主體保持幾何安靜，尾部短且不尖；內部 dot 不可過大。
- Negative space logic: bubble 內保留大面積留白，避免像通知 badge 或 typing indicator。
- Visual center: 尾部會讓下方偏重，整體上移到約 `12,11.3`。
- Variant behavior: `outline` 為 bubble + dot；`fill` 為實心 bubble，內部 dot 以挖空呈現；`selected` 建議 fill；`disabled` 保留尾部。
- Best use in TENKI: Check-in CTA、日記入口、daily state capture。

### 2.12 Mood

- Icon name: `Mood`
- Purpose: 表示情緒狀態，不可做成 emoji。
- Shape concept: 一張中性、克制、讀值型的 face disk。
- Internal structure: 外圈約 `14` 直徑；兩個極短垂直眼位；一條水平或極淺弧度 mouth line。
- Line behavior: 五官只用最少筆畫；眼位不可做成圓眼、睫毛、眉毛。
- Negative space logic: 眼與口之間距要大於 `2px`；外圈與五官保持安靜呼吸感。
- Visual center: 因五官集中在中央偏下，整體可略上移到約 `12,11.6`。
- Variant behavior: `outline` 為 face disk；`fill` 可用實心圓盤挖出眼口；`selected` 可接受更高對比，但不加表情變化；`disabled` 仍維持五官可讀。
- Best use in TENKI: 情緒標記、check-in 結果、情緒歷史列表。

### 2.13 Sleep

- Icon name: `Sleep`
- Purpose: 表示睡眠相關資料與恢復上下文。
- Shape concept: 幾何 crescent，單純、沉靜、不加星星。
- Internal structure: 由一個大圓減去一個偏移小圓形成 crescent；整體控制在約 `13×13`。
- Line behavior: Outline 版本以單一 crescent 輪廓完成；外內弧厚度視覺上要均衡。
- Negative space logic: 內外圓間最窄處至少 `2px`；不要再加 `Z`、星點、雲朵。
- Visual center: 因 crescent 右側較空，視覺中心略往左，約 `11.5,12`。
- Variant behavior: `outline` 為 crescent；`fill` 為實心月牙；`selected` 優先用 fill；`disabled` 保持月牙厚度。
- Best use in TENKI: Sleep 卡片、夜間恢復摘要、歷史睡眠入口。

### 2.14 Recovery

- Icon name: `Recovery`
- Purpose: 表示恢復狀態與回升能力，不做 refresh system icon。
- Shape concept: 一個近乎閉合的 restore loop，像能量重新閉環，但沒有箭頭。
- Internal structure: 外層為約 `14` 直徑的近完整圓弧，右上保留一個小 gap；gap 內放一段較短 inner returning arc。
- Line behavior: 主外弧主導語意，內返弧只做輔助，不可搶主視覺。
- Negative space logic: gap 要明確但不過大；不可加箭頭頭、醫療十字、葉子。
- Visual center: 主外弧較重，視覺中心略往左下，約 `11.7,12.2`。
- Variant behavior: `outline` 為外 restore loop + inner arc；`fill` 為實心環體並保留 gap 與 inner arc cutout；`selected` 建議 fill；`disabled` 不可讓 gap 消失。
- Best use in TENKI: Recovery 卡片、training readiness、日內恢復狀態。

### 2.15 Focus

- Icon name: `Focus`
- Purpose: 表示專注、目標鎖定、低干擾模式。
- Shape concept: 中央 target dot + 四向短刻度，像鎖定點，不做完整軍事瞄具。
- Internal structure: 中心一個小 dot，東西南北各一條短 tick；可加一個非常淡的外 partial ring，但不要有 sweep。
- Line behavior: 刻度長度一致，與中心 dot 的距離一致；外 partial ring 若使用，必須比 Deep Scan 更安靜。
- Negative space logic: 中心保持乾淨，不加十字全線穿過；避免和 scan reticle 一模一樣。
- Visual center: 幾何中心即視覺中心，約 `12,12`。
- Variant behavior: `outline` 為 dot + ticks；`fill` 讓 dot 與 ticks 實心；`selected` 可加 partial ring fill 切角；`disabled` 仍保留中心鎖定感。
- Best use in TENKI: Focus mode、coach suggestion、session tag。

### 2.16 Garmin Source

- Icon name: `Garmin Source`
- Purpose: 表示資料來自 Garmin / wearable source。
- Shape concept: 一只精簡化運動手錶，不使用 Garmin 商標、不使用品牌三角 logo。
- Internal structure: 中央為約 `10×10` 的圓角方形錶面，上下各一段短 strap；錶面中心可放一個 sensor dot。
- Line behavior: 錶面外框為主；strap 短且居中，不做過多錶耳細節。
- Negative space logic: 錶面內保持簡潔，不畫真實 UI；不可出現 Garmin logo、指南針、地圖。
- Visual center: 幾何中心即視覺中心，約 `12,12`。
- Variant behavior: `outline` 為 watch silhouette；`fill` 為實心錶面 + strap，中心 sensor dot 可做 cutout；`selected` 可搭配來源 chip 使用；`disabled` 仍可讀成 wearable。
- Best use in TENKI: Source chip、裝置選擇器、來源標註列。

### 2.17 rPPG Source

- Icon name: `rPPG Source`
- Purpose: 表示資料來自 camera-based remote PPG。
- Shape concept: 前置感測 camera module + pulse lens，不做拍照 app icon。
- Internal structure: 一個低矮圓角矩形作為 camera body，中央一顆 lens circle，右上可有一個小 sensor dot，下方一條短 scan slit。
- Line behavior: body 保持簡練；lens 為絕對主元素，scan slit 只是語意補強。
- Negative space logic: 不畫快門葉片、不畫閃光燈、不畫照片輪廓；避免 DSLR 感。
- Visual center: 因 sensor dot 偏右上，整體需略向左下補償，約 `11.7,12.1`。
- Variant behavior: `outline` 為 module + lens；`fill` 可把 body 實心，lens 與 slit 挖空；`selected` 可在來源 chip 上用 fill；`disabled` 保留 lens。
- Best use in TENKI: Source chip、scan mode selector、資料來源標記。

### 2.18 Close

- Icon name: `Close`
- Purpose: 表示關閉、dismiss、退出浮層。
- Shape concept: 緊湊的 optically trimmed `X`，不做巨大警告式叉。
- Internal structure: 兩條 `45°` 斜線在中心交會，端點內縮，不碰觸 live area 邊界。
- Line behavior: 兩筆長度完全一致；交會點略偏上 `0.2px` 可減少下沉感。
- Negative space logic: 四角留白均衡；不可搭配圓圈形成禁用符號。
- Visual center: 視覺中心約 `12,11.8`。
- Variant behavior: `outline` 即預設 `X`；`fill` 可做成兩個實心斜條；`selected` 建議直接提高對比，不需加底板；`disabled` 降低存在感即可。
- Best use in TENKI: Modal close、sheet dismiss、lightbox 退出。

### 2.19 Confirm

- Icon name: `Confirm`
- Purpose: 表示確認、完成、套用。
- Shape concept: 一筆式 precision check，不做卡通勾勾。
- Internal structure: 由短下行段與長上行段組成；角度保持 `45°` family 語言；整體寬高控制在約 `12×10`。
- Line behavior: 起筆不過低，終點不過高；折點略靠左，讓勾形更穩定。
- Negative space logic: 勾形周圍需有足夠留白；不可加圓圈，不可畫成 checklist box。
- Visual center: 因長上行段拉向右上，視覺中心約 `11.8,12.1`。
- Variant behavior: `outline` 為單勾；`fill` 為實心 check silhouette；`selected` 可使用 semantic green tint，但 asset 本體仍先以單色交付；`disabled` 不改角度。
- Best use in TENKI: 套用、完成 check-in、確認設定。

### 2.20 Warning

- Icon name: `Warning`
- Purpose: 表示高風險、注意、品質問題。
- Shape concept: 圓角警示三角形 + 中央 exclamation，偏 cockpit fault light，而不是工地告示牌。
- Internal structure: 一個 upright rounded triangle，內部一條短直立 exclamation stem + 一個 dot。
- Line behavior: 外輪廓要穩，三角形底邊略寬；內部 exclamation 置中，與外框保留一致距離。
- Negative space logic: 三角形三角內部留白要夠，不可填太滿；不可加條紋、火花、爆炸形。
- Visual center: 因三角形尖端上揚，視覺中心約 `12,11.2`。
- Variant behavior: `outline` 為三角框 + exclamation；`fill` 為實心三角形挖出 exclamation；`selected` 可使用 amber 語意色；`disabled` 保留 exclamation。
- Best use in TENKI: 低訊號提示、風險警告、掃描中斷與 degraded state。

---

## 3. 每顆 icon 的 short prompt

- Heart Rate: `24x24 premium dark-dashboard outline icon, compact geometric heart shell, softened lower point, 20x20 live area, 2px stroke, Ferrari cockpit x Apple symbol system, monochrome, calm and precise.`
- HRV: `24x24 premium outline icon, compact heart shell with internal short cadence rail and three uneven interval ticks, 20x20 live area, 2px stroke, geometric, engineered, monochrome, dark UI friendly.`
- Stress: `24x24 premium outline icon, high-zone cockpit gauge with open lower arc, small center hub, needle pointing upper-right, 20x20 live area, 2px stroke, calm technical style, monochrome.`
- Breathing: `24x24 premium outline icon, two mirrored open breathing arcs around a center dot, no lungs, 20x20 live area, 2px stroke, geometric, calm, biometric dashboard friendly.`
- Body Battery: `24x24 premium outline icon, refined horizontal energy cell with one short terminal and one internal charge bar, 20x20 live area, 2px stroke, monochrome, dark premium health app style.`
- ANS Balance: `24x24 premium outline icon, two mirrored inward semicircular fields with a short center spine, balanced and calm, 20x20 live area, 2px stroke, geometric, monochrome.`
- Deep Scan: `24x24 premium outline icon, dual reticle rings with one active scan sweep line, 20x20 live area, 2px stroke, precise cockpit scan symbol, monochrome, low-noise.`
- Signal Quality: `24x24 premium outline icon, four calibrated ascending signal bars on a shared baseline, 20x20 live area, 2px stroke, engineered dashboard icon, monochrome, no wifi.`
- Insights: `24x24 premium outline icon, rounded data card frame with one rising insight line ending in a dot, 20x20 live area, 2px stroke, geometric, dark dashboard friendly, monochrome.`
- Expand Details: `24x24 premium outline icon, four outward corner brackets with open center, 20x20 live area, 2px stroke, compact geometric expand-details symbol, monochrome.`
- Quick Check-in: `24x24 premium outline icon, compact rounded self-report bubble with a single centered dot and very short tail, 20x20 live area, 2px stroke, calm, monochrome, not chatty.`
- Mood: `24x24 premium outline icon, neutral face disk with two minimal eye ticks and one short mouth line, 20x20 live area, 2px stroke, calm and precise, monochrome, not emoji.`
- Sleep: `24x24 premium outline icon, geometric crescent moon only, no stars, 20x20 live area, 2px stroke, dark premium wellness style, monochrome.`
- Recovery: `24x24 premium outline icon, near-closed restore loop with a short inner returning arc and no arrowheads, 20x20 live area, 2px stroke, geometric, calm, monochrome.`
- Focus: `24x24 premium outline icon, center dot with four short cardinal focus ticks, optional subtle partial ring, 20x20 live area, 2px stroke, cockpit lock-on symbol, monochrome.`
- Garmin Source: `24x24 premium outline icon, compact sport watch silhouette with square rounded face and short straps, no brand logo, 20x20 live area, 2px stroke, monochrome.`
- rPPG Source: `24x24 premium outline icon, minimal front camera module with central lens, small sensor dot and short scan slit, 20x20 live area, 2px stroke, geometric, monochrome.`
- Close: `24x24 premium outline icon, compact optically trimmed X, 45-degree strokes, 20x20 live area, 2px stroke, calm system symbol, monochrome.`
- Confirm: `24x24 premium outline icon, precise one-stroke check mark with compact geometry, 20x20 live area, 2px stroke, premium system symbol, monochrome.`
- Warning: `24x24 premium outline icon, rounded warning triangle with centered exclamation, 20x20 live area, 2px stroke, cockpit fault-light style, monochrome-first.`

---

## 4. 每顆 icon 的 negative prompt

- Heart Rate: `No ECG waveform, no cartoon heart, no glossy love icon, no emoji styling, no medical cross, no drop shadow.`
- HRV: `No full ECG trace, no pulse app waveform, no heart plus chart combo, no battery bars, no decorative spark.`
- Stress: `No angry face, no explosion, no flame, no tachometer numbers, no comic tension marks, no hazard stripes.`
- Breathing: `No lungs, no wind swirl, no cloud, no leaf, no yoga mandala, no soft blob organic illustration.`
- Body Battery: `No OS battery status icon look, no multiple tiny segments, no lightning bolt, no charger cable, no toy battery.`
- ANS Balance: `No yin-yang, no scales, no chakra symbol, no neuron illustration, no petal shapes, no ornamental symmetry.`
- Deep Scan: `No magnifying glass, no radar wedge fill, no sci-fi neon glow, no fingerprint, no target crosshair overload.`
- Signal Quality: `No wifi arcs, no antenna mast, no sound equalizer crowd, no mobile network logo styling, no waveform clutter.`
- Insights: `No light bulb, no sparkle wand, no magic stars, no brain icon, no eye icon, no multiseries analytics chart.`
- Expand Details: `No maximize window box, no fullscreen rectangle, no arrowheads, no pinch gesture hands, no camera frame styling.`
- Quick Check-in: `No messaging app bubble, no three typing dots, no clipboard, no form sheet, no notification badge, no emoji face.`
- Mood: `No smiley emoji, no cheeks, no eyebrows, no tears, no cute mascot face, no cartoon expression exaggeration.`
- Sleep: `No stars, no Z letters, no bed, no pillow, no cloud, no dreamy illustration, no night-sky decorations.`
- Recovery: `No refresh arrows, no medical cross, no leaf, no recycle logo, no heart-plus symbol, no circular arrows.`
- Focus: `No sniper scope, no military target, no camera autofocus square, no radar sweep, no bullseye rings overload.`
- Garmin Source: `No Garmin logo, no brand triangle, no map pin, no navigation arrow, no smartwatch UI screenshot, no crown detail overload.`
- rPPG Source: `No DSLR camera, no photo landscape, no shutter petals, no flash burst, no film icon, no social camera app look.`
- Close: `No circle-slash prohibition sign, no heavy bold error X, no rough hand-drawn cross, no sparkle ends.`
- Confirm: `No checklist box, no seal badge, no ribbon, no emoji check, no rounded bubble behind the check by default.`
- Warning: `No explosive comic icon, no striped hazard sign, no skull, no fire, no triangle with extra border layers, no 3D caution badge.`

---

## 5. 優先級排序

### MVP 先做的 8 顆

1. `Deep Scan`
   原因：直接服務 scan CTA 與掃描狀態，是 TENKI 首頁最核心語意。
2. `Signal Quality`
   原因：scan flow 必須即時反映品質好壞，沒有它會失去感測可解釋性。
3. `Heart Rate`
   原因：最常出現的 biometrics 主指標。
4. `HRV`
   原因：TENKI 核心引擎與專業價值的重要指標。
5. `Stress`
   原因：結果頁與風險建議高度依賴 stress 語意。
6. `Breathing`
   原因：低能區與校準流程需要呼吸引導入口。
7. `Insights`
   原因：結果頁與 coach layer 需要一個比 analytics 更精準的洞察入口符號。
8. `Warning`
   原因：低品質、風險升高、scan fail 都需要高辨識警示 icon。

### 第二批 12 顆

- `Body Battery`
  原因：重要，但比 Heart Rate / HRV / Stress 晚一階。
- `ANS Balance`
  原因：專業度高，但 MVP 可以先用文字與圖例補位。
- `Expand Details`
  原因：功能需要，但可暫時用系統 icon 過渡。
- `Quick Check-in`
  原因：check-in flow 可在掃描核心穩定後補上。
- `Mood`
  原因：屬 secondary emotional layer，不阻塞 scan MVP。
- `Sleep`
  原因：偏歷史與恢復語境，不是首頁關鍵路徑。
- `Recovery`
  原因：和 Sleep / Body Battery 同層，可第二波一起做。
- `Focus`
  原因：偏 mode / coaching layer，非第一屏必要。
- `Garmin Source`
  原因：來源 chip 屬進階整合，可跟裝置接入一起做。
- `rPPG Source`
  原因：source 標記可晚於 scan 主流程上線。
- `Close`
  原因：MVP 期間可暫時沿用系統 close icon。
- `Confirm`
  原因：MVP 期間可暫時沿用系統 confirm icon。

---

## 6. 一張整理表

| icon name | category | purpose | shape logic | line logic | variant notes | priority |
|---|---|---|---|---|---|---|
| Heart Rate | Biometrics | 即時心率主指標 | 緊湊 heart shell | 單一連續外輪廓 | fill 保留 cleft；selected 用 fill | MVP |
| HRV | Biometrics | 心率變異性 | heart shell + cadence rail | 外輪廓主導，內部三 tick | fill 改為 rail cutout | MVP |
| Stress | Biometrics | 壓力負荷 | 高區 needle gauge | 開口圓弧 + 斜 needle | selected 可強化外弧實心 | MVP |
| Breathing | Biometrics | 呼吸率 / 呼吸引導 | 雙對稱呼吸弧 + 中心 dot | 左右弧對稱不閉合 | fill 用 band 化處理 | MVP |
| Body Battery | Biometrics | 能量儲備 | 精簡 energy cell | 外框主導 + 單一 bar | fill 保留 bar cutout | Batch 2 |
| ANS Balance | Biometrics | 交感/副交感平衡 | 雙弧場 + 中央 spine | 左右等重 | fill 維持中央分界 | Batch 2 |
| Deep Scan | Scan / Analysis | 深度掃描模式 | 雙層 reticle + sweep | ring 權重一致 | selected 優先 fill | MVP |
| Signal Quality | Scan / Analysis | 訊號品質 | 四階 ascending bars | bars 等寬等距 | fill 最清楚 | MVP |
| Insights | Scan / Analysis | 洞察與解讀 | data card + rising line | 外框安靜，內部一條主線 | fill 可做實心卡片 | MVP |
| Expand Details | Scan / Analysis | 展開更多細節 | 四角 outward brackets | 四角等長等角 | fill 變實心 corner blocks | Batch 2 |
| Quick Check-in | Emotional / Wellness | 一鍵自我回報 | 單點 bubble | 主體安靜，尾部極短 | fill 挖空中心 dot | Batch 2 |
| Mood | Emotional / Wellness | 情緒狀態 | 中性 face disk | 五官最少筆畫 | fill 挖空眼口 | Batch 2 |
| Sleep | Emotional / Wellness | 睡眠 | 幾何 crescent | 內外弧視覺均衡 | fill 直接用月牙 | Batch 2 |
| Recovery | Emotional / Wellness | 恢復 | near-closed restore loop | 外弧主導，內返弧輔助 | fill 保留 gap | Batch 2 |
| Focus | Emotional / Wellness | 專注 / 鎖定 | center dot + 4 focus ticks | cardinal ticks 等長 | selected 可加 partial ring | Batch 2 |
| Garmin Source | System / Source | Garmin / wearable 來源 | 方形錶面 + 短 strap | 錶面為主，strap 收斂 | 不用品牌 logo | Batch 2 |
| rPPG Source | System / Source | camera-based PPG 來源 | camera module + lens | lens 主導，slit 輔助 | fill 用 body 實心 | Batch 2 |
| Close | System / Source | 關閉 / dismiss | 緊湊 X | 兩條 45° 斜線 | selected 只提高對比 | Batch 2 |
| Confirm | System / Source | 確認 / 完成 | precision check | 一筆式勾形 | 可語意上色，但先單色 | Batch 2 |
| Warning | System / Source | 風險 / 注意 | rounded triangle + exclamation | 三角框穩定置中 | 可語意上色 amber | MVP |
