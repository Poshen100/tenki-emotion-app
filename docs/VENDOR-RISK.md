# 廠商風險：停權時什麼會壞、什麼不會，以及怎麼降低代價

> 寫於 2026-10-17，起因是 GitHub 帳號在 10-16 被以「ToS 違規」停權
> （Ticket 4868985）。那次推送、PR、CI、Vercel 新部署全斷了好幾天。
>
> 🔴 **「完全不會受到影響」做不到。** 任何單一廠商都能在沒有預警的情況下
> 停掉你 —— GitHub、Apple、Google、Stripe、Vercel 都一樣。把目標訂成
> 「不受影響」只會買到假的安心。做得到的是：
> **讓停權只擋住開發，不擋住營運與收入。**

---

## 1. 影響範圍（2026-10-16 實測，不是推測）

| 會壞 | 不會壞 |
|------|--------|
| `git push` / `pull` / PR / code review | **已上架 App 照常運作**（binary 在 App Store / Play，與 GitHub 無關）|
| GitHub Actions（`ci.yml` + `android-dev-build.yml`）| **已部署的網站還活著**（Vercel 最後一次部署不會因此下線）|
| **Vercel 新部署** —— 它透過 GitHub 整合拉 code | **訂閱收入照收**（金流在 Apple / Google / Stripe）|

### 結論：真正的商業風險不是「服務中斷」

線上使用者與收入在 GitHub 停權時**本來就是安全的**。
真正會痛的是另一件事：**線上有 bug，而你推不出修正版。**

所以對策的目標不是「讓 GitHub 不會掛」，是
**「GitHub 掛了，我仍然發得出版本」**。

---

## 2. 對策，照 CP 值排

### ① 第二個 git remote（約 10 分鐘，最高 CP 值）

本機 clone 本來就是完整副本。加一個獨立廠商的 remote（GitLab / Codeberg /
自架），推的時候兩邊都推。這一條解掉「程式碼拿不回來」與「不能繼續開發」。

```sh
git remote add mirror <另一個廠商的 repo>
git push mirror --all && git push mirror --tags
```

⚠️ 鏡像要**定期真的推**，不是設完就算。沒有被推過的鏡像等於不存在。

### ② 搬到 GitHub Organization，而且要有第二位 owner

個人帳號停權 ＝ 一個人倒下全部倒。Org 有多位 owner，一人被停另一人還能動。
商業化之後 repo 本來就該屬於公司實體，而不是某個人的個人帳號。

### ③ GitHub Team（$4/人/月）—— 值得買，但理由不是防停權

⚠️ **這一條本來寫成「付費帳號在濫用偵測上寬容度較高、而且有 support SLA」，
那是錯的，2026-10-21 更正。** 實際上：

- **$4 的 Team 沒有 support SLA**，跟免費版走同一個支援佇列。
  有 SLA 的是 Enterprise（約 $21/人/月）或另外加購的 Premium Support。
- 「付費帳號比較不會被濫用偵測標記」**沒有可靠證據**，不要當成買它的理由。
- **Actions 分鐘數也多半不構成理由**：私有 repo 免費 2,000 分/月、Team 3,000 分/月。
  本專案一輪 CI（4 個 job，preview 那支跑 Playwright 約 12–14 分）約 **18–22 分鐘**，
  一個 PR 連同合併後的 main 約 40 分鐘 —— 以目前節奏用不到免費額度的三分之一。

**真正值得的是 branch protection**：私有 repo 的分支保護規則要 Team 才有。
沒有它，「CI 紅著也能合併」只能靠自律擋。要上架、要收訂閱，
那條該用規則鎖住（required status checks），而不是靠人記得。

🔴 **而解決「GitHub 掛了我還能發版」的是上面的 ①（第二個 remote），那是免費的。**
不要用付費方案買一個它不提供的保障。

### ④ 讓 Vercel 不要只能從 GitHub 拉

目前 Vercel 走 GitHub 整合，所以 GitHub 死 → 新部署也死。
留一條 CLI 直接部署的路（`vercel deploy --prebuilt`），
從本機或從別的 CI 觸發，GitHub 掛掉時仍然出得了版本。

### ⑤ build 產物另外備份

IPA / AAB / 其他 release artifact 不要只存在 GitHub Releases。

### ⑥ 不要讓同一個帳號兼差

個人實驗、公司 repo、CI、部署金鑰分開。一個被停不會連坐。

---

## 3. 🔴 風險高一個量級的其實是 Apple / Google

GitHub 停權**不會讓你掉一毛錢**。能直接掐死商業化的是開發者帳號：

- 可以下架 App → **收入歸零**
- 審核可以無限期拖，沒有 SLA
- **訂閱金流就在它們手上**
- 申訴管道比 GitHub 更慢、更不透明

同樣的分散邏輯要**優先**用在這裡：

- 開發者帳號掛**公司實體**，不要用個人 Apple ID
- 設定多位 Admin / Account Holder 之外的管理者
- 付款方式有備援（卡片過期導致的停權很常見）
- 訂閱走一層抽象（RevenueCat 之類），之後要補 web 訂閱或換金流時不必重寫

---

## 4. 這次的觸發點：AI agent 的 API burst

GitHub Support 的說法是「activity 被 abuse-detection 系統標記，進入人工審查」。
最可能的來源是 AI 開發助手透過 GitHub App 代為操作所產生的樣態：

- 短時間大量 API 呼叫
- App token 開 PR、讀 workflow 結果
- 密集觸發 Actions（而 Playwright 的瀏覽器測試單 job 要 7–10 分鐘、吃 CPU）

這些在濫用偵測眼裡跟 bot farm / 挖礦的特徵**重疊**。

⚠️ **商業化之後自動化只會更多，所以這個風險是往上走的。**
對策是上面的 ③（付費方案）加上：用官方整合、不要高頻輪詢、
CI 不要掛不必要的排程觸發。

---

## 5. 真的被停權時的 runbook

1. **先分辨是哪一層**：帳號？App 安裝？repo？
   用瀏覽器登入 github.com —— 登得進去就不是帳號層級。
2. **保全本機工作**：`git bundle create <檔名>.bundle <base>..HEAD`，
   把檔案帶出容器。本機 commit 在臨時容器裡**不算安全**。
3. **開一張票就好**：`support.github.com/contact`。
   ⚠️ 不要開第二張（會重新排隊），不要去社群問（他們處理不了帳號問題）。
4. **申訴信要問「具體是哪一條」**，而不是只說「我沒做壞事」。
   附上登入失敗截圖、正常運作與失效的時間窗。
5. 🔴 **絕對不要另開新帳號**（包括用 Google / Apple 另外登入）——
   會被視為規避停權，申訴直接變難。
6. **不要催**。人工審查已經在跑；一週無下文再在**同一張票**底下禮貌 follow-up。

---

## 6. 事件紀錄

| 時間（UTC）| 事件 |
|---|---|
| 2026-10-15 ~01:50 | 完全正常 —— PR #281 合併、main 的 CI 四個 job 全綠 |
| 2026-10-16 | 登入被擋；git 與 REST API 全部 403 |
| 2026-10-17 06:39 | GitHub Support 回覆：abuse-detection 標記、進入人工審查，詢問用途 |

