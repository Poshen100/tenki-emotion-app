import { describe, it, expect } from 'vitest';
import { canTransitionTo } from '../baseline/flow';

describe('canTransitionTo', () => {
  it('intro -> sensor_choice is valid', () => {
    expect(canTransitionTo('intro', 'sensor_choice')).toBe(true);
  });

  it('intro -> guided_scan is invalid', () => {
    expect(canTransitionTo('intro', 'guided_scan')).toBe(false);
  });

  it('readiness_check -> guided_scan blocked when not_ready', () => {
    expect(canTransitionTo('readiness_check', 'guided_scan', { readinessLevel: 'not_ready' })).toBe(false);
  });

  it('readiness_check -> guided_scan allowed when ready', () => {
    expect(canTransitionTo('readiness_check', 'guided_scan', { readinessLevel: 'ready' })).toBe(true);
  });

  it('any step -> retry_help is always valid', () => {
    const steps = ['intro', 'sensor_choice', 'readiness_check', 'guided_scan', 'analyzing', 'result'] as const;
    steps.forEach(s => expect(canTransitionTo(s, 'retry_help')).toBe(true));
  });

  it('sensor_choice -> readiness_check is valid', () => {
    expect(canTransitionTo('sensor_choice', 'readiness_check')).toBe(true);
  });

  it('sensor_choice -> intro (back) is valid', () => {
    expect(canTransitionTo('sensor_choice', 'intro')).toBe(true);
  });

  it('guided_scan -> analyzing is valid', () => {
    expect(canTransitionTo('guided_scan', 'analyzing')).toBe(true);
  });

  it('analyzing -> result is valid', () => {
    expect(canTransitionTo('analyzing', 'result')).toBe(true);
  });

  it('result -> intro is invalid (no skipping back)', () => {
    expect(canTransitionTo('result', 'intro')).toBe(false);
  });

  it('retry_help -> readiness_check is valid', () => {
    expect(canTransitionTo('retry_help', 'readiness_check')).toBe(true);
  });

  it('retry_help -> sensor_choice is valid', () => {
    expect(canTransitionTo('retry_help', 'sensor_choice')).toBe(true);
  });
});
