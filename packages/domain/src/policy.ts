/**
 * The policy catalogue: every rule an agent follows is a parameter here, with
 * its default, its basis and the clause it belongs to. The engine never reads
 * a rule from code; it reads `Policy.get(key, segment)`, which the server
 * builds from layer.policy_params (seeded from DEFAULTS and edited on the
 * Policies screen, versioned and approved).
 *
 * Basis marks: [R] regulation or documented practice (see research/),
 * [Q] stated by QIB, [D] design default.
 */
import type { ParamValue, PolicyParams, Segment } from './types.js';
import { SEGMENTS } from './types.js';

export type Domain = 'POL-01' | 'POL-02' | 'POL-03' | 'POL-04' | 'POL-05' | 'POL-06' | 'POL-07' | 'POL-08' | 'POL-09' | 'POL-10' | 'SEG' | 'CH' | 'REF' | 'DATA';

export const DOMAINS: { id: Domain; name: string; approver: string; description: string }[] = [
  { id: 'POL-01', name: 'Contact policy', approver: 'HEAD', description: 'Windows, caps, notices, channels and escalation per segment.' },
  { id: 'POL-02', name: 'Document refresh', approver: 'HEAD', description: 'Pre-expiry watch, post-expiry notices, restriction proposals, document channels and assurance.' },
  { id: 'POL-03', name: 'Salary and employment evidence', approver: 'CREDIT', description: 'Salary window and thresholds, explained gaps, standing orders, employer approval criteria.' },
  { id: 'POL-04', name: 'Eligibility rules', approver: 'CREDIT', description: 'QCB caps, tenor, DBR, age, minimum amount, model and rating thresholds.' },
  { id: 'POL-05', name: 'Suppression and conduct', approver: 'COMPLIANCE', description: 'When offers are suppressed; early-arrears cadence; cautionary-note routing; hardship.' },
  { id: 'POL-06', name: 'Data update and maker-checker', approver: 'SUPERVISOR', description: 'Which fields need a checker; confidence thresholds; audit sampling; rejection rules.' },
  { id: 'POL-07', name: 'Privacy and consent', approver: 'COMPLIANCE', description: 'Service versus marketing messages, the three suppression lists, opt-out timing, message elements.' },
  { id: 'POL-08', name: 'Escalation', approver: 'HEAD', description: 'The ladder, SLAs per rung, who may pause or close.' },
  { id: 'POL-09', name: 'Calendar', approver: 'COMPLIANCE', description: 'Quiet periods: Friday window, public holidays, Eid, Ramadan.' },
  { id: 'POL-10', name: 'Retention and audit', approver: 'COMPLIANCE', description: 'Retention of outreach records and documents; trail rules.' },
  { id: 'SEG', name: 'Segments', approver: 'HEAD', description: 'Segment names, membership rules and RM ownership.' },
  { id: 'CH', name: 'Channels', approver: 'HEAD', description: 'Which channels exist, their order per segment and the document channels.' },
  { id: 'REF', name: 'Reference lists', approver: 'COMPLIANCE', description: 'Note types, status codes, restricted nationalities, ineligible segments, acceptable gap reasons.' },
  { id: 'DATA', name: 'Synthetic data', approver: 'HEAD', description: 'The distributions the generator uses on reset: segment mix, nationality mix, reason weights, eligible rate.' },
];

export type ParamType = 'number' | 'boolean' | 'string' | 'list' | 'time';
export type ParamDef = {
  key: string; domain: Domain; label: string; type: ParamType; segmented: boolean; unit?: string; clause?: string; basis: string;
  default: ParamValue | Record<Segment, ParamValue>; help?: string;
};

const seg = (v: [ParamValue, ParamValue, ParamValue, ParamValue]): Record<Segment, ParamValue> => ({ VVIP: v[0], HNWI: v[1], HIGH_VALUE: v[2], MASS: v[3] });

