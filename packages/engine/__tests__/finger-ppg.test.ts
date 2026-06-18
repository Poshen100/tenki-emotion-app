import {
  detectPeaks,
  computeIBI,
  estimateHrvFromIBI,
  assessBeatRegularity,
  processFingerPpgWindow,
} from '../src/biometric/finger-ppg';
import type { FingerPpgSample } from '../src/biometric/finger-ppg';

describe('Finger PPG Engine Logic', () => {
  describe('peak detection and IBI estimation', () => {
    it('detects peaks from a synthetic PPG signal', () => {
      const sampleRate = 30; // 30 FPS
      const durationSec = 10;
      const totalSamples = sampleRate * durationSec;
      const bpm = 60; // 1 beat per second
      const beatIntervalSamples = sampleRate; // 30 samples per beat
      
      const signal: number[] = [];
      for (let i = 0; i < totalSamples; i++) {
        // Simple cardiac pulse approximation: a asymmetric peaked wave
        const phase = (i % beatIntervalSamples) / beatIntervalSamples;
        const val = Math.sin(phase * Math.PI) * Math.exp(-phase * 2) + Math.random() * 0.05;
        signal.push(val);
      }

      const peaks = detectPeaks(signal, sampleRate);
      // We expect around 9-10 peaks for 10 seconds at 60 BPM
      expect(peaks.length).toBeGreaterThanOrEqual(9);
      expect(peaks.length).toBeLessThanOrEqual(11);

      const ibis = computeIBI(peaks);
      expect(ibis.length).toBeGreaterThan(0);
      
      // The average IBI should be close to 1000ms (since BPM is 60)
      const avgIbi = ibis.reduce((a, b) => a + b, 0) / ibis.length;
      expect(avgIbi).toBeGreaterThan(900);
      expect(avgIbi).toBeLessThan(1100);
    });
  });

  describe('HRV RMSSD and regularity calculations', () => {
    it('calculates RMSSD correctly', () => {
      const ibis = [1000, 950, 1050, 1000, 980];
      // Successive differences: -50, 100, -50, -20
      // Squared: 2500, 10000, 2500, 400
      // Sum = 15400
      // Mean sum of squares = 15400 / 4 = 3850
      // sqrt(3850) = 62.05
      const rmssd = estimateHrvFromIBI(ibis);
      expect(rmssd).toBeCloseTo(62.05, 1);
    });

    it('determines beat regularity correctly', () => {
      // Highly regular beats (low coefficient of variation)
      const regularIbis = [1000, 1000, 1000, 1000];
      expect(assessBeatRegularity(regularIbis)).toBe(1.0);

      // Irregular beats (higher CV)
      const irregularIbis = [1000, 600, 1200, 700];
      expect(assessBeatRegularity(irregularIbis)).toBeLessThan(0.70);
    });
  });

  describe('processFingerPpgWindow', () => {
    it('processes sample windows and reports quality and precision', () => {
      const samples: FingerPpgSample[] = [];
      const sampleRate = 30;
      
      // Generate 4 seconds of data (120 samples)
      for (let i = 0; i < 120; i++) {
        const phase = (i % 30) / 30;
        const redMean = Math.sin(phase * Math.PI) * Math.exp(-phase * 2);
        samples.push({
          timestamp: Date.now() + i * 33,
          redMean,
          greenMean: 0.1,
          coverage: 0.95,
          motionDelta: 0.05, // very stable
        });
      }

      const result = processFingerPpgWindow(samples, sampleRate);
      expect(result.bpm).toBeCloseTo(60, 0);
      expect(result.validBeats).toBeGreaterThan(0);
      expect(result.signalQuality.acceptable).toBe(true);
      expect(result.signalQuality.coverage).toBeCloseTo(0.95, 2);
      expect(result.precisionTier).toBe('quick'); // 4 beats is quick
    });
  });
});
