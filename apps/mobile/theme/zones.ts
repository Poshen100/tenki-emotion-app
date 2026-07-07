/**
 * @module theme/zones
 * @description Zone tones + score boundaries for the mobile theme.
 * Runtime mirror of @tenki/shared zone-config (PLAYBOOK §7: mobile does not
 * import packages at runtime). Kept RN-free so jest can lock it against the
 * shared source via theme/__tests__/zone-sync.test.ts.
 */

// keep in sync with @tenki/shared design-tokens brand spine (zone tones)
export const zones = {
  clear:   { bg: '#00B4D8', text: '#FFFFFF', range: [70, 100] as const },
  neutral: { bg: '#64748B', text: '#FFFFFF', range: [40, 69] as const },
  strain:  { bg: '#C2703D', text: '#FFFFFF', range: [0, 39] as const },
} as const;

export type ZoneName = keyof typeof zones;

/** Returns zone config for a given Edge Score (0-100). */
export function getZoneForScore(score: number): { name: ZoneName; bg: string; text: string } {
  if (score >= zones.clear.range[0]) return { name: 'clear', bg: zones.clear.bg, text: zones.clear.text };
  if (score >= zones.neutral.range[0]) return { name: 'neutral', bg: zones.neutral.bg, text: zones.neutral.text };
  return { name: 'strain', bg: zones.strain.bg, text: zones.strain.text };
}

/** Zone display labels (safe, compliance-checked wording). */
export const zoneLabels: Record<ZoneName, string> = {
  clear: 'Clear',
  neutral: 'Neutral',
  strain: 'Strain',
} as const;
