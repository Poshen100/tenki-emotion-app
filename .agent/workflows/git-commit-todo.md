---
description: Git commit after every Todo item in a plan
---

# Commit Per Todo Workflow

## 📌 核心規則
**每完成 plan 裡的一個 Todo → 立即 commit 一次**

## 步驟

1. 確認目前 Todo 已完成
// turbo
2. Stage 剛才修改的檔案
```bash
git add <changed-files>
```
// turbo
3. 用對應 Todo 描述 commit
```bash
git commit -m "<type>(<scope>): <todo原文描述>"
```
// turbo
4. 繼續下一個 Todo，重複以上步驟

## Commit 類型對照表

| type | 使用時機 |
|------|---------|
| `feat` | 新功能 Todo |
| `fix` | 修 Bug Todo |
| `test` | 加測試 Todo |
| `refactor` | 重構 Todo |
| `docs` | 文件 Todo |
| `style` | UI/CSS Todo |
| `perf` | 效能優化 Todo |

## 範例

Plan Todo: `[ ] Implement T3 CANSLIM template`
```bash
git commit -m "feat(core): implement T3 CANSLIM template"
```

Plan Todo: `[ ] Fix PPG camera lifecycle on reload`
```bash
git commit -m "fix(ppg): fix camera lifecycle on reload"
```

Plan Todo: `[ ] Add Kalman filter edge case tests`
```bash
git commit -m "test(kalman): add edge case for zero variance"
```

## ❌ 禁止行為

- 累積 5 個 Todo 才 commit 一次（找 Bug 時會瘋掉）
- commit message 寫 "update" 或 "fix bug"（沒意義）
- 一個 commit 做多個完全不相關的事情

## ✅ 優點

- `git log --oneline` = 完整的 plan 執行軌跡
- 任何 Bug 可以 `git bisect` 精確定位到哪個 Todo
- Code review 時每個 commit 對應一個功能點，清晰易讀
- 出問題可以 `git revert` 單一 Todo

// turbo-all
