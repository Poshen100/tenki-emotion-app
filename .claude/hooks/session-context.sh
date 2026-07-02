#!/usr/bin/env bash
# TENKI Core — SessionStart Hook
# 每次 AI 開 session 自動注入專案背景知識
# Outputs key context so any AI agent immediately understands the project.

set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

cat << 'CONTEXT'
══════════════════════════════════════════════════════
 TENKI CORE v3.0 — AI Session Context
══════════════════════════════════════════════════════

【產品】Privacy-first cognitive wellness app
【核心指標】Decision Edge Score (0-100)
【3 Zone】Clear (70-100) / Neutral (40-69) / Strain (0-39)
【2 Tier】Free / Premium
【架構】Local-first + Cloud-minimal

【禁止事項】
 ✗ 不要用 TEI/PR99/PEAK/OPTIMAL (已廢棄)
 ✗ 不要給醫療診斷或金融建議
 ✗ 不要上傳 raw biometric data 到雲端
 ✗ 不要動 apps/web/ 裡的任何檔案
 ✗ 不要用 any (TypeScript)

【Commit 規範】每個 Todo = 一個 commit
 格式: <type>(<scope>): <description>

【驗證】bash scripts/verify.sh 一鍵跑完 merge gate
 (Jest + ts-jest,不是 vitest;apps/mobile 不在 root
  workspaces,verify.sh 會自動分開跑)
【盲區】CI/Biome 不涵蓋 apps/preview/** → 改 preview
 需 founder 手機實走;細節見 docs/PLAYBOOK.md §3/§6
══════════════════════════════════════════════════════
CONTEXT

# Dynamic context: recent git activity
echo ""
echo "【最近 5 個 Commits】"
cd "$PROJECT_DIR" && git log --oneline -5 2>/dev/null || echo "(git not available)"

echo ""
echo "【Current Branch】"
cd "$PROJECT_DIR" && git branch --show-current 2>/dev/null || echo "(unknown)"

echo ""
echo "【Working Tree Status】"
cd "$PROJECT_DIR" && git status --short 2>/dev/null | head -10 || echo "(clean)"

echo ""
echo "【Monorepo Structure】"
cat << 'STRUCTURE'
 tenki-emotion-app/
 ├── packages/engine/    — Edge Score 引擎 (scoring, session, baseline, compliance)
 ├── packages/scan/      — FHZ 掃描 pipeline (原 fdcb)
 ├── packages/shared/    — Design tokens, zone config, feature flags
 ├── domain/             — Domain models, contracts, policies, analytics
 ├── apps/web/           — Web prototype (🔒 不可修改)
 ├── apps/mobile/        — Expo/React Native app (Phase C)
 ├── apps/preview/       — 瀏覽器驗證 UI (CI 盲區!)
 ├── core/               — Legacy vanilla JS (🔒 僅參考)
 ├── CLAUDE.md           — 📌 AI 開發策略 (必讀)
 ├── docs/PLAYBOOK.md    — 📌 已知陷阱手冊 (動工前查)
 └── MEMORY.md           — 📌 Session 記憶 (讀最上條)
STRUCTURE

echo ""
echo "══════════════════════════════════════════════════════"
echo " 📌 開始前請先讀: CLAUDE.md → MEMORY.md 最上面一條"
echo "    → docs/PLAYBOOK.md 對應段落 (文件衝突時看其 §0)"
echo "══════════════════════════════════════════════════════"
