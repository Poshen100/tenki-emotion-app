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

本機 clone 本來就是完整副本。加一個獨立廠商的 remote，推的時候兩邊都推。
這一條解掉「程式碼拿不回來」與「不能繼續開發」。

**工具已經寫好了：`scripts/mirror-push.sh`。** 只缺兩個環境變數。

#### 一次性設定

1. 註冊 GitLab：<https://gitlab.com/users/sign_up>
   - 選 GitLab 不選 Bitbucket：Bitbucket 免費版每 repo 約 1GB 軟上限，
     而本 repo 的 `.git` 已經約 300MB（歷史肥肉，見下）。
   - ⚠️ `codeberg.org` 在本專案的雲端環境**連不到**（實測），不要選它。
2. 建一個**空的** private project：<https://gitlab.com/projects/new#blank_project>
   - Visibility 選 **Private**
   - 🔴 **不要勾**「Initialize repository with a README」
   - ⚠️ **已經勾了也不用重建。** 對面的 `main` 會有一顆我們沒有的 commit，
     跟本機歷史沒有共同祖先，直接推會被 non-fast-forward 擋下來。
     `mirror-push.sh` 的 preflight 會攔住並告訴你怎麼辦（見下）。
     （2026-10-26 實際踩到。）
3. 產 token：<https://gitlab.com/-/user_settings/personal_access_tokens>
   - ⚠️ **`Generate token` 是個下拉，底下還分兩種 —— 兩種都推得動：**

     | 選項 | 範圍 | 怎麼設才能 push |
     |---|---|---|
     | **Fine-grained token**（建議）| 只給指定的群組／專案 | **Code** 權限設成 **Push** |
     | Legacy token | 該帳號**所有**專案 | 只勾 `write_repository` |

     選 Fine-grained：一樣推得動，而且把「PAT 涵蓋所有 repo」這個缺點解掉。
     介面太難操作就退回 Legacy —— 一定能用，別卡在這裡。
     ⚠️ GitLab 對 git over HTTPS **不驗使用者名稱**，所以腳本用的
     `oauth2:<token>` 對兩種都有效。
   - 🔴 **這兩個都屬於 Personal Access Token。** 另外兩種不行，2026-10 查證：

     | token 種類 | GitLab.com 免費版 | 能 push 嗎 |
     |---|---|---|
     | Project Access Token | ❌ 限 Premium/Ultimate | — |
     | Deploy Token | ✅ 有 | ❌ git 唯讀 |
     | **Personal Access Token** | ✅ 有 | ✅ |

     ⚠️ 方案內容會變，眼見為憑。
   - 🔴 **token 只顯示一次**，當場複製。
   - ⚠️ PAT 涵蓋該帳號所有 repo → **設到期日**。
     新帳號只有這一個鏡像 repo 時，實際風險很小。
4. 🔴 **不要把 token 貼進對話或寫進檔案。**
   放進雲端環境的 Network secrets / 環境變數
   （session 標題列的環境選單 → Edit）：

   | 變數 | 值 |
   |---|---|
   | `MIRROR_REMOTE` | 那個 project 的 HTTPS URL |
   | `MIRROR_TOKEN` | 剛才那個 token |

5. **開一個新 session** —— 舊 session 讀不到新加的變數。
   ⚠️ 前三步手機瀏覽器都做得完；第 4 步的環境設定介面**可能需要電腦**。

#### 平常怎麼用

```sh
bash scripts/mirror-push.sh
```

它會推 `--all` 與 `--tags`，推之前先 `git ls-remote` 問對面有什麼。
退出碼分得開，不會半成功：

| exit | 意思 | 怎麼辦 |
|---|---|---|
| 2 | 兩個環境變數沒設齊 | 照上面的一次性設定做 |
| 1 | 連不上鏡像，或憑證被拒 | token 打錯／過期／權限不足（要 `write_repository` 或 Code→Push）|
| 3 | 對面有本機沒有的 commit | 見下面那條 |

🔴 **exit 3（對面有東西）怎麼處理。** 最常見是建 project 時勾了 README。
preflight 在**送出任何物件之前**就擋下來，兩條路：

```sh
# a) 覆寫鏡像 —— 鏡像本來就該是本機的精確副本
MIRROR_FORCE=1 bash scripts/mirror-push.sh
# b) 或在 GitLab 上把那些 commit 砍掉，再重跑不帶 MIRROR_FORCE 的版本
```

⚠️ **`MIRROR_FORCE` 刻意不是預設值。** 這次對面只有一顆拋棄式 README，
覆寫無害；但「鏡像推送預設 force」會長久留在 repo 裡，而下一次對面
可能有別人推的東西。預設安全、要覆寫就講出來。

⚠️ **拿 clone URL 不要用猜的。** GitLab 的顯示名稱（例「Tenki Core-group」）
跟 URL 裡的 slug 可以不同。到 project 頁按 **`Code`** → **Clone with HTTPS**
複製，那個值就是 `MIRROR_REMOTE`。

🔴 **這支刻意不做 `git remote add`** —— 帶憑證的 URL 只在那一次 push 用，
不寫進 `.git/config`。已驗證：token 不會出現在輸出、不會進 config、
`git remote -v` 不變。

⚠️ **鏡像要定期真的推，不是設完就算。沒有被推過的鏡像等於不存在。**

#### 關於 300MB

`.git` 約 300MB，來源是歷史裡的 `apps/mobile/node_modules/`（libskia.a 等約
250MB）與根目錄兩個 24MB 的 3D 資產。兩者**現在都已不被追蹤**
（`.gitignore` 兩層都擋），是純歷史肥肉、不是現行 bug。

🔴 **不要為了瘦身重寫歷史。** `MEMORY.md` 與 `docs/PLAYBOOK.md` 大量引用
commit SHA 當證據，重寫會讓每一個 SHA 失效 —— 那等於打斷整條文件鏈，
代價遠大於 300MB。需要快就用 `git clone --depth`。

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

