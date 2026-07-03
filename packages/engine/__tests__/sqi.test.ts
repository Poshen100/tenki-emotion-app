import { calculateSqi, getSqiGrade, SQI_THRESHOLD } from '../src/legacy/sqi';

describe('SQI Engine Logic', () => {
    describe('calculateSqi', () => {
        it('returns a high SQI for a highly stable signal with low CV', () => {
            // 100 points around 1000 with very little deviation -> mean ~1000, std ~0
            const signal = Array.from({ length: 100 }, () => 1000 + (Math.random() * 2 - 1));
            const sqi = calculateSqi(signal, 30);
            expect(sqi).toBeGreaterThan(95);
        });

        it('returns a low SQI for a noisy signal with high CV', () => {
            // Points alternating drastically -> mean ~500, std ~500 so CV ~ 1.0 => 100-(1.0*200) = <0 -> 0
            const signal = Array.from({ length: 100 }, (_, i) => i % 2 === 0 ? 0 : 1000);
            const sqi = calculateSqi(signal, 30);
            expect(sqi).toBe(0);
        });

        it('returns 0 for an empty array', () => {
            expect(calculateSqi([], 30)).toBe(0);
        });

        it('returns 0 for a flatline at 0 to avoid division by 0', () => {
            expect(calculateSqi([0, 0, 0, 0], 30)).toBe(0);
        });
    });

    describe('getSqiGrade', () => {
        it('maps boundaries properly to respective grades', () => {
            expect(getSqiGrade(100)).toBe('A');
            expect(getSqiGrade(80)).toBe('A');

            expect(getSqiGrade(79)).toBe('B');
            expect(getSqiGrade(60)).toBe('B');

            expect(getSqiGrade(59)).toBe('C');
            expect(getSqiGrade(40)).toBe('C');

            expect(getSqiGrade(39)).toBe('D');
            expect(getSqiGrade(20)).toBe('D');

            expect(getSqiGrade(19)).toBe('F');
            expect(getSqiGrade(0)).toBe('F');
        });
    });

    describe('SQI_THRESHOLD', () => {
        it('is exported and set to 40', () => {
            expect(SQI_THRESHOLD).toBe(40);
        });
    });
});
