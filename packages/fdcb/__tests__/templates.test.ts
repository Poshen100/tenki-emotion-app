import {
  TEMPLATE_DEFAULTS,
  validateTemplateConfig,
  selectTemplate,
  type FBDConfig,
  type CANSLIMConfig,
  type Mode2Config,
} from '../src/templates/index';

describe('TEMPLATE_DEFAULTS', () => {
  it('has all 3 templates defined', () => {
    expect(TEMPLATE_DEFAULTS.fbd).toBeDefined();
    expect(TEMPLATE_DEFAULTS.canslim).toBeDefined();
    expect(TEMPLATE_DEFAULTS.mode2).toBeDefined();
  });

  it('FBD defaults match spec', () => {
    const fbd = TEMPLATE_DEFAULTS.fbd as FBDConfig;
    expect(fbd.durationSec).toBe(900);
    expect(fbd.lockWindowSec).toBe(180);
    expect(fbd.emotionMinScore).toBe(55);
    expect(fbd.addPositionAllowed).toBe(false);
    expect(fbd.acceptancePromptRatio).toBe(0.5);
  });

  it('CANSLIM defaults match spec', () => {
    const c = TEMPLATE_DEFAULTS.canslim as CANSLIMConfig;
    expect(c.durationSec).toBe(1800);
    expect(c.entryLockWindowSec).toBe(300);
    expect(c.stopLossRequired).toBe(true);
    expect(c.emotionMinScore).toBe(60);
    expect(c.fastCompletionThreshold).toBe(75);
  });

  it('Mode2 defaults match spec', () => {
    const m = TEMPLATE_DEFAULTS.mode2 as Mode2Config;
    expect(m.durationSec).toBe(2700);
    expect(m.maxTradesPerDay).toBe(1);
    expect(m.emotionMinScore).toBe(65);
    expect(m.violationPenaltyPoints).toBe(10);
  });
});

describe('validateTemplateConfig', () => {
  it('rejects missing templateId', () => {
    const result = validateTemplateConfig({});
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('templateId');
  });

  it('rejects invalid templateId', () => {
    const result = validateTemplateConfig({ templateId: 'unknown' as 'fbd' });
    expect(result.valid).toBe(false);
  });

  it('cannot override FBD addPositionAllowed', () => {
    const result = validateTemplateConfig({
      templateId: 'fbd',
      addPositionAllowed: true as unknown as false,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('addPositionAllowed');
  });

  it('cannot override CANSLIM stopLossRequired', () => {
    const result = validateTemplateConfig({
      templateId: 'canslim',
      stopLossRequired: false as unknown as true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('stopLossRequired');
  });

  it('cannot override Mode2 maxTradesPerDay', () => {
    const result = validateTemplateConfig({
      templateId: 'mode2',
      maxTradesPerDay: 5 as unknown as 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('maxTradesPerDay');
  });

  it('clamps FBD durationSec within bounds', () => {
    const result = validateTemplateConfig({ templateId: 'fbd', durationSec: 50 });
    expect(result.valid).toBe(true);
    expect((result.sanitized as FBDConfig).durationSec).toBe(300);
  });

  it('clamps CANSLIM emotionMinScore within bounds', () => {
    const result = validateTemplateConfig({ templateId: 'canslim', emotionMinScore: 99 });
    expect(result.valid).toBe(true);
    expect((result.sanitized as CANSLIMConfig).emotionMinScore).toBe(75);
  });

  it('valid FBD override passes', () => {
    const result = validateTemplateConfig({ templateId: 'fbd', durationSec: 600 });
    expect(result.valid).toBe(true);
    expect((result.sanitized as FBDConfig).durationSec).toBe(600);
  });
});

describe('selectTemplate', () => {
  it('choppy market → mode2 regardless of score', () => {
    expect(selectTemplate(90, 'choppy')).toBe('mode2');
    expect(selectTemplate(20, 'choppy')).toBe('mode2');
  });

  it('breakout + score >= 60 → canslim', () => {
    expect(selectTemplate(60, 'breakout')).toBe('canslim');
    expect(selectTemplate(85, 'breakout')).toBe('canslim');
  });

  it('breakout + score < 60 → fbd', () => {
    expect(selectTemplate(59, 'breakout')).toBe('fbd');
    expect(selectTemplate(30, 'breakout')).toBe('fbd');
  });

  it('trending market → fbd', () => {
    expect(selectTemplate(90, 'trending')).toBe('fbd');
    expect(selectTemplate(50, 'trending')).toBe('fbd');
  });
});
