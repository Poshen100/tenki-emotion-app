/**
 * 量到／算出／推論 labels (P0-B, founder 2026-11-24, spec §2.4).
 */
import {
  BEAT_TIMINGS,
  EVIDENCE_LAYERS,
  EVIDENCE_QUALITIES,
  EVIDENCE_SOURCES,
  EVIDENCE_VALIDATIONS,
  type EvidenceLabel,
  REPORTED_LAYER,
  evidenceLabelCopy,
  evidenceLabelLine,
  evidenceLabelProblem,
} from '../evidence-label';
import { isCompliantCopy } from '../safe-copy';

const cameraPrv: EvidenceLabel = {
  layer: 'calculated',
  source: 'camera_fingertip',
  beatTiming: 'estimated',
  quality: 'passed',
  validation: 'none',
};

/** Every consistent label the type allows. */
function allConsistentLabels(): EvidenceLabel[] {
  const out: EvidenceLabel[] = [];
  const layers = [...EVIDENCE_LAYERS, REPORTED_LAYER];
  for (const layer of layers)
    for (const source of EVIDENCE_SOURCES)
      for (const beatTiming of [undefined, ...BEAT_TIMINGS])
        for (const quality of EVIDENCE_QUALITIES)
          for (const validation of EVIDENCE_VALIDATIONS) {
            const label: EvidenceLabel = { layer, source, quality, validation, ...(beatTiming ? { beatTiming } : {}) };
            if (evidenceLabelProblem(label) === null) out.push(label);
          }
  return out;
}

describe('evidenceLabelCopy', () => {
  it('a camera Pulse Rhythm says 算出, where it came from, and that beat timing is not guaranteed', () => {
    const c = evidenceLabelCopy(cameraPrv);
    expect(c).toEqual({
      layer: '算出',
      source: '手機相機・指尖',
      beatTiming: '拍點時間不保證（從光的波形推回來的）',
      quality: '這次的品質過關',
      validation: '還沒有對照驗證',
    });
  });

  it('the validated wording is the same sentence as the #27 headline note', () => {
    expect(evidenceLabelCopy({ ...cameraPrv, validation: 'this_device_preliminary' }).validation).toBe(
      '這台手機做過初步的胸帶對照（只代表這台手機）',
    );
  });

  it('every field is present in the one-line form, in a fixed order', () => {
    expect(evidenceLabelLine(cameraPrv)).toBe(
      '算出 · 手機相機・指尖 · 拍點時間不保證（從光的波形推回來的） · 這次的品質過關 · 還沒有對照驗證',
    );
  });

  it('every consistent label renders compliant copy', () => {
    const labels = allConsistentLabels();
    expect(labels.length).toBeGreaterThan(20);
    for (const label of labels) {
      for (const text of Object.values(evidenceLabelCopy(label))) {
        if (text !== null) expect(isCompliantCopy(text)).toBe(true);
      }
    }
  });

  it('never claims medical-grade or validated-HRV status', () => {
    for (const label of allConsistentLabels()) {
      expect(evidenceLabelLine(label)).not.toMatch(/醫療|精準|HRV|心律變異|驗證過的/);
    }
  });
});

describe('evidenceLabelProblem', () => {
  it('🔴 self-report is its own layer and source — it cannot pass as measured, calculated or inferred', () => {
    for (const layer of EVIDENCE_LAYERS) {
      expect(evidenceLabelProblem({ layer, source: 'self_report', quality: 'passed', validation: 'none' })).not.toBeNull();
    }
    expect(evidenceLabelProblem({ layer: 'reported', source: 'camera_fingertip', quality: 'passed', validation: 'none' })).not.toBeNull();
    expect(evidenceLabelCopy({ layer: 'reported', source: 'self_report', quality: 'passed', validation: 'none' }).layer).toBe('你填的');
  });

  it('🔴 a camera cannot be labelled as guaranteeing beat timing', () => {
    expect(evidenceLabelProblem({ ...cameraPrv, beatTiming: 'derived' })).not.toBeNull();
    expect(() => evidenceLabelCopy({ ...cameraPrv, beatTiming: 'observed' })).toThrow();
  });

  it('only the fingertip camera can carry the #27 preliminary validation', () => {
    expect(
      evidenceLabelProblem({ layer: 'inferred', source: 'camera_face_framing', quality: 'passed', validation: 'this_device_preliminary' }),
    ).not.toBeNull();
  });
});
