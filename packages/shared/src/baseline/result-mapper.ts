import type { BootstrapResult, BootstrapAcceptance } from './types';

export function mapMockResult(acceptance: BootstrapAcceptance): BootstrapResult {
  const base = {
    resultId: `baseline-${Date.now()}`,
    acceptance,
    createdAt: new Date().toISOString(),
  };
  if (acceptance === 'accepted') {
    return {
      ...base,
      baselineScore: 87,
      confidence: 'high',
      signalQuality: 'high',
      stability: 'stable',
      recommendedAction: 'accept',
      observations: [
        { key: 'signal', label: '訊號品質', value: '穩定', tone: 'good' },
        { key: 'motion', label: '動作干擾', value: '極低', tone: 'good' },
        { key: 'lighting', label: '環境光線', value: '充足', tone: 'good' },
      ],
    };
  }
  if (acceptance === 'provisional') {
    return {
      ...base,
      baselineScore: 61,
      confidence: 'medium',
      signalQuality: 'medium',
      stability: 'moderate',
      recommendedAction: 'accept',
      observations: [
        { key: 'signal', label: '訊號品質', value: '尚可', tone: 'caution' },
        { key: 'motion', label: '動作干擾', value: '輕微', tone: 'caution' },
        { key: 'lighting', label: '環境光線', value: '略暗', tone: 'caution' },
      ],
    };
  }
  return {
    ...base,
    confidence: 'low',
    signalQuality: 'low',
    stability: 'weak',
    recommendedAction: 'retry_now',
    retryReason: 'signal_inconclusive',
    observations: [
      { key: 'signal', label: '訊號品質', value: '不足', tone: 'caution' },
    ],
  };
}
