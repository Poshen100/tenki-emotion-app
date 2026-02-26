import { selectSource, shouldDegrade, buildFusionLog, SOURCE_PRIORITY } from '../src/fusion';

describe('Fusion Engine Logic', () => {
    describe('selectSource', () => {
        it('selects the highest priority source when multiple options are qualified', () => {
            const available = [
                { source: 'rppg_forehead' as const, sqiScore: 80 },
                { source: 'watch_healthkit' as const, sqiScore: 90 }
            ];
            const log = selectSource(available);
            expect(log.source).toBe('watch_healthkit');
            expect(log.degraded).toBe(false);
            expect(log.confidence).toBe(SOURCE_PRIORITY['watch_healthkit'] / 100);
        });

        it('always prefers BLE chest strap even if a lower priority has higher SQI', () => {
            const available = [
                { source: 'rppg_glabella' as const, sqiScore: 99 },
                { source: 'ble_chest' as const, sqiScore: 50 } // 50 > SQI_THRESHOLD (40)
            ];
            const log = selectSource(available);
            expect(log.source).toBe('ble_chest');
        });

        it('marks degraded if all sensors have sqi < 40 and takes the highest ranking failing one', () => {
            const available = [
                { source: 'watch_healthkit' as const, sqiScore: 10 },
                { source: 'ble_chest' as const, sqiScore: 20 }
            ];
            const log = selectSource(available);
            expect(log.source).toBe('ble_chest');
            expect(log.degraded).toBe(true);
            expect(log.confidence).toBe(0.3); // Forced to 0.3 when degraded
            expect(log.fallbackReason).toBe('No source passed SQI threshold');
        });

        it('returns a low confidence non-degraded response if only rppg_cheek passes threshold', () => {
            const available = [
                { source: 'watch_healthkit' as const, sqiScore: 10 },
                { source: 'rppg_cheek' as const, sqiScore: 45 }
            ];
            const log = selectSource(available);
            expect(log.source).toBe('rppg_cheek');
            expect(log.degraded).toBe(false);
            // confidence should be > 0 but < 0.5 because it's a weak source
            expect(log.confidence).toBe(0.4);
        });

        it('fails over immediately for empty array', () => {
            const log = selectSource([]);
            expect(log.degraded).toBe(true);
        });
    });

    describe('shouldDegrade', () => {
        it('returns true if explicitly marked degraded', () => {
            const log = buildFusionLog('ble_chest', 50, true);
            expect(shouldDegrade(log)).toBe(true);
        });

        it('returns true if confidence < 0.5', () => {
            const log = buildFusionLog('rppg_cheek', 80, false);
            // confidence for cheek is 0.4
            expect(shouldDegrade(log)).toBe(true);
        });

        it('returns false for strong confident sources', () => {
            const log = buildFusionLog('watch_healthkit', 90, false);
            expect(shouldDegrade(log)).toBe(false); // confidence 0.8
        });
    });
});
