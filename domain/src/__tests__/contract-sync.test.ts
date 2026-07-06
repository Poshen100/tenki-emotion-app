/**
 * Compile-time sync lock between domain contracts and the engine's own
 * type definitions. The monorepo layers deliberately do not import each
 * other at runtime (mirror convention), so this test is the tripwire:
 * if either side changes its union, ts-jest fails to compile this file.
 */
import type { GateResult } from '../../../packages/engine/src/session/types';
import type { DomainGateResult } from '../contracts/scan-contract';
import { DOMAIN_GATE_RESULTS } from '../contracts/scan-contract';

type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

describe('contract sync — engine ↔ domain (compile-time lock)', () => {
  it('GateResult and DomainGateResult are the same union', () => {
    const inSync: MutuallyAssignable<GateResult, DomainGateResult> = true;
    expect(inSync).toBe(true);
  });

  it('DOMAIN_GATE_RESULTS enumerates every member of the union', () => {
    expect([...DOMAIN_GATE_RESULTS].sort()).toEqual(
      ['clear_pass', 'force_hold', 'red_gate', 'soft_caution'],
    );
  });
});
