/** Shared pieces used across screens. Compose from Atelier; nothing here re-styles it. */
import type { ReactNode } from 'react';
import { DemoBanner, DemoReference, AgentAutonomyChip, AgentAvatar, type AgentAutonomy } from '@cognirise/atelier/archetypes';
import { PageContainer, PageHero } from '@cognirise/atelier/layout';
import { cn } from '@cognirise/atelier/lib/utils';
import { initials } from '../lib/format';
import { useApp } from './state';

export const AUTONOMY: Record<string, AgentAutonomy> = { A0: 'observe', A1: 'recommend', A2: 'assisted', A3: 'supervised', A4: 'autonomous' };
export const AGENT_NAMES: Record<string, [string, string]> = { raqib: ['Raqib', 'رقيب'], munadi: ['Munadi', 'منادي'], mustaqbil: ['Mustaqbil', 'مستقبِل'], fahis: ['Fahis', 'فاحص'], muhaddith: ['Muhaddith', 'محدِّث'], muwathiq: ['Muwathiq', 'موثِّق'], muahil: ['Muahil', 'مؤهِّل'], munabbih: ['Munabbih', 'منبِّه'], hami: ['Hami', 'حامي'], dalil: ['Dalil', 'دليل'] };
export const SEG: Record<string, string> = { VVIP: 'VVIP', HNWI: 'HNWI', HIGH_VALUE: 'High Value', MASS: 'Mass' };
export const CLASS_LABEL: Record<string, string> = { A: 'Ask the customer', B: 'The bank must act', C: 'Not eligible by policy', D: 'Collections boundary' };
export const CLASS_TONE: Record<string, string> = { A: 'is-primary', B: 'is-warn', C: '', D: 'is-danger' };
export const PERSONA_SHORT: Record<string, string> = { head: 'Head of Retail Credit', credit: 'Credit Policy', ops: 'Operations Officer', supervisor: 'Operations Supervisor', compliance: 'Compliance', rm: 'Relationship Manager', collections: 'Collections', steward: 'Data Steward' };

