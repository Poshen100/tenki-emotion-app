/**
 * @fileoverview Decision Timer Engine - 決策計時器狀態機
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    const TimerStates = {
        IDLE: 'IDLE', PREVIEW: 'PREVIEW', RUNNING: 'RUNNING',
        COMPLETE: 'COMPLETE', TIMEOUT: 'TIMEOUT', ABORT: 'ABORT'
    };

    const TemplateConfig = {
        CANSILM_GROWTH: {
            name: 'Cansilm 通用成長股', duration: 300,
            segments: [
                { end: 60, label: '等待方向確認' },
                { end: 240, label: '觀察量能收縮' },
                { end: 300, label: '進場窗口' }
            ],
            timeoutMessage: 'No FOMO today'
        },
        CANSILM_HIGHRS: {
            name: 'Cansilm High RS Breakout', duration: 240,
            segments: [
                { end: 60, label: '等待確認' },
                { end: 240, label: '進場窗口🚀' }
            ],
            timeoutMessage: 'Timeout = WIN ! Patient !'
        },
        MANCINI_FBD: {
            name: 'Mancini FBD', duration: 180,
            segments: [
                { end: 60, label: 'No entry' },
                { end: 140, label: 'Watch acceptance' },
                { end: 180, label: 'Setup breathing' }
            ],
            timeoutMessage: 'Boring = good'
        }
    };

    class DecisionTimer {
        constructor(options = {}) {
            this.state = TimerStates.IDLE;
            this.template = null;
            this.startTime = null;
            this.duration = 0;
            this.intervalId = null;
            this.currentTEI = null;
            this.autoSave = options.autoSave !== false;
            this._callbacks = { onStateChange: [], onProgress: [], onComplete: [], onTimeout: [], onAbort: [] };
            this._tryRestore();
        }

        _tryRestore() {
            try {
                const saved = localStorage.getItem('tenki_timer_state');
                if (saved) {
                    const data = JSON.parse(saved);
                    if (data.state === TimerStates.RUNNING && data.startTime) {
                        const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
                        if (elapsed < data.duration) {
                            Object.assign(this, data);
                            this._startInterval();
                        } else {
                            localStorage.removeItem('tenki_timer_state');
                        }
                    }
                }
            } catch (e) { console.error('[DecisionTimer] Restore error:', e); }
        }

        preview(templateName, currentTEI) {
            if (this.state !== TimerStates.IDLE) return false;
            const config = TemplateConfig[templateName];
            if (!config) return false;
            this.state = TimerStates.PREVIEW;
            this.template = templateName;
            this.currentTEI = currentTEI;
            this.duration = config.duration;
            this._emit('onStateChange');
            if (global.EventBridge) {
                global.EventBridge.notifyDecisionState('PREVIEW', { template: templateName, tei: currentTEI, duration: config.duration });
            }
            return true;
        }

        start(templateName, currentTEI) {
            if (this.state === TimerStates.PREVIEW) {
                templateName = templateName || this.template;
                currentTEI = currentTEI !== undefined ? currentTEI : this.currentTEI;
            } else if (this.state !== TimerStates.IDLE) return false;
            const config = TemplateConfig[templateName];
            if (!config) return false;
            this.template = templateName;
            this.state = TimerStates.RUNNING;
            this.startTime = Date.now();
            this.duration = config.duration;
            this.currentTEI = currentTEI;
            this._emit('onStateChange');
            this._save();
            if (global.EventBridge) {
                global.EventBridge.notifyDecisionState('RUNNING', { template: templateName, tei: currentTEI, duration: this.duration });
            }
            this._startInterval();
            return true;
        }

        _startInterval() {
            if (this.intervalId) clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this._tick(), 1000);
        }

        _tick() {
            if (this.state !== TimerStates.RUNNING) { this._stopInterval(); return; }
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const remaining = Math.max(0, this.duration - elapsed);
            const segment = this._getCurrentSegment(elapsed);
            const progressData = { elapsed, remaining, segment, percent: Math.round((elapsed / this.duration) * 100) };
            this._callbacks.onProgress.forEach(cb => cb(progressData));
            if (global.EventBridge) global.EventBridge.notifyDecisionState('PROGRESS', progressData);
            if (remaining <= 0) this._timeout();
        }

        _getCurrentSegment(elapsed) {
            const config = TemplateConfig[this.template];
            if (!config) return { label: '' };
            for (let seg of config.segments) { if (elapsed < seg.end) return seg; }
            return { label: 'Complete' };
        }

        complete() {
            if (this.state !== TimerStates.RUNNING) return null;
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const result = { template: this.template, tei: this.currentTEI, elapsed, entryType: elapsed >= this.duration ? 'TIMEOUT' : 'EARLY', timestamp: new Date().toISOString() };
            this._stopInterval();
            this.state = TimerStates.COMPLETE;
            this._emit('onStateChange');
            this._clear();
            this._callbacks.onComplete.forEach(cb => cb(result));
            if (global.EventBridge) global.EventBridge.notifyDecisionState('COMPLETE', result);
            return result;
        }

        _timeout() {
            const result = { template: this.template, tei: this.currentTEI, elapsed: this.duration, entryType: 'TIMEOUT', timestamp: new Date().toISOString() };
            this._stopInterval();
            this.state = TimerStates.TIMEOUT;
            this._emit('onStateChange');
            this._clear();
            this._callbacks.onTimeout.forEach(cb => cb(result));
            if (global.EventBridge) global.EventBridge.notifyDecisionState('TIMEOUT', result);
        }

        abort() {
            if (this.state !== TimerStates.RUNNING && this.state !== TimerStates.PREVIEW) return null;
            const elapsed = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
            const result = { template: this.template, tei: this.currentTEI, elapsed, entryType: 'ABORT', timestamp: new Date().toISOString() };
            this._stopInterval();
            this.state = TimerStates.ABORT;
            this._emit('onStateChange');
            this._clear();
            this._callbacks.onAbort.forEach(cb => cb(result));
            if (global.EventBridge) global.EventBridge.notifyDecisionState('ABORT', result);
            return result;
        }

        reset() { this._stopInterval(); this.state = TimerStates.IDLE; this.template = null; this.startTime = null; this.duration = 0; this.currentTEI = null; this._clear(); this._emit('onStateChange'); }
        _stopInterval() { if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; } }
        _emit(type) { const data = { state: this.state, template: this.template, tei: this.currentTEI, duration: this.duration }; this._callbacks[type].forEach(cb => cb(data)); }
        _save() { if (this.autoSave) try { localStorage.setItem('tenki_timer_state', JSON.stringify({ state: this.state, template: this.template, startTime: this.startTime, duration: this.duration, currentTEI: this.currentTEI })); } catch (e) { } }
        _clear() { try { localStorage.removeItem('tenki_timer_state'); } catch (e) { } }

        onStateChange(cb) { this._callbacks.onStateChange.push(cb); return () => { const i = this._callbacks.onStateChange.indexOf(cb); if (i > -1) this._callbacks.onStateChange.splice(i, 1); }; }
        onProgress(cb) { this._callbacks.onProgress.push(cb); return () => { const i = this._callbacks.onProgress.indexOf(cb); if (i > -1) this._callbacks.onProgress.splice(i, 1); }; }
        onComplete(cb) { this._callbacks.onComplete.push(cb); return () => { const i = this._callbacks.onComplete.indexOf(cb); if (i > -1) this._callbacks.onComplete.splice(i, 1); }; }
        onTimeout(cb) { this._callbacks.onTimeout.push(cb); return () => { const i = this._callbacks.onTimeout.indexOf(cb); if (i > -1) this._callbacks.onTimeout.splice(i, 1); }; }
        onAbort(cb) { this._callbacks.onAbort.push(cb); return () => { const i = this._callbacks.onAbort.indexOf(cb); if (i > -1) this._callbacks.onAbort.splice(i, 1); }; }

        getState() { return this.state; }
        getTemplate() { return this.template; }
        getTemplateConfig(name) { return TemplateConfig[name] || null; }
        static getTemplates() { return { ...TemplateConfig }; }
        isRunning() { return this.state === TimerStates.RUNNING; }
        getRemaining() { if (this.state !== TimerStates.RUNNING || !this.startTime) return 0; return Math.max(0, this.duration - Math.floor((Date.now() - this.startTime) / 1000)); }
    }

    DecisionTimer.States = TimerStates;
    DecisionTimer.Templates = TemplateConfig;
    global.DecisionTimer = DecisionTimer;

})(typeof window !== 'undefined' ? window : this);
