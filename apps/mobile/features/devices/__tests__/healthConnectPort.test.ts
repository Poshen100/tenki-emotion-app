import {
  HEALTH_CONNECT_READ_TYPES,
  buildReadPermissions,
  resolveGrantedScopes,
  toLinkOutcome,
} from '../adapters/healthConnectPort';

describe('HEALTH_CONNECT_READ_TYPES', () => {
  it('asks for HRV as RMSSD — Health Connect has no SDNN type', () => {
    expect(HEALTH_CONNECT_READ_TYPES.context).toContain('HeartRateVariabilityRmssd');
    expect(HEALTH_CONNECT_READ_TYPES.context).not.toContain('HeartRateVariabilitySdnn');
  });

  it('keeps the scan bucket minimal — the scan window needs heart rate, not a life history', () => {
    expect(HEALTH_CONNECT_READ_TYPES.scan).toEqual(['HeartRate']);
  });

  it('routes long history through its own Health Connect permission', () => {
    expect(HEALTH_CONNECT_READ_TYPES.history).toEqual(['ReadHealthDataHistory']);
  });
});

describe('buildReadPermissions', () => {
  it('only ever asks for read access', () => {
    const permissions = buildReadPermissions(['scan', 'context']);
    expect(permissions.every((p) => p.accessType === 'read')).toBe(true);
  });

  it('asks for exactly the record types behind the requested scopes', () => {
    expect(buildReadPermissions(['scan'])).toEqual([
      { accessType: 'read', recordType: 'HeartRate' },
    ]);
    expect(buildReadPermissions(['scan', 'context'])).toHaveLength(
      HEALTH_CONNECT_READ_TYPES.scan.length + HEALTH_CONNECT_READ_TYPES.context.length,
    );
  });
});

describe('resolveGrantedScopes', () => {
  const read = (recordType: string) => ({ accessType: 'read' as const, recordType });

  it('counts a scope as granted only when every record type behind it came back', () => {
    const partialContext = HEALTH_CONNECT_READ_TYPES.context.slice(0, 2).map(read);
    expect(resolveGrantedScopes(['context'], partialContext)).toEqual([]);

    const fullContext = HEALTH_CONNECT_READ_TYPES.context.map(read);
    expect(resolveGrantedScopes(['context'], fullContext)).toEqual(['context']);
  });

  it('keeps the scopes that are fully covered when others are not', () => {
    const granted = [read('HeartRate')];
    expect(resolveGrantedScopes(['scan', 'context'], granted)).toEqual(['scan']);
  });

  it('ignores write grants — TENKI never writes to the hub', () => {
    const granted = [{ accessType: 'write' as const, recordType: 'HeartRate' }];
    expect(resolveGrantedScopes(['scan'], granted)).toEqual([]);
  });

  it('returns nothing when the user granted nothing', () => {
    expect(resolveGrantedScopes(['scan', 'context', 'history'], [])).toEqual([]);
  });
});

describe('toLinkOutcome', () => {
  it('reports a full grant', () => {
    expect(toLinkOutcome(['scan'], ['scan'])).toEqual({ kind: 'granted', scopes: ['scan'] });
  });

  it('reports a partial grant as a connection, with only what was given', () => {
    expect(toLinkOutcome(['scan', 'context'], ['scan'])).toEqual({
      kind: 'partial',
      scopes: ['scan'],
    });
  });

  it('reports an empty grant as a denial, not an error', () => {
    expect(toLinkOutcome(['scan', 'context'], [])).toEqual({ kind: 'denied' });
  });
});