export const PARAMS: ParamDef[] = [
  // ---------------------------------------------------------------- POL-01 contact
  { key: 'serviceWindowStart', domain: 'POL-01', label: 'Service-message window starts (Doha)', type: 'time', segmented: true, clause: 'POL-01 §2.1', basis: '[R] CRA Qatar: no direct marketing 21:00–09:00; CBUAE collections 09:00–20:00', default: seg(['10:00', '09:00', '09:00', '09:00']) },
  { key: 'serviceWindowEnd', domain: 'POL-01', label: 'Service-message window ends (Doha)', type: 'time', segmented: true, clause: 'POL-01 §2.1', basis: '[R] as above', default: seg(['17:00', '18:00', '20:00', '20:00']) },
  { key: 'callWindowStart', domain: 'POL-01', label: 'Call window starts', type: 'time', segmented: true, clause: 'POL-01 §2.2', basis: '[R] UAE marketing-call window 09:00–18:00', default: seg(['10:00', '09:00', '09:00', '09:00']) },
  { key: 'callWindowEnd', domain: 'POL-01', label: 'Call window ends', type: 'time', segmented: true, clause: 'POL-01 §2.2', basis: '[R] as above', default: seg(['17:00', '18:00', '18:00', '18:00']) },
  { key: 'maxContactsPerDay', domain: 'POL-01', label: 'Max contacts per day (all channels)', type: 'number', segmented: true, clause: 'POL-01 §3.1', basis: '[R] Fair4All: not more than one action a day', default: seg([1, 1, 1, 1]) },
  { key: 'maxContactsPerWeek', domain: 'POL-01', label: 'Max contacts per week', type: 'number', segmented: true, clause: 'POL-01 §3.1', basis: '[R] ACCC/ASIC 3 per week; segment step-downs [D]', default: seg([0.5, 1, 2, 3]) },
  { key: 'maxContactsPer30d', domain: 'POL-01', label: 'Max contacts per 30 days', type: 'number', segmented: true, clause: 'POL-01 §3.1', basis: '[R] SAMA ≤ 10 attempts in 30 days', default: seg([2, 3, 6, 8]) },
  { key: 'noticesPreExpiry', domain: 'POL-01', label: 'Automated notices in the pre-expiry watch', type: 'number', segmented: true, clause: 'POL-01 §4.1', basis: '[D] T-90, T-60, T-30', default: seg([0, 1, 3, 3]) },
  { key: 'noticesPostExpiry', domain: 'POL-01', label: 'Automated notices after the fall-out', type: 'number', segmented: true, clause: 'POL-01 §4.2', basis: '[R] RBI ≥ 3 before and ≥ 3 after; variants [D]', default: seg([0, 2, 2, 3]) },
  { key: 'reminderIntervalDays', domain: 'POL-01', label: 'Days between post-fall-out notices', type: 'number', segmented: true, unit: 'days', clause: 'POL-01 §4.2', basis: '[R] CBUAE 90-day notice before a block; interval [D]', default: seg([30, 14, 30, 30]) },
  { key: 'humanAfterAttempts', domain: 'POL-01', label: 'A person steps in after N unanswered notices', type: 'number', segmented: true, clause: 'POL-01 §5.1', basis: '[D]; CBUAE AI note: out-of-loop only for low-risk steps', default: seg([0, 2, 2, 3]) },
  { key: 'rmFirst', domain: 'POL-01', label: 'RM-first (no automated message without the RM)', type: 'boolean', segmented: true, clause: 'POL-01 §6.1', basis: '[D] private-banking service model', default: seg([true, true, false, false]) },
  { key: 'rmApprovalRequired', domain: 'POL-01', label: 'RM approval required before a message is sent', type: 'boolean', segmented: true, clause: 'POL-01 §6.1', basis: '[D]', default: seg([true, true, false, false]) },
  { key: 'attemptChannelRule', domain: 'POL-01', label: 'Channel rule per attempt', type: 'string', segmented: false, clause: 'POL-01 §3.3', basis: '[D] one channel per attempt, in the segment order; a call is the human step', default: 'ONE_PER_ATTEMPT' },
  // ---------------------------------------------------------------- POL-02 documents
  { key: 'preExpiryWatchDays', domain: 'POL-02', label: 'Pre-expiry watch opens (days before expiry)', type: 'number', segmented: false, unit: 'days', clause: 'POL-02 §1.1', basis: '[D] practice; CBUAE 90-day written-notice period', default: 90 },
  { key: 'preExpiryNoticeDays', domain: 'POL-02', label: 'Pre-expiry notices at (days before expiry)', type: 'list', segmented: false, clause: 'POL-02 §1.1', basis: '[D]', default: ['90', '60', '30'] },
  { key: 'postExpiryNoticeDays', domain: 'POL-02', label: 'Post-expiry notices at (days after expiry)', type: 'list', segmented: false, clause: 'POL-02 §1.2', basis: '[R] RBI ≥ 3 post-due; [D] cadence', default: ['0', '30', '60'] },
  { key: 'restrictionProposalDay', domain: 'POL-02', label: 'Temporary restriction proposed at (days after expiry)', type: 'number', segmented: false, unit: 'days', clause: 'POL-02 §4.3', basis: '[R] CBUAE 6.2.1.5: 90 calendar days of written notice before a card block', default: 90 },
  { key: 'restrictionApprover', domain: 'POL-02', label: 'Restriction approved by', type: 'string', segmented: true, clause: 'POL-02 §4.3', basis: '[D]', default: seg(['HEAD', 'RM', 'SUPERVISOR', 'SUPERVISOR']) },
  { key: 'hardRestrictionAfterDays', domain: 'POL-02', label: 'Hard restriction only after a further notice period', type: 'number', segmented: false, unit: 'days', clause: 'POL-02 §4.4', basis: '[R] RBI partial-then-full freeze; 90 days [D]', default: 90 },
  { key: 'documentChannels', domain: 'POL-02', label: 'Accepted document channels', type: 'list', segmented: true, clause: 'POL-02 §2.1', basis: '[D]', default: seg([['RM', 'BRANCH'], ['INAPP', 'RM', 'BRANCH'], ['INAPP', 'EMAIL', 'BRANCH'], ['INAPP', 'EMAIL', 'BRANCH']]) },
  { key: 'salaryCertMaxAgeDays', domain: 'POL-02', label: 'Salary certificate maximum age', type: 'number', segmented: false, unit: 'days', clause: 'POL-02 §3.1', basis: '[D]', default: 30 },
  { key: 'bankStatementMaxAgeDays', domain: 'POL-02', label: 'Bank statement maximum age', type: 'number', segmented: false, unit: 'days', clause: 'POL-02 §3.1', basis: '[D]', default: 90 },
  { key: 'renewalExtensionDays', domain: 'POL-02', label: 'Extension when renewal is in progress', type: 'number', segmented: false, unit: 'days', clause: 'POL-02 §5.1', basis: '[R] Qatari banks grant extensions; length [D]', default: 30 },
  // ---------------------------------------------------------------- POL-03 salary & employment
  { key: 'salaryWindowMonths', domain: 'POL-03', label: 'Salary history window', type: 'number', segmented: false, unit: 'months', clause: 'POL-03 §1.1', basis: '[Q] "any of the last 6 months"', default: 6 },
  { key: 'lowSalaryPct', domain: 'POL-03', label: 'Low salary = below this share of the trailing median', type: 'number', segmented: false, unit: '%', clause: 'POL-03 §1.2', basis: '[D]', default: 70 },
  { key: 'acceptExplainedGap', domain: 'POL-03', label: 'An explained gap can be accepted', type: 'boolean', segmented: true, clause: 'POL-03 §2.1', basis: '[D] approval-gated', default: seg([true, true, true, true]) },
  { key: 'explainedGapApprover', domain: 'POL-03', label: 'Explained gap approved by', type: 'string', segmented: true, clause: 'POL-03 §2.1', basis: '[D]', default: seg(['CREDIT', 'CREDIT', 'CREDIT', 'SUPERVISOR']) },
  { key: 'salaryTransferOffer', domain: 'POL-03', label: 'Offer salary transfer when salary is paid elsewhere', type: 'boolean', segmented: false, clause: 'POL-03 §3.1', basis: '[R] marketing consent required (PDPPL art. 22)', default: true },
  { key: 'standingOrderCounting', domain: 'POL-03', label: 'Standing orders counted as obligations', type: 'string', segmented: false, clause: 'POL-03 §4.1', basis: '[A] FI = recurring orders to financial institutions only', default: 'FI_ONLY' },
  { key: 'standingOrderLimitPct', domain: 'POL-03', label: 'Standing-order limit (share of salary)', type: 'number', segmented: false, unit: '%', clause: 'POL-03 §4.2', basis: '[D][A]', default: 25 },
  { key: 'employerMinHeadcount', domain: 'POL-03', label: 'Employer approval: minimum headcount', type: 'number', segmented: false, clause: 'POL-03 §5.1', basis: '[D]; 2013 practice and QIB@work targeting [R]', default: 20 },
  { key: 'employerMinQibSalaried', domain: 'POL-03', label: 'Employer approval: or minimum QIB-salaried staff', type: 'number', segmented: false, clause: 'POL-03 §5.1', basis: '[D]', default: 5 },
  { key: 'employerMinMonthsOperating', domain: 'POL-03', label: 'Employer approval: minimum months of operation', type: 'number', segmented: false, unit: 'months', clause: 'POL-03 §5.1', basis: '[D]', default: 12 },
  { key: 'employerRequireWps', domain: 'POL-03', label: 'Employer approval: WPS must be active', type: 'boolean', segmented: false, clause: 'POL-03 §5.1', basis: '[R] WPS mandatory since 2015', default: true },
  { key: 'employerReviewSlaDays', domain: 'POL-03', label: 'Employer review SLA', type: 'number', segmented: false, unit: 'working days', clause: 'POL-03 §5.2', basis: '[D]', default: 5 },
  // ---------------------------------------------------------------- POL-04 eligibility
  { key: 'capQatari', domain: 'POL-04', label: 'Cap, Qatari nationals (repayable, incl. profit)', type: 'number', segmented: false, unit: 'QAR', clause: 'POL-04 §1.1', basis: '[R] QCB 2011', default: 2000000 },
  { key: 'capResident', domain: 'POL-04', label: 'Cap, residents (repayable, incl. profit)', type: 'number', segmented: false, unit: 'QAR', clause: 'POL-04 §1.1', basis: '[R] QCB 2011', default: 400000 },
  { key: 'tenorQatari', domain: 'POL-04', label: 'Maximum tenor, Qataris', type: 'number', segmented: false, unit: 'months', clause: 'POL-04 §1.2', basis: '[R] QCB 2011', default: 72 },
  { key: 'tenorResident', domain: 'POL-04', label: 'Maximum tenor, residents', type: 'number', segmented: false, unit: 'months', clause: 'POL-04 §1.2', basis: '[R] QCB 2011', default: 48 },
  { key: 'minTenorMonths', domain: 'POL-04', label: 'Minimum tenor', type: 'number', segmented: false, unit: 'months', clause: 'POL-04 §1.3', basis: '[D]', default: 12 },
  { key: 'dbrQatari', domain: 'POL-04', label: 'DBR, Qataris (of basic + social allowance)', type: 'number', segmented: false, unit: '%', clause: 'POL-04 §2.1', basis: '[R] QCB; base wording as on QIB/Ahlibank pages', default: 75 },
  { key: 'dbrResident', domain: 'POL-04', label: 'DBR, residents (of total salary)', type: 'number', segmented: false, unit: '%', clause: 'POL-04 §2.1', basis: '[R] QCB', default: 50 },
  { key: 'ageMinQatari', domain: 'POL-04', label: 'Minimum age, Qataris', type: 'number', segmented: false, clause: 'POL-04 §3.1', basis: '[R] QIB page', default: 18 },
  { key: 'ageMaxQatari', domain: 'POL-04', label: 'Age limit at maturity, Qataris', type: 'number', segmented: false, clause: 'POL-04 §3.1', basis: '[R] QIB page; at maturity [A]', default: 65 },
  { key: 'ageMinResident', domain: 'POL-04', label: 'Minimum age, residents', type: 'number', segmented: false, clause: 'POL-04 §3.1', basis: '[R] QIB page', default: 21 },
  { key: 'ageMaxResident', domain: 'POL-04', label: 'Age limit at maturity, residents', type: 'number', segmented: false, clause: 'POL-04 §3.1', basis: '[R] QIB page; at maturity [A]', default: 60 },
  { key: 'minEligible', domain: 'POL-04', label: 'Minimum eligible amount', type: 'number', segmented: false, unit: 'QAR', clause: 'POL-04 §4.1', basis: '[Q]', default: 5000 },
  { key: 'cardMinPaymentPct', domain: 'POL-04', label: 'Card minimum payment counted', type: 'number', segmented: false, unit: '% of outstanding', clause: 'POL-04 §2.2', basis: '[D]', default: 5 },
  { key: 'indicativeRatePct', domain: 'POL-04', label: 'Indicative profit rate for the annuity', type: 'number', segmented: false, unit: '% p.a.', clause: 'POL-04 §4.2', basis: '[D]; QCB lending rate + 1.5pp reported [R], UNVERIFIED', default: 6.0 },
  { key: 'requireCurrentAccount', domain: 'POL-04', label: 'Current account required', type: 'boolean', segmented: false, clause: 'POL-04 §5.1', basis: '[Q] implied', default: true },
  { key: 'requireApprovedEmployer', domain: 'POL-04', label: 'Approved employer required', type: 'boolean', segmented: false, clause: 'POL-04 §5.1', basis: '[R] QIB page', default: true },
  { key: 'requirePassportResidents', domain: 'POL-04', label: 'Valid passport required for residents', type: 'boolean', segmented: false, clause: 'POL-04 §5.1', basis: '[R] QIB page', default: true },
  { key: 'modelCutOff', domain: 'POL-04', label: 'Risk model cut-off (score 0–1)', type: 'number', segmented: false, clause: 'POL-04 §6.1', basis: '[Q][A] opaque', default: 0.42 },
  { key: 'ratingThreshold', domain: 'POL-04', label: 'Minimum internal rating', type: 'string', segmented: false, clause: 'POL-04 §6.2', basis: '[A]', default: 'BBB' },
  { key: 'autoIjaraCutOff', domain: 'POL-04', label: 'Auto Ijara cut-off (score 0–1)', type: 'number', segmented: false, clause: 'POL-04 §6.3', basis: '[Q][A] vehicle finance only', default: 0.5 },
  { key: 'exposureInfoMessage', domain: 'POL-04', label: 'Tell the customer when exposure is the only reason', type: 'boolean', segmented: false, clause: 'POL-04 §7.1', basis: '[D]', default: false },
  // ---------------------------------------------------------------- POL-05 suppression & conduct
  { key: 'suppressIfDpd', domain: 'POL-05', label: 'Suppress offers when any DPD > 0', type: 'boolean', segmented: false, clause: 'POL-05 §1.1', basis: '[R] CONC 6.7.7R; CBUAE 7.1.2.3', default: true },
  { key: 'returnedChequeLookbackMonths', domain: 'POL-05', label: 'Returned-cheque lookback', type: 'number', segmented: false, unit: 'months', clause: 'POL-05 §1.2', basis: '[D] = bureau ageing of 3 years; 12 is the alternative', default: 36 },
  { key: 'irregularLatePayments6m', domain: 'POL-05', label: 'Irregular = late instalments in 6 months at or above', type: 'number', segmented: false, clause: 'POL-05 §1.3', basis: '[D]', default: 2 },
  { key: 'earlyArrearsMaxDpd', domain: 'POL-05', label: 'Early-arrears reminders up to DPD', type: 'number', segmented: false, unit: 'days', clause: 'POL-05 §2.1', basis: '[R] Fair4All cadence', default: 30 },
  { key: 'collectionsHandoffDpd', domain: 'POL-05', label: 'Collections takes over at DPD', type: 'number', segmented: false, unit: 'days', clause: 'POL-05 §2.2', basis: '[D]', default: 31 },
  { key: 'arrearsCadenceDays', domain: 'POL-05', label: 'Arrears reminders at DPD', type: 'list', segmented: false, clause: 'POL-05 §2.1', basis: '[R] Fair4All: day 1, 4, 7 (call), 10 (letter)', default: ['1', '4', '7', '10'] },
  { key: 'coolingMonthsAfterCure', domain: 'POL-05', label: 'Cooling period after a DPD cure', type: 'number', segmented: false, unit: 'months', clause: 'POL-05 §3.1', basis: '[D]', default: 3 },
  { key: 'hardshipHumanWithinDays', domain: 'POL-05', label: 'Hardship or complaint reaches a person within', type: 'number', segmented: false, unit: 'working days', clause: 'POL-05 §4.1', basis: '[R] FCA CONC 7.3 forbearance; the day count [D]', default: 1 },
  // ---------------------------------------------------------------- POL-06 maker-checker
  { key: 'checkerFields', domain: 'POL-06', label: 'Fields that always need a checker', type: 'list', segmented: false, clause: 'POL-06 §1.1', basis: '[R] BCBS dual control', default: ['qid_number', 'passport_number', 'qid_expiry', 'passport_expiry', 'name', 'dob', 'nationality', 'employer', 'salary', 'mobile', 'email', 'address', 'status', 'standing_orders'] },
  { key: 'autoApprove', domain: 'POL-06', label: 'Auto-approve record writes', type: 'boolean', segmented: false, clause: 'POL-06 §1.2', basis: '[D] none in v1', default: false },
  { key: 'oneClickReviewConfidence', domain: 'POL-06', label: 'One-click review when extraction confidence is at least', type: 'number', segmented: false, clause: 'POL-06 §1.3', basis: '[R] vendor HITL thresholds 0.90–0.95', default: 0.95 },
  { key: 'randomAuditPct', domain: 'POL-06', label: 'Random audit of approved updates', type: 'number', segmented: false, unit: '%', clause: 'POL-06 §2.1', basis: '[D] vendor practice', default: 5 },
  { key: 'nameMatchTolerance', domain: 'POL-06', label: 'Name match tolerance (tokens)', type: 'number', segmented: false, clause: 'POL-06 §3.1', basis: '[D]', default: 1 },
  { key: 'mrzCheckRequired', domain: 'POL-06', label: 'MRZ check digits required for passports', type: 'boolean', segmented: false, clause: 'POL-06 §3.2', basis: '[R] ICAO 9303', default: true },
  // ---------------------------------------------------------------- POL-07 privacy
  { key: 'serviceWithoutConsent', domain: 'POL-07', label: 'Service messages allowed without marketing consent', type: 'boolean', segmented: false, clause: 'POL-07 §1.1', basis: '[R] CRA existing-relationship presumption; ICO service vs marketing; confirm under the NCSA guideline', default: true },
  { key: 'marketingConsentFor', domain: 'POL-07', label: 'Marketing consent required for', type: 'list', segmented: false, clause: 'POL-07 §2.1', basis: '[R] PDPPL art. 22', default: ['OFFER', 'CURRENT_ACCOUNT_OFFER', 'SALARY_TRANSFER_OFFER', 'CONSOLIDATION_OFFER'] },
  { key: 'optOutEffectDays', domain: 'POL-07', label: 'Opt-out takes effect within', type: 'number', segmented: false, unit: 'business days', clause: 'POL-07 §3.1', basis: '[R] CRA art. 6(3)', default: 2 },
  { key: 'dncBlocksServiceMessages', domain: 'POL-07', label: 'Do-not-contact blocks service messages too', type: 'boolean', segmented: false, clause: 'POL-07 §3.2', basis: '[R] Reg F cease-communication; letter exception [D]', default: true },
  { key: 'senderIdentity', domain: 'POL-07', label: 'Sender identity line', type: 'string', segmented: false, clause: 'POL-07 §4.1', basis: '[R] CRA art. 6(4) Arabic and English', default: 'Qatar Islamic Bank (QIB) · مصرف قطر الإسلامي · +974 4402 0888' },
  // ---------------------------------------------------------------- POL-08 escalation
  { key: 'slaOpsOfficerDays', domain: 'POL-08', label: 'SLA: Operations Officer', type: 'number', segmented: false, unit: 'working days', clause: 'POL-08 §1.1', basis: '[D]', default: 1 },
  { key: 'slaSupervisorDays', domain: 'POL-08', label: 'SLA: Operations Supervisor', type: 'number', segmented: false, unit: 'working days', clause: 'POL-08 §1.1', basis: '[D]', default: 2 },
  { key: 'slaRmDays', domain: 'POL-08', label: 'SLA: Relationship Manager', type: 'number', segmented: false, unit: 'working days', clause: 'POL-08 §1.1', basis: '[D] same day for HNWI/VVIP', default: 1 },
  { key: 'slaCreditDays', domain: 'POL-08', label: 'SLA: Credit Policy', type: 'number', segmented: false, unit: 'working days', clause: 'POL-08 §1.1', basis: '[D]', default: 3 },
  { key: 'slaComplianceDays', domain: 'POL-08', label: 'SLA: Compliance', type: 'number', segmented: false, unit: 'working days', clause: 'POL-08 §1.1', basis: '[D]', default: 3 },
  // ---------------------------------------------------------------- POL-09 calendar
  { key: 'fridayQuietStart', domain: 'POL-09', label: 'Friday quiet window starts', type: 'time', segmented: false, clause: 'POL-09 §1.1', basis: '[D] UNVERIFIED', default: '11:30' },
  { key: 'fridayQuietEnd', domain: 'POL-09', label: 'Friday quiet window ends', type: 'time', segmented: false, clause: 'POL-09 §1.1', basis: '[D] UNVERIFIED', default: '14:00' },
  { key: 'ramadanWindowStart', domain: 'POL-09', label: 'Ramadan window starts', type: 'time', segmented: false, clause: 'POL-09 §2.1', basis: '[D] UNVERIFIED', default: '10:00' },
  { key: 'ramadanWindowEnd', domain: 'POL-09', label: 'Ramadan window ends', type: 'time', segmented: false, clause: 'POL-09 §2.1', basis: '[D] UNVERIFIED', default: '16:00' },
  { key: 'ramadanStart', domain: 'POL-09', label: 'Ramadan starts (set each year by Compliance)', type: 'string', segmented: false, clause: 'POL-09 §2.1', basis: '[D] approximate astronomical dates', default: '2027-02-08' },
  { key: 'ramadanEnd', domain: 'POL-09', label: 'Ramadan ends', type: 'string', segmented: false, clause: 'POL-09 §2.1', basis: '[D]', default: '2027-03-09' },
  { key: 'holidays', domain: 'POL-09', label: 'Public holidays and Eid (no contact)', type: 'list', segmented: false, clause: 'POL-09 §1.2', basis: '[R] ASIC / CBUAE draft: none on holidays; Qatar dates [D]', default: ['2026-12-18', '2027-02-09', '2027-03-10', '2027-03-11', '2027-03-12', '2027-05-17', '2027-05-18', '2027-05-19', '2027-12-18'] },
  { key: 'weekend', domain: 'POL-09', label: 'Weekend days (0 = Sunday … 6 = Saturday)', type: 'list', segmented: false, clause: 'POL-09 §1.3', basis: '[D] Qatar: Friday and Saturday', default: ['5', '6'] },
  // ---------------------------------------------------------------- POL-10 retention
  { key: 'retainOutreachYears', domain: 'POL-10', label: 'Retain outreach records', type: 'number', segmented: false, unit: 'years', clause: 'POL-10 §1.1', basis: '[D]; CBUAE analogue 5 years', default: 5 },
  { key: 'retainKycYears', domain: 'POL-10', label: 'Retain KYC documents', type: 'number', segmented: false, unit: 'years', clause: 'POL-10 §1.2', basis: '[R] Qatar AML Law 20/2019: 10 years', default: 10 },
  // ---------------------------------------------------------------- SEG segments
  { key: 'segLabel', domain: 'SEG', label: 'Segment name', type: 'string', segmented: true, basis: '[A]', default: seg(['VVIP', 'HNWI', 'High Value', 'Mass']) },
  { key: 'segTier', domain: 'SEG', label: 'QIB tier it maps to', type: 'string', segmented: true, basis: '[A]', default: seg(['Private Banking', 'Tamayuz', 'Affluent', 'Essential Banking']) },
  { key: 'hnwiMinSalary', domain: 'SEG', label: 'HNWI: monthly salary at least', type: 'number', segmented: false, unit: 'QAR', basis: '[R] Tamayuz: salary ≥ 50,000', default: 50000 },
  { key: 'hnwiMinDeposits', domain: 'SEG', label: 'HNWI: or deposits at least', type: 'number', segmented: false, unit: 'QAR', basis: '[R] Tamayuz: deposits ≥ 350,000', default: 350000 },
  { key: 'hvMinSalary', domain: 'SEG', label: 'High Value: monthly salary at least', type: 'number', segmented: false, unit: 'QAR', basis: '[D]', default: 20000 },
  { key: 'hvMinDeposits', domain: 'SEG', label: 'High Value: or deposits at least', type: 'number', segmented: false, unit: 'QAR', basis: '[D]', default: 100000 },
  // ---------------------------------------------------------------- CH channels
  { key: 'channelEnabled', domain: 'CH', label: 'Channels enabled', type: 'list', segmented: false, basis: '[R] QIB: app, SMS, e-mail, call centre; WhatsApp not found', default: ['PUSH', 'INAPP', 'EMAIL', 'SMS', 'CALL', 'LETTER', 'RM'] },
  { key: 'channelOrder', domain: 'CH', label: 'Channel order per attempt', type: 'list', segmented: true, clause: 'POL-01 §3.2', basis: '[R] CBUAE approved methods; [D] order', default: seg([['RM', 'LETTER'], ['INAPP', 'EMAIL', 'RM'], ['PUSH', 'INAPP', 'EMAIL', 'CALL'], ['PUSH', 'INAPP', 'EMAIL', 'SMS', 'CALL']]) },
  { key: 'offerChannel', domain: 'CH', label: 'Channel for the One Click offer', type: 'string', segmented: true, basis: '[R] QIB: SMS and/or app notification', default: seg(['RM', 'PUSH', 'PUSH', 'PUSH']) },
  // ---------------------------------------------------------------- REF lists
  { key: 'noteTypesRemediable', domain: 'REF', label: 'Cautionary-note types Compliance may reclassify to a workflow', type: 'list', segmented: false, basis: '[A]', default: ['KYC_EXPIRED', 'SALARY_STOPPED'] },
  { key: 'statusContactable', domain: 'REF', label: 'Customer statuses that may be contacted', type: 'list', segmented: false, basis: '[A]', default: ['NORMAL', 'DORMANT', 'BLOCKED_KYC', 'BLOCKED_SALARY'] },
  { key: 'restrictedNationalities', domain: 'REF', label: 'Restricted nationalities (illustrative — Compliance edits)', type: 'list', segmented: false, basis: '[A] illustrative; the demo generator uses placeholder codes', default: ['XR1', 'XR2', 'XR3'] },
  { key: 'ineligibleSegmentTags', domain: 'REF', label: 'Ineligible segment tags', type: 'list', segmented: false, basis: '[A]', default: ['STAFF', 'MINOR', 'NON_RESIDENT', 'CORPORATE_LINKED'] },
  { key: 'acceptableGapReasons', domain: 'REF', label: 'Acceptable explained-gap reasons', type: 'list', segmented: false, basis: '[D]', default: ['UNPAID_LEAVE', 'DELAYED_PAYROLL', 'MATERNITY', 'JOB_CHANGE_LE_60_DAYS'] },
  // ---------------------------------------------------------------- DATA generator
  { key: 'dataCustomers', domain: 'DATA', label: 'Customers in the synthetic base', type: 'number', segmented: false, basis: '[D]', default: 2400 },
  { key: 'dataEligibleRate', domain: 'DATA', label: 'Eligible rate the generator targets', type: 'number', segmented: false, unit: '%', basis: '[Q] 35%', default: 35 },
  { key: 'dataQatariPct', domain: 'DATA', label: 'Qatari nationals', type: 'number', segmented: false, unit: '%', basis: '[D]', default: 30 },
  { key: 'dataSegmentMix', domain: 'DATA', label: 'Segment mix VVIP / HNWI / High Value / Mass', type: 'list', segmented: false, unit: '%', basis: '[D]', default: ['1', '4', '15', '80'] },
  { key: 'dataReasonWeights', domain: 'DATA', label: 'Reason weights by rank (R01 … R20)', type: 'list', segmented: false, basis: '[D] decaying by QIB rank', default: ['22', '15', '11', '8', '6', '5.5', '5', '4.5', '4', '3.5', '3', '2.5', '2.2', '2', '1.6', '1.3', '1', '0.8', '0.6', '0.5'] },
  { key: 'dataMarketingConsentPct', domain: 'DATA', label: 'Customers with marketing consent', type: 'number', segmented: false, unit: '%', basis: '[D]', default: 72 },
  { key: 'dataSeed', domain: 'DATA', label: 'Generator seed', type: 'number', segmented: false, basis: '[D] deterministic', default: 20261007 },
];

