import {
  SCENARIO_MODE_DEFAULTS,
  validateModeConfig,
  type ScenarioMode,
  type ScenarioModeConfig,
} from '../src/scenario-mode';

describe('SCENARIO_MODE_DEFAULTS', () => {
  it('has all 4 modes defined', () => {
    const modes: ScenarioMode[] = ['health', 'focus', 'performance', 'trader'];
    for (const m of modes) {
      expect(SCENARIO_MODE_DEFAULTS[m]).toBeDefined();
      expect(SCENARIO_MODE_DEFAULTS[m].mode).toBe(m);
    }
  });

  it('health mode defaults are correct', () => {
    const h = SCENARIO_MODE_DEFAULTS.health;
    expect(h.timerType).toBe('countup');
    expect(h.breathingEnabled).toBe(true);
    expect(h.disciplineTracking).toBe('none');
    expect(h.defaultDurationSec).toBe(300);
    expect(h.emotionGateEnabled).toBe(false);
    expect(h.emotionMinScore).toBeNull();
  });

  it('focus mode has pomodoro timer and emotion gate', () => {
    const f = SCENARIO_MODE_DEFAULTS.focus;
    expect(f.timerType).toBe('pomodoro');
    expect(f.emotionGateEnabled).toBe(true);
    expect(f.emotionMinScore).toBe(50);
    expect(f.defaultDurationSec).toBe(1500);
  });

  it('trader mode has high discipline and notifications', () => {
    const t = SCENARIO_MODE_DEFAULTS.trader;
    expect(t.disciplineTracking).toBe('high');
    expect(t.notificationsEnabled).toBe(true);
    expect(t.timerType).toBe('countdown');
    expect(t.emotionMinScore).toBe(55);
  });

  it('performance mode uses interval timer', () => {
    const p = SCENARIO_MODE_DEFAULTS.performance;
    expect(p.timerType).toBe('interval');
    expect(p.defaultDurationSec).toBe(600);
    expect(p.emotionGateEnabled).toBe(false);
  });
});

describe('validateModeConfig', () => {
  it('returns valid with defaults when no overrides', () => {
    const result = validateModeConfig({}, 'health');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toEqual(SCENARIO_MODE_DEFAULTS.health);
  });

  it('clamps duration below minimum', () => {
    const result = validateModeConfig({ defaultDurationSec: 10 }, 'health');
    expect(result.valid).toBe(true);
    expect(result.sanitized!.defaultDurationSec).toBe(60);
  });

  it('clamps duration above maximum', () => {
    const result = validateModeConfig({ defaultDurationSec: 99999 }, 'trader');
    expect(result.valid).toBe(true);
    expect(result.sanitized!.defaultDurationSec).toBe(7200);
  });

  it('rejects invalid timerType', () => {
    const result = validateModeConfig(
      { timerType: 'invalid' as ScenarioModeConfig['timerType'] },
      'health'
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('timerType');
  });

  it('rejects mode override mismatch', () => {
    const result = validateModeConfig({ mode: 'trader' }, 'health');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Cannot override mode');
  });

  it('clamps emotion score within bounds for trader', () => {
    const result = validateModeConfig(
      { emotionGateEnabled: true, emotionMinScore: 95 },
      'trader'
    );
    expect(result.valid).toBe(true);
    expect(result.sanitized!.emotionMinScore).toBe(90);
  });

  it('nullifies emotionMinScore when gate disabled', () => {
    const result = validateModeConfig(
      { emotionGateEnabled: false, emotionMinScore: 60 },
      'trader'
    );
    expect(result.valid).toBe(true);
    expect(result.sanitized!.emotionMinScore).toBeNull();
  });

  it('preserves valid overrides', () => {
    const result = validateModeConfig(
      { breathingEnabled: false, defaultDurationSec: 600 },
      'trader'
    );
    expect(result.valid).toBe(true);
    expect(result.sanitized!.breathingEnabled).toBe(false);
    expect(result.sanitized!.defaultDurationSec).toBe(600);
  });
});
