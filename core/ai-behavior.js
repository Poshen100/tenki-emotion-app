/**
 * TENKI PRO - AI Behavior Intelligence v1.0
 * 
 * AI 行為智慧層 - 分析交易行為模式
 * 
 * 核心原則: 只分析，不建議！
 * - 分群: 分析你處於什麼狀態
 * - 對照: 查看你以前怎麼做
 * - 呈現: 讓你看到歷史統計
 * 
 * AI 絕對禁止:
 * ❌ 不給進出場建議
 * ❌ 不預測勝負
 * ❌ 不強制阻斷交易
 * 
 * @author TENKI Team
 * @version 1.0.0
 */

const AIBehavior = (function () {
    'use strict';

    // =============================================================================
    // CONSTANTS
    // =============================================================================

    /**
     * 預設配置
     * @constant {Object}
     */
    const DEFAULTS = {
        K_CLUSTERS: 4,          // K-means 群數
        MAX_ITERATIONS: 100,    // 最大迭代次數
        CONVERGENCE_THRESHOLD: 0.001,  // 收斂閾值
        MIN_SAMPLES: 20,        // 最小樣本數
        SIMILARITY_LIMIT: 10    // 相似度匹配數量
    };

    /**
     * 特徵名稱
     * @enum {string}
     */
    const FEATURES = {
        TEI: 'tei',
        TIME_OF_DAY: 'time_of_day',
        DECISION_TIME: 'decision_time',
        TEMPLATE: 'template'
    };

    // =============================================================================
    // AI BEHAVIOR CLASS
    // =============================================================================

    /**
     * AI 行為分析引擎
     */
    class AIBehaviorEngine {
        /**
         * 建立 AI 行為分析引擎
         * 
         * @param {Object} [config={}] - 配置選項
         * @param {number} [config.k=4] - 群數
         * @param {number} [config.maxIterations=100] - 最大迭代次數
         */
        constructor(config = {}) {
            this.k = config.k || DEFAULTS.K_CLUSTERS;
            this.maxIterations = config.maxIterations || DEFAULTS.MAX_ITERATIONS;

            // 快取分群結果
            this._clusterCache = null;
            this._lastClusterTime = 0;
        }

        // =========================================================================
        // K-MEANS CLUSTERING
        // =========================================================================

        /**
         * K-means 分群演算法
         * 
         * @param {Array<Object>} records - 交易記錄
         * @param {number} [k] - 群數 (覆蓋預設值)
         * @returns {Object} 分群結果
         * 
         * @example
         * const result = ai.cluster(trades, 4);
         * console.log('群組:', result.clusters);
         */
        cluster(records, k = this.k) {
            if (!Array.isArray(records) || records.length < k) {
                return {
                    success: false,
                    error: `資料量不足以分群 (需要至少 ${k} 筆)`
                };
            }

            // 1. 提取特徵向量
            const features = records.map(r => this._extractFeatures(r));

            // 2. 隨機初始化中心點
            let centroids = this._initializeCentroids(features, k);

            // 3. 迭代直到收斂
            let iteration = 0;
            let converged = false;
            let assignments = [];

            while (!converged && iteration < this.maxIterations) {
                // 分配到最近的中心
                assignments = this._assignClusters(features, centroids);

                // 重新計算中心點
                const newCentroids = this._recalculateCentroids(features, assignments, k);

                // 檢查是否收斂
                converged = this._hasConverged(centroids, newCentroids);
                centroids = newCentroids;
                iteration++;
            }

            // 4. 整理結果
            const clusters = this._organizeClusters(records, assignments, centroids, k);

            // 快取結果
            this._clusterCache = clusters;
            this._lastClusterTime = Date.now();

            // 發送事件
            if (typeof EventBridge !== 'undefined') {
                EventBridge.emit('cluster-updated', {
                    clusters: clusters.length,
                    iterations: iteration
                });
            }

            return {
                success: true,
                clusters,
                centroids,
                iterations: iteration,
                converged
            };
        }

        /**
         * 提取特徵向量
         * 特徵: [tei, time_of_day, decision_time, template_encoded]
         * 
         * @private
         * @param {Object} record - 交易記錄
         * @returns {Array<number>} 正規化的特徵向量
         */
        _extractFeatures(record) {
            // 時間正規化 (0-1)
            const timestamp = record.timestamp ? new Date(record.timestamp) : new Date();
            const hour = timestamp.getHours() + timestamp.getMinutes() / 60;
            const normalizedHour = hour / 24;

            // 模板編碼
            const templateEncoding = {
                'CANSILM_GROWTH': 0,
                'CANSILM_HIGHRS': 0.25,
                'MANCINI_FBD': 0.5,
                'FOCUS_SESSION': 0.75,
                'RECOVERY_BREAK': 1
            };

            return [
                (record.tei || 50) / 100,                          // TEI: 0-1
                normalizedHour,                                     // 時間: 0-1
                Math.min((record.decision_time || 0) / 300, 1),    // 決策時間: 0-1 (max 5分鐘)
                templateEncoding[record.template] || 0.5            // 模板: 0-1
            ];
        }

        /**
         * 初始化中心點 (K-means++)
         * @private
         */
        _initializeCentroids(features, k) {
            const n = features.length;
            const centroids = [];
            const usedIndices = new Set();

            // 隨機選第一個中心點
            const firstIdx = Math.floor(Math.random() * n);
            centroids.push([...features[firstIdx]]);
            usedIndices.add(firstIdx);

            // 選擇剩餘的中心點
            while (centroids.length < k) {
                // 計算每個點到最近中心點的距離
                const distances = features.map((f, i) => {
                    if (usedIndices.has(i)) return 0;

                    let minDist = Infinity;
                    for (const c of centroids) {
                        const dist = this._euclideanDistance(f, c);
                        minDist = Math.min(minDist, dist);
                    }
                    return minDist * minDist; // 距離平方
                });

                // 按距離加權隨機選擇
                const totalDist = distances.reduce((a, b) => a + b, 0);
                let random = Math.random() * totalDist;
                let selectedIdx = 0;

                for (let i = 0; i < n; i++) {
                    random -= distances[i];
                    if (random <= 0) {
                        selectedIdx = i;
                        break;
                    }
                }

                centroids.push([...features[selectedIdx]]);
                usedIndices.add(selectedIdx);
            }

            return centroids;
        }

        /**
         * 分配點到最近的群
         * @private
         */
        _assignClusters(features, centroids) {
            return features.map(f => {
                let minDist = Infinity;
                let cluster = 0;

                centroids.forEach((c, i) => {
                    const dist = this._euclideanDistance(f, c);
                    if (dist < minDist) {
                        minDist = dist;
                        cluster = i;
                    }
                });

                return cluster;
            });
        }

        /**
         * 重新計算中心點
         * @private
         */
        _recalculateCentroids(features, assignments, k) {
            const dims = features[0].length;
            const newCentroids = [];

            for (let c = 0; c < k; c++) {
                const clusterPoints = features.filter((_, i) => assignments[i] === c);

                if (clusterPoints.length === 0) {
                    // 如果群是空的，隨機選一個點
                    const randomIdx = Math.floor(Math.random() * features.length);
                    newCentroids.push([...features[randomIdx]]);
                } else {
                    // 計算平均值
                    const centroid = new Array(dims).fill(0);
                    for (const point of clusterPoints) {
                        for (let d = 0; d < dims; d++) {
                            centroid[d] += point[d];
                        }
                    }
                    for (let d = 0; d < dims; d++) {
                        centroid[d] /= clusterPoints.length;
                    }
                    newCentroids.push(centroid);
                }
            }

            return newCentroids;
        }

        /**
         * 檢查是否收斂
         * @private
         */
        _hasConverged(oldCentroids, newCentroids) {
            for (let i = 0; i < oldCentroids.length; i++) {
                const dist = this._euclideanDistance(oldCentroids[i], newCentroids[i]);
                if (dist > DEFAULTS.CONVERGENCE_THRESHOLD) {
                    return false;
                }
            }
            return true;
        }

        /**
         * 歐式距離
         * @private
         */
        _euclideanDistance(a, b) {
            return Math.sqrt(
                a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
            );
        }

        /**
         * 整理分群結果
         * @private
         */
        _organizeClusters(records, assignments, centroids, k) {
            const clusters = [];

            for (let c = 0; c < k; c++) {
                const clusterRecords = records.filter((_, i) => assignments[i] === c);

                if (clusterRecords.length === 0) continue;

                // 計算群統計
                const wins = clusterRecords.filter(r => r.result === 'WIN');
                const winRate = Math.round((wins.length / clusterRecords.length) * 100);

                // 反正規化中心點以便理解
                const centroid = centroids[c];
                const avgTEI = Math.round(centroid[0] * 100);
                const avgHour = Math.round(centroid[1] * 24);
                const avgDecisionTime = Math.round(centroid[2] * 300);

                // 生成中性描述
                const description = this._generateClusterDescription(avgTEI, avgHour, avgDecisionTime, winRate);

                clusters.push({
                    id: c,
                    size: clusterRecords.length,
                    centroid: {
                        tei: avgTEI,
                        hourOfDay: avgHour,
                        decisionTime: avgDecisionTime
                    },
                    winRate,
                    description,
                    records: clusterRecords.map(r => r.id)
                });
            }

            // 按大小排序
            clusters.sort((a, b) => b.size - a.size);

            return clusters;
        }

        /**
         * 生成群描述 (中性語言)
         * @private
         */
        _generateClusterDescription(tei, hour, decisionTime, winRate) {
            const teiDesc = tei < 40 ? '較低 TEI' : tei > 70 ? '較高 TEI' : '中等 TEI';
            const timeDesc = hour < 10 ? '早盤' : hour > 14 ? '尾盤' : '盤中';
            const speedDesc = decisionTime < 60 ? '快速決策' : decisionTime > 180 ? '謹慎決策' : '一般決策';

            // 中性語言，不帶建議
            return `${timeDesc} / ${teiDesc} / ${speedDesc} (勝率 ${winRate}%)`;
        }

        // =========================================================================
        // SIMILARITY MATCHING
        // =========================================================================

        /**
         * 找出與當前狀態最相似的歷史記錄
         * 
         * @param {Object} current - 當前狀態
         * @param {Array<Object>} historical - 歷史記錄
         * @param {number} [limit=10] - 返回數量限制
         * @returns {Array<Object>} 相似記錄 (含相似度分數)
         */
        findSimilar(current, historical, limit = DEFAULTS.SIMILARITY_LIMIT) {
            if (!Array.isArray(historical) || historical.length === 0) {
                return [];
            }

            const currentFeatures = this._extractFeatures(current);

            // 計算每條記錄的相似度
            const scored = historical.map(record => {
                const features = this._extractFeatures(record);
                const distance = this._euclideanDistance(currentFeatures, features);
                const similarity = 1 / (1 + distance); // 轉換為相似度 (0-1)

                return {
                    record,
                    similarity: Math.round(similarity * 100),
                    distance
                };
            });

            // 按相似度排序
            scored.sort((a, b) => b.similarity - a.similarity);

            return scored.slice(0, limit);
        }

        /**
         * 判斷當前狀態屬於哪個群
         * 
         * @param {Object} current - 當前狀態
         * @param {Object} [clusterResult] - 分群結果 (不提供則使用快取)
         * @returns {Object|null} 所屬群資訊
         */
        classifyCurrent(current, clusterResult = null) {
            const clusters = clusterResult || this._clusterCache;

            if (!clusters || !clusters.clusters) {
                return null;
            }

            const currentFeatures = this._extractFeatures(current);

            // 找最近的中心點
            let minDist = Infinity;
            let closestCluster = null;

            for (const cluster of clusters.clusters) {
                const centroidFeatures = [
                    cluster.centroid.tei / 100,
                    cluster.centroid.hourOfDay / 24,
                    cluster.centroid.decisionTime / 300,
                    0.5 // 默認模板值
                ];

                const dist = this._euclideanDistance(currentFeatures, centroidFeatures);
                if (dist < minDist) {
                    minDist = dist;
                    closestCluster = cluster;
                }
            }

            return closestCluster;
        }

        // =========================================================================
        // BEHAVIOR ANALYSIS
        // =========================================================================

        /**
         * 分析行為模式
         * 
         * @param {Array<Object>} records - 交易記錄
         * @returns {Object} 行為分析結果
         */
        analyzeBehavior(records) {
            if (!Array.isArray(records) || records.length < DEFAULTS.MIN_SAMPLES) {
                return {
                    hasData: false,
                    message: `需要至少 ${DEFAULTS.MIN_SAMPLES} 筆記錄`
                };
            }

            // 執行分群
            const clusterResult = this.cluster(records);

            if (!clusterResult.success) {
                return {
                    hasData: false,
                    message: clusterResult.error
                };
            }

            // 分析各群特徵
            const patterns = this._identifyPatterns(clusterResult.clusters);

            // 發送分析事件
            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifyBehaviorAnalyzed({
                    clusters: clusterResult.clusters.length,
                    patterns
                });
            }

            return {
                hasData: true,
                clusters: clusterResult.clusters,
                patterns,
                summary: this._generateSummary(clusterResult.clusters)
            };
        }

        /**
         * 識別行為模式
         * @private
         */
        _identifyPatterns(clusters) {
            const patterns = [];

            for (const cluster of clusters) {
                // 高勝率模式
                if (cluster.winRate >= 60 && cluster.size >= 10) {
                    patterns.push({
                        type: 'HIGH_WIN_RATE',
                        clusterDescription: cluster.description,
                        winRate: cluster.winRate,
                        size: cluster.size
                    });
                }

                // 低勝率模式
                if (cluster.winRate <= 40 && cluster.size >= 10) {
                    patterns.push({
                        type: 'LOW_WIN_RATE',
                        clusterDescription: cluster.description,
                        winRate: cluster.winRate,
                        size: cluster.size
                    });
                }
            }

            return patterns;
        }

        /**
         * 生成摘要 (中性語言)
         * @private
         */
        _generateSummary(clusters) {
            if (clusters.length === 0) {
                return '無法識別明顯的行為模式';
            }

            const summaries = [];

            // 找最大群
            const largest = clusters[0];
            summaries.push(
                `最常見的狀態: ${largest.description} (${largest.size} 筆)`
            );

            // 找最高勝率群
            const bestWinRate = [...clusters].sort((a, b) => b.winRate - a.winRate)[0];
            if (bestWinRate.winRate > 50 && bestWinRate.size >= 5) {
                summaries.push(
                    `最高勝率情境: ${bestWinRate.centroid.tei} TEI 區間 (${bestWinRate.winRate}%)`
                );
            }

            return summaries.join('\n');
        }

        // =========================================================================
        // NEUTRAL LANGUAGE GENERATION
        // =========================================================================

        /**
         * 生成中性語言描述
         * 
         * 注意: 永遠不給建議，只陳述事實
         * 
         * @param {Object} context - 上下文
         * @param {Object} context.current - 當前狀態
         * @param {Array<Object>} context.similar - 相似記錄
         * @param {Object} context.cluster - 所屬群
         * @returns {Array<string>} 中性描述列表
         */
        generateNeutralStatements(context) {
            const statements = [];

            // 相似度描述
            if (context.similar && context.similar.length > 0) {
                const avgWinRate = Math.round(
                    context.similar.filter(s => s.record.result === 'WIN').length /
                    context.similar.length * 100
                );
                statements.push(
                    `與目前相似的 ${context.similar.length} 筆記錄，勝率為 ${avgWinRate}%`
                );
            }

            // 群描述
            if (context.cluster) {
                statements.push(
                    `目前狀態屬於「${context.cluster.description}」`
                );
            }

            // 時間描述
            if (context.current) {
                const hour = new Date().getHours();
                const timeContext = hour < 10 ? '早盤時段' : hour > 14 ? '尾盤時段' : '盤中時段';
                statements.push(`現在是${timeContext}`);
            }

            return statements;
        }

        // =========================================================================
        // UTILITIES
        // =========================================================================

        /**
         * 取得快取的分群結果
         * @returns {Object|null}
         */
        getCachedClusters() {
            return this._clusterCache;
        }

        /**
         * 清除快取
         */
        clearCache() {
            this._clusterCache = null;
            this._lastClusterTime = 0;
        }
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    // 單例實例
    let instance = null;

    return {
        // Classes
        AIBehaviorEngine,

        // Constants
        DEFAULTS,
        FEATURES,

        /**
         * 取得單例實例
         * @returns {AIBehaviorEngine}
         */
        getInstance() {
            if (!instance) {
                instance = new AIBehaviorEngine();
            }
            return instance;
        },

        /**
         * 建立新實例
         * @param {Object} [config] - 配置
         * @returns {AIBehaviorEngine}
         */
        create(config = {}) {
            return new AIBehaviorEngine(config);
        }
    };

})();

// =============================================================================
// USAGE EXAMPLES
// =============================================================================
/*

// 取得實例
const ai = AIBehavior.getInstance();

// 對交易記錄進行分群
const clusterResult = ai.cluster(trades, 4);
if (clusterResult.success) {
    console.log('群數:', clusterResult.clusters.length);
    clusterResult.clusters.forEach(c => {
        console.log(`群 ${c.id}: ${c.description}`);
    });
}

// 找相似記錄
const similar = ai.findSimilar({
    tei: 57,
    template: 'MANCINI_FBD',
    decision_time: 120
}, trades, 10);

console.log('相似記錄:');
similar.forEach(s => {
    console.log(`- 相似度 ${s.similarity}%:`, s.record);
});

// 判斷當前狀態屬於哪個群
const cluster = ai.classifyCurrent({
    tei: 72,
    template: 'CANSILM_GROWTH'
});
console.log('所屬群:', cluster?.description);

// 生成中性描述
const statements = ai.generateNeutralStatements({
    current: { tei: 72 },
    similar: similar,
    cluster: cluster
});
console.log('分析結果:');
statements.forEach(s => console.log('-', s));

*/

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIBehavior;
}
