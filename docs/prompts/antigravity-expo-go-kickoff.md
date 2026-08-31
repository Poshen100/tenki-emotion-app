# 開工單 — 讓 founder 在圖書館電腦上親眼看到 mobile UX（Expo Go）

> 建立：2026-08-19 ｜ 執行環境：**圖書館公用 Windows PC + Antigravity**
> founder 硬體：**只有 iPhone**（無 Mac、無 Android 機、無 Apple Developer 帳號）

---

## 0. 先停 — 你大概正走在錯的路上

**這份檔案不在 `main` 上。** 它只存在於分支
`claude/tenki-core-growth-arch-7teiqj`。所以：

- `raw.githubusercontent.com/.../main/...` → **404**
- 從 `main` 的 tree 找 → **找不到**

**不要用 GitHub API 去搜。** 這個 repo 有 **71 條分支**，未認證的 GitHub API
每小時只有 **60 次**請求。「逐條分支拉 tree 找檔案」會在走到一半時被 rate limit
擋掉；如果你的迴圈把錯誤 `catch {}` 吞掉，你會得到「找不到」的錯誤結論，
然後開始憑空編造一份計畫。**這已經發生過一次（2026-08-19）。**

正確做法只有一個 —— **你已經 clone 了整個 repo，用它**：

```powershell
cd <你 clone 的路徑>\tenki-emotion-app
git fetch origin claude/tenki-core-growth-arch-7teiqj
git checkout claude/tenki-core-growth-arch-7teiqj
git log --oneline -1        # 應為 docs: record what Expo Go can and cannot show now
type docs\prompts\antigravity-expo-go-kickoff.md
```

零次 API 呼叫。從磁碟讀。

> **如果任何一步失敗就停下來回報，不要推測。** 推測出來的計畫比沒有計畫更貴 ——
> 上一次的推測版本主張用「模擬訊號管線」補上缺少的相機，
> 那正好是本工單與 `choreography.ts` 的 `isQualityInstrumented()` 明文禁止的事。

---

## 0. 這張工單要達成的一件事

分支 `claude/tenki-core-growth-arch-7teiqj` 上有 37 個 commit 的 mobile UX 工作，
**founder 一次都沒看過**。這張工單的唯一目標是：**把 dev server 跑起來，讓他用自己的
iPhone 透過 Expo Go 看到它。**

不是重構、不是修 bug、不是加功能。**能跑 + 能看 + 誠實回報**就是完成。

---

## 1. 先讀（house 制度，不可跳過）

`CLAUDE.md` → `docs/PLAYBOOK.md`（§1 任務路由、§0 文件矛盾裁決）→ `MEMORY.md` 最上條。

**Rule #0 防丟失**：開工第一分鐘先確認在正確分支上，任何改動立刻 commit + push。

**絕不直推 `main`。** 本工單原則上不需要改 code；真要改，開 `feat/*` 分支走 PR。

---

## 2. 分支（最容易錯的一步）

```bash
git fetch origin
git checkout claude/tenki-core-growth-arch-7teiqj
git log --oneline -1     # 應為 086341a feat(mobile): flick up to retry a failed scan
```

⚠️ **這些 commit 不在 `main` 上。** checkout 到 main 會什麼都看不到，然後浪費一小時找原因。

---

## 3. 環境（假設沒有 admin 權限）

依序檢查，缺什麼補什麼：

| 檢查 | 沒有時的退路（**都不需要 admin**） |
|------|-----------------------------------|
| `node -v`（需 ≥ 20） | nodejs.org 下載 **`node-vXX-win-x64.zip`**（不是 `.msi`），解壓到 `%USERPROFILE%`，把該資料夾加進本 session 的 `PATH` |
| `git --version` | PortableGit（`.7z.exe` 自解壓版） |
| 可寫磁碟 ≥ 2GB | 一律在 `%USERPROFILE%` 或隨身碟底下操作，不要放 `C:\Program Files` |

`npm install` 在公用網路可能要 **10–20 分鐘**，先開始跑，別等。

---

## 4. 安裝（`apps/mobile` 那一步是必要的）

```bash
npm install                    # root
cd apps/mobile && npm install  # 必要，不可省略
```

⚠️ **`apps/mobile` 刻意不在 npm workspace 裡**（root `workspaces` 只有 `packages/*` 與 `domain`），
所以 root 的 `npm install` **不會**幫它裝依賴。而且這輪新增了 `expo-sensors`，沒裝就會缺模組。

---

## 5. 啟動 — **一開始就用 `--tunnel`**

```bash
cd apps/mobile
npx expo start --tunnel
```

