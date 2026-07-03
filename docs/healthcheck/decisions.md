# decisions.md — 2026-07-03 健檢關鍵裁決

> 每條：決策 + 為什麼 + 捨棄的替代方案。
> **2026-07-03 更新：founder 已拍板全部三件待決事項（全依建議）** — D1 措辭修正 ✅ 已執行、D3 考古層刪除 ✅ 已執行、D5 調色盤保留掛牌 ✅ 已執行。

## D1. Reanimated 3 規則 → 改寫為「目標態 + 現況豁免」，不立即遷移

**決策**：CLAUDE.md 規則措辭改為「動畫目標 Reanimated 3；現有 core-RN `Animated` 是 mock 階段的已知過渡債（INTEGRATION 標記），原生整合階段一併遷移；**不得新增**超出既有模式的 legacy Animated 用法」。20 檔 244 處現在不動。
**為什麼**：這不是偷懶違規 — 2026-06-10 的刻意決策（當時無 Mac、Reanimated 需原生驗證），元件自書 JSDoc、MEMORY 有案。現在盲遷 20 檔會產生大量無法在雲端驗證的動畫回歸，違反 Surgical Changes。規則與現實長期矛盾比債本身更毒（每個新 session 的 AI 都會困惑或誤改）。
**捨棄**：(a) 立即全面遷移 — 需實機 QA，雲端做不到，風險大於收益；(b) 刪除規則 — 丟失目標態，原生階段會忘記還債。

## D2. TEI 退場分四級，各級獨立可停

**決策**：①（零風險）`engine/src/tei.ts` + `engine/__tests__/tei.test.ts` 直接刪（僅互相引用的檢疫區外死代碼；`legacy/tei.ts` 保留完整相容故事）；②（低風險）engine 頂層 legacy-only 五檔（ewma/hrv/sqi/stress + 殘餘）搬進 `legacy/`；③（中風險）`packages/scan` 的 `teiAt*` 欄位、`TEI_BUCKET_BOUNDARIES`、`getTeiBucket` 改名為 Edge Score 語彙 — 先盤點消費者再動；④（低風險高噪音）preview v6 `tlTlTlTeiScore` 命名債 — 純內部 id，排最後。
**為什麼**：分級讓 Sonnet 可以逐級執行、每級有獨立驗收，錯一級不連坐。engine `types.ts`/`baseline.ts`/`rr.ts`/`fusion.ts` 被 active v3 引用（本體 import 追蹤），**不在退場清單** — 需先抽出 v3 仍用的部分，屬另一個計畫。
**捨棄**：一次性大掃除 — 改名觸及 scan 公開 API 與 90 行 preview，單 PR 爆炸半徑太大。

## D3. 根目錄考古層：`dev-dist/` + `vite.config.js` 直接刪；其餘六目錄 **[待 founder 拍板]** 再刪

**決策**：`dev-dist/`（build 產物）與 `vite.config.js`（死設定 + P0-1 違規文案）無需拍板即可刪。`src/`、`ui/`、`tests/`、`integration/`、`templates/` 建議整批刪除（git 歷史可復原），但屬破壞性動作，等 founder 一句話。
**為什麼**：零引用已由 agent 逐目錄驗證；「留著」的成本是每個 AI session 的認知稅與誤入風險（tests/ 裡的 tei 測試檔就是誘導誤判的餌）。vite devDependency 也一併移除。
**捨棄**：(a) 搬進 docs/archive/ — 代碼不是文件，git log 就是 archive；(b) 全部保留加 README — 治標，考古層繼續長大。

## D4. mobile 孤兒：只刪「無未來」的四檔，預留件全部保留並掛牌

**決策**：刪 `QualityMeter.tsx`、`ReadinessChecklist.tsx`、`StatusPill.tsx`、`lib/mock-scan.ts`。保留並在檔頭加 `DORMANT (awaiting native wiring)` 註解：`pulse-profile-store.ts`（TENKI Pulse 最後一哩，MEMORY 2026-06-14 有案）、finger-precision utils 四檔（等 multi-modal-blend 接線）、`face-baseline/recovery.tsx`（等原生 face-lost 事件）。
**為什麼**：「孤兒」有兩種 — 重構遺留（刪）與預留產能（留）。分不清就會重演「刪了下季度要用的東西」。掛牌讓下個 AI 不再重複調查。
**捨棄**：全刪（毀掉已測試的預留件）；全留（考古層在 mobile 重演）。

## D5. preview 第二調色盤（#c97b2f 金）**[待 founder 拍板]** — 不機械修

**決策**：`styles.css:2138` 的 `--tenki-accent-*` 調色盤是否併入 tokens.css canonical（`--gold-secured:#FFD46E` 等），交 founder 視覺裁決；健檢只記錄，不改。
**為什麼**：`#c97b2f` 出自 founder 參考截圖（task.md Screen C 明載），是「founder 認可過的視覺」與「後來的 token 收斂政策」打架 — 這是設計決策不是 bug。preview 又是 CI 盲區，改了只有 founder 手機能驗。
**捨棄**：機械改成 canonical — 可能毀掉 founder 喜歡的畫面，PLAYBOOK「不盲調視覺」原則。

## D6. maturityStage 語意缺口：先掛牌後補洞，不現在改行為

**決策**：短期在 `apps/mobile/.../maturityStage.ts` 加 mirror 標記 + caveat 註解（明示缺 distinct-days 條件）；補洞（真的接 ≥3 天條件）排入原生階段（需要持久化掃描日期，牽動 store persist 設計）。
**為什麼**：現在改行為會讓 demo 中的 maturity 進度倒退（founder 體驗突變），且 store 未持久化、distinctDays 無資料源 — 改了也是假的。缺口的危險在「沒人知道」，掛牌先消掉這個危險。
**捨棄**：立即實作 distinct-days — 無持久化基礎，假修。

## D7. 文件收斂：橫幅制度延伸到漏網五檔，DEPLOYMENT_MAP.json 改為「從 .md 重生」

**決策**：給 `BRAND.md`（根）、`docs/BRAND.md`、`DEPLOYMENTS.md`、`TENKI-ULTRA-SPEC.md`、`docs/TEI-SPEC.md`、`docs/progressive-tei-api.md` 加 SUPERSEDED/HISTORICAL 橫幅（同 RULES.md 格式）。`DEPLOYMENT_MAP.json` 本次手動修正 + 在兩檔頭部互加「改 .md 必須同步 .json」提示。
**為什麼**：橫幅是已驗證有效的制度（2026-07-02 立），漏網檔案是同一病的同一藥。f21bcd2 漏改 .json 證明「雙檔手動同步」會失敗，但寫產生器超出本次範圍 — 先用互相提醒的低科技解。
**捨棄**：寫 .md→.json 產生器 — 過度工程，路由變更頻率不值得。

## D8. 便宜模型 sub-agent 的使用紀律（本次實戰教訓，寫進 PLAYBOOK）

**決策**：在 PLAYBOOK 新增一節：sub-agent 跑量測類任務時 (a) 會產生副作用的指令（如 `jest --coverage`）要在 prompt 裡先聲明產物清理義務或事後由本體清理；(b) 便宜模型的異常回報（如「lint 紅了」）必須本體覆核再採信。
**為什麼**：本次 haiku agent 跑 coverage 污染工作區，然後把自己造成的 lint 紅回報成 repo 現況 — 若無覆核就會寫進報告變成假發現。這是可重複的失敗模式。
**捨棄**：禁止 sub-agent 跑測試 — 因噎廢食，量測正是最該外包的機械工作。
