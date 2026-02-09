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
