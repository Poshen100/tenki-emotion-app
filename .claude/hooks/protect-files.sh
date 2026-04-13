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
