> ⛔ **SUPERSEDED (2026-07-02) — DO NOT FOLLOW THIS FILE.**
> 本檔是 v1 時代的指令（還在講 TEI score 與 trading risk management，兩者皆為 v3 禁用概念）。
> 現行規則：`CLAUDE.md`（工程）+ `SYSTEM.md`（產品定位）+ `docs/PLAYBOOK.md`（操作與優先序）。
> 保留此檔僅供考古。

# AI Instructions - TENKI Emotion App

## Project Overview
HRV-based TEI score + trading risk management system.

## Core Structure
- **Core logic**: `src/core` (Currently in the root, moving towards `core/` as per CLAUDE.md)
- **UI components**: `src/components` (Currently in `ui/` or root)
- **TEI types**: `src/core/types.ts`
- **Future Python engine**: `/engine/tei_engine.py`

## Rules for AI
- **DO NOT TOUCH SYSTEM CORE**: `index.html` (except SAFE ZONE), `app.js`, `rpgg.js`, `expression.js`.
- **Event Bridge**: All communication must go through `EventBridge`.
- **Overlay UI**: Use `.overlay-` prefix and `#tenki-pro-overlay` container.
- **Vanilla JS**: No bundler required for MVP, but Vite is used for development.
