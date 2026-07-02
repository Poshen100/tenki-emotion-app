#!/usr/bin/env bash
# TENKI Core — Compact Hook
# 當 context window 被壓縮後，重新注入關鍵記憶
# Boris 技巧: "compact 後 Claude 會忘記背景，要重新注入"

cat << 'COMPACT'
⚠️ Context 已壓縮 — 重新注入關鍵記憶:

【v3 架構】Edge Score (0-100) / 3 Zone (Clear/Neutral/Strain) / 2 Tier (Free/Premium)
【禁止】TEI, PR99, PEAK/OPTIMAL, 醫療建議, 金融建議, apps/web/ 修改
【Commit】每個 Todo = 一個 commit, 格式: <type>(<scope>): <desc>
【驗證】bash scripts/verify.sh (Jest 不是 vitest; mobile 分開跑)
【必讀】CLAUDE.md → docs/PLAYBOOK.md (陷阱手冊) → MEMORY.md 最上條
COMPACT
