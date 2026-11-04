/**
 * Three pieces every Cognirise prototype needs and none should build again
 * (lifted from Δ Force and QIB Jahiz, Oct 2026; the canon's SCREEN-DISCIPLINE
 * and MENU-DISCIPLINE require them):
 *
 *   DemoControl   the one control in the title bar that holds the rig:
 *                 Present, Scenarios, persona, clock, demo data and Reset,
 *                 interface, skin. Hidden when the address has ?client=1, so a
 *                 client can explore alone.
 *   ConfirmCard   what the assistant shows before a write: one sentence, the
 *                 facts once, one button. Never a payload or a tool name.
 *   Provenance    the one collapsed disclosure that holds the proof (steps,
 *                 trail, rules cited, system calls) under a work surface,
 *                 named for the question it answers.
 */
import { useState, type ReactNode } from 'react';
import { Check, ChevronRight, Loader2, Presentation } from 'lucide-react';
import { cn } from '../../lib/utils';
import { tr, trs } from '../../lib/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

/* ---------------------------------------------------------- DemoControl */

export type DemoControlItem = { id: string; label: ReactNode; icon?: ReactNode; onSelect: () => void; hidden?: boolean };

/** True when the address carries ?client=1: the rig is hidden and the client explores alone. */
export function isClientView() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('client') === '1';
}

/**
 * The rig, in one menu beside the person in the title bar. Groups are
 * separated by a line; `note` is a small line at the bottom (the data is
 * synthetic, the rules' version). Renders nothing in the client view.
 */
export function DemoControl({ groups, note, label = 'Demo', offline = false, className }: { groups: DemoControlItem[][]; note?: ReactNode; label?: string; /** Claude is not connected: the control reads OFFLINE, the one place the room sees it. */ offline?: boolean; className?: string }) {
  if (isClientView()) return null;
  const visible = groups.map((g) => g.filter((i) => !i.hidden)).filter((g) => g.length);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn('flex items-center gap-1.5 rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-[12px] hover:bg-card', className)}>
          <Presentation className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">{trs(label)}</span>
          {offline ? <span className="rounded-sm bg-warn/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warn">{trs('Offline')}</span> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {visible.map((g, k) => (
          <div key={k}>
            {k > 0 ? <DropdownMenuSeparator /> : null}
            {g.map((i) => (
              <DropdownMenuItem key={i.id} onSelect={i.onSelect}>
                {i.icon ? <span className="me-2 inline-flex h-4 w-4 items-center justify-center">{i.icon}</span> : null}
                {tr(i.label)}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
        {note ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">{tr(note)}</DropdownMenuLabel>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------------------------------------- ConfirmCard */

/**
 * What the assistant shows before it writes anything: the sentence the person
 * would say ("Approve SAR 90,000 for the lockers pilot"), the facts once, and
 * one button. `onConfirm` does the write; the card shows busy, done or the
 * error in plain words.
 */
export function ConfirmCard({ sentence, facts = [], action = 'Confirm', done = 'Done.', onConfirm, className }: { sentence: ReactNode; facts?: { label: ReactNode; value: ReactNode }[]; action?: string; done?: ReactNode; onConfirm: () => Promise<unknown>; className?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const go = async () => {
    setState('busy');
    try {
      await onConfirm();
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  };
  return (
    <div className={cn('rounded-lg border border-primary/40 bg-primary/5 p-3', className)}>
      <p className="text-[13px] font-medium text-foreground">{tr(sentence)}</p>
      {facts.length ? (
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[12px]">
          {facts.slice(0, 4).map((f, i) => (
            <div key={i} className="contents">
              <dt className="text-muted-foreground">{tr(f.label)}</dt>
              <dd className="tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-2.5">
        {state === 'done' ? (
          <p className="inline-flex items-center gap-1 text-[12px] text-success"><Check className="h-3.5 w-3.5" />{tr(done)}</p>
        ) : (
          <button type="button" disabled={state === 'busy'} onClick={go} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-60">
            {state === 'busy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {trs(action)}
          </button>
        )}
      </div>
      {state === 'error' ? <p className="mt-1.5 text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------- Provenance */

/**
 * The proof behind a work surface, collapsed by default everywhere,
 * including demos: steps, decision trail, rules cited, system calls. Named
 * for the question it answers ("How this was checked", "What the agents
 * did"). One per view.
 */
export function Provenance({ label = 'How this was checked', defaultOpen = false, children, className }: { label?: ReactNode; defaultOpen?: boolean; children: ReactNode; className?: string }) {
  return (
    <details className={cn('group mt-3 rounded-lg border border-border/50', className)} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-1 px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-3.5 w-3.5 transition group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90" />
        {tr(label)}
      </summary>
      <div className="space-y-3 border-t border-border/50 px-3 py-2 text-[12px]">{children}</div>
    </details>
  );
}