export const PARAM = Object.fromEntries(PARAMS.map((p) => [p.key, p])) as Record<string, ParamDef>;

export type PolicyClause = { id: string; domain: Domain; heading: string; heading_ar: string; text: string; text_ar: string; basis: string; tags: string[] };

export const CLAUSES: PolicyClause[] = [
  { id: 'POL-01 §1.1', domain: 'POL-01', heading: 'Service messages are not marketing', heading_ar: 'رسائل الخدمة ليست تسويقاً', basis: 'CRA Spam Regulation art. 6; ICO guidance (inferred)', tags: ['service', 'marketing', 'consent'],
    text: 'A message that asks a customer to update data the bank must hold, or informs them of a restriction, is a service message and may be sent without marketing consent through one neutral channel. A message that offers a product is marketing and requires consent.',
    text_ar: 'الرسالة التي تطلب من العميل تحديث بيانات يجب على المصرف الاحتفاظ بها هي رسالة خدمة ويمكن إرسالها دون موافقة تسويقية عبر قناة واحدة محايدة. أما الرسالة التي تعرض منتجاً فهي تسويق وتتطلب موافقة.' },
  { id: 'POL-01 §2.1', domain: 'POL-01', heading: 'Contact windows', heading_ar: 'نوافذ التواصل', basis: 'CRA Qatar: no direct marketing 21:00–09:00; CBUAE collections 09:00–20:00', tags: ['window', 'hours', 'quiet'],
    text: 'No service message is sent outside the segment\'s window or inside a quiet period. A message that falls into one is rescheduled to the next open window, and the rescheduling is logged.',
    text_ar: 'لا تُرسل أي رسالة خدمة خارج نافذة الشريحة أو خلال فترة هدوء. تُعاد جدولة الرسالة إلى أقرب نافذة مفتوحة ويُسجل ذلك.' },
  { id: 'POL-01 §2.2', domain: 'POL-01', heading: 'Call windows', heading_ar: 'نوافذ الاتصال', basis: 'UAE marketing-call window 09:00–18:00 (analogue)', tags: ['call', 'hours'],
    text: 'Calls, including the RM\'s, are made inside the call window only. A call that carries an offer is marketing and follows the stricter window.', text_ar: 'تُجرى المكالمات، بما فيها مكالمات مدير العلاقة، ضمن نافذة الاتصال فقط.' },
  { id: 'POL-01 §3.1', domain: 'POL-01', heading: 'Contact caps', heading_ar: 'حدود التواصل', basis: 'SAMA ≤ 10 attempts/30 days; ACCC/ASIC 3/week; Reg F 7-in-7 upper bound', tags: ['cap', 'frequency', 'attempts'],
    text: 'A customer receives at most the segment\'s number of contacts per day, per week and per thirty days across all channels and all cases. The guard counts collections reminders in the daily cap.',
    text_ar: 'يتلقى العميل كحد أقصى عدد الاتصالات المحدد لشريحته يومياً وأسبوعياً وكل ثلاثين يوماً عبر جميع القنوات وجميع الحالات.' },
  { id: 'POL-01 §3.2', domain: 'POL-01', heading: 'Channel order', heading_ar: 'ترتيب القنوات', basis: 'CBUAE approved methods; design default', tags: ['channel', 'order'],
    text: 'Each attempt uses one channel, the next in the segment\'s order. A channel the customer opted out of is skipped. The call is the human step and is never an automated attempt.',
    text_ar: 'تستخدم كل محاولة قناة واحدة بحسب ترتيب الشريحة. تُتجاوز القناة التي انسحب منها العميل. المكالمة خطوة بشرية وليست محاولة آلية.' },
  { id: 'POL-01 §3.3', domain: 'POL-01', heading: 'One channel per attempt', heading_ar: 'قناة واحدة لكل محاولة', basis: 'design default', tags: ['attempt'],
    text: 'The second attempt uses the second channel in the order, the third the third; when the order is exhausted the case escalates to a person.', text_ar: 'تستخدم المحاولة الثانية القناة الثانية وهكذا؛ وعند استنفاد الترتيب تُصعّد الحالة إلى شخص.' },
  { id: 'POL-01 §4.1', domain: 'POL-01', heading: 'Pre-expiry watch', heading_ar: 'متابعة ما قبل الانتهاء', basis: 'CBUAE 90-day written-notice period (analogue)', tags: ['expiry', 'watch', 'notice'],
    text: 'A document expiring inside the watch window opens a watch case. The watch is a trigger, not a fall-out: the customer is still eligible until the document expires.', text_ar: 'تفتح الوثيقة التي تنتهي ضمن نافذة المتابعة حالة متابعة. المتابعة محفز وليست سبب استبعاد.' },
  { id: 'POL-01 §4.2', domain: 'POL-01', heading: 'Post-fall-out notices', heading_ar: 'إشعارات ما بعد الاستبعاد', basis: 'RBI ≥ 3 notices before and after (analogue)', tags: ['notice', 'reminder'],
    text: 'After a fall-out the segment\'s number of automated notices go out at the configured intervals. Nothing further is sent automatically once they are exhausted.', text_ar: 'بعد الاستبعاد تُرسل الإشعارات الآلية المحددة للشريحة على الفترات المضبوطة، ولا يُرسل شيء آلياً بعد استنفادها.' },
  { id: 'POL-01 §5.1', domain: 'POL-01', heading: 'A person steps in', heading_ar: 'تدخل شخص', basis: 'CBUAE AI guidance note: human out of the loop only for low-risk steps', tags: ['escalation', 'human'],
    text: 'When the segment\'s number of notices go unanswered, the case escalates to a person: a contact-centre call task for Mass and High Value, the RM for HNWI and VVIP.', text_ar: 'عند عدم الرد على عدد الإشعارات المحدد للشريحة تُصعّد الحالة إلى شخص.' },
  { id: 'POL-01 §6.1', domain: 'POL-01', heading: 'RM-first segments', heading_ar: 'الشرائح التي يبدأ فيها مدير العلاقة', basis: 'private-banking service model (design default)', tags: ['rm', 'hnwi', 'vvip'],
    text: 'For an RM-first segment no automated message leaves without the relationship manager. Jahiz drafts; the RM approves or sends.', text_ar: 'في الشرائح التي يبدأ فيها مدير العلاقة لا تُرسل أي رسالة آلية دونه. يصوغ جاهز ويعتمد مدير العلاقة أو يرسل.' },
  { id: 'POL-02 §1.1', domain: 'POL-02', heading: 'Pre-expiry notices', heading_ar: 'إشعارات ما قبل الانتهاء', basis: 'design default', tags: ['expiry', 'notice'],
    text: 'Pre-expiry notices go at the configured days before expiry, through the segment\'s first channel, asking for the renewed document when it is available.', text_ar: 'تُرسل إشعارات ما قبل الانتهاء في الأيام المحددة قبل الانتهاء.' },
  { id: 'POL-02 §1.2', domain: 'POL-02', heading: 'Post-expiry notices', heading_ar: 'إشعارات ما بعد الانتهاء', basis: 'RBI (analogue)', tags: ['expiry', 'notice'],
    text: 'Post-expiry notices go at the configured days after expiry. Each names the document, the consequence, the channels to upload and the opt-out.', text_ar: 'تُرسل إشعارات ما بعد الانتهاء في الأيام المحددة بعد الانتهاء.' },
  { id: 'POL-02 §2.1', domain: 'POL-02', heading: 'Document channels and assurance', heading_ar: 'قنوات الوثائق ومستوى الثقة', basis: 'GPG 45 / EBA remote onboarding', tags: ['document', 'upload', 'assurance'],
    text: 'An in-app capture carries the highest assurance, then an RM-collected scan, then an e-mailed attachment. E-mailed evidence always needs a checker.', text_ar: 'يحمل التقاط التطبيق أعلى مستوى ثقة، ثم المسح الذي يجمعه مدير العلاقة، ثم المرفق البريدي.' },
  { id: 'POL-02 §3.1', domain: 'POL-02', heading: 'Document age', heading_ar: 'عمر الوثيقة', basis: 'design default', tags: ['document', 'age'],
    text: 'A salary certificate older than the configured age, or a bank statement older than its limit, is rejected with the reason and re-requested.', text_ar: 'تُرفض شهادة الراتب أو كشف الحساب الأقدم من الحد المضبوط مع بيان السبب.' },
  { id: 'POL-02 §4.3', domain: 'POL-02', heading: 'Restrictions are proposals', heading_ar: 'القيود مقترحات', basis: 'CBUAE 6.2.1.5; SAMA 30-day notice (analogues)', tags: ['restriction', 'block', 'approval'],
    text: 'A restriction is a proposal to the approver named for the segment; Jahiz never restricts an account on its own authority. The proposal names the notices sent and the date of each.', text_ar: 'القيد مقترح يُرفع إلى المعتمد المحدد للشريحة؛ لا يقيّد جاهز أي حساب من تلقاء نفسه.' },
  { id: 'POL-02 §4.4', domain: 'POL-02', heading: 'Hard restriction', heading_ar: 'القيد الكامل', basis: 'RBI partial-then-full freeze (analogue)', tags: ['restriction'],
    text: 'A hard restriction follows only after a further notice period and a second approval.', text_ar: 'لا يُطبق القيد الكامل إلا بعد فترة إشعار إضافية واعتماد ثانٍ.' },
  { id: 'POL-02 §5.1', domain: 'POL-02', heading: 'Renewal in progress', heading_ar: 'تجديد قيد الإجراء', basis: 'Qatari bank practice', tags: ['extension'],
    text: 'A customer who shows renewal in progress receives the configured extension before any restriction is proposed.', text_ar: 'يحصل العميل الذي يثبت أن التجديد قيد الإجراء على التمديد المضبوط قبل اقتراح أي قيد.' },
  { id: 'POL-03 §1.1', domain: 'POL-03', heading: 'Salary window', heading_ar: 'نافذة الراتب', basis: 'QIB reason wording', tags: ['salary', 'window'],
    text: 'The salary history examined is the configured number of calendar months before the scan date.', text_ar: 'تُفحص الأشهر المضبوطة من تاريخ الراتب قبل تاريخ الفحص.' },
  { id: 'POL-03 §1.2', domain: 'POL-03', heading: 'Low salary', heading_ar: 'الراتب المنخفض', basis: 'design default', tags: ['salary', 'low'],
    text: 'A month is low when its salary credit is below the configured share of the trailing median; a month with no salary credit is missing.', text_ar: 'يُعد الشهر منخفضاً عندما يقل راتبه عن النسبة المضبوطة من الوسيط؛ والشهر بلا راتب مفقود.' },
  { id: 'POL-03 §2.1', domain: 'POL-03', heading: 'Explained gaps', heading_ar: 'الفجوات المبررة', basis: 'design default — a credit decision, so approval-gated', tags: ['gap', 'explained', 'approval'],
    text: 'A documented gap for an acceptable reason may be accepted by the approver named for the segment; the month is then annotated and the eligibility check treats it as served.', text_ar: 'يمكن للمعتمد قبول الفجوة الموثقة لسبب مقبول؛ ويُعلّم الشهر عندها ويُعامل كمستوفٍ.' },
  { id: 'POL-03 §3.1', domain: 'POL-03', heading: 'Salary transfer offer', heading_ar: 'عرض تحويل الراتب', basis: 'PDPPL art. 22', tags: ['salary', 'transfer', 'offer', 'consent'],
    text: 'When the reply shows the salary is paid elsewhere, the salary-transfer offer goes as a separate message only where marketing consent exists; otherwise it becomes an RM or branch task.', text_ar: 'عند تبيّن أن الراتب يُدفع في مصرف آخر يُرسل عرض تحويل الراتب برسالة منفصلة فقط عند وجود موافقة تسويقية.' },
  { id: 'POL-03 §4.1', domain: 'POL-03', heading: 'Standing orders counted', heading_ar: 'أوامر الدفع المحتسبة', basis: 'assumption to confirm with QIB', tags: ['standing', 'orders'],
    text: 'Only recurring standing orders to financial institutions count as obligations. The customer\'s classification, once a checker approves it, changes the count.', text_ar: 'تُحتسب فقط أوامر الدفع الدائمة إلى المؤسسات المالية كالتزامات.' },
  { id: 'POL-03 §4.2', domain: 'POL-03', heading: 'Standing-order limit', heading_ar: 'حد أوامر الدفع', basis: 'design default', tags: ['standing', 'limit'],
    text: 'Counted standing orders above the configured share of salary raise reason R04. R04 is evaluated before R03: if removing the counted orders restores capacity, the reason is R04.', text_ar: 'تثير أوامر الدفع المحتسبة التي تتجاوز النسبة المضبوطة من الراتب السبب R04.' },
  { id: 'POL-03 §5.1', domain: 'POL-03', heading: 'Employer approval criteria', heading_ar: 'معايير اعتماد جهة العمل', basis: '2013 practice; QIB@work targeting; thresholds design default', tags: ['employer', 'approval'],
    text: 'An employer may be approved when its commercial registration is valid, WPS is active, the sector is not restricted, and it meets the headcount or QIB-salaried-staff minimum and the months of operation. Credit Policy decides.', text_ar: 'يمكن اعتماد جهة العمل عند صلاحية السجل التجاري وتفعيل نظام حماية الأجور واستيفاء الحد الأدنى من الموظفين. تقرر سياسة الائتمان.' },
  { id: 'POL-03 §5.2', domain: 'POL-03', heading: 'Employer review SLA', heading_ar: 'مهلة مراجعة جهة العمل', basis: 'design default', tags: ['employer', 'sla'],
    text: 'An employer review is decided inside the configured SLA; the customers waiting on it are told nothing until the decision.', text_ar: 'تُقرر مراجعة جهة العمل ضمن المهلة المضبوطة.' },
  { id: 'POL-04 §1.1', domain: 'POL-04', heading: 'Caps', heading_ar: 'الحدود القصوى', basis: 'QCB April 2011 directive (via QIB and other bank pages)', tags: ['cap', 'qcb'],
    text: 'Total repayable, including profit, may not exceed the cap for the customer\'s nationality group.', text_ar: 'لا يجوز أن يتجاوز إجمالي المبلغ المستحق السداد بما فيه الربح الحد الأقصى لفئة جنسية العميل.' },
  { id: 'POL-04 §1.2', domain: 'POL-04', heading: 'Tenor', heading_ar: 'المدة', basis: 'QCB 2011', tags: ['tenor'],
    text: 'The tenor is the lesser of the maximum for the nationality group and the months to the age limit.', text_ar: 'المدة هي الأقل بين الحد الأقصى لفئة الجنسية والأشهر المتبقية حتى حد العمر.' },
  { id: 'POL-04 §1.3', domain: 'POL-04', heading: 'Minimum tenor', heading_ar: 'الحد الأدنى للمدة', basis: 'design default', tags: ['tenor', 'age'],
    text: 'A customer whose months to the age limit are below the minimum tenor fails the age criteria.', text_ar: 'يخفق العميل الذي تقل أشهره المتبقية حتى حد العمر عن الحد الأدنى للمدة في شرط العمر.' },
  { id: 'POL-04 §2.1', domain: 'POL-04', heading: 'Debt burden ratio', heading_ar: 'نسبة عبء الدين', basis: 'QCB 75% / 50%; base wording as stated on QIB and Ahlibank pages (UNVERIFIED against the QCB text)', tags: ['dbr', 'instalment'],
    text: 'Monthly obligations, including the new instalment, may not exceed the configured share of the DBR base: basic salary plus social allowance for Qataris, total salary for residents.', text_ar: 'لا يجوز أن تتجاوز الالتزامات الشهرية بما فيها القسط الجديد النسبة المضبوطة من الأساس.' },
  { id: 'POL-04 §2.2', domain: 'POL-04', heading: 'Card minimum payments', heading_ar: 'الحد الأدنى لسداد البطاقات', basis: 'design default', tags: ['card', 'obligation'],
    text: 'The configured share of card outstanding counts as a monthly obligation.', text_ar: 'تُحتسب النسبة المضبوطة من رصيد البطاقة التزاماً شهرياً.' },
  { id: 'POL-04 §3.1', domain: 'POL-04', heading: 'Age', heading_ar: 'العمر', basis: 'QIB page: Qataris 18–65, residents 21–60', tags: ['age'],
    text: 'The customer must be at least the minimum age and must reach the age limit no earlier than the maturity of the minimum tenor.', text_ar: 'يجب ألا يقل عمر العميل عن الحد الأدنى وألا يبلغ حد العمر قبل استحقاق الحد الأدنى للمدة.' },
  { id: 'POL-04 §4.1', domain: 'POL-04', heading: 'Minimum eligible amount', heading_ar: 'الحد الأدنى للمبلغ المؤهل', basis: 'QIB: QAR 5,000', tags: ['minimum', 'amount'],
    text: 'An eligible amount below the minimum is reason R12.', text_ar: 'المبلغ المؤهل الذي يقل عن الحد الأدنى هو السبب R12.' },
  { id: 'POL-04 §4.2', domain: 'POL-04', heading: 'How the amount is computed', heading_ar: 'كيفية احتساب المبلغ', basis: 'design', tags: ['amount', 'annuity'],
    text: 'Capacity and cap are compared on one basis — principal — through the annuity factor at the indicative rate over the tenor. The lower of the two is the eligible amount, rounded down to the nearest 500.', text_ar: 'تُقارن القدرة والحد الأقصى على أساس واحد هو أصل المبلغ عبر معامل الأقساط. المبلغ المؤهل هو الأقل منهما.' },
  { id: 'POL-04 §5.1', domain: 'POL-04', heading: 'Requirements', heading_ar: 'المتطلبات', basis: 'QIB page; QIB brief', tags: ['requirements', 'current account', 'employer', 'documents'],
    text: 'The customer needs salary credited to QIB, an approved employer, a current account, a valid QID and — for residents — a valid passport.', text_ar: 'يحتاج العميل إلى تحويل الراتب إلى المصرف وجهة عمل معتمدة وحساب جارٍ وبطاقة شخصية سارية وجواز سفر سارٍ للمقيمين.' },
  { id: 'POL-04 §6.1', domain: 'POL-04', heading: 'Model cut-off', heading_ar: 'حد النموذج', basis: 'QIB; opaque to Jahiz', tags: ['model', 'score'],
    text: 'The bank\'s model score is an input Jahiz does not compute. Below the cut-off the customer is reason R09 and no outreach is made.', text_ar: 'درجة نموذج المصرف مدخل لا يحتسبه جاهز. دون الحد يكون العميل السبب R09 ولا يُتواصل معه.' },
  { id: 'POL-04 §6.2', domain: 'POL-04', heading: 'Rating', heading_ar: 'التصنيف', basis: 'assumption', tags: ['rating'], text: 'An internal rating below the threshold is reason R19.', text_ar: 'التصنيف الداخلي دون الحد هو السبب R19.' },
  { id: 'POL-04 §6.3', domain: 'POL-04', heading: 'Auto Ijara cut-off', heading_ar: 'حد إجارة السيارات', basis: 'assumption: per-product exclusion', tags: ['ijara', 'vehicle'],
    text: 'The Auto Ijara cut-off excludes the vehicle-finance offer only. A customer failing only R20 remains eligible for personal finance.', text_ar: 'يستبعد حد إجارة السيارات عرض تمويل المركبات فقط.' },
  { id: 'POL-04 §7.1', domain: 'POL-04', heading: 'Exposure messages', heading_ar: 'رسائل التعرض', basis: 'design default', tags: ['exposure'],
    text: 'A customer whose only reason is exposure is not contacted unless the exposure message is switched on.', text_ar: 'لا يُتواصل مع العميل الذي سببه الوحيد هو التعرض ما لم تُفعّل رسالة التعرض.' },
  { id: 'POL-05 §1.1', domain: 'POL-05', heading: 'Offer suppression', heading_ar: 'حجب العروض', basis: 'FCA CONC 6.7.7R; CBUAE 7.1.2.3 (analogues)', tags: ['suppress', 'offer', 'dpd'],
    text: 'No offer is sent to a customer with days past due on any facility, a returned cheque inside the lookback, irregular payments, an open hardship or complaint, a marketing opt-out, an active cautionary note or a do-not-contact flag.', text_ar: 'لا يُرسل أي عرض إلى عميل عليه متأخرات أو شيك مرتجع ضمن فترة المراجعة أو مدفوعات غير منتظمة أو شكوى مفتوحة أو انسحاب تسويقي أو ملاحظة تحذيرية أو علامة عدم الاتصال.' },
  { id: 'POL-05 §1.2', domain: 'POL-05', heading: 'Returned cheques', heading_ar: 'الشيكات المرتجعة', basis: 'Qatar Credit Bureau: 3 years from settlement', tags: ['cheque'],
    text: 'A returned cheque suppresses offers for the configured lookback from its settlement; an unsettled cheque suppresses indefinitely.', text_ar: 'يحجب الشيك المرتجع العروض طوال فترة المراجعة المضبوطة من تاريخ تسويته.' },
  { id: 'POL-05 §1.3', domain: 'POL-05', heading: 'Irregular payments', heading_ar: 'المدفوعات غير المنتظمة', basis: 'design default', tags: ['irregular'],
    text: 'Late instalments at or above the threshold in six months, or a restructured schedule, are reason R14 until six regular months have passed.', text_ar: 'الأقساط المتأخرة عند الحد أو فوقه خلال ستة أشهر هي السبب R14 حتى تمر ستة أشهر منتظمة.' },
  { id: 'POL-05 §2.1', domain: 'POL-05', heading: 'Early-arrears reminders', heading_ar: 'تذكيرات المتأخرات المبكرة', basis: 'Fair4All Finance cadence; FCA TR16/10 tone', tags: ['arrears', 'reminder', 'dpd'],
    text: 'Early-arrears reminders go only inside the DPD limit, at the configured days, one action per day, in neutral wording, through push or e-mail then a call task then a letter.', text_ar: 'تُرسل تذكيرات المتأخرات المبكرة ضمن حد أيام التأخر فقط وفي الأيام المضبوطة بإجراء واحد يومياً وبصياغة محايدة.' },
  { id: 'POL-05 §2.2', domain: 'POL-05', heading: 'Collections hand-off', heading_ar: 'التسليم إلى التحصيل', basis: 'design default', tags: ['collections', 'handoff'],
    text: 'At the configured DPD the case is handed to Collections and Jahiz sends nothing further.', text_ar: 'عند أيام التأخر المضبوطة تُسلّم الحالة إلى التحصيل ولا يرسل جاهز شيئاً بعدها.' },
  { id: 'POL-05 §3.1', domain: 'POL-05', heading: 'Cooling period', heading_ar: 'فترة التهدئة', basis: 'design default', tags: ['cooling'],
    text: 'After a DPD cure the customer is re-qualified only when the cooling period has passed without a new arrear.', text_ar: 'بعد تسوية المتأخرات لا يُعاد تأهيل العميل إلا بعد انقضاء فترة التهدئة دون متأخرات جديدة.' },
  { id: 'POL-05 §4.1', domain: 'POL-05', heading: 'Hardship and complaints', heading_ar: 'العسر والشكاوى', basis: 'FCA CONC 7.3 forbearance (analogue)', tags: ['hardship', 'complaint', 'pause'],
    text: 'A reply classed as hardship, complaint or dispute pauses every automated message to that customer; a person takes the case within the configured working days; only an acknowledgement is sent.', text_ar: 'يوقف الرد المصنّف عسراً أو شكوى أو نزاعاً كل الرسائل الآلية للعميل ويتولى شخص الحالة ضمن أيام العمل المضبوطة.' },
  { id: 'POL-05 §5.1', domain: 'POL-05', heading: 'Cautionary notes', heading_ar: 'الملاحظات التحذيرية', basis: 'design default', tags: ['note', 'compliance'],
    text: 'Every cautionary note goes to the Compliance queue. No customer contact is made until Compliance clears it or reclassifies a remediable note to its workflow.', text_ar: 'تُحال كل ملاحظة تحذيرية إلى قائمة الامتثال ولا يُتواصل مع العميل حتى يصفّيها الامتثال أو يعيد تصنيفها.' },
  { id: 'POL-06 §1.1', domain: 'POL-06', heading: 'Maker-checker', heading_ar: 'الصانع والمراجع', basis: 'BCBS operational-risk principles: dual control', tags: ['maker', 'checker', 'approval', 'update'],
    text: 'No field on a customer record changes without a second person\'s approval; the agent is the maker. The proposal shows the evidence, the before and the after.', text_ar: 'لا يتغير أي حقل في سجل العميل دون اعتماد شخص ثانٍ؛ الوكيل هو الصانع.' },
  { id: 'POL-06 §1.2', domain: 'POL-06', heading: 'No auto-approval', heading_ar: 'لا اعتماد آلي', basis: 'v1 decision', tags: ['auto'],
    text: 'Auto-approval of record writes is off in this version. Confidence only changes the checker\'s view: at or above the threshold the proposal is a one-click review, below it a full comparison.', text_ar: 'الاعتماد الآلي للكتابة في السجل معطّل في هذا الإصدار.' },
  { id: 'POL-06 §1.3', domain: 'POL-06', heading: 'Confidence and the review', heading_ar: 'الثقة والمراجعة', basis: 'vendor HITL guidance', tags: ['confidence'],
    text: 'Extraction confidence is recorded per field. The checker sees the fields below the threshold highlighted.', text_ar: 'تُسجل ثقة الاستخراج لكل حقل وتُبرز الحقول دون الحد للمراجع.' },
  { id: 'POL-06 §2.1', domain: 'POL-06', heading: 'Random audit', heading_ar: 'التدقيق العشوائي', basis: 'vendor practice', tags: ['audit'],
    text: 'The configured share of approved updates is re-reviewed by a second supervisor.', text_ar: 'يُعاد فحص النسبة المضبوطة من التحديثات المعتمدة من قبل مشرف ثانٍ.' },
  { id: 'POL-06 §3.1', domain: 'POL-06', heading: 'Name match', heading_ar: 'مطابقة الاسم', basis: 'design default', tags: ['name', 'mismatch'],
    text: 'Names are compared after normalisation with the configured token tolerance. A mismatch is a flag; a document that belongs to a different person is rejected and noted to Compliance.', text_ar: 'تُقارن الأسماء بعد التطبيع. الوثيقة التي تعود لشخص آخر تُرفض وتُبلّغ إلى الامتثال.' },
  { id: 'POL-06 §3.2', domain: 'POL-06', heading: 'MRZ check digits', heading_ar: 'أرقام التحقق', basis: 'ICAO 9303', tags: ['mrz', 'passport'],
    text: 'A passport\'s machine-readable zone must verify (document number, date of birth, expiry, composite).', text_ar: 'يجب التحقق من منطقة القراءة الآلية في جواز السفر.' },
  { id: 'POL-07 §1.1', domain: 'POL-07', heading: 'Service messages and consent', heading_ar: 'رسائل الخدمة والموافقة', basis: 'CRA existing-relationship presumption; ICO (inferred; confirm under the NCSA guideline)', tags: ['consent', 'service'],
    text: 'Service messages may be sent without marketing consent through one neutral channel.', text_ar: 'يمكن إرسال رسائل الخدمة دون موافقة تسويقية عبر قناة محايدة واحدة.' },
  { id: 'POL-07 §2.1', domain: 'POL-07', heading: 'Marketing consent', heading_ar: 'الموافقة التسويقية', basis: 'PDPPL art. 22', tags: ['consent', 'offer'],
    text: 'Any offer — the One Click offer, a current account, a salary transfer, a consolidation — requires marketing consent on the record.', text_ar: 'يتطلب أي عرض موافقة تسويقية مسجلة.' },
  { id: 'POL-07 §3.1', domain: 'POL-07', heading: 'Opt-out timing', heading_ar: 'توقيت الانسحاب', basis: 'CRA art. 6(3): two business days', tags: ['optout'],
    text: 'An opt-out takes effect within the configured business days; a queued offer to that customer is blocked immediately.', text_ar: 'يسري الانسحاب خلال أيام العمل المضبوطة ويُحجب أي عرض مُجدول فوراً.' },
  { id: 'POL-07 §3.2', domain: 'POL-07', heading: 'The three lists', heading_ar: 'القوائم الثلاث', basis: 'Reg F cease-communication; CBUAE opt-out default (analogues)', tags: ['dnc', 'optout', 'lists'],
    text: 'Do-not-contact blocks every outbound contact except the one regulatory letter before a restriction. A marketing opt-out blocks offers only. A channel opt-out blocks that channel only; the next permitted channel is used.', text_ar: 'يحجب عدم الاتصال كل تواصل صادر باستثناء الخطاب التنظيمي قبل القيد. يحجب الانسحاب التسويقي العروض فقط. يحجب انسحاب القناة تلك القناة فقط.' },
  { id: 'POL-07 §4.1', domain: 'POL-07', heading: 'Message elements', heading_ar: 'عناصر الرسالة', basis: 'CRA art. 6(4)', tags: ['sender', 'identity'],
    text: 'Every message carries the sender identity in Arabic and English, its purpose, the opt-out instruction and the case reference.', text_ar: 'تحمل كل رسالة هوية المرسل بالعربية والإنجليزية والغرض وتعليمات الانسحاب ومرجع الحالة.' },
  { id: 'POL-08 §1.1', domain: 'POL-08', heading: 'The ladder', heading_ar: 'سلّم التصعيد', basis: 'design default', tags: ['escalation', 'sla'],
    text: 'Agent → Operations Officer → Operations Supervisor → Relationship Manager → Head of Retail Credit, each inside its SLA.', text_ar: 'الوكيل ثم موظف العمليات ثم مشرف العمليات ثم مدير العلاقة ثم رئيس الائتمان، كلٌّ ضمن مهلته.' },
  { id: 'POL-09 §1.1', domain: 'POL-09', heading: 'Friday window', heading_ar: 'نافذة الجمعة', basis: 'design default — UNVERIFIED', tags: ['friday', 'quiet'],
    text: 'No message or call between the Friday quiet start and end.', text_ar: 'لا رسالة ولا مكالمة بين بداية نافذة هدوء الجمعة ونهايتها.' },
  { id: 'POL-09 §1.2', domain: 'POL-09', heading: 'Public holidays and Eid', heading_ar: 'العطل الرسمية والأعياد', basis: 'ASIC; CBUAE draft (analogues)', tags: ['holiday', 'eid'],
    text: 'No contact on public holidays or Eid.', text_ar: 'لا تواصل في العطل الرسمية أو الأعياد.' },
  { id: 'POL-09 §1.3', domain: 'POL-09', heading: 'Weekend', heading_ar: 'عطلة الأسبوع', basis: 'design default', tags: ['weekend'],
    text: 'Automated service messages may go on weekend days inside the window; calls and letters do not.', text_ar: 'يجوز إرسال رسائل الخدمة الآلية في عطلة الأسبوع ضمن النافذة؛ أما المكالمات والخطابات فلا.' },
  { id: 'POL-09 §2.1', domain: 'POL-09', heading: 'Ramadan', heading_ar: 'رمضان', basis: 'design default — UNVERIFIED', tags: ['ramadan'],
    text: 'During Ramadan the window narrows to the configured hours and nothing goes within an hour of iftar.', text_ar: 'خلال رمضان تضيق النافذة إلى الساعات المضبوطة ولا يُرسل شيء قبل الإفطار أو بعده بساعة.' },
  { id: 'POL-10 §1.1', domain: 'POL-10', heading: 'Outreach retention', heading_ar: 'الاحتفاظ بسجلات التواصل', basis: 'CBUAE analogue 5 years', tags: ['retention'],
    text: 'Outreach records are kept for the configured years after the case closes.', text_ar: 'تُحفظ سجلات التواصل للسنوات المضبوطة بعد إغلاق الحالة.' },
  { id: 'POL-10 §1.2', domain: 'POL-10', heading: 'KYC retention', heading_ar: 'الاحتفاظ بوثائق اعرف عميلك', basis: 'Qatar AML Law 20/2019', tags: ['retention', 'kyc'],
    text: 'Identity documents are kept for the configured years. The trail is append-only.', text_ar: 'تُحفظ وثائق الهوية للسنوات المضبوطة. سجل التدقيق لا يُحذف منه.' },
];

