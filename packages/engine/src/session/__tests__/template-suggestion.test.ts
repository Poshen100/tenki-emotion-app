import { suggestTemplateForStrategyHint } from '../template-suggestion';

describe('suggestTemplateForStrategyHint', () => {
  it('suggests CANSLIM for canslim hints', () => {
    expect(suggestTemplateForStrategyHint('CANSLIM')).toBe('CANSLIM');
    expect(suggestTemplateForStrategyHint('Canslim GS')).toBe('CANSLIM');
  });

  it('suggests FBD for fbd and mancini hints', () => {
    expect(suggestTemplateForStrategyHint('FBD')).toBe('FBD');
    expect(suggestTemplateForStrategyHint('Mancini FBD')).toBe('FBD');
    expect(suggestTemplateForStrategyHint('mancini')).toBe('FBD');
  });

  it('suggests MODE_2 for high-sensitivity hints', () => {
    expect(suggestTemplateForStrategyHint('High RS')).toBe('MODE_2');
    expect(suggestTemplateForStrategyHint('mode 2')).toBe('MODE_2');
    expect(suggestTemplateForStrategyHint('High-Sensitivity Control')).toBe('MODE_2');
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(suggestTemplateForStrategyHint('  cAnSlIm  ')).toBe('CANSLIM');
  });

  it('prefers the earlier mapping when multiple keywords appear', () => {
    expect(suggestTemplateForStrategyHint('canslim high rs')).toBe('CANSLIM');
  });

  it('returns null for null, empty, or unknown hints', () => {
    expect(suggestTemplateForStrategyHint(null)).toBeNull();
    expect(suggestTemplateForStrategyHint('')).toBeNull();
    expect(suggestTemplateForStrategyHint('   ')).toBeNull();
    expect(suggestTemplateForStrategyHint('momentum')).toBeNull();
  });
});
