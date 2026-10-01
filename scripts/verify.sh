#!/usr/bin/env bash
# TENKI Core — 一鍵 merge gate（Definition of Done）
#
# 跑完整套驗證: lint + 5 套件 tsc + root 測試 + mobile tsc/測試 + preview 語法 + 禁用詞彙
#              + preview harness（Playwright，偵測得到才跑）。
# 沒有這裡的綠燈，任何改動都不算「完成」。（CI = .github/workflows/ci.yml 跑同一套。）
#
# ⚠️ 本腳本涵蓋不到的事（見 docs/PLAYBOOK.md §3）:
#   - apps/preview 的視覺/互動 → founder 手機實走才算驗證
#   - 動效手感、實機效能 → 實機為準
#
# 用法: bash scripts/verify.sh          # 全套
#       bash scripts/verify.sh --quick  # 跳過 mobile（僅 packages/domain 改動時可用）

set -uo pipefail
cd "$(dirname "$0")/.."

QUICK=0
[ "${1:-}" = "--quick" ] && QUICK=1

RESULTS=()
FAILED=0

run_step() {
  local name="$1"
  shift
  echo ""
  echo "━━━ $name ━━━"
  if "$@"; then
    RESULTS+=("✓ $name")
  else
    RESULTS+=("✗ $name")
    FAILED=1
  fi
}

# ── 0. 依賴檢查 ──────────────────────────────────────────
if [ ! -d node_modules ]; then
  echo "🚫 root node_modules 不存在 — 先跑: npm ci"
  exit 1
fi

# ── 1. Lint（Biome，只涵蓋 packages/domain/apps/mobile）──
run_step "lint (biome)" npm run lint --silent

# ── 2. TypeScript 零錯誤（5 套件各自跑）─────────────────
run_step "tsc packages/engine" npx tsc --noEmit -p packages/engine
run_step "tsc packages/scan" npx tsc --noEmit -p packages/scan
run_step "tsc packages/shared" npx tsc --noEmit -p packages/shared
run_step "tsc domain" npx tsc --noEmit -p domain
run_step "tsc api" npx tsc --noEmit -p api

# ── 3. Root 測試（Jest；不含 apps/mobile）────────────────
run_step "root tests (jest)" npm test --silent

# ── 4. Mobile（不在 root workspaces，必須分開跑）─────────
if [ "$QUICK" = "1" ]; then
  RESULTS+=("– mobile (–-quick 跳過)")
elif [ ! -d apps/mobile/node_modules ]; then
  echo ""
  echo "🚫 apps/mobile/node_modules 不存在 — 先跑: cd apps/mobile && npm ci"
  RESULTS+=("✗ mobile (deps 未安裝)")
  FAILED=1
else
  run_step "tsc apps/mobile" bash -c 'cd apps/mobile && npx tsc --noEmit'
  run_step "mobile tests (jest)" bash -c 'cd apps/mobile && npm test --silent'
fi

# ── 5. Preview 語法檢查（CI/Biome 盲區的最低防線）────────
check_preview() {
  local ok=0
  while IFS= read -r f; do
    node --check "$f" 2>/dev/null || node --check --input-type=module < "$f" || ok=1
  done < <(find apps/preview -name '*.js' -not -path '*/node_modules/*')
  return $ok
}
run_step "preview syntax (node --check)" check_preview

# ── 6. 禁用詞彙（TEI/PR99 不得進新代碼）──────────────────
run_step "banned vocab (check-vocab)" bash scripts/check-vocab.sh

# ── 6b. MEMORY.md 的插入點標記 ──────────────────────────
# 協議第 1 條說「新條目加在協議正下方」，但那是一個**位置**，而位置需要一個
# 機械上唯一的 anchor 才找得準。`# YYYY-MM-DD` 標題與 `---` 都不唯一
# （2026-09-30 就有兩條同日紀錄），拿它們當 anchor 會插到檔案中間。
#
# 🔴 這條守的是「標記還在、還在正確的位置」。標記被刪或被搬走的話，下個 session
#    會靜靜地退回那個不唯一的 anchor —— 而那是出事那天的狀況。
check_memory_marker() {
  local n before_first
  # 🔴 只數**註解形式** `<!-- MEMORY-INSERT-HERE`。
  #    第一版數的是裸 token，而協議第 1 條的散文裡也寫了它一次 —— 於是乾淨時
  #    就報 2 次，而把標記刪掉反而變成 1 次＝綠。那是一條在量錯東西的檢查
  #    （PLAYBOOK：活性檢查量的不是同一個東西，就不是活性檢查）。
  #    反向驗證抓到的，不是推理出來的。
  n=$(grep -c '<!-- MEMORY-INSERT-HERE' MEMORY.md)
  if [ "$n" -ne 1 ]; then
    echo "🚫 MEMORY.md 的插入點標記出現 $n 次（應為 1）—— 協議第 1 條靠它定位"
    return 1
  fi
  # 標記必須排在所有條目之前，否則新條目會被插到檔案中間。
  before_first=$(awk '/<!-- MEMORY-INSERT-HERE/{m=NR} /^# 20[0-9][0-9]-/{if(!f)f=NR} END{print (m && f && m<f) ? "ok" : "bad"}' MEMORY.md)
  if [ "$before_first" != "ok" ]; then
    echo "🚫 MEMORY.md 的插入點標記不在所有條目之前 —— 新條目會被插到檔案中間"
    return 1
  fi
  return 0
}
run_step "memory insert marker" check_memory_marker

# ── 7. Preview harness（Playwright）─────────────────────
# 這兩支以前是 CI／verify 的盲區，而那個盲區咬過兩次（#231 改文案沒改斷言、
# Hero 爆版連三個 PR 沒紅）。現在 CI 一定會跑它們（.github/workflows/ci.yml
# 的 preview job），本機則是**偵測得到就跑**：裝了 Playwright 就當場採雷，
# 沒裝就標示跳過 —— 跟 mobile 未安裝時同樣的處理方式，不讓它變成硬失敗。
if node -e "import('playwright')" >/dev/null 2>&1 \
   || [ -d /opt/node22/lib/node_modules/playwright ]; then
  run_step "preview harness (fdcb)" node scripts/preview-fdcb.mjs
  run_step "preview harness (strip-color)" node scripts/preview-strip-color.mjs
  run_step "preview harness (decision-chain)" node scripts/preview-decision-chain.mjs
  run_step "preview harness (today-layout)" node scripts/preview-today-layout.mjs
  run_step "preview harness (scan-blink)" node scripts/preview-scan-blink.mjs
  run_step "preview harness (token-scale)" node scripts/preview-token-scale.mjs
  run_step "preview harness (drift)" node scripts/preview-drift.mjs
  run_step "preview harness (lab)" node scripts/preview-lab.mjs
else
  RESULTS+=("– preview harness（未裝 Playwright，略過；CI 會跑）")
fi

# ── 總結 ─────────────────────────────────────────────────
echo ""
echo "══════════ verify.sh 結果 ══════════"
for r in "${RESULTS[@]}"; do echo " $r"; done
echo "════════════════════════════════════"
if [ "$FAILED" = "1" ]; then
  echo "🔴 未通過 — 修到全綠才能 push / 回報完成。"
  exit 1
fi
echo "🟢 全部通過。（preview 視覺類改動仍需 founder 手機實走）"
exit 0