/** The engine's view of the active policy: `get(key, segment)`. */
export class Policy {
  constructor(private params: PolicyParams, public version: number = 1) {}
  get<T extends ParamValue = ParamValue>(key: string, segment?: Segment): T {
    const v = this.params[key];
    const def = PARAM[key];
    if (v === undefined) {
      if (!def) throw new Error(`Unknown policy parameter ${key}`);
      return (def.segmented ? (def.default as Record<Segment, ParamValue>)[segment ?? 'MASS'] : def.default) as T;
    }
    if (def?.segmented && typeof v === 'object' && !Array.isArray(v)) return ((v as Record<Segment, ParamValue>)[segment ?? 'MASS'] ?? (def.default as Record<Segment, ParamValue>)[segment ?? 'MASS']) as T;
    return v as T;
  }
  num(key: string, segment?: Segment): number { return Number(this.get(key, segment)); }
  bool(key: string, segment?: Segment): boolean { return Boolean(this.get(key, segment)); }
  str(key: string, segment?: Segment): string { return String(this.get(key, segment)); }
  list(key: string, segment?: Segment): string[] { const v = this.get(key, segment); return Array.isArray(v) ? v.map(String) : String(v).split(',').map((s) => s.trim()).filter(Boolean); }
  nums(key: string, segment?: Segment): number[] { return this.list(key, segment).map(Number); }
  raw(): PolicyParams { return this.params; }
}

/** The defaults as a PolicyParams object (what the seed writes). */
export function defaultParams(): PolicyParams {
  const out: PolicyParams = {};
  for (const p of PARAMS) out[p.key] = p.default as any;
  return out;
}

export const DEFAULT_POLICY = new Policy(defaultParams(), 1);
