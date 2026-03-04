/**
 * @fileoverview AI Behavior Intelligence - 行為模式分析
 * @description 使用 K-means 分群分析交易行為模式。核心原則：只分析，不建議。
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    class AIBehavior {
        constructor() {
            this._features = null;
        }

        /**
         * 顯示 AI 提示訊息 (Todo 5)
         * @param {string} msg - 提示訊息 
         */
        static showHint(msg) {
            const hintBox = document.getElementById('ai-hint-box');
            if (hintBox) {
                hintBox.textContent = msg;
                hintBox.style.display = 'block';
            }
            // 由於這是一個重要提示，我們也確保它在 console 顯示
            console.log('%c[AI Hint]', 'color: #00F0FF; font-weight: bold;', msg);
        }

        /**
         * K-means 分群演算法
         * @param {Array} records - 交易記錄
         * @param {number} [k=4] - 群數
         * @returns {Object} 分群結果
         */
        cluster(records, k = 4) {
            if (!records || records.length < k) {
                return { error: '資料量不足以分群', minRequired: k };
            }

            // 提取特徵向量
            this._features = records.map(r => this.extractFeatures(r));
            const features = this._features;

            // 隨機初始化中心點
            let centroids = this.randomCentroids(features, k);
            let clusters = [];
            let iteration = 0;
            const maxIterations = 100;
            let converged = false;

            while (!converged && iteration < maxIterations) {
                clusters = this.assignClusters(features, centroids);
                const newCentroids = this.recalculateCentroids(features, clusters, k);
                converged = this.hasConverged(centroids, newCentroids);
                centroids = newCentroids;
                iteration++;
            }

            // 為每個群組計算統計
            const clusterStats = this.calculateClusterStats(records, clusters, k);

            return {
                clusters,
                centroids,
                iterations: iteration,
                converged,
                clusterStats
            };
        }

        /**
         * 提取特徵向量 [tei, time_of_day, decision_time, template_encoded]
         */
        extractFeatures(record) {
            let hour = 12;
            try { hour = new Date(record.timestamp).getHours(); } catch (e) { }
            const templateEncoding = { 'CANSILM_GROWTH': 0, 'CANSILM_HIGHRS': 1, 'MANCINI_FBD': 2 };
            return [
                (record.tei || 50) / 100,
                hour / 24,
                (record.decision_time || 0) / 300,
                (templateEncoding[record.template] || 0) / 2
            ];
        }

        /**
         * 歐式距離
         */
        distance(a, b) {
            return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - (b[i] || 0), 2), 0));
        }

        /**
         * 隨機初始化中心點
         */
        randomCentroids(features, k) {
            const centroids = [];
            const used = new Set();
            const maxAttempts = features.length * 2;
            let attempts = 0;
            while (centroids.length < k && attempts < maxAttempts) {
                const idx = Math.floor(Math.random() * features.length);
                if (!used.has(idx)) {
                    centroids.push([...features[idx]]);
                    used.add(idx);
                }
                attempts++;
            }
            return centroids;
        }

        /**
         * 分配到最近的中心
         */
        assignClusters(features, centroids) {
            return features.map(f => {
                const distances = centroids.map(c => this.distance(f, c));
                return distances.indexOf(Math.min(...distances));
            });
        }

        /**
         * 重新計算中心點
         */
        recalculateCentroids(features, clusters, k) {
            const newCentroids = [];
            for (let i = 0; i < k; i++) {
                const clusterPoints = features.filter((_, idx) => clusters[idx] === i);
                if (clusterPoints.length > 0) {
                    const centroid = clusterPoints[0].map((_, dim) =>
                        clusterPoints.reduce((sum, p) => sum + p[dim], 0) / clusterPoints.length
                    );
                    newCentroids.push(centroid);
                } else {
                    // 空群組，保留隨機點
                    newCentroids.push(features[Math.floor(Math.random() * features.length)]);
                }
            }
            return newCentroids;
        }

        /**
         * 檢查是否收斂
         */
        hasConverged(oldCentroids, newCentroids, threshold = 0.001) {
            if (oldCentroids.length !== newCentroids.length) return false;
            return oldCentroids.every((old, i) => this.distance(old, newCentroids[i]) < threshold);
        }

        /**
         * 計算各群組統計
         */
        calculateClusterStats(records, clusters, k) {
            const stats = [];
            for (let i = 0; i < k; i++) {
                const clusterRecords = records.filter((_, idx) => clusters[idx] === i);
                if (clusterRecords.length === 0) continue;
                const wins = clusterRecords.filter(r => r.result === 'WIN');
                const avgTEI = Math.round(clusterRecords.reduce((s, r) => s + (r.tei || 0), 0) / clusterRecords.length);
                const avgTime = Math.round(clusterRecords.reduce((s, r) => s + (r.decision_time || 0), 0) / clusterRecords.length);
                stats.push({
                    clusterId: i,
                    count: clusterRecords.length,
                    winRate: Math.round((wins.length / clusterRecords.length) * 100),
                    avgTEI,
                    avgDecisionTime: avgTime,
                    dominantEntryType: this.findDominant(clusterRecords, 'entry_type'),
                    dominantTemplate: this.findDominant(clusterRecords, 'template')
                });
            }
            return stats;
        }

        /**
         * 找出最常見的值
         */
        findDominant(records, field) {
            const counts = {};
            records.forEach(r => { counts[r[field]] = (counts[r[field]] || 0) + 1; });
            let max = 0, dominant = null;
            for (const [key, count] of Object.entries(counts)) {
                if (count > max) { max = count; dominant = key; }
            }
            return dominant;
        }

        /**
         * 生成中性洞察 (不帶建議/預測)
         * @param {Object} current - 當前狀態
         * @param {Object} patterns - 歷史模式統計
         * @returns {Array<string>} 洞察陣列
         */
        generateInsights(current, patterns) {
            const insights = [];

            // ✅ 中性描述 (正確)
            if (patterns.timeoutRate !== undefined) {
                insights.push(`在類似情況下，你有 ${patterns.timeoutRate}% 的機率等待 ≥ 2 分鐘`);
            }
            if (patterns.avgTime !== undefined) {
                insights.push(`過去 ${patterns.sampleSize || 'N'} 次類似決策，平均耗時 ${patterns.avgTime} 秒`);
            }
            if (patterns.winRate !== undefined && patterns.teiRange) {
                insights.push(`TEI ${patterns.teiRange} 區間，你的勝率是 ${patterns.winRate}%`);
            }

            // ❌ 避免這些 (錯誤) - 這裡不實作
            // "建議你等待 2 分鐘" - 太主動
            // "你應該進場" - 違反原則
            // "這次會贏" - 預測未來

            return insights;
        }

        /**
         * 找出當前狀態最接近的群組
         * @param {Object} current - 當前狀態
         * @param {Array} centroids - 群組中心點
         * @returns {number} 群組索引
         */
        findNearestCluster(current, centroids) {
            const features = this.extractFeatures(current);
            const distances = centroids.map(c => this.distance(features, c));
            return distances.indexOf(Math.min(...distances));
        }
    }

    global.AIBehavior = AIBehavior;

})(typeof window !== 'undefined' ? window : this);
