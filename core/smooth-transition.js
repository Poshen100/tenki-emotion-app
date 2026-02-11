/**
 * @fileoverview Smooth TEI Transition - EWMA 動畫控制器
 * @description 使用指數加權移動平均實現 TEI 分數的平滑過渡動畫。
 *              信心度高時收斂更快，低時過渡更慢。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    class SmoothTEITransition {
        constructor() {
            this.currentTEI = 0;
            this.targetTEI = 0;
            this.currentConfidence = 0;
            this.animating = false;
            this._animationId = null;
            this._callbacks = [];
        }

        /**
         * 平滑更新 TEI
         * @param {number} newTEI - 新的 TEI 分數 (1-99)
         * @param {number} confidence - 信心度 (0-1，影響更新速度)
         */
        smoothUpdate(newTEI, confidence) {
            this.targetTEI = Math.max(1, Math.min(99, newTEI));
            this.currentConfidence = confidence;

            if (this.animating) return;

            this.animating = true;
            const alpha = Math.max(0.05, confidence * 0.5); // 信心度高 → 更快收斂
            const duration = 800; // ms
            const fps = 60;
            const totalFrames = Math.round((duration / 1000) * fps);

            let frame = 0;

            const animate = () => {
                if (frame < totalFrames && Math.abs(this.currentTEI - this.targetTEI) > 0.5) {
                    // EWMA (指數加權移動平均)
                    this.currentTEI += alpha * (this.targetTEI - this.currentTEI);

                    // 通知 UI 更新
                    this._notifyUpdate(Math.round(this.currentTEI));

                    frame++;
                    this._animationId = requestAnimationFrame(animate);
                } else {
                    this.currentTEI = this.targetTEI;
                    this._notifyUpdate(this.targetTEI);
                    this.animating = false;
                    this._animationId = null;
                }
            };

            this._animationId = requestAnimationFrame(animate);
        }

        /**
         * 立即設定 TEI (無動畫)
         * @param {number} tei
         */
        setImmediate(tei) {
            this.cancel();
            this.currentTEI = tei;
            this.targetTEI = tei;
            this._notifyUpdate(tei);
        }

        /**
         * 取消正在進行的動畫
         */
        cancel() {
            if (this._animationId) {
                cancelAnimationFrame(this._animationId);
                this._animationId = null;
            }
            this.animating = false;
        }

        /**
         * 註冊更新回調
         * @param {Function} callback - 接收 { score, timestamp }
         * @returns {Function} 取消訂閱函數
         */
        onUpdate(callback) {
            this._callbacks.push(callback);
            return () => {
                this._callbacks = this._callbacks.filter(cb => cb !== callback);
            };
        }

        /** @private */
        _notifyUpdate(tei) {
            const payload = {
                score: tei,
                confidence: this.currentConfidence,
                timestamp: Date.now()
            };

            // 通知本地回調
            this._callbacks.forEach(cb => {
                try { cb(payload); } catch (e) { console.error('[SmoothTEI] Callback error:', e); }
            });

            // 通知 EventBridge (如果存在)
            if (global.EventBridge && typeof global.EventBridge.notifyTEIUpdate === 'function') {
                global.EventBridge.notifyTEIUpdate(tei, 'smooth-transition');
            }
        }

        /**
         * 取得目前狀態
         */
        getState() {
            return {
                currentTEI: Math.round(this.currentTEI),
                targetTEI: this.targetTEI,
                confidence: this.currentConfidence,
                animating: this.animating
            };
        }

        /**
         * 重置
         */
        reset() {
            this.cancel();
            this.currentTEI = 0;
            this.targetTEI = 0;
            this.currentConfidence = 0;
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { SmoothTEITransition };
    }

    global.TENKI_SMOOTH_TRANSITION = {
        create: () => new SmoothTEITransition(),
        SmoothTEITransition
    };

    console.log('[SMOOTH-TRANSITION] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
