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

# 產品名稱洩漏：這個模式對外一律叫「決策紀律模式 / Decision Mode」。
# 依據 docs/APP_STORE_COMPLIANCE.md §6 與送審檢查表 #17、
# docs/TRADINGVIEW-ALERT-SPEC.md §0，以及 safe-copy.ts 的 PROHIBITED_VOCABULARY。
#
# 🔴 只擋**命名**，不擋**否認**。免責聲明的工作就是點名它不做的事 ——
#    「does not provide … trading signals」必須留著那個字，
#    把 isCompliantCopy 無差別套上去會刪掉一句法律上有意義的否認。
#    所以這裡鎖的是當作標籤用的字串（引號包住的 'Trader'、標題式的 Trader Mode、
#    以及中文的「交易者模式」），不是小寫的 trading signals / trading recommendations。
# ⚠️ 內部識別字（SessionMode='trader'、TraderTemplateId、TRADER_MODE_DISCLAIMER）
#    刻意不擋 —— 那是 persisted contract 與常數名，不是使用者看得到的字。
BANNED_COPY_REGEX="'Trader'|\"Trader\"|Trader Mode|交易者模式"

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
ADDED=$(git diff "$MERGE_BASE" -- "${PATHSPECS[@]}" | grep -E '^\+[^+]' || true)

HITS=$(echo "$ADDED" | grep -nE "$BANNED_REGEX" || true)

if [ -n "$HITS" ]; then
  echo "🚫 新增的代碼含 v2 廢棄詞彙（TEI / PR99）— 請改用 Edge Score / Decision Edge:"
  echo "$HITS"
  echo ""
  echo "   規則出處: CLAUDE.md 禁止事項表、docs/PLAYBOOK.md §8"
  exit 1
fi

COPY_HITS=$(echo "$ADDED" | grep -nE "$BANNED_COPY_REGEX" || true)

if [ -n "$COPY_HITS" ]; then
  echo "🚫 新增的代碼把這個模式命名為「Trader」— 對外一律「決策紀律模式 / Decision Mode」:"
  echo "$COPY_HITS"
  echo ""
  echo "   規則出處: docs/APP_STORE_COMPLIANCE.md §6 + 送審檢查表 #17、"
  echo "             docs/TRADINGVIEW-ALERT-SPEC.md §0"
  echo "   註: 內部識別字（SessionMode='trader' 等）不受此限；"
  echo "       免責聲明裡的否認句（does not provide … trading signals）也不受此限。"
  exit 1
fi

echo "✓ check-vocab: 無新增禁用詞彙"
exit 0
