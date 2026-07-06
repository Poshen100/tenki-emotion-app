/**
 * Sync lock between the mobile theme's zone mirror and the canonical
 * @tenki/shared zone-config. The mirror exists because mobile does not
 * import packages at runtime (PLAYBOOK §7); this test is the tripwire
 * that keeps the two from drifting.
 */
import { ZONE_CONFIG, getZoneByScore } from '../../../../packages/shared/src/zone-config';
import { getZoneForScore, zones } from '../zones';

describe('zone sync — mobile theme ↔ @tenki/shared zone-config', () => {
  it('mirrors every zone range exactly', () => {
    for (const indicator of ZONE_CONFIG) {
      const mirrored = zones[indicator.zone];
      expect(mirrored.range).toEqual([indicator.min, indicator.max]);
    }
  });

  it('mirrors every zone background color', () => {
    for (const indicator of ZONE_CONFIG) {
      expect(zones[indicator.zone].bg).toBe(indicator.color);
    }
  });

  it('classifies boundary scores identically to the shared source', () => {
    for (const score of [0, 39, 40, 69, 70, 100]) {
      expect(getZoneForScore(score).name).toBe(getZoneByScore(score).zone);
    }
  });
});
