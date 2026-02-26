/**
 * TENKI Progressive TEI Milestone Overlay
 * =====================================
 * Listens to ProgressiveTEI events and displays floating indicator
 * GLIMPSE (2s) -> PREVIEW (15s) -> DEFAULT (30s) -> SPECTRUM (60s)
 */

(function (global) {
    'use strict';

    const LABEL_MAP = {
        'quick': 'GLIMPSE',
        'standard': 'PREVIEW',
        'precise': 'DEFAULT',
        'ultra': 'SPECTRUM'
    };

    const MilestoneOverlay = {
        _el: null,
        _textEl: null,
        _hideTimeout: null,

        init() {
            // Create DOM if not exists
            this._el = document.getElementById('milestone-overlay');
            if (!this._el) {
                this._el = document.createElement('div');
                this._el.id = 'milestone-overlay';
                this._el.className = 'milestone-overlay';

                this._el.innerHTML = `
                    <div class="milestone-dot"></div>
                    <div class="milestone-text" id="milestone-text">SCANNING</div>
                `;
                document.body.appendChild(this._el);
            }
            this._textEl = document.getElementById('milestone-text');

            // Listen to Events
            if (global.EventBridgeV2) {
                global.EventBridgeV2.addEventListener('tenki:tei-progressive', (e) => this.onProgress(e));
                global.EventBridgeV2.addEventListener('tenki:tei-scan-started', () => this.onScanStart());
                global.EventBridgeV2.addEventListener('tenki:tei-scan-stopped', () => this.hide());
            } else {
                document.addEventListener('tenki:tei-progressive', (e) => this.onProgress(e));
                document.addEventListener('tenki:tei-scan-started', () => this.onScanStart());
                document.addEventListener('tenki:tei-scan-stopped', () => this.hide());
            }
        },

        onScanStart() {
            // Reset state
            this._el.className = 'milestone-overlay show';
            this._textEl.textContent = 'ANALYZING';
            clearTimeout(this._hideTimeout);
        },

        onProgress(e) {
            const data = e.detail || e;
            if (!data.level) return;

            const label = LABEL_MAP[data.level] || data.level;

            this._el.className = `milestone-overlay show level-${data.level}`;
            this._textEl.textContent = label;

            // Optional pop effect
            this._el.style.transform = 'translateX(-50%) translateY(5px) scale(1.05)';
            setTimeout(() => {
                if (this._el) this._el.style.transform = '';
            }, 150);

            if (data._meta && data._meta.is_final) {
                this.scheduleHide();
            }
        },

        scheduleHide() {
            clearTimeout(this._hideTimeout);
            this._hideTimeout = setTimeout(() => {
                this.hide();
            }, 3000);
        },

        hide() {
            if (this._el) {
                this._el.classList.remove('show');
            }
            clearTimeout(this._hideTimeout);
        }
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MilestoneOverlay.init());
    } else {
        setTimeout(() => MilestoneOverlay.init(), 100);
    }

    global.MilestoneOverlay = MilestoneOverlay;

})(typeof window !== 'undefined' ? window : globalThis);
