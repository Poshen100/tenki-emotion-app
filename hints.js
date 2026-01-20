// hints.js - Physiological Risk Hint Dictionary v2
// Coach-style prompts: short, actionable, bilingual (中英混合 like Apple)
// Never directly modifies TEI - only affects Confidence & prompt text

(function () {
    // Coach-style prompt dictionary
    // Each hint has: mainPrompt (action), subReason (gray), category, phase
    const COACH_PROMPTS = {
        // === Guidance (sweet spot) ===
        follow_stardust: {
            id: 'follow_stardust',
            mainPrompt: "Follow the stardust. 跟隨星塵",
            subReason: "Find the sweet spot. 找到最佳位置",
            mainPromptShort: "Follow stardust · 跟隨星塵",
            check: (m) => m.gazeStability < 0.7 && m.gazeStability > 0.3 && m.quality > 0.3 && !m.blinkRateAbnormal,
            priority: 0,  // Highest priority for guidance
            category: 'guidance',
            phase: 1
        },

        // === Quality/Stability (2s phase) ===
        motion_artifact: {
            id: 'motion_artifact',
            mainPrompt: "Hold still for 5 seconds. 保持靜止",
            subReason: "Motion detected · 偵測到移動",
            mainPromptShort: "Hold still · 保持靜止",
            check: (m) => m.headJitter > 0.5 || m.deviceMotion > 0.3,
            priority: 1,
            category: 'quality',
            phase: 1
        },
        signal_weak: {
            id: 'signal_weak',
            mainPrompt: "Move to brighter light. 移到光線充足處",
            subReason: "Signal is weak · 訊號微弱",
            mainPromptShort: "More light · 需要更多光源",
            check: (m) => m.quality < 0.5 || m.lux < 20,
            priority: 2,
            category: 'quality',
            phase: 1
        },
        focus_unstable: {
            id: 'focus_unstable',
            mainPrompt: "Face the screen. Relax your jaw. 面對螢幕，放鬆下巴",
            subReason: "Focus unstable · 視線不穩",
            mainPromptShort: "Look here · 看這裡",
            check: (m) => m.gazeStability < 0.5 || m.blinkRateAbnormal,
            priority: 3,
            category: 'quality',
            phase: 1
        },

        // === Breathing (15s phase) ===
        breathing_fast: {
            id: 'breathing_fast',
            mainPrompt: "Slow your breathing. 放慢呼吸",
            subReason: "Breathing is fast · 呼吸較快",
            mainPromptShort: "Breathe slower · 放慢呼吸",
            check: (m) => m.rr > 18,
            priority: 4,
            category: 'breathing',
            phase: 2
        },
        breathing_guide: {
            id: 'breathing_guide',
            mainPrompt: "Inhale 4, exhale 6 — repeat. 吸4秒，呼6秒",
            subReason: "Aim for slower exhale · 呼氣放更慢",
            mainPromptShort: "4-6 breathing · 4-6呼吸法",
            check: (m) => m.rr > 16 && m.rr <= 18 && m.rmssd !== null && m.rmssd < 40,
            priority: 5,
            category: 'breathing',
            phase: 2
        },

        // === Precision (30-60s phase) ===
        need_more_data: {
            id: 'need_more_data',
            mainPrompt: "Keep going — accuracy improves at 30s. 繼續，30秒後更準確",
            subReason: "HRV needs more clean beats · HRV需要更多乾淨心跳",
            mainPromptShort: "Keep scanning · 繼續掃描",
            check: (m) => m.nIbiUsable !== undefined && m.nIbiUsable < 20 && m.nIbiUsable > 5,
            priority: 6,
            category: 'precision',
            phase: 3
        },
        try_6bpm: {
            id: 'try_6bpm',
            mainPrompt: "Try 6 breaths/min for 60s. 嘗試每分鐘6次呼吸",
            subReason: "This can raise HRV · 這能提升HRV",
            mainPromptShort: "6 breaths/min · 6次/分鐘",
            check: (m) => m.rmssd !== null && m.rmssd < 30 && m.rmssd > 10,
            priority: 7,
            category: 'precision',
            phase: 3
        },
        restart_suggested: {
            id: 'restart_suggested',
            mainPrompt: "Restart when you're steady. 穩定後重新開始",
            subReason: "Too much motion to trust HRV · 動作過多，HRV不可靠",
            mainPromptShort: "Try again · 請重試",
            check: (m) => m.headJitter > 0.7 && m.quality < 0.4,
            priority: 8,
            category: 'quality',
            phase: 3
        },

        // === Physiological status (informational, any phase) ===
        tension_detected: {
            id: 'tension_detected',
            mainPrompt: "Tension detected. Take a moment. 偵測到緊繃，休息一下",
            subReason: "HR elevated, HRV declining · 心率升高，HRV下降",
            mainPromptShort: "Tension · 緊繃",
            check: (m) => m.hr > 80 && m.rmssd !== null && m.rmssd < 35,
            priority: 9,
            category: 'physiological',
            phase: 2
        },
        recovery_low: {
            id: 'recovery_low',
            mainPrompt: "Recovery seems low. Consider rest. 恢復力偏低，考慮休息",
            subReason: "HRV persistently low · HRV持續偏低",
            mainPromptShort: "Low recovery · 恢復力低",
            check: (m) => m.rmssd !== null && m.rmssd < 25 && m.rmssdStable,
            priority: 10,
            category: 'physiological',
            phase: 2
        }
    };

    class HintEngine {
        constructor() {
            // Activation timers (ms condition must hold before hint activates)
            this.activationThresholdMs = 4000;  // 4s for coach prompts
            // Deactivation timers (ms condition must clear before hint deactivates)
            this.deactivationThresholdMs = 6000;  // 6s hysteresis for stability

            // State for each hint
            this.hintStates = {};
            for (const key of Object.keys(COACH_PROMPTS)) {
                this.hintStates[key] = {
                    active: false,
                    intensity: 'none', // 'none', 'hint', 'alert'
                    conditionStartTime: null,
                    conditionClearTime: null,
                    durationInWindow: 0
                };
            }

            // History for trend calculation
            this.conditionHistory = [];
            this.maxHistoryMs = 60000;

            // Current active hints (sorted by priority)
            this.activeHints = [];
        }

        // Update hints based on current metrics
        update(metrics) {
            const now = performance.now();
            const conditions = {};

            // Check all hint conditions
            for (const [key, def] of Object.entries(COACH_PROMPTS)) {
                const conditionMet = def.check(metrics);
                conditions[key] = conditionMet;

                const state = this.hintStates[key];

                if (conditionMet) {
                    state.conditionClearTime = null;

                    if (!state.conditionStartTime) {
                        state.conditionStartTime = now;
                    }

                    const duration = now - state.conditionStartTime;

                    // Activate after threshold
                    if (duration >= this.activationThresholdMs && !state.active) {
                        state.active = true;
                        state.intensity = 'hint';
                    }

                    // Upgrade to alert after longer duration (12s)
                    if (duration >= this.activationThresholdMs * 3 && state.intensity === 'hint') {
                        state.intensity = 'alert';
                    }
                } else {
                    state.conditionStartTime = null;

                    if (state.active) {
                        if (!state.conditionClearTime) {
                            state.conditionClearTime = now;
                        }

                        const clearDuration = now - state.conditionClearTime;

                        // Deactivate after hysteresis threshold
                        if (clearDuration >= this.deactivationThresholdMs) {
                            state.active = false;
                            state.intensity = 'none';
                            state.conditionClearTime = null;
                        }
                    }
                }
            }

            // Store condition history for trend calculation
            this.conditionHistory.push({ t: now, conditions });
            this.trimHistory(now);

            // Update active hints list (sorted by priority, quality first)
            this.activeHints = Object.entries(this.hintStates)
                .filter(([_, state]) => state.active)
                .map(([key, state]) => ({
                    ...COACH_PROMPTS[key],
                    intensity: state.intensity
                }))
                .sort((a, b) => {
                    // Quality hints always first
                    if (a.category === 'quality' && b.category !== 'quality') return -1;
                    if (b.category === 'quality' && a.category !== 'quality') return 1;
                    return a.priority - b.priority;
                });

            this.updateWindowDurations(now);
        }

        trimHistory(now) {
            const cutoff = now - this.maxHistoryMs;
            while (this.conditionHistory.length > 0 && this.conditionHistory[0].t < cutoff) {
                this.conditionHistory.shift();
            }
        }

        updateWindowDurations(now) {
            const windowMs = 30000;
            const cutoff = now - windowMs;
            const windowHistory = this.conditionHistory.filter(h => h.t >= cutoff);

            if (windowHistory.length < 2) return;

            for (const key of Object.keys(COACH_PROMPTS)) {
                let trueDuration = 0;

                for (let i = 1; i < windowHistory.length; i++) {
                    if (windowHistory[i - 1].conditions[key]) {
                        trueDuration += windowHistory[i].t - windowHistory[i - 1].t;
                    }
                }

                const totalDuration = windowHistory[windowHistory.length - 1].t - windowHistory[0].t;
                this.hintStates[key].durationInWindow = totalDuration > 0
                    ? trueDuration / totalDuration
                    : 0;
            }
        }

        // Get coach prompt based on current phase
        // Returns: { mainPrompt, subReason, intensity } or null
        getCoachPrompt(phase) {
            // Filter hints by phase and priority
            // Rule: Quality hints always show first, then guidance
            const qualityHints = this.activeHints.filter(h => h.category === 'quality');
            const guidanceHints = this.activeHints.filter(h => h.category === 'guidance');

            if (qualityHints.length > 0) {
                // Always prioritize quality hints
                const hint = qualityHints[0];
                return {
                    mainPrompt: hint.mainPrompt,
                    subReason: hint.subReason,
                    intensity: this.hintStates[hint.id].intensity,
                    category: hint.category
                };
            }

            // Guidance hints (e.g. "Follow the stardust") can show at phase 1
            if (guidanceHints.length > 0 && phase >= 1) {
                const hint = guidanceHints[0];
                return {
                    mainPrompt: hint.mainPrompt,
                    subReason: hint.subReason,
                    intensity: this.hintStates[hint.id].intensity,
                    category: hint.category
                };
            }

            // Phase-appropriate hints
            let eligibleHints = [];

            if (phase === 1) {
                // 2s: Only guidance hints (handled above)
                return null;
            } else if (phase === 2) {
                // 15s: Breathing hints allowed
                eligibleHints = this.activeHints.filter(h =>
                    h.category === 'breathing' || h.category === 'physiological'
                );
            } else if (phase >= 3) {
                // 30-60s: Precision hints + all others
                eligibleHints = this.activeHints.filter(h => h.phase <= phase);
            }

            if (eligibleHints.length === 0) return null;

            const hint = eligibleHints[0];
            return {
                mainPrompt: hint.mainPrompt,
                subReason: hint.subReason,
                intensity: this.hintStates[hint.id].intensity,
                category: hint.category
            };
        }

        // Get output based on current phase (legacy compatibility)
        getPhaseOutput(phase) {
            const prompt = this.getCoachPrompt(phase);

            return {
                hints: this.activeHints.filter(h => h.phase <= phase).slice(0, 1),
                showTEI: phase >= 2,
                showSnapshot: phase >= 3,
                message: prompt ? prompt.mainPrompt : null,
                subReason: prompt ? prompt.subReason : null,
                intensity: prompt ? prompt.intensity : 'none'
            };
        }

        // Get the primary hint for display
        getPrimaryHint() {
            if (this.activeHints.length === 0) return null;
            return this.activeHints[0];
        }

        // Get formatted hint string for UI (short version)
        getHintString() {
            if (this.activeHints.length === 0) return '';
            return this.activeHints[0].mainPromptShort;
        }

        // Get hint intensity for styling
        getHintIntensity() {
            if (this.activeHints.length === 0) return 'none';
            return this.hintStates[this.activeHints[0].id].intensity;
        }

        // Should confidence be reduced due to hints?
        shouldReduceConfidence() {
            return this.activeHints.some(h => h.category === 'quality');
        }

        // Get confidence modifier based on active hints
        getConfidenceModifier() {
            let modifier = 1.0;

            for (const hint of this.activeHints) {
                const state = this.hintStates[hint.id];

                if (hint.category === 'quality') {
                    modifier *= state.intensity === 'alert' ? 0.6 : 0.8;
                }
                // Other categories don't reduce confidence (informational only)
            }

            return Math.max(0.5, modifier);
        }

        // Check if any hint requires GATE HOLD
        requiresGateHold() {
            return this.activeHints.some(h =>
                h.category === 'quality' &&
                this.hintStates[h.id].intensity === 'alert'
            );
        }

        // Get all hints with their current state
        getAllHintStates() {
            return Object.entries(this.hintStates).map(([key, state]) => ({
                id: key,
                label: COACH_PROMPTS[key].mainPromptShort,
                active: state.active,
                intensity: state.intensity,
                durationRatio: Math.round(state.durationInWindow * 100)
            }));
        }

        reset() {
            for (const key of Object.keys(COACH_PROMPTS)) {
                this.hintStates[key] = {
                    active: false,
                    intensity: 'none',
                    conditionStartTime: null,
                    conditionClearTime: null,
                    durationInWindow: 0
                };
            }
            this.conditionHistory = [];
            this.activeHints = [];
        }
    }

    window.TENKI_HINTS = {
        create() { return new HintEngine(); },
        PROMPTS: COACH_PROMPTS
    };
})();
