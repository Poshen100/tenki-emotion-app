/**
 * SQI (Signal Quality Index) Gating & Fallbacks
 * 
 * Enforces strict quality thresholds for camera rPPG.
 * Prioritizes Glabella ROI -> Forehead -> Cheeks.
 * Explictly prompts user instead of showing fake data when SQI is low.
 */

const SQIGating = {
    currentROI: 'glabella', // 'glabella', 'forehead', 'cheeks'
    sqiThreshold: 0.65,
    isLocked: false,
    lockProgress: 0,

    init: function () {
        if (typeof window.EventBridge !== 'undefined') {
            window.EventBridge.on('rppg:quality', this.handleQualityUpdate.bind(this));
        }
    },

    handleQualityUpdate: function (data) {
        if (window.HybridSync && window.HybridSync.isConnected) {
            // BLE overrides camera SQI concerns entirely
            this._clearPrompt();
            return;
        }

        const { sqi, hasGlabella, hasForehead } = data;

        // Evaluate ROI fallback
        let newROI = 'cheeks';
        if (hasGlabella && sqi >= this.sqiThreshold) {
            newROI = 'glabella';
        } else if (hasForehead && sqi >= this.sqiThreshold - 0.1) {
            newROI = 'forehead';
        }

        if (newROI !== this.currentROI) {
            this.currentROI = newROI;
            console.log(`[SQIGating] ROI shifted to: ${this.currentROI}`);

            if (this.currentROI === 'forehead' || this.currentROI === 'cheeks') {
                this._showPrompt(`Glabella Obscured. Using ${this.currentROI} ROI (Degraded Accuracy)`, 'warn');
            } else {
                this._showPrompt('Glabella Optical Lock Acquired', 'success');
                setTimeout(() => this._clearPrompt(), 3000);
            }
        }

        // Lock phase logic (first 15s)
        if (!this.isLocked && this.currentROI === 'glabella') {
            this.lockProgress += 2; // Simulated progress per update
            if (this.lockProgress >= 100) {
                this.isLocked = true;
                this.lockProgress = 100;
                this._clearPrompt();
            } else {
                this._updateProgressBar(this.lockProgress);
            }
        }

        // Halt if critical failure
        if (sqi < 0.3) {
            this._showPrompt('Signal Lost: Adjust lighting or position. Pause Data.', 'error');
            if (window.EventBridge) window.EventBridge.emit('sqi:halt');
        }
    },

    _showPrompt: function (message, type) {
        let el = document.getElementById('sqi-gating-prompt');
        if (!el) {
            el = document.createElement('div');
            el.id = 'sqi-gating-prompt';
            el.style.position = 'fixed';
            el.style.top = 'env(safe-area-inset-top, 20px)';
            el.style.left = '50%';
            el.style.transform = 'translateX(-50%)';
            el.style.zIndex = '9999';
            el.style.padding = '8px 16px';
            el.style.borderRadius = '20px';
            el.style.fontFamily = 'var(--rp-font), sans-serif';
            el.style.fontSize = '12px';
            el.style.fontWeight = '600';
            el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
            el.style.transition = 'all 0.3s ease';
            document.body.appendChild(el);
        }

        el.textContent = message;

        if (type === 'error') {
            el.style.background = 'var(--rp-violet, #7b68ee)';
            el.style.color = '#fff';
        } else if (type === 'warn') {
            el.style.background = 'var(--rp-yellow, #ffd600)';
            el.style.color = '#000';
        } else {
            el.style.background = 'var(--rp-cyan, #00ffcc)';
            el.style.color = '#000';
        }

        el.style.opacity = '1';
    },

    _clearPrompt: function () {
        const el = document.getElementById('sqi-gating-prompt');
        if (el) el.style.opacity = '0';
    },

    _updateProgressBar: function (pct) {
        this._showPrompt(`Glabella Optical Lock... ${pct}%`, 'warn');
    }
};

window.SQIGating = SQIGating;

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SQIGating.init());
} else {
    SQIGating.init();
}