const STATUS: Record<string, { tone: string; en: string }> = {
  WAITING: { tone: 'is-warn', en: 'Waiting' }, WAITING_EVENT: { tone: 'is-primary', en: 'Waiting for the customer' }, RUNNING: { tone: 'is-primary', en: 'Running' }, COMPLETED: { tone: 'is-success', en: 'Completed' },
  REJECTED: { tone: 'is-danger', en: 'Declined' }, ESCALATED: { tone: 'is-danger', en: 'Escalated' }, CANCELLED: { tone: '', en: 'Cancelled' }, DONE: { tone: 'is-success', en: 'Done' }, PENDING: { tone: '', en: 'Pending' }, SKIPPED: { tone: '', en: 'Skipped' }, FAILED: { tone: 'is-danger', en: 'Failed' },
  APPROVED: { tone: 'is-success', en: 'Approved' }, APPLIED: { tone: 'is-success', en: 'Applied' }, PROPOSED: { tone: 'is-warn', en: 'Proposed' }, REVIEW: { tone: 'is-warn', en: 'Needs review' }, REJECT_RECOMMENDED: { tone: 'is-danger', en: 'Reject recommended' }, RECEIVED: { tone: '', en: 'Received' },
  SCHEDULED: { tone: 'is-primary', en: 'Scheduled' }, SENT: { tone: 'is-success', en: 'Sent' }, DELIVERED: { tone: 'is-success', en: 'Delivered' }, BLOCKED: { tone: 'is-danger', en: 'Blocked' }, DEFERRED: { tone: 'is-warn', en: 'Deferred' },
  OPEN: { tone: 'is-primary', en: 'Open' }, ACTIVE: { tone: 'is-primary', en: 'Active' }, SUPERSEDED: { tone: '', en: 'Superseded' }, DECLINED: { tone: 'is-danger', en: 'Declined' }, CLOSED: { tone: '', en: 'Closed' }, ABANDONED: { tone: '', en: 'Stopped' },
  DETECTED: { tone: '', en: 'Detected' }, CLASSIFIED: { tone: '', en: 'Classified' }, SUPPRESSED: { tone: '', en: 'Suppressed' }, QUEUED: { tone: 'is-primary', en: 'Queued' }, CONTACTED: { tone: 'is-primary', en: 'Contacted' }, AWAITING_REPLY: { tone: 'is-primary', en: 'Awaiting reply' }, REPLY_RECEIVED: { tone: 'is-warn', en: 'Reply received' },
  UNDER_REVIEW: { tone: 'is-warn', en: 'Under review' }, UPDATE_PROPOSED: { tone: 'is-warn', en: 'Update proposed' }, UPDATE_APPROVED: { tone: 'is-success', en: 'Update approved' }, UPDATE_REJECTED: { tone: 'is-danger', en: 'Update rejected' }, RECORD_UPDATED: { tone: 'is-success', en: 'Record updated' },
  REQUALIFIED: { tone: 'is-primary', en: 'Re-qualified' }, REVIEW_OPEN: { tone: 'is-warn', en: 'Review open' }, DECIDED: { tone: '', en: 'Decided' }, RECHECK_SCHEDULED: { tone: '', en: 'Re-check scheduled' }, REMINDING: { tone: 'is-warn', en: 'Reminding' }, HANDED_OVER: { tone: 'is-danger', en: 'Handed over' },
  COOLING: { tone: '', en: 'Cooling period' }, PAUSED: { tone: 'is-danger', en: 'Paused' }, RESTRICTION_PROPOSED: { tone: 'is-danger', en: 'Restriction proposed' },
  CURED: { tone: 'is-success', en: 'Cured' }, CURED_AWAITING_HISTORY: { tone: 'is-success', en: 'Cured, awaiting history' }, AWAITING_CONSENT: { tone: 'is-warn', en: 'Awaiting consent' }, UNRESPONSIVE: { tone: 'is-danger', en: 'Unresponsive' }, INELIGIBLE_BY_POLICY: { tone: '', en: 'Ineligible by policy' }, OPTED_OUT: { tone: '', en: 'Opted out' }, ESCALATED_TO_HUMAN: { tone: 'is-warn', en: 'Escalated to a person' }, WITHDRAWN: { tone: '', en: 'Withdrawn' },
  NORMAL: { tone: 'is-success', en: 'Normal' }, DORMANT: { tone: 'is-warn', en: 'Dormant' }, BLOCKED_KYC: { tone: 'is-danger', en: 'Blocked (KYC)' }, BLOCKED_SALARY: { tone: 'is-danger', en: 'Blocked (salary)' }, BLOCKED_DELINQ: { tone: 'is-danger', en: 'Blocked (delinquency)' }, FROZEN_COURT: { tone: 'is-danger', en: 'Frozen (court)' }, FROZEN_SANCTIONS: { tone: 'is-danger', en: 'Frozen (sanctions)' }, DECEASED: { tone: '', en: 'Deceased' },
  UNAPPROVED: { tone: 'is-warn', en: 'Unapproved' }, UNDER_REVIEW_E: { tone: 'is-warn', en: 'Under review' }, RESTRICTED: { tone: 'is-danger', en: 'Restricted' },
  claude: { tone: 'is-success', en: 'Claude' }, offline: { tone: 'is-warn', en: 'Offline' },
};
export function StatusChip({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return null;
  const s = STATUS[status] ?? { tone: '', en: status.replace(/_/g, ' ').toLowerCase() };
  return <span className={cn('mono-chip whitespace-nowrap', s.tone, className)}>{s.en}</span>;
}
export function Chip({ children, tone, className, title }: { children: ReactNode; tone?: 'primary' | 'success' | 'warn' | 'danger'; className?: string; title?: string }) {
  return <span title={title} className={cn('mono-chip whitespace-nowrap', tone && `is-${tone}`, className)}>{children}</span>;
}
export const Ref = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap"><DemoReference>{children}</DemoReference></span>;
export function SegChip({ s }: { s: string | null | undefined }) { return s ? <Chip tone={s === 'VVIP' ? 'danger' : s === 'HNWI' ? 'warn' : s === 'HIGH_VALUE' ? 'primary' : undefined}>{SEG[s] ?? s}</Chip> : null; }
export function ClassChip({ cls, long }: { cls: string | null | undefined; long?: boolean }) { return cls ? <span className={cn('mono-chip whitespace-nowrap', CLASS_TONE[cls])} title={CLASS_LABEL[cls]}>{long ? `${cls} · ${CLASS_LABEL[cls]}` : cls}</span> : null; }
export function ReasonChip({ code, label }: { code: string; label?: string }) { return <span className="mono-chip whitespace-nowrap" title={label}>{code}</span>; }
export function Clause({ id, onClick }: { id: string | null | undefined; onClick?: (id: string) => void }) { return id ? <button type="button" onClick={() => onClick?.(id)} className="mono-chip is-primary hover:opacity-80">{id}</button> : null; }

export function Person({ name, sub, size = 28 }: { name: string; sub?: ReactNode; size?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="flex shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-semibold text-primary" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</span>
      <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-medium">{name}</span>{sub ? <span className="block truncate text-xs text-muted-foreground">{sub}</span> : null}</span>
    </span>
  );
}
export function AgentTag({ id, autonomy, showChip = true, size = 22 }: { id: string; autonomy?: string | null; showChip?: boolean; size?: number }) {
  const n = AGENT_NAMES[id];
  if (!n) return <span className="text-sm">{id === 'policy' ? 'Policy store' : id === 'core' ? 'Core banking' : id}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <AgentAvatar agent={{ id, name: n[0], role: '', initials: n[0].slice(0, 2) }} size={size} showActivity={false} />
      <span className="text-sm font-medium">{n[0]}</span>
      {showChip && autonomy && AUTONOMY[autonomy] ? <AgentAutonomyChip level={AUTONOMY[autonomy]} /> : null}
    </span>
  );
}
export function Btn({ children, onClick, kind = 'ghost', disabled, type = 'button', className, small, title }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; type?: 'button' | 'submit'; className?: string; small?: boolean; title?: string }) {
  return <button type={type} title={title} onClick={onClick} disabled={disabled} className={cn('pill-btn', kind === 'primary' ? 'pill-btn-primary' : 'pill-btn-ghost', kind === 'danger' && 'border-danger/50 text-danger hover:bg-danger/10', small && 'px-3 py-1.5 text-xs', className)}>{children}</button>;
}
export function Bar({ value, max = 100, tone = 'primary', className }: { value: number; max?: number; tone?: 'primary' | 'success' | 'warn' | 'danger' | 'accent'; className?: string }) {
  const w = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}><div className={cn('h-full rounded-full', { primary: 'bg-primary', success: 'bg-success', warn: 'bg-warn', danger: 'bg-danger', accent: 'bg-accent' }[tone])} style={{ width: `${w}%` }} /></div>;
}
export function Empty({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>; }
export function Kv({ k, v, mono }: { k: ReactNode; v: ReactNode; mono?: boolean }) { return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className={cn('mt-0.5 break-words text-sm leading-snug', mono && 'font-mono')}>{v}</dd></div>; }
export function Table({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn('overflow-x-auto scroll-thin', className)}><table className="table-clean">{children}</table></div>; }
export function Field({ label, children }: { label: ReactNode; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
export function Screen({ hero, children, banner = true }: { hero: ReactNode; children: ReactNode; banner?: boolean }) {
  const { director } = useApp();
  return (
    <div className="space-y-4">
      {hero}
      {banner && !director ? <DemoBanner kind="synthetic" title="Synthetic data" className="py-2.5">Every customer, document, employer and figure here is fictional and generated for this demo; every identifier starts with DEMO-. The core bank, the channels and One Click Finance are simulated behind a connector.</DemoBanner> : null}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
/** The page hero; while the Director runs it collapses to one band so the content a step points at is in view. */
export function Hero(props: Parameters<typeof PageHero>[0]) {
  const { director } = useApp();
  if (!director) return <PageHero {...props} />;
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
          <h1 className="truncate text-xl font-semibold leading-tight">{props.title}</h1>
        </div>
        {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
      </div>
      {props.children ? <div className="mt-2">{props.children}</div> : null}
    </div>
  );
}
export { PageContainer };
export function SourceStamp({ resource }: { resource: string }) { return <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Source: core banking (simulated) · {resource}</span>; }
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: ReactNode; n?: number }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-border/70 bg-card/40 p-1">
      {tabs.map((t) => <button key={t.id} type="button" onClick={() => onChange(t.id)} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', value === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{t.label}{t.n !== undefined ? <span className="ms-1.5 opacity-70">{t.n}</span> : null}</button>)}
    </div>
  );
}
export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'danger' | 'success' }) {
  return <div className={cn('rounded-xl border px-3 py-2 text-[13px] leading-relaxed', tone === 'warn' ? 'border-warn/40 bg-warn/5' : tone === 'danger' ? 'border-danger/40 bg-danger/5' : tone === 'success' ? 'border-success/40 bg-success/5' : 'border-primary/30 bg-primary/5')}>{children}</div>;
}
export function Select({ value, onChange, children, className }: { value: string; onChange: (v: string) => void; children: ReactNode; className?: string }) {
  return <select className={cn('input', className)} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>;
}
