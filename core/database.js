/**
 * TENKI PRO - Database Abstraction Layer v1.0
 * 
 * 統一資料庫介面，支援 localStorage 和 IndexedDB
 * 
 * @author TENKI Team
 * @version 1.0.0
 */

const TenkiDatabase = (function () {
    'use strict';

    // =============================================================================
    // CONSTANTS
    // =============================================================================

    const DB_NAME = 'TenkiProDB';
    const DB_VERSION = 1;

    const STORES = {
        TRADES: 'trades',
        SCANS: 'scans',
        TEMPLATES: 'templates',
        SETTINGS: 'settings'
    };

    const LS_KEYS = {
        TRADES: 'tenki_trades',
        SCANS: 'tenki_scans',
        TEMPLATES: 'tenki_templates',
        SETTINGS: 'tenki_settings'
    };

    // =============================================================================
    // UTILITIES
    // =============================================================================

    function generateId(prefix = 'db') {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // =============================================================================
    // LOCALSTORAGE ADAPTER
    // =============================================================================

    class LocalStorageAdapter {
        constructor() {
            this._cache = {};
            for (const store of Object.values(STORES)) {
                this._cache[store] = null;
            }
        }

        async init() {
            for (const [storeKey, lsKey] of Object.entries(LS_KEYS)) {
                const store = STORES[storeKey];
                this._loadStore(store, lsKey);
            }
            return Promise.resolve();
        }

        _loadStore(store, key) {
            try {
                const data = localStorage.getItem(key);
                if (store === STORES.SETTINGS) {
                    this._cache[store] = data ? JSON.parse(data) : {};
                } else {
                    this._cache[store] = data ? JSON.parse(data) : [];
                }
            } catch (error) {
                console.error(`[TenkiDB] Failed to load ${store}:`, error);
                this._cache[store] = store === STORES.SETTINGS ? {} : [];
            }
        }

        _saveStore(store) {
            const key = LS_KEYS[store.toUpperCase()] || `tenki_${store}`;
            try {
                localStorage.setItem(key, JSON.stringify(this._cache[store]));
            } catch (error) {
                console.error(`[TenkiDB] Failed to save ${store}:`, error);
                throw error;
            }
        }

        async add(store, item) {
            const newItem = { ...item };
            if (!newItem.id) {
                newItem.id = generateId(store.substr(0, 2));
            }
            if (!newItem.createdAt) {
                newItem.createdAt = new Date().toISOString();
            }
            newItem.updatedAt = new Date().toISOString();

            this._cache[store].push(newItem);
            this._saveStore(store);
            return newItem.id;
        }

        async get(store, id) {
            const item = this._cache[store].find(i => i.id === id);
            return item ? deepClone(item) : null;
        }

        async getAll(store, query = {}) {
            let items = [...this._cache[store]];

            if (query.filters) {
                for (const [key, value] of Object.entries(query.filters)) {
                    if (Array.isArray(value)) {
                        items = items.filter(i => i[key] >= value[0] && i[key] <= value[1]);
                    } else {
                        items = items.filter(i => i[key] === value);
                    }
                }
            }

            if (query.sortBy) {
                const sortMult = query.sortDesc ? -1 : 1;
                items.sort((a, b) => {
                    if (a[query.sortBy] < b[query.sortBy]) return -1 * sortMult;
                    if (a[query.sortBy] > b[query.sortBy]) return 1 * sortMult;
                    return 0;
                });
            }

            if (query.limit) {
                items = items.slice(0, query.limit);
            }

            return items.map(deepClone);
        }

        async update(store, id, updates) {
            const index = this._cache[store].findIndex(i => i.id === id);
            if (index === -1) return false;

            this._cache[store][index] = {
                ...this._cache[store][index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this._saveStore(store);
            return true;
        }

        async delete(store, id) {
            const index = this._cache[store].findIndex(i => i.id === id);
            if (index === -1) return false;

            this._cache[store].splice(index, 1);
            this._saveStore(store);
            return true;
        }

        async count(store, query = {}) {
            const items = await this.getAll(store, { filters: query.filters });
            return items.length;
        }

        async clear(store) {
            this._cache[store] = store === STORES.SETTINGS ? {} : [];
            this._saveStore(store);
        }

        async getSetting(key, defaultValue = null) {
            return this._cache[STORES.SETTINGS][key] ?? defaultValue;
        }

        async setSetting(key, value) {
            this._cache[STORES.SETTINGS][key] = value;
            this._saveStore(STORES.SETTINGS);
        }

        async getAllSettings() {
            return deepClone(this._cache[STORES.SETTINGS]);
        }

        async exportAll() {
            return {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                data: deepClone(this._cache)
            };
        }

        async importAll(data, merge = false) {
            if (!data || !data.data) {
                throw new Error('Invalid import data');
            }

            for (const [store, items] of Object.entries(data.data)) {
                if (merge && Array.isArray(items)) {
                    const existingIds = new Set(this._cache[store].map(i => i.id));
                    const newItems = items.filter(i => !existingIds.has(i.id));
                    this._cache[store].push(...newItems);
                } else {
                    this._cache[store] = items;
                }
                this._saveStore(store);
            }

            return true;
        }
    }

    // =============================================================================
    // INDEXEDDB ADAPTER
    // =============================================================================

    class IndexedDBAdapter {
        constructor() {
            this.db = null;
        }

        async init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this.db = request.result;
                    resolve();
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    for (const store of Object.values(STORES)) {
                        if (!db.objectStoreNames.contains(store)) {
                            const objectStore = db.createObjectStore(store, { keyPath: 'id' });
                            objectStore.createIndex('createdAt', 'createdAt', { unique: false });
                            objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });

                            if (store === STORES.TRADES) {
                                objectStore.createIndex('tei', 'tei', { unique: false });
                                objectStore.createIndex('template', 'template', { unique: false });
                                objectStore.createIndex('result', 'result', { unique: false });
                            }
                        }
                    }
                };
            });
        }

        async add(store, item) {
            return new Promise((resolve, reject) => {
                const newItem = { ...item };
                if (!newItem.id) {
                    newItem.id = generateId(store.substr(0, 2));
                }
                if (!newItem.createdAt) {
                    newItem.createdAt = new Date().toISOString();
                }
                newItem.updatedAt = new Date().toISOString();

                const tx = this.db.transaction(store, 'readwrite');
                const objectStore = tx.objectStore(store);
                const request = objectStore.add(newItem);

                request.onsuccess = () => resolve(newItem.id);
                request.onerror = () => reject(request.error);
            });
        }

        async get(store, id) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(store, 'readonly');
                const objectStore = tx.objectStore(store);
                const request = objectStore.get(id);

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        }

        async getAll(store, query = {}) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(store, 'readonly');
                const objectStore = tx.objectStore(store);
                const request = objectStore.getAll();

                request.onsuccess = () => {
                    let items = request.result || [];

                    if (query.filters) {
                        for (const [key, value] of Object.entries(query.filters)) {
                            if (Array.isArray(value)) {
                                items = items.filter(i => i[key] >= value[0] && i[key] <= value[1]);
                            } else {
                                items = items.filter(i => i[key] === value);
                            }
                        }
                    }

                    if (query.sortBy) {
                        const sortMult = query.sortDesc ? -1 : 1;
                        items.sort((a, b) => {
                            if (a[query.sortBy] < b[query.sortBy]) return -1 * sortMult;
                            if (a[query.sortBy] > b[query.sortBy]) return 1 * sortMult;
                            return 0;
                        });
                    }

                    if (query.limit) {
                        items = items.slice(0, query.limit);
                    }

                    resolve(items);
                };
                request.onerror = () => reject(request.error);
            });
        }

        async update(store, id, updates) {
            const existing = await this.get(store, id);
            if (!existing) return false;

            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(store, 'readwrite');
                const objectStore = tx.objectStore(store);
                const updated = {
                    ...existing,
                    ...updates,
                    updatedAt: new Date().toISOString()
                };
                const request = objectStore.put(updated);

                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        }

        async delete(store, id) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(store, 'readwrite');
                const objectStore = tx.objectStore(store);
                const request = objectStore.delete(id);

                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        }

        async count(store, query = {}) {
            const items = await this.getAll(store, { filters: query.filters });
            return items.length;
        }

        async clear(store) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(store, 'readwrite');
                const objectStore = tx.objectStore(store);
                const request = objectStore.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        async getSetting(key, defaultValue = null) {
            const settings = await this.get(STORES.SETTINGS, 'app_settings');
            return settings?.[key] ?? defaultValue;
        }

        async setSetting(key, value) {
            let settings = await this.get(STORES.SETTINGS, 'app_settings');
            if (!settings) {
                settings = { id: 'app_settings' };
            }
            settings[key] = value;
            settings.updatedAt = new Date().toISOString();

            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(STORES.SETTINGS, 'readwrite');
                const objectStore = tx.objectStore(STORES.SETTINGS);
                const request = objectStore.put(settings);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        async getAllSettings() {
            const settings = await this.get(STORES.SETTINGS, 'app_settings');
            return settings || {};
        }

        async exportAll() {
            const data = {};
            for (const store of Object.values(STORES)) {
                data[store] = await this.getAll(store);
            }
            return {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                data
            };
        }

        async importAll(data, merge = false) {
            if (!data || !data.data) {
                throw new Error('Invalid import data');
            }

            for (const [store, items] of Object.entries(data.data)) {
                if (!merge) {
                    await this.clear(store);
                }

                for (const item of items) {
                    if (merge) {
                        const existing = await this.get(store, item.id);
                        if (!existing) {
                            await this.add(store, item);
                        }
                    } else {
                        await this.add(store, item);
                    }
                }
            }

            return true;
        }
    }

    // =============================================================================
    // DATABASE FACADE
    // =============================================================================

    class DatabaseFacade {
        constructor() {
            this.adapter = null;
            this.isInitialized = false;
        }

        async init() {
            if (this.isInitialized) return;

            if (typeof indexedDB !== 'undefined') {
                try {
                    this.adapter = new IndexedDBAdapter();
                    await this.adapter.init();
                    console.log('[TenkiDB] Using IndexedDB');
                } catch (error) {
                    console.warn('[TenkiDB] IndexedDB failed, falling back to localStorage:', error);
                    this.adapter = new LocalStorageAdapter();
                    await this.adapter.init();
                }
            } else {
                this.adapter = new LocalStorageAdapter();
                await this.adapter.init();
                console.log('[TenkiDB] Using localStorage');
            }

            this.isInitialized = true;
        }

        // TRADES
        async addTrade(trade) { return this.adapter.add(STORES.TRADES, trade); }
        async getTrade(id) { return this.adapter.get(STORES.TRADES, id); }
        async getAllTrades(query) { return this.adapter.getAll(STORES.TRADES, query); }
        async updateTrade(id, updates) { return this.adapter.update(STORES.TRADES, id, updates); }
        async deleteTrade(id) { return this.adapter.delete(STORES.TRADES, id); }
        async countTrades(query) { return this.adapter.count(STORES.TRADES, query); }
        async clearTrades() { return this.adapter.clear(STORES.TRADES); }

        // TEMPLATES
        async addTemplate(template) { return this.adapter.add(STORES.TEMPLATES, template); }
        async getTemplate(id) { return this.adapter.get(STORES.TEMPLATES, id); }
        async getAllTemplates(query) { return this.adapter.getAll(STORES.TEMPLATES, query); }
        async updateTemplate(id, updates) { return this.adapter.update(STORES.TEMPLATES, id, updates); }
        async deleteTemplate(id) { return this.adapter.delete(STORES.TEMPLATES, id); }

        // SETTINGS
        async getSetting(key, defaultValue) { return this.adapter.getSetting(key, defaultValue); }
        async setSetting(key, value) { return this.adapter.setSetting(key, value); }
        async getAllSettings() { return this.adapter.getAllSettings(); }

        // EXPORT/IMPORT
        async exportAll() { return this.adapter.exportAll(); }
        async importAll(data, merge) { return this.adapter.importAll(data, merge); }
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    let instance = null;

    return {
        STORES,

        async getInstance() {
            if (!instance) {
                instance = new DatabaseFacade();
                await instance.init();
            }
            return instance;
        },

        create() {
            return new DatabaseFacade();
        }
    };

})();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TenkiDatabase;
}
