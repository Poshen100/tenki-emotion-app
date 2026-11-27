/**
 * TENKI — 量到／算出／推論標籤的橋（P0-B）。
 *
 * 臉部掃描（readiness-scan.js）與 /drift/（drift-alert.js）是傳統 script，不能 import
 * ES module。這支 module 把**同一個** `evidenceLabelLine` 掛到 window 上 ——
 * 🔴 不是第二份文案：標籤的字只在 packages/engine/src/compliance/evidence-label.ts 產生。
 * ⚠️ module script 是 defer 的：用的人要在**用到的那一刻**才讀 window.TENKI_EVIDENCE_LABEL，
 *    不能在載入時就讀。
 */
import { evidenceLabelLine } from './engine/compliance/evidence-label.js';

window.TENKI_EVIDENCE_LABEL = { line: evidenceLabelLine };
// 載入時就畫過一次的頁面（/drift/）等這個訊號重畫 —— 它先跑、這支後到。
window.dispatchEvent(new Event('tenki:evidence-label-ready'));
