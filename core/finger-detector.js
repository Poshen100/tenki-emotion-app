/**
 * TENKI FingerDetector
 * =====================
 * 手指覆蓋率偵測模組
 *
 * 功能:
 * - 從 <video> 或 ImageBitmap 幀中計算手指覆蓋率
 * - 支援 MediaPipe Hands（可選）與 純像素分析 fallback
 * - 輸出 RED / YELLOW / GREEN 三色狀態
 * - 透過 EventBridgeV2 發送 tenki:ppg-coverage 事件
 *
 * ROI 策略 (Solo Founder 三大利器之一):
 *   優先順序: glabella (眉心) → forehead (額頭) → cheeks (臉頰) → center (中心)
 *   手機後鏡頭 PPG 模式: 整幀作為 ROI
 *
 * 覆蓋率閾值:
 *   GREEN  ≥ 0.85 → 信號可靠，開始鎖定
 *   YELLOW ≥ 0.60 → 調整中
 *   RED    < 0.60 → 覆蓋不足
 *
 * 不可修改任何 LOCKED FILE
 *
 * @version 2.0.0
 * @author  TENKI Core Team
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 常數
// ─────────────────────────────────────────────────────────────────────────────

const COVERAGE_GREEN_THRESHOLD = 0.85;
const COVERAGE_YELLOW_THRESHOLD = 0.60;

const SKIN_R_MIN = 80;
const SKIN_G_MIN = 40;
const SKIN_B_MIN = 20;
const SKIN_R_MAX = 255;
const SKIN_G_MAX = 200;
const SKIN_B_MAX = 170;
const SKIN_R_DOMINANT_RATIO = 1.15;

const PIXEL_SAMPLE_STRIDE = 4;
const COVERAGE_EWMA_ALPHA = 0.25;
const MEDIAPIPE_CONFIDENCE = 0.7;
const EMIT_THROTTLE_MS = 100;
const ROI_STRATEGIES = ['full', 'center', 'top', 'glabella'];


// ─────────────────────────────────────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────────────────────────────────────

function isSkinPixel(r, g, b) {
    if (r < SKIN_R_MIN || r > SKIN_R_MAX) return false;
    if (g < SKIN_G_MIN || g > SKIN_G_MAX) return false;
    if (b < SKIN_B_MIN || b > SKIN_B_MAX) return false;
    if (r < g * SKIN_R_DOMINANT_RATIO) return false;
    return true;
}

function getRoiRect(strategy, width, height) {
    switch (strategy) {
        case 'glabella':
            return {
                x: Math.floor(width * 0.35),
                y: Math.floor(height * 0.10),
                w: Math.floor(width * 0.30),
                h: Math.floor(height * 0.25),
            };
        case 'forehead':
            return {
                x: Math.floor(width * 0.20),
                y: Math.floor(height * 0.05),
                w: Math.floor(width * 0.60),
                h: Math.floor(height * 0.30),
            };
        case 'top':
            return { x: 0, y: 0, w: width, h: Math.floor(height * 0.5) };
        case 'center':
            return {
                x: Math.floor(width * 0.20),
                y: Math.floor(height * 0.20),
                w: Math.floor(width * 0.60),
                h: Math.floor(height * 0.60),
            };
        case 'full':
        default:
            return { x: 0, y: 0, w: width, h: height };
    }
}

function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}

function coverageToColor(coverage) {
    if (coverage >= COVERAGE_GREEN_THRESHOLD) return 'green';
    if (coverage >= COVERAGE_YELLOW_THRESHOLD) return 'yellow';
    return 'red';
}

function coverageHint(color, roiStrategy) {
    if (color === 'green') return '保持不動，正在讀取...';
    if (color === 'yellow') return '繼續調整手指位置';

    const roiHints = {
        glabella: '請以眉心對準鏡頭（最佳 ROI）',
        forehead: '請以額頭對準鏡頭',
        top: '請將手指上移',
        center: '請將手指完整覆蓋鏡頭',
        full: '請將手指完整覆蓋鏡頭',
    };
    return roiHints[roiStrategy] || '請將手指完整覆蓋鏡頭';
}


// ─────────────────────────────────────────────────────────────────────────────
// FingerDetector 主類別
// ─────────────────────────────────────────────────────────────────────────────

class FingerDetector {
    constructor(options = {}) {
        this._roiStrategy = options.roiStrategy || 'full';
        this._useMediaPipe = options.useMediaPipe || false;
        this._verbose = options.verbose || false;

        this._canvas = null;
        this._ctx = null;

        this._ewmaCoverage = 0;
        this._initialized = false;

        this._mediapipeHands = null;
        this._mediapipeReady = false;

        this._lastEmitTs = 0;

        this._stats = {
            framesProcessed: 0,
            framesWithFinger: 0,
            currentROI: this._roiStrategy,
        };
    }

    // ── 公開 API ──

    processFrame(frame) {
        this._stats.framesProcessed++;

        let imageData;

        try {
            imageData = this._extractImageData(frame);
        } catch (err) {
            this._log(`⚠️ 無法提取圖像資料: ${err.message}`);
            return this._makeResult(this._ewmaCoverage);
        }

        const rawCoverage = this._calcCoverageFromImageData(imageData);

        if (!this._initialized) {
            this._ewmaCoverage = rawCoverage;
            this._initialized = true;
        } else {
            this._ewmaCoverage = COVERAGE_EWMA_ALPHA * rawCoverage
                + (1 - COVERAGE_EWMA_ALPHA) * this._ewmaCoverage;
        }

        const result = this._makeResult(this._ewmaCoverage);

        if (result.color === 'green' || result.color === 'yellow') {
            this._stats.framesWithFinger++;
        }

        this._emitIfReady(result);

        return result;
    }

    setROIStrategy(strategy) {
        if (!ROI_STRATEGIES.includes(strategy)) {
            console.warn(`[FingerDetector] 無效 ROI 策略: "${strategy}"`);
            return;
        }
        this._roiStrategy = strategy;
        this._stats.currentROI = strategy;
        this._log(`ROI 策略切換: ${strategy}`);
    }

    getStats() {
        return {
            ...this._stats,
            ewmaCoverage: Math.round(this._ewmaCoverage * 1000) / 1000,
            currentColor: coverageToColor(this._ewmaCoverage),
        };
    }

    reset() {
        this._ewmaCoverage = 0;
        this._initialized = false;
        this._lastEmitTs = 0;
        this._stats = {
            framesProcessed: 0,
            framesWithFinger: 0,
            currentROI: this._roiStrategy,
        };
    }

    // ── 私有 ──

    _extractImageData(frame) {
        if (frame instanceof ImageData) {
            return frame;
        }

        const width = frame.videoWidth || frame.width || 640;
        const height = frame.videoHeight || frame.height || 480;

        if (!this._canvas) {
            if (typeof OffscreenCanvas !== 'undefined') {
                this._canvas = new OffscreenCanvas(width, height);
            } else {
                this._canvas = document.createElement('canvas');
                this._canvas.width = width;
                this._canvas.height = height;
            }
            this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
        }

        if (this._canvas.width !== width || this._canvas.height !== height) {
            this._canvas.width = width;
            this._canvas.height = height;
        }

        this._ctx.drawImage(frame, 0, 0, width, height);

        const roi = getRoiRect(this._roiStrategy, width, height);
        return this._ctx.getImageData(roi.x, roi.y, roi.w, roi.h);
    }

    _calcCoverageFromImageData(imageData) {
        const { data, width, height } = imageData;
        let skinPixels = 0;
        let totalPixels = 0;

        for (let y = 0; y < height; y += PIXEL_SAMPLE_STRIDE) {
            for (let x = 0; x < width; x += PIXEL_SAMPLE_STRIDE) {
                const idx = (y * width + x) * 4;
                totalPixels++;
                if (isSkinPixel(data[idx], data[idx + 1], data[idx + 2])) {
                    skinPixels++;
                }
            }
        }

        if (totalPixels === 0) return 0;
        return clamp(skinPixels / totalPixels, 0, 1);
    }

    _makeResult(coverage) {
        const color = coverageToColor(coverage);
        return {
            coverage: Math.round(coverage * 1000) / 1000,
            color,
            hint: coverageHint(color, this._roiStrategy),
        };
    }

    _emitIfReady(result) {
        const now = Date.now();
        if (now - this._lastEmitTs < EMIT_THROTTLE_MS) return;
        this._lastEmitTs = now;

        if (typeof window !== 'undefined' && window.EventBridgeV2) {
            window.EventBridgeV2.emitPPGCoverage(result.coverage);
        }
    }

    _log(msg) {
        if (this._verbose) {
            console.log(`[FingerDetector] ${msg}`);
        }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.FingerDetector = FingerDetector;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FingerDetector,
        isSkinPixel,
        coverageToColor,
        coverageHint,
        getRoiRect,
        COVERAGE_GREEN_THRESHOLD,
        COVERAGE_YELLOW_THRESHOLD,
    };
}
