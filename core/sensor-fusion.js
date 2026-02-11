/**
 * @fileoverview Sensor Fusion Engine - 多模態生物信號融合
 * @description 整合 rPPG、HealthKit、穿戴設備等多來源數據，
 *              使用加權融合提供最高精度的 TEI 計算。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    // 數據源權重配置
    const SOURCE_WEIGHTS = {
        'rppg': 0.60,       // 手機 rPPG
        'healthkit': 0.90,  // HealthKit (高準確度)
        'watch': 1.00,      // Apple Watch (最準確)
        'garmin': 0.80,     // Garmin
        'fitbit': 0.70,     // Fitbit
        'ble': 0.85,        // BLE 心率帶
        'finger_ppg': 0.88  // 手指 PPG
    };

    class SensorFusionEngine {
        constructor() {
            this.sources = new Map();
            this.lastFused = null;
            this._kalmanFilter = null;
        }

        /**
         * 初始化所有可用的數據源
         */
        async initializeSources() {
            // 1. rPPG (必備 - 使用現有 RPPGController)
            if (global.TENKI_RPPG) {
                this.sources.set('rppg', {
                    name: 'rPPG',
                    type: 'rppg',
                    active: true,
                    getData: () => this._getRPPGData()
                });
            }

            // 2. HealthKit (iPhone only)
            if (global.TENKI_HEALTHKIT) {
                const hk = global.TENKI_HEALTHKIT.create();
                if (await hk.isAvailable()) {
                    this.sources.set('healthkit', {
                        name: 'HealthKit',
                        type: 'healthkit',
                        active: true,
                        instance: hk,
                        getData: () => hk.getData()
                    });
                }
            }

            // 3. Watch
            if (global.TENKI_WATCH) {
                const watch = global.TENKI_WATCH.create();
                if (await watch.isConnected()) {
                    this.sources.set('watch', {
                        name: 'Apple Watch',
                        type: 'watch',
                        active: true,
                        instance: watch,
                        getData: () => watch.getData()
                    });
                }
            }

            // 4. Kalman Filter
            if (global.TENKI_KALMAN) {
                this._kalmanFilter = global.TENKI_KALMAN.create();
            }

            console.log(`[SensorFusion] Initialized ${this.sources.size} source(s)`);
        }

        /**
         * 手動註冊數據源
         * @param {string} name - 識別名稱
         * @param {Object} source - { getData: () => Promise<{hr, hrv, confidence}> }
         */
        registerSource(name, source) {
            this.sources.set(name, {
                name,
                type: name,
                active: true,
                ...source
            });
        }

        /**
         * 融合所有可用數據源
         * @returns {Promise<Object>} { hr, hrv, confidence, sources }
         */
        async fuse() {
            const data = [];

            // 收集所有源數據
            for (const [name, source] of this.sources) {
                if (!source.active) continue;

                try {
                    const sample = await source.getData();
                    if (sample && this._isValid(sample)) {
                        data.push({
                            name,
                            hr: sample.hr,
                            hrv: sample.hrv,
                            confidence: sample.confidence || 0.5,
                            weight: SOURCE_WEIGHTS[name] || 0.5,
                            timestamp: sample.timestamp || Date.now()
                        });
                    }
                } catch (error) {
                    console.warn(`[SensorFusion] Source ${name} failed:`, error.message);
                }
            }

            if (data.length === 0) {
                return {
                    hr: 0,
                    hrv: 0,
                    confidence: 0,
                    sources: [],
                    error: 'No valid data sources',
                    timestamp: Date.now()
                };
            }

            // 加權融合
            const fused = this._weightedFusion(data);

            // 如果有 Kalman Filter，套用
            if (this._kalmanFilter) {
                const filtered = this._kalmanFilter.update(
                    { hr: fused.hr, hrv: fused.hrv },
                    {
                        hr: 1 / (fused.confidence + 0.01),
                        hrv: 1 / (fused.confidence + 0.01)
                    }
                );
                fused.hr = filtered.hr;
                fused.hrv = filtered.hrv;
                fused.kalmanApplied = true;
            }

            this.lastFused = {
                hr: Math.round(fused.hr * 10) / 10,
                hrv: Math.round(fused.hrv * 10) / 10,
                confidence: Math.round(fused.confidence * 100) / 100,
                sources: data.map(d => d.name),
                sourceCount: data.length,
                timestamp: Date.now()
            };

            return this.lastFused;
        }

        /**
         * 加權融合算法
         * @private
         */
        _weightedFusion(data) {
            const totalWeight = data.reduce((sum, d) =>
                sum + d.confidence * d.weight, 0);

            if (totalWeight === 0) {
                return { hr: 0, hrv: 0, confidence: 0 };
            }

            const hr = data.reduce((sum, d) =>
                sum + d.hr * d.confidence * d.weight, 0) / totalWeight;

            const hrv = data.reduce((sum, d) =>
                sum + d.hrv * d.confidence * d.weight, 0) / totalWeight;

            // 融合後的信心度 — 多源時提升
            const avgConfidence = data.reduce((sum, d) => sum + d.confidence, 0) / data.length;
            const multiSourceBoost = Math.min(1.0, 0.8 + data.length * 0.05);
            const confidence = Math.min(1.0, avgConfidence * multiSourceBoost);

            return { hr, hrv, confidence };
        }

        /**
         * 取得 rPPG 數據（從現有系統）
         * @private
         */
        _getRPPGData() {
            if (!global.TENKI_RPPG) return null;

            // 嘗試從現有的 rPPG controller 取得數據
            const rppg = global._tenkiRPPGInstance;
            if (!rppg || !rppg.metrics) return null;

            const bpm = rppg.metrics.bpm;
            const rmssd = rppg.metrics.rmssd;
            const quality = rppg.metrics.quality || 0;

            if (!bpm || bpm <= 0) return null;

            return {
                hr: bpm,
                hrv: rmssd || 0,
                confidence: Math.min(1, quality / 100),
                timestamp: Date.now()
            };
        }

        /**
         * 數據有效性檢查
         * @private
         */
        _isValid(sample) {
            return (
                sample != null &&
                typeof sample.hr === 'number' &&
                sample.hr >= 40 && sample.hr <= 180 &&
                !isNaN(sample.hr)
            );
        }

        /**
         * 取得可用數據源列表
         */
        getAvailableSources() {
            const result = [];
            for (const [name, source] of this.sources) {
                result.push({
                    name,
                    type: source.type,
                    active: source.active,
                    weight: SOURCE_WEIGHTS[name] || 0.5
                });
            }
            return result;
        }

        /**
         * 取得最近的融合結果
         */
        getLastResult() {
            return this.lastFused;
        }

        /**
         * 重置
         */
        reset() {
            this.lastFused = null;
            if (this._kalmanFilter) {
                this._kalmanFilter = global.TENKI_KALMAN ? global.TENKI_KALMAN.create() : null;
            }
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { SensorFusionEngine, SOURCE_WEIGHTS };
    }

    global.TENKI_SENSOR_FUSION = {
        create: () => new SensorFusionEngine(),
        SensorFusionEngine,
        SOURCE_WEIGHTS
    };

    console.log('[SENSOR-FUSION] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
