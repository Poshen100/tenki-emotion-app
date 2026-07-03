#!/usr/bin/env bash
# TENKI Core — 禁用詞彙檢查（v2 廢棄詞不得進入新代碼）
#
# 只檢查「相對於 main 新增的行」，所以既有 legacy 殘留（packages/engine/src/tei.ts、
# legacy-tei-adapter 等 18 個已知檔案）不會誤報；那些屬已知債，見 docs/PLAYBOOK.md §8。
#
# 用法:
#   bash scripts/check-vocab.sh            # diff 對象 = origin/main 與 HEAD 的 merge-base
#   bash scripts/check-vocab.sh <base-ref> # 指定 diff 基準
#
# Exit 0 = 乾淨或無法取得基準（警告後放行）; Exit 1 = 發現新增的禁用詞。

set -uo pipefail
cd "$(dirname "$0")/.."

BASE_REF="${1:-origin/main}"

# 禁用詞（case-sensitive; 全大寫縮寫不會誤中 tlTlTlTeiScore 這類既有 camelCase 殘留）
BANNED_REGEX='\bTEI\b|\bPR99\b'

# 只掃代碼路徑；排除 legacy / tei 相容層（它們合法地談論舊詞彙）
PATHSPECS=(
  'packages' 'domain' 'apps/mobile' 'apps/preview'
  ':(exclude)packages/engine/src/legacy/**'
  ':(exclude)packages/engine/src/tei.ts'
  ':(exclude)packages/engine/src/types.ts'
  ':(exclude)packages/engine/src/common/legacy-tei-adapter*'
  ':(exclude)packages/engine/src/common/__tests__/legacy-tei-adapter*'
  ':(exclude)packages/engine/src/pipeline/progressive-pipeline.ts'
)

if ! git rev-parse --verify -q "$BASE_REF" > /dev/null; then
  git fetch origin main --quiet 2> /dev/null || true
fi
if ! git rev-parse --verify -q "$BASE_REF" > /dev/null; then
  echo "⚠️  check-vocab: 找不到基準 $BASE_REF，跳過檢查（請確認已 fetch origin/main）"
  exit 0
fi

MERGE_BASE=$(git merge-base "$BASE_REF" HEAD 2> /dev/null || echo "$BASE_REF")

# git diff <merge-base>（無第二 ref）= 涵蓋已 commit + 未 commit 的全部改動
HITS=$(git diff "$MERGE_BASE" -- "${PATHSPECS[@]}" \
  | grep -E '^\+[^+]' \
  | grep -nE "$BANNED_REGEX" || true)

if [ -n "$HITS" ]; then
  echo "🚫 新增的代碼含 v2 廢棄詞彙（TEI / PR99）— 請改用 Edge Score / Decision Edge:"
  echo "$HITS"
  echo ""
  echo "   規則出處: CLAUDE.md 禁止事項表、docs/PLAYBOOK.md §8"
  exit 1
fi

echo "✓ check-vocab: 無新增禁用詞彙"
exit 0
