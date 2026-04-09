import { describe, it, expect } from 'vitest';
import { evaluateReadiness } from '../baseline/readiness-rules';
import type { ReadinessCheckItem } from '../baseline/types';

const allPassChecks: ReadinessCheckItem[] = [
  { key: 'lighting', label: '光線', passed: true, severity: 'required' },
  { key: 'visibility', label: '清晰', passed: true, severity: 'required' },
  { key: 'stability', label: '穩定', passed: true, severity: 'required' },
  { key: 'environment', label: '環境', passed: true, severity: 'required' },
  { key: 'emotional_settled', label: '情緒', passed: true, severity: 'recommended' },
];

describe('evaluateReadiness', () => {
  it('all pass + permission = ready', () => {
    const r = evaluateReadiness(allPassChecks, true, true);
    expect(r.level).toBe('ready');
    expect(r.score).toBe(100);
    expect(r.blockers).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it('no permission = not_ready', () => {
    const r = evaluateReadiness(allPassChecks, false, true);
    expect(r.level).toBe('not_ready');
    expect(r.blockers).toContain('Camera permission not granted');
  });

  it('no camera initialized = not_ready', () => {
    const r = evaluateReadiness(allPassChecks, true, false);
    expect(r.level).toBe('not_ready');
    expect(r.blockers).toContain('Camera not initialized');
  });

  it('required fail = not_ready', () => {
    const checks = allPassChecks.map((c, i) => (i === 0 ? { ...c, passed: false } : c));
    const r = evaluateReadiness(checks, true, true);
    expect(r.level).toBe('not_ready');
    expect(r.blockers).toContain('光線');
  });

  it('only recommended fail = ready_with_caution', () => {
    const checks = allPassChecks.map((c, i) => (i === 4 ? { ...c, passed: false } : c));
    const r = evaluateReadiness(checks, true, true);
    expect(r.level).toBe('ready_with_caution');
    expect(r.warnings).toContain('情緒');
    expect(r.score).toBe(80);
  });

  it('multiple required fail = not_ready with multiple blockers', () => {
    const checks = allPassChecks.map((c, i) => (i < 2 ? { ...c, passed: false } : c));
    const r = evaluateReadiness(checks, true, true);
    expect(r.level).toBe('not_ready');
    expect(r.blockers.length).toBeGreaterThanOrEqual(2);
  });

  it('lastCheckedAt is set', () => {
    const r = evaluateReadiness(allPassChecks, true, true);
    expect(r.lastCheckedAt).toBeDefined();
    expect(new Date(r.lastCheckedAt!).getTime()).toBeGreaterThan(0);
  });
});
