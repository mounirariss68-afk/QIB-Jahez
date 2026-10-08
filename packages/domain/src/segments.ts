/**
 * Segment assignment (DESIGN §4.1): VVIP by the Private Banking flag, then
 * HNWI and High Value by salary or deposits, then Mass. Evaluated in that
 * order so every customer lands in exactly one segment. The thresholds are
 * SEG parameters.
 */
import type { Policy } from './policy.js';
import type { Segment } from './types.js';

export type SegmentInputs = { privateBanking: boolean; salaryTotal: number; deposits: number };

export function assignSegment(x: SegmentInputs, policy: Policy): Segment {
  if (x.privateBanking) return 'VVIP';
  if (x.salaryTotal >= policy.num('hnwiMinSalary') || x.deposits >= policy.num('hnwiMinDeposits')) return 'HNWI';
  if (x.salaryTotal >= policy.num('hvMinSalary') || x.deposits >= policy.num('hvMinDeposits')) return 'HIGH_VALUE';
  return 'MASS';
}

/** The human step after N unanswered notices, by segment, as the policy states it. */
export function humanStepFor(segment: Segment, policy: Policy): 'RM' | 'CALL' | 'NONE' {
  if (policy.bool('rmFirst', segment)) return 'RM';
  return policy.num('humanAfterAttempts', segment) > 0 ? 'CALL' : 'NONE';
}
