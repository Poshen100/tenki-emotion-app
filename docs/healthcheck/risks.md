# risks.md — 風險與未解清單（2026-07-03 健檢，誠實版）

## 已知風險（執行 plan.md 時要盯）

1. **scan 套件 TEI 改名（plan 3.3）是本計畫風險最高的一步**：`teiAt*` 欄位若曾被序列化存過本地資料，改名會讓舊資料讀不回。本次 audit 未發現持久化層用到（mobile 不 import packages/scan — 未發現 ≠ 不存在），執行者動手前要 grep `JSON.parse|AsyncStorage|SQLite` 相關消費點再下手。
2. **preview 改動（plan 1.2 / 3.4）CI 驗不到**：唯一真驗收是 founder 手機。歷史上三輪「綠了卻在 iOS 壞」（PLAYBOOK §3）。
3. **根目錄考古層刪除（plan 4.2）是破壞性動作**：git 可復原，但若有「repo 外」的東西（founder 桌面腳本、舊筆記連結）指向這些路徑，我們看不到。所以掛 [待 founder 拍板]。
4. **Reanimated 措辭修正（plan 2.5）動的是 founder 立的硬規則**：必須拍板，AI 不得自改（RULES 精神）。
5. **橫幅制度的副作用**：加了 SUPERSEDED 的檔案內容仍在 repo、仍可被全文搜尋命中。橫幅擋「冷讀」，擋不了「grep 斷章取義」。長期解是搬 docs/archive/，本次不做。

## 未解（本次沒有答案，誠實列）

1. **`apps/mobile/dist/`（`/face-baseline/` 固定網址在服務的東西）新鮮度未驗**：agent D 明說未查 build 時間戳。若它落後於 mobile 源碼，founder 在該網址看到的是舊版。驗法：比對 dist 內 bundle hash 與最近 mobile 改動日期，或直接重 export。
2. **`baseline-3d.html` / `finger-demo.html` 不在部署地圖是否刻意**：MEMORY 語氣像內部 demo，但無明文。要 founder 一句話：進地圖 or 標內部。
3. **domain 84.56% 覆蓋率沒有規則要求** — 要不要跟 engine/scan 一樣訂 ≥90%？制度空白，非 bug。
4. **`packages/shared/src/components`（stardust 參考元件）被 tsc 與 biome 同時排除**：v25.8.2 視覺規格的唯一代碼載體完全無檢查。刻意（依賴未裝）但值得知道。
5. **styles.css 第二調色盤（#c97b2f 金）的視覺歸屬**：founder 認可的截圖色 vs token 收斂政策，只有 founder 能裁（decisions.md D5）。
6. **finger-precision feature barrel 沒人 import**（screen 走 deep path）：是等 blend 接線的刻意預留還是接線時的疏忽？程式上無從判定。
7. **本報告的孤兒判定依賴靜態 grep**：動態 require、字串拼路徑的 import 掃不到（agent 已查 lazy/barrel，mobile 無此 pattern 的跡象，但 preview vanilla JS 世界不在此保證內）。
8. **未審計範圍**：`apps/web/`（凍結區，只確認沒被改）、`core/` 內容品質（凍結參考區）、`brand/` 資產檔、GitHub Actions 以外的部署設定（Vercel dashboard 端）、`ANTIGRAVITY.md` 1186 行全文一致性（只驗了置頂 note 與結構宣稱）。

## 健檢方法本身的侷限

- 覆蓋率數字來自 haiku agent 實測，本體只覆核了異常項（lint 事件）與總結論，未逐檔重跑。
- 「零網路呼叫」結論基於關鍵字掃描（fetch/axios/WebSocket/sendBeacon/upload/https），不能排除異體寫法；但 mobile 依賴表無網路庫，交叉佐證是強的。
- 色彩比對只涵蓋 agent 掃過的 6 個檔 + 已知消費點，preview 內嵌 style 可能還有零星裸 hex（已知至少 soul-enroll/finger-demo 的 #00F0FF 是懸而未決的獨立儀式色，MEMORY 2026-06-20 有案）。
