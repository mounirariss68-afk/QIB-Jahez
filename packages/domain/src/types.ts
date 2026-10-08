/**
 * Shared types for Jahiz — the agentic readiness and remediation layer for
 * QIB's One Click Finance pre-approval. Pure data: no I/O here.
 */

export type Segment = 'VVIP' | 'HNWI' | 'HIGH_VALUE' | 'MASS';
export const SEGMENTS: Segment[] = ['VVIP', 'HNWI', 'HIGH_VALUE', 'MASS'];
export const SEGMENT_LABEL: Record<Segment, string> = { VVIP: 'VVIP', HNWI: 'HNWI', HIGH_VALUE: 'High Value', MASS: 'Mass' };
export const SEGMENT_TIER: Record<Segment, string> = { VVIP: 'Private Banking', HNWI: 'Tamayuz', HIGH_VALUE: 'Affluent', MASS: 'Essential' };

/** The twenty fall-out reasons, in QIB's rank order (R01 = most frequent). */
export type ReasonCode =
  | 'R01' | 'R02' | 'R03' | 'R04' | 'R05' | 'R06' | 'R07' | 'R08' | 'R09' | 'R10'
  | 'R11' | 'R12' | 'R13' | 'R14' | 'R15' | 'R16' | 'R17' | 'R18' | 'R19' | 'R20';

/** A = ask the customer · B = the bank must act · C = not eligible by policy · D = collections boundary */
export type CaseClass = 'A' | 'B' | 'C' | 'D';

export type CustomerStatus = 'NORMAL' | 'DORMANT' | 'BLOCKED_KYC' | 'BLOCKED_SALARY' | 'BLOCKED_DELINQ' | 'FROZEN_COURT' | 'FROZEN_SANCTIONS' | 'DECEASED' | 'CLOSED';
export type NoteType = 'KYC_EXPIRED' | 'SALARY_STOPPED' | 'COURT_ATTACHMENT' | 'SANCTIONS' | 'FRAUD_AML' | 'LEGAL_HOLD' | 'DECEASED';
export type EmployerStatus = 'APPROVED' | 'UNAPPROVED' | 'UNDER_REVIEW' | 'RESTRICTED';
export type Channel = 'PUSH' | 'INAPP' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'CALL' | 'LETTER' | 'RM';
export type DocType = 'QID' | 'PASSPORT' | 'SALARY_CERT' | 'HR_LETTER' | 'LIABILITY_LETTER' | 'BANK_STATEMENT' | 'SO_DECLARATION';

/** Everything `qualify` needs about one customer, as the core schema holds it. */
export type CustomerFacts = {
  id: string;
  isQatari: boolean;
  dob: string;                 // YYYY-MM-DD
  nationality: string;         // ISO alpha-3
  segment: Segment;
  status: CustomerStatus;
  segmentTag: string | null;   // e.g. STAFF, MINOR, NON_RESIDENT (ineligible segments) or null
  basic: number; allowances: number; socialAllowance: number; salaryTotal: number;
  salaryCredits: { month: string; amount: number }[]; // last 12 months, YYYY-MM
  employerId: string | null; employerStatus: EmployerStatus | null;
  qidExpiry: string | null; passportExpiry: string | null;
  hasCurrentAccount: boolean;
  facilities: { product: 'PERSONAL' | 'AUTO_IJARA' | 'HOME'; instalment: number; outstanding: number; repayable: number; dpd: number; late6m: number; irregular: boolean }[];
  cards: { limit: number; outstanding: number; dpd: number }[];
  standingOrders: { type: 'FI' | 'SCHOOL' | 'FAMILY' | 'RENT' | 'OTHER'; amount: number; classified: string | null }[];
  returnedCheques: { returnedOn: string; settledOn: string | null }[];
  notes: { type: NoteType; lifted: boolean }[];
  modelScore: number; rating: string; autoIjaraScore: number;
  explainedGaps: string[];     // months (YYYY-MM) with an accepted explanation
};

export type Eligibility = {
  eligible: boolean;
  eligibleVehicle: boolean;
  amount: number;              // QAR, principal, rounded to 500
  reasons: ReasonCode[];
  cls: CaseClass | null;       // null when eligible
  inputs: {
    dbrBase: number; dbrPct: number; obligations: number; capacity: number; monthsToAgeLimit: number; tenor: number;
    cap: number; exposure: number; headroom: number; amountByCapacity: number; amountByCap: number;
    salaryMissing: string[]; salaryLow: string[]; standingOrdersCounted: number;
  };
};

/** One policy parameter value, possibly per segment. */
export type ParamValue = string | number | boolean | string[];
export type PolicyParams = Record<string, ParamValue | Partial<Record<Segment, ParamValue>>>;

export type CaseState =
  | 'DETECTED' | 'CLASSIFIED' | 'SUPPRESSED' | 'QUEUED' | 'CONTACTED' | 'AWAITING_REPLY' | 'REPLY_RECEIVED' | 'UNDER_REVIEW'
  | 'UPDATE_PROPOSED' | 'UPDATE_APPROVED' | 'UPDATE_REJECTED' | 'RECORD_UPDATED' | 'REQUALIFIED' | 'REVIEW_OPEN' | 'DECIDED'
  | 'RECHECK_SCHEDULED' | 'REMINDING' | 'HANDED_OVER' | 'COOLING' | 'PAUSED' | 'ESCALATED' | 'RESTRICTION_PROPOSED' | 'CLOSED';

export type CloseCode = 'CURED' | 'CURED_AWAITING_HISTORY' | 'AWAITING_CONSENT' | 'UNRESPONSIVE' | 'INELIGIBLE_BY_POLICY' | 'OPTED_OUT' | 'ESCALATED_TO_HUMAN' | 'WITHDRAWN' | 'SUPERSEDED';

export type Autonomy = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
