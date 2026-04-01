/**
 * @fileoverview TENKI PRO Overlay Controller - Overlay Mount/Unmount Manager
 * @description 管理所有覆蓋層（camera overlay, scan HUD, etc.）的掛載和卸載。
 * 
 * 設計原則：
 * 1. 不修改 index.html 或任何 LOCKED 檔案
 * 2. 所有 overlay 以 <body> 直接子元素方式掛載
 * 3. z-index 層級管理，避免與 Stardust 衝突
 * 4. 透過 EventBridge 接收命令、發送狀態
 * 
 * @version 2.0.0
 * @author TENKI PRO Team
 */

(function (global) {
    'use strict';

    // ==================== Z-INDEX 層級 ====================
    const Z_LAYERS = {
        STARDUST_BASE: 1,          // 星塵粒子 (不碰)
        STARDUST_HUD: 100,         // 星塵 HUD (不碰)
        OVERLAY_NOTIFICATION: 8000, // 通知層
        OVERLAY_SCAN_HUD: 9000,     // 掃描 HUD
        OVERLAY_CAMERA: 10000,      // 相機覆蓋層
        OVERLAY_MODAL: 11000        // 模態對話框
    };

    // ==================== OVERLAY REGISTRY ====================
    /**
     * @typedef {Object} OverlayConfig
     * @property {string} id - DOM element ID
     * @property {string} cssClass - Root CSS class for the overlay
     * @property {number} zIndex - z-index layer
     * @property {boolean} blockScroll - Whether to prevent body scroll
     * @property {boolean} blockTouch - Whether to block touch events to layers underneath
     * @property {Function|null} onMount - Callback after mount
     * @property {Function|null} onUnmount - Callback before unmount
     */

    const OVERLAY_REGISTRY = {
        camera: {
            id: 'tenki-camera-overlay',
            cssClass: 'camera-overlay',
            zIndex: Z_LAYERS.OVERLAY_CAMERA,
            blockScroll: true,
            blockTouch: true,
            onMount: null,
            onUnmount: null
        },
        scanHud: {
            id: 'tenki-scan-hud',
            cssClass: 'scan-hud',
            zIndex: Z_LAYERS.OVERLAY_SCAN_HUD,
            blockScroll: false,
            blockTouch: false,
            onMount: null,
            onUnmount: null
        },
        notification: {
            id: 'tenki-notification-overlay',
            cssClass: 'overlay-notification',
            zIndex: Z_LAYERS.OVERLAY_NOTIFICATION,
            blockScroll: false,
            blockTouch: false,
            onMount: null,
            onUnmount: null
        }
    };

    // ==================== OVERLAY CONTROLLER ====================

    class OverlayController {
        constructor() {
            /** @type {Map<string, HTMLElement>} */
            this._mounted = new Map();

            /** @type {Set<string>} */
            this._scrollLocks = new Set();

            this._originalBodyOverflow = null;
            this._initialized = false;
        }

        /**
         * 初始化 OverlayController
         * 設定 EventBridge 監聽
         */
        init() {
            if (this._initialized) return;
            this._initialized = true;
            console.log('[OverlayCtrl] Initialized — mount point: <body>');
        }

        // ==================== MOUNT / UNMOUNT ====================

        /**
         * 掛載一個 overlay 到 <body>
         * 
         * @param {string} overlayName - 在 OVERLAY_REGISTRY 中的名稱 (e.g., 'camera', 'scanHud')
         * @param {Object} [options={}] - 可選的覆蓋選項
         * @param {string} [options.innerHTML] - 直接設定 innerHTML
         * @param {Function} [options.onMount] - 掛載後的回呼
         * @param {Function} [options.onUnmount] - 卸載前的回呼
         * @returns {HTMLElement|null} 返回已掛載的 DOM 元素，或 null（如果已掛載或設定不存在）
         * 
         * @example
         * const el = OverlayController.mount('camera', {
         *   innerHTML: '<div class="camera-overlay-video">...</div>',
         *   onMount: () => console.log('Camera overlay mounted')
         * });
         */
        mount(overlayName, options = {}) {
            // 已掛載時，返回現有元素
            if (this._mounted.has(overlayName)) {
                console.warn(`[OverlayCtrl] "${overlayName}" already mounted`);
                return this._mounted.get(overlayName);
            }

            const config = OVERLAY_REGISTRY[overlayName];
            if (!config) {
                console.error(`[OverlayCtrl] Unknown overlay: "${overlayName}"`);
                return null;
            }

            // 建立容器元素
            const el = document.createElement('div');
            el.id = config.id;
            el.className = config.cssClass;
            el.style.zIndex = config.zIndex;
            el.setAttribute('data-overlay', overlayName);
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-modal', config.blockTouch ? 'true' : 'false');

            // 初始隱藏 (opacity 動畫)
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.3s ease';

            // 設定 innerHTML
            if (options.innerHTML) {
                el.innerHTML = options.innerHTML;
            }

            // 合併回呼
            const onMount = options.onMount || config.onMount;
            const onUnmount = options.onUnmount || config.onUnmount;

            // 掛載到 <body>
            document.body.appendChild(el);
            this._mounted.set(overlayName, el);

            // 阻止底層滾動
            if (config.blockScroll) {
                this._lockScroll(overlayName);
            }

            // 阻止底層觸控事件穿透
            if (config.blockTouch) {
                el.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: false });
            }

            // 下一幀啟動動畫 (fade in)
            requestAnimationFrame(() => {
                el.style.opacity = '1';
            });

            // 呼叫 onMount 回呼
            if (typeof onMount === 'function') {
                try { onMount(el); } catch (err) {
                    console.error(`[OverlayCtrl] onMount error for "${overlayName}":`, err);
                }
            }

            // 通知 EventBridge
            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifyPPGCalibration({
                    state: overlayName === 'camera' ? 'INIT' : 'DETECTING',
                    overlayMounted: overlayName
                });
            }

            console.log(`[OverlayCtrl] [OK] Mounted "${overlayName}" at z-index ${config.zIndex}`);
            return el;
        }

        /**
         * 卸載一個 overlay
         * 
         * @param {string} overlayName - overlay 名稱
         * @param {Object} [options={}] - 選項
         * @param {boolean} [options.animate=true] - 是否播放淡出動畫
         * @returns {boolean} 是否成功卸載
         */
        unmount(overlayName, options = {}) {
            const el = this._mounted.get(overlayName);
            if (!el) {
                console.warn(`[OverlayCtrl] "${overlayName}" is not mounted`);
                return false;
            }

            const config = OVERLAY_REGISTRY[overlayName];
            const animate = options.animate !== false;

            // 呼叫 onUnmount 回呼
            const onUnmount = config ? config.onUnmount : null;
            if (typeof onUnmount === 'function') {
                try { onUnmount(el); } catch (err) {
                    console.error(`[OverlayCtrl] onUnmount error for "${overlayName}":`, err);
                }
            }

            // 解除滾動鎖定
            this._unlockScroll(overlayName);

            const doRemove = () => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
                this._mounted.delete(overlayName);
                console.log(`[OverlayCtrl] [REMOVED] Unmounted "${overlayName}"`);
            };

            if (animate) {
                el.style.opacity = '0';
                el.addEventListener('transitionend', doRemove, { once: true });
                // 安全超時：如果 transitionend 未觸發
                setTimeout(doRemove, 400);
            } else {
                doRemove();
            }

            return true;
        }

        /**
         * 卸載所有已掛載的 overlay
         */
        unmountAll() {
            const names = [...this._mounted.keys()];
            for (const name of names) {
                this.unmount(name, { animate: false });
            }
        }

        // ==================== 查詢 ====================

        /**
         * 取得已掛載的 overlay 元素
         * @param {string} overlayName
         * @returns {HTMLElement|null}
         */
        getElement(overlayName) {
            return this._mounted.get(overlayName) || null;
        }

        /**
         * 檢查是否已掛載
         * @param {string} overlayName
         * @returns {boolean}
         */
        isMounted(overlayName) {
            return this._mounted.has(overlayName);
        }

        /**
         * 取得所有已掛載的 overlay 名稱
         * @returns {string[]}
         */
        getMountedOverlays() {
            return [...this._mounted.keys()];
        }

        // ==================== 滾動鎖定 ====================

        /**
         * 鎖定 body 滾動
         * @private
         */
        _lockScroll(overlayName) {
            if (this._scrollLocks.size === 0) {
                this._originalBodyOverflow = document.body.style.overflow;
                document.body.style.overflow = 'hidden';
            }
            this._scrollLocks.add(overlayName);
        }

        /**
         * 解除 body 滾動鎖定
         * @private
         */
        _unlockScroll(overlayName) {
            this._scrollLocks.delete(overlayName);
            if (this._scrollLocks.size === 0 && this._originalBodyOverflow !== null) {
                document.body.style.overflow = this._originalBodyOverflow;
                this._originalBodyOverflow = null;
            }
        }

        // ==================== 動態註冊 ====================

        /**
         * 動態註冊新的 overlay 類型
         * @param {string} name - 名稱
         * @param {OverlayConfig} config - 設定
         */
        registerOverlay(name, config) {
            if (OVERLAY_REGISTRY[name]) {
                console.warn(`[OverlayCtrl] Overlay "${name}" already registered, overwriting`);
            }
            OVERLAY_REGISTRY[name] = {
                id: config.id || `tenki-${name}-overlay`,
                cssClass: config.cssClass || `${name}-overlay`,
                zIndex: config.zIndex || Z_LAYERS.OVERLAY_NOTIFICATION,
                blockScroll: config.blockScroll || false,
                blockTouch: config.blockTouch || false,
                onMount: config.onMount || null,
                onUnmount: config.onUnmount || null
            };
            console.log(`[OverlayCtrl] Registered overlay type: "${name}"`);
        }
    }

    // ==================== SINGLETON & EXPORT ====================

    const instance = new OverlayController();

    // 自動初始化
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => instance.init());
        } else {
            instance.init();
        }
    }

    // 導出
    global.TENKI_OVERLAY = {
        mount: (name, opts) => instance.mount(name, opts),
        unmount: (name, opts) => instance.unmount(name, opts),
        unmountAll: () => instance.unmountAll(),
        getElement: (name) => instance.getElement(name),
        isMounted: (name) => instance.isMounted(name),
        getMountedOverlays: () => instance.getMountedOverlays(),
        registerOverlay: (name, config) => instance.registerOverlay(name, config),
        Z_LAYERS,
        OVERLAY_REGISTRY,
        _instance: instance
    };

    console.log('[OverlayCtrl] Module loaded ✓');

})(typeof window !== 'undefined' ? window : this);
