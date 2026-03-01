# FDCB (Floating Decision Control Bar) Specification

## Introduction
一條永遠浮動在螢幕底部的「自我紀律引擎」。決策 → 數據 → 自我覺察，全閉環。

## Component Structure
1. **模板選擇區 (Left)**: 選擇 6 種預設模板 (CANSLIM_GS, MANCINI_FBD, etc.)
2. **計時核心區 (Center)**: 狀態機 (IDLE -> READY -> RUNNING -> COMPLETE) 與進度條
3. **事件紀錄區 (Right)**: Micro Event 紀錄與展開的 Timeline (MiniTimeline)

## Data Layer
- 每次事件 (ENTRY/ADD/REDUCE/EXIT) 紀錄當下的時間與 TEI。
- 完成時上報 Database 生成「TEI Bucket」決策洞察：
  *例：「在 TEI 70-75 時，你通常在 90-150 秒內進場，勝率 62%」*
