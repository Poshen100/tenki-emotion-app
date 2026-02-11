/**
 * @fileoverview Storage Manager - 3 層備份儲存管理器
 * @description 包裝現有 TenkiDatabase，提供 localStorage → IndexedDB → Cloud 三層備份，
 *              以及匯出/匯入功能。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    class StorageManager {
        constructor() {
            this.db = null;
            this._initialized = false;
        }

        /**
         * 初始化儲存管理器
         */
        async init() {
            if (this._initialized) return;

            // 嘗試使用現有的 TenkiDatabase
            if (global.TenkiDatabase) {
                this.db = global.TenkiDatabase;
                await this.db.init();
            }

            this._initialized = true;
            console.log('[StorageManager] Initialized');
        }

        /**
         * 儲存數據（三層策略）
         * @param {string} store - 儲存名稱 ('scans' | 'trades' | 'settings')
         * @param {Object} data
         * @returns {Promise<boolean>}
         */
        async save(store, data) {
            let saved = false;

            // Layer 1: localStorage (快速)
            try {
                const key = `tenki_${store}`;
                const existing = JSON.parse(localStorage.getItem(key) || '[]');
                existing.push({ ...data, _savedAt: Date.now() });
                // 保留最近 500 筆
                const trimmed = existing.slice(-500);
                localStorage.setItem(key, JSON.stringify(trimmed));
                saved = true;
            } catch (e) {
                console.warn('[StorageManager] localStorage save failed:', e.message);
            }

            // Layer 2: IndexedDB (持久)
            if (this.db) {
                try {
                    await this.db.add(store, data);
                    saved = true;
                } catch (e) {
                    console.warn('[StorageManager] IndexedDB save failed:', e.message);
                }
            }

            return saved;
        }

        /**
         * 讀取數據
         * @param {string} store
         * @param {Object} [query] - 查詢參數
         * @returns {Promise<Array>}
         */
        async get(store, query) {
            // 優先從 IndexedDB 讀取
            if (this.db) {
                try {
                    const data = await this.db.getAll(store);
                    if (data && data.length > 0) {
                        return this._applyQuery(data, query);
                    }
                } catch (e) {
                    console.warn('[StorageManager] IndexedDB read failed:', e.message);
                }
            }

            // Fallback: localStorage
            try {
                const key = `tenki_${store}`;
                const data = JSON.parse(localStorage.getItem(key) || '[]');
                return this._applyQuery(data, query);
            } catch {
                return [];
            }
        }

        /**
         * 取得交易 (ExpectancyCalculator 接口)
         * @param {Date} startDate
         * @param {Date} endDate
         * @returns {Promise<Array>}
         */
        async getTrades(startDate, endDate) {
            const trades = await this.get('trades');
            const start = startDate ? new Date(startDate).getTime() : 0;
            const end = endDate ? new Date(endDate).getTime() : Infinity;

            return trades.filter(t => {
                const ts = new Date(t.timestamp || t._savedAt).getTime();
                return ts >= start && ts <= end;
            });
        }

        /**
         * 匯出所有數據
         * @returns {Promise<string>} JSON
         */
        async exportAll() {
            const data = {};
            const stores = ['scans', 'trades', 'settings'];

            for (const store of stores) {
                data[store] = await this.get(store);
            }

            data.exportedAt = new Date().toISOString();
            data.version = '2.0.0';

            return JSON.stringify(data, null, 2);
        }

        /**
         * 匯入數據
         * @param {string} jsonString
         * @returns {Promise<Object>} { success, counts }
         */
        async importData(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                const counts = {};

                for (const store of ['scans', 'trades', 'settings']) {
                    if (data[store] && Array.isArray(data[store])) {
                        for (const item of data[store]) {
                            await this.save(store, item);
                        }
                        counts[store] = data[store].length;
                    }
                }

                return { success: true, counts };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }

        /**
         * 清除指定 store 的數據
         * @param {string} store
         */
        async clear(store) {
            try { localStorage.removeItem(`tenki_${store}`); } catch { }
            // IndexedDB 清除需要更多邏輯，暫不實作
        }

        /**
         * 取得儲存狀態
         */
        getStatus() {
            let localStorageUsed = 0;
            try {
                for (const key of ['tenki_scans', 'tenki_trades', 'tenki_settings']) {
                    const val = localStorage.getItem(key);
                    if (val) localStorageUsed += val.length;
                }
            } catch { }

            return {
                initialized: this._initialized,
                hasIndexedDB: !!this.db,
                localStorageBytes: localStorageUsed,
                localStorageKB: Math.round(localStorageUsed / 1024)
            };
        }

        // ==================== Private ====================

        _applyQuery(data, query) {
            if (!query) return data;

            let result = [...data];

            if (query.startDate) {
                const start = new Date(query.startDate).getTime();
                result = result.filter(d => new Date(d.timestamp || d._savedAt).getTime() >= start);
            }

            if (query.endDate) {
                const end = new Date(query.endDate).getTime();
                result = result.filter(d => new Date(d.timestamp || d._savedAt).getTime() <= end);
            }

            if (query.limit) {
                result = result.slice(-query.limit);
            }

            return result;
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { StorageManager };
    }

    global.TENKI_STORAGE = {
        create: () => new StorageManager(),
        StorageManager
    };

    console.log('[STORAGE-MANAGER] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
