/**
 * @fileoverview TENKI 2.0 Bootstrap — 整合所有 v2.0 新模組
 * @description 在 DOMContentLoaded 後自動初始化 Progressive TEI、Sensor Fusion、
 *              Expectancy Calculator、Trade Logger、Storage Manager，
 *              並將它們連接到 EventBridge 和現有 app 物件。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    class Tenki2 {
        constructor() {
            this.progressiveTEI = null;
            this.smoothTransition = null;
            this.sensorFusion = null;
            this.expectancy = null;
            this.tradeLogger = null;
            this.storage = null;
            this._initialized = false;
        }

        /**
         * 初始化所有 v2.0 模組
         */
        async init() {
            if (this._initialized) return this;

            console.log('[TENKI 2.0] Bootstrapping...');

            // ── 1. Storage Manager ──
            if (global.TENKI_STORAGE) {
                this.storage = global.TENKI_STORAGE.create();
                await this.storage.init();
                console.log('[TENKI 2.0] ✓ StorageManager');
            }

            // ── 2. Progressive TEI ──
            if (global.TENKI_PROGRESSIVE_TEI) {
                this.progressiveTEI = global.TENKI_PROGRESSIVE_TEI.create({
                    baselineHR: 72  // Will be updated from real data
                });
                console.log('[TENKI 2.0] ✓ ProgressiveTEI');
            }

            // ── 3. Smooth Transition ──
            if (global.TENKI_SMOOTH_TRANSITION) {
                this.smoothTransition = global.TENKI_SMOOTH_TRANSITION.create();
                console.log('[TENKI 2.0] ✓ SmoothTransition');
            }

            // ── 4. Sensor Fusion ──
            if (global.TENKI_SENSOR_FUSION) {
                this.sensorFusion = global.TENKI_SENSOR_FUSION.create();
                console.log('[TENKI 2.0] ✓ SensorFusion');
            }

            // ── 5. Expectancy Calculator ──
            if (global.TENKI_EXPECTANCY) {
                this.expectancy = global.TENKI_EXPECTANCY.create(this.storage);
                console.log('[TENKI 2.0] ✓ ExpectancyCalculator');
            }

            // ── 6. Trade Logger ──
            if (global.TENKI_TRADE_LOGGER) {
                this.tradeLogger = global.TENKI_TRADE_LOGGER.create();
                console.log('[TENKI 2.0] ✓ TradeLogger');
            }

            // ── Wire into EventBridge ──
            this._wireEventBridge();

            // ── Wire into app object ──
            this._wireApp();

            this._initialized = true;
            console.log('[TENKI 2.0] Bootstrap complete ✓');
            return this;
        }

        /**
         * 連接 EventBridge 事件
         */
        _wireEventBridge() {
            if (!global.EventBridge) return;

            const bridge = global.EventBridge;
            const self = this;

            // Listen for TEI updates from the main engine → feed into Progressive TEI
            bridge.on('tei:updated', (data) => {
                if (self.progressiveTEI && data && data.hr) {
                    const result = self.progressiveTEI.onNewData(
                        { hr: data.hr, hrv: data.hrv || data.rmssd },
                        data.quality || 0.8
                    );

                    if (result) {
                        // Emit progressive result
                        bridge.emit('tei:progressive', {
                            score: result.score,
                            confidence: result.confidence,
                            level: result.level,
                            errorMargin: result.errorMargin,
                            range: result.range
                        });

                        // Feed into smooth transition
                        if (self.smoothTransition) {
                            self.smoothTransition.smoothUpdate(result.score, result.confidence);
                        }
                    }
                }
            });

            // Listen for trade completion → log with TEI data
            bridge.on('trade:completed', (data) => {
                if (self.tradeLogger) {
                    self.tradeLogger.logTrade({
                        symbol: data.symbol || data.template,
                        outcome: data.result,
                        pnl: data.pnl || data.r_multiple || 0,
                        notes: data.notes || ''
                    });
                }
            });

            // Listen for sensor data → feed to fusion engine
            bridge.on('sensor:rppg', (data) => {
                if (self.sensorFusion) {
                    self.sensorFusion.updateSource('rppg', {
                        hr: data.hr,
                        hrv: data.hrv
                    }, data.quality || 0.7);
                }
            });
        }

        /**
         * 將 v2.0 方法注入到現有 app 物件
         */
        _wireApp() {
            if (!global.app) return;

            const self = this;

            // Inject v2 methods into app
            global.app.getProgressiveTEI = function () {
                return self.progressiveTEI ? self.progressiveTEI.getProgress() : null;
            };

            global.app.getExpectancyReport = async function (start, end) {
                if (!self.expectancy) return null;
                return await self.expectancy.calculate(start, end);
            };

            global.app.logTrade = function (tradeData) {
                if (self.tradeLogger) {
                    self.tradeLogger.logTrade(tradeData);
                }
            };

            global.app.exportAllData = async function () {
                if (self.storage) {
                    return await self.storage.exportAll();
                }
                return '{}';
            };

            global.app.getFusedMetrics = async function () {
                if (self.sensorFusion) {
                    return await self.sensorFusion.fuse();
                }
                return null;
            };

            // Override the EXPORT DATA button handler
            const exportBtn = document.querySelector('[class*="EXPORT"]');
            if (!exportBtn) {
                // Find by text content
                document.querySelectorAll('div').forEach(el => {
                    if (el.textContent.trim() === 'EXPORT DATA ↗') {
                        el.addEventListener('click', async () => {
                            const json = await global.app.exportAllData();
                            const blob = new Blob([json], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `tenki-export-${new Date().toISOString().slice(0, 10)}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                        });
                    }
                });
            }

            // Hook into the existing updateLiveScore to feed progressive TEI
            const originalUpdateLiveScore = global.app.updateLiveScore;
            if (originalUpdateLiveScore) {
                global.app.updateLiveScore = function () {
                    // Call original
                    originalUpdateLiveScore.call(global.app);

                    // Feed data to Progressive TEI
                    const m = global.app.state.liveMetrics;
                    if (self.progressiveTEI && m.hr && m.rmssd) {
                        const quality = global.app.state.rppg
                            ? (global.app.state.rppg.metrics.quality || 0.7)
                            : 0.7;

                        self.progressiveTEI.onNewData(
                            { hr: m.hr, hrv: m.rmssd },
                            quality
                        );
                    }

                    // Feed to sensor fusion
                    if (self.sensorFusion && m.hr) {
                        self.sensorFusion.updateSource('rppg', {
                            hr: m.hr,
                            hrv: m.rmssd || 0
                        }, global.app.state.rppg
                            ? (global.app.state.rppg.metrics.quality || 0.6)
                            : 0.6);
                    }
                };
            }
        }

        /**
         * 取得系統狀態
         */
        getStatus() {
            return {
                initialized: this._initialized,
                modules: {
                    progressiveTEI: !!this.progressiveTEI,
                    smoothTransition: !!this.smoothTransition,
                    sensorFusion: !!this.sensorFusion,
                    expectancy: !!this.expectancy,
                    tradeLogger: !!this.tradeLogger,
                    storage: !!this.storage
                },
                progress: this.progressiveTEI ? this.progressiveTEI.getProgress() : null,
                storage: this.storage ? this.storage.getStatus() : null
            };
        }
    }

    // ==================== EXPORT ====================
    global.Tenki2 = Tenki2;
    global.TENKI2 = new Tenki2();

    // Auto-init after DOM is ready
    if (typeof document !== 'undefined') {
        // Use a small delay to ensure all other modules have loaded
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                global.TENKI2.init().then(() => {
                    console.log('[TENKI 2.0] Status:', global.TENKI2.getStatus());
                });
            }, 100);
        });
    }

    console.log('[TENKI-2-BOOTSTRAP] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
