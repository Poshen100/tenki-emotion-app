#!/usr/bin/env bash
# TENKI Core — PreToolUse Hook (Edit|Write)
# 保護不可修改的檔案: apps/web/*, .env, credentials
# Exit 2 = block the action

FILE_PATH=$(jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Block: apps/web/ (locked prototype)
if echo "$FILE_PATH" | grep -q "apps/web/"; then
  echo "🚫 apps/web/ 是鎖定的 prototype，不可修改。請在 apps/mobile/ 開發新功能。" >&2
  exit 2
fi

# Block: core/ (legacy v2 vanilla JS — reference only, per CLAUDE.md)
if echo "$FILE_PATH" | grep -qE '(^|/)core/' && ! echo "$FILE_PATH" | grep -q "node_modules"; then
  echo "🚫 core/ 是 v2 legacy 模組，僅供參考不可修改。新代碼進 packages/ 或 apps/mobile/。" >&2
  exit 2
fi

# Warn (not block): governance/rule files — legitimate 🟢/🟡 updates exist
# (adding lessons, MEMORY entries), so we can't hard-block; instead remind the
# model of the permission tiers every time it touches one. See adversarial
# review 2026-07-04: the 🔴 red zone must not rely on honour alone.
if echo "$FILE_PATH" | grep -qE '(CLAUDE\.md|SYSTEM\.md|docs/PLAYBOOK\.md|docs/MOTION-DIRECTION\.md|\.cursor/harness/)' && ! echo "$FILE_PATH" | grep -q "node_modules"; then
  echo "⚠️ 你正在編輯規則檔。先按 .cursor/harness/05_maintenance.md 分級：🟢 只能新增教訓列/日誌條目；🔴（CLAUDE.md 硬規則、PLAYBOOK §0、標「拍板/鎖定/locked/FOUNDER-APPROVED」的內容、harness 權限分級）未經 founder 同意不得修改。判斷不了 → 當 🔴 停下先問。"
fi

# Block: sensitive files
if echo "$FILE_PATH" | grep -qE '\.(env|env\.local|env\.production)$'; then
  echo "🚫 不可修改 .env 檔案 — 可能包含 secrets。" >&2
  exit 2
fi

# Block: lock files
if echo "$FILE_PATH" | grep -qE 'package-lock\.json$'; then
  echo "🚫 不要直接修改 package-lock.json，請用 npm install。" >&2
  exit 2
fi

exit 0
