# templates/ — Legacy Decision Templates

> **⚠️ 注意**: 此資料夾包含舊版 (v1) 決策模板的 JSON 定義。

## 現況

這些 JSON 模板是 Web prototype 時期建立的，已被 `packages/fdcb/src/templates.ts` 中的 TypeScript 定義取代。

| 檔案 | 對應新模板 |
|------|----------|
| `canslim-growth.json` | `CANSLIM_GS` in `packages/fdcb/src/templates.ts` |
| `canslim-highrs.json` | `CANSLIM_HIGH_RS` in `packages/fdcb/src/templates.ts` |
| `mancini-fbd.json` | `MANCINI_FBD` in `packages/fdcb/src/templates.ts` |

## 注意事項

- **所有新功能開發應使用 `packages/fdcb/` 模組**
- 此資料夾保留供參考，不應直接使用
- 新增模板請更新 `packages/fdcb/src/templates.ts`
