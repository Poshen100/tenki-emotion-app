/**
 * @module feature-flags/flags.test
 * @description Unit tests for the Feature Flag system.
 */

import {
  FEATURE_FLAGS,
  createDefaultFlags,
  isFeatureEnabled,
  applyRemoteOverrides,
} from '../flags';

describe('createDefaultFlags', () => {
  it('should create flags with all defined defaults', () => {
    const flags = createDefaultFlags();
    expect(flags.edge_score_v3).toBe(true);
    expect(flags.session_governance_v3).toBe(true);
    expect(flags.scan_pipeline_v1).toBe(false);
    expect(flags.lab_prediction).toBe(false);
    expect(flags.benchmark_opt_in).toBe(false);
    expect(flags.reviewer_demo_mode).toBe(false);
  });

  it('should include all 6 flag IDs', () => {
    const flags = createDefaultFlags();
    expect(Object.keys(flags).length).toBe(6);
  });
});

describe('isFeatureEnabled', () => {
  it('should return true for enabled flags', () => {
    const flags = createDefaultFlags();
    expect(isFeatureEnabled(flags, 'edge_score_v3')).toBe(true);
  });

  it('should return false for disabled flags', () => {
    const flags = createDefaultFlags();
    expect(isFeatureEnabled(flags, 'scan_pipeline_v1')).toBe(false);
  });
});

describe('applyRemoteOverrides', () => {
  it('should override remote-configurable flags', () => {
    const flags = createDefaultFlags();
    const updated = applyRemoteOverrides(flags, { scan_pipeline_v1: true });
    expect(updated.scan_pipeline_v1).toBe(true);
  });

  it('should NOT override non-remote-configurable flags', () => {
    const flags = createDefaultFlags();
    const updated = applyRemoteOverrides(flags, {
      edge_score_v3: false, // NOT remoteConfigurable
    } as Record<string, boolean>);
    expect(updated.edge_score_v3).toBe(true); // Should stay true
  });

  it('should NOT override reviewer_demo_mode via remote', () => {
    const flags = createDefaultFlags();
    const updated = applyRemoteOverrides(flags, {
      reviewer_demo_mode: true,
    } as Record<string, boolean>);
    expect(updated.reviewer_demo_mode).toBe(false); // NOT remoteConfigurable
  });

  it('should not mutate the original flags', () => {
    const flags = createDefaultFlags();
    const original = { ...flags };
    applyRemoteOverrides(flags, { scan_pipeline_v1: true });
    expect(flags).toEqual(original);
  });

  it('should handle empty overrides', () => {
    const flags = createDefaultFlags();
    const updated = applyRemoteOverrides(flags, {});
    expect(updated).toEqual(flags);
  });
});

describe('FEATURE_FLAGS definitions', () => {
  it('should have 6 flag definitions', () => {
    expect(Object.keys(FEATURE_FLAGS).length).toBe(6);
  });

  it('each flag should have required fields', () => {
    for (const [id, def] of Object.entries(FEATURE_FLAGS)) {
      expect(def.id).toBe(id);
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(typeof def.defaultValue).toBe('boolean');
      expect(typeof def.remoteConfigurable).toBe('boolean');
    }
  });

  it('core flags should not be remote-configurable', () => {
    expect(FEATURE_FLAGS.edge_score_v3.remoteConfigurable).toBe(false);
    expect(FEATURE_FLAGS.session_governance_v3.remoteConfigurable).toBe(false);
    expect(FEATURE_FLAGS.reviewer_demo_mode.remoteConfigurable).toBe(false);
  });

  it('experimental flags should be remote-configurable', () => {
    expect(FEATURE_FLAGS.scan_pipeline_v1.remoteConfigurable).toBe(true);
    expect(FEATURE_FLAGS.lab_prediction.remoteConfigurable).toBe(true);
    expect(FEATURE_FLAGS.benchmark_opt_in.remoteConfigurable).toBe(true);
  });
});