**為什麼不用預設的 LAN 模式**：圖書館 Wi-Fi 幾乎一定開了 client isolation
（裝置之間互相看不到），`npx expo start` 印出的 `exp://192.168.x.x:8081` 手機**連不上**。
這不是設定錯誤，是網路政策 —— 不要花時間 debug 它。

`--tunnel` 第一次會自動裝 `@expo/ngrok`，可能需要登入 Expo 帳號。

**若圖書館防火牆連 ngrok 也擋**：退路是 **founder 的 iPhone 開個人熱點 → 電腦連上該熱點 →
改用預設 LAN 模式**。熱點底下沒有 client isolation。

founder 用 iPhone 的 **Expo Go** 掃終端機印出的 QR code。

---

## 6. 驗收清單（Antigravity 負責讓它跑得到；founder 負責看）

| # | 畫面 | 動作 | 通過的樣子 |
|---|------|------|-----------|
| 0 | **任何畫面** | 開起來 | **沒有白畫面** — 根 layout 這輪新包了 `GestureHandlerRootView`，這是唯一有全域風險的改動 |
| 1 | Today | 有分數時看背景 | 色溫／星點／流速隨 Zone 改變：Clear 偏冷偏慢、Strain 略暖偏動。**Strain 必須仍然「高級」，不能像警報** |
| 2 | onboarding 各頁 | 純目視 | 版面沒被新背景推歪（舊背景用百分比定位，新的用 `Dimensions`） |
| 3 | 建立基準線 intro | **長按** Begin Calibration | **4 段分明的觸覺**（不是連續震動），充能條掃過膠囊；放手中斷 |
| 4 | 基準線成功頁 | 點金色封印 | 重播個人簽名脈衝（3 段遞增） |
| 5 | 重試頁 | 上滑 / 左右滑 | 上滑觸發重試；**左右滑不觸發**，系統返回手勢正常 |
| 6 | 設定 → 減少動態 | 打開後重看 1、3 | 星星停止閃爍但仍在；長按 CTA 變成**一般點擊即確認** |
| 7 | 擷取畫面 | 走進掃描流程 | **不崩**；框裡明說沒有相機；粒子隨進度收斂、觸覺同步（＝第 1 項） |
| 8 | Processing 畫面 | 走到「Securing…」 | **不崩**；降級 orb 會轉。這裡看不到 Skia 版，屬預期 |

第 6 項是可及性驗收，**不要跳過** —— 它是這輪唯一沒有自動測試能覆蓋的承諾。

---

## 7. 缺的原生模組 — 已降級，**不要「修」它**

Expo Go 不帶 `react-native-vision-camera` 也不帶 `@shopify/react-native-skia`。
2026-08-19 已加上探測 + 降級（`utils/optionalNative.ts`），所以**畫面不再崩**，但要知道
你看到的是什麼：

| 畫面 | Expo Go 實際看到 | 意義 |
|------|-----------------|------|
| 擷取畫面 | 掃描框裡顯示「No camera in this build」 | **刻意不假裝有相機**。周圍的粒子網格、進度尺、觸覺全部真的在跑 |
| Processing / Resonance | 降級版 orb（純 RN Animated） | 環真的會轉、球真的會隨進度變亮，**但不是 Skia 那顆** |

因此：

- **第 1 項（多感官掃描儀式）→ 看得到。** 粒子收斂/散開與觸覺同步本來就是純 RN Animated。
- **第 2 項（Skia orb 物理 + 傾斜視差）→ 看不到真樣子。** 環速、視差、模糊都是 Skia 專屬，
  降級版沒有。這一項仍需 development build。Expo Go 只能證明「它不會崩」。

**嚴禁**為了讓它「完整」就把這兩個套件從 `package.json` 拿掉，或把降級版當成正式實作。
有一條測試（`__tests__/optionalNative.test.ts`）會掃描原始碼，如果有人把這兩個模組
重新寫成 module scope 的 static import，測試會紅燈 —— 那就是當初崩潰的成因。

## 8. 公用電腦的安全規則

- **不要**在這台機器上存任何憑證：`.env`、Expo 登入 token、GitHub PAT
- 收工前：`npx expo logout`、`git credential reject`、刪掉 clone 的資料夾
- 不要把 repo clone 到共用磁碟區

---

## 9. 如果時間只夠做一件事

跑到 **第 0 項 + 第 1 項**。app 開得起來、Today 的背景會隨 Zone 呼吸 —— 這兩件證明了
這輪最大的兩個風險（根 layout 改動、背景元件換掉）沒有炸。其餘可以下次。

---

## 10. 回報

每一項填 pass / fail + 一句話，寫進 `MEMORY.md` 最上方新條目（格式見該檔協議），
或直接貼回對話。**fail 要附實際錯誤訊息**，不要寫「好像不行」。

**不需要跑 `npm run verify`** —— 這張工單不改 code。真的改了才需要。
