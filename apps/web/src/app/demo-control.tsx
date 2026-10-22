/**
 * The Demo control: every rig item in one place beside the person, so the
 * menu holds only the work (MENU-DISCIPLINE.md). Present mode, the six
 * scenarios, the persona, the virtual clock, the customer's phone, the
 * activity console, the demo data and the interface. Hidden with `?client=1`,
 * when the client explores alone.
 */
import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@cognirise/atelier/components/ui/dropdown-menu';
import { useTheme } from '@cognirise/atelier/layout';
import { Activity, CalendarClock, Check, Database, Monitor, Moon, Play, Presentation, RotateCcw, Settings as SettingsIcon, SlidersHorizontal, Smartphone, Sun, UserRound } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { useApp } from './state';

/** `?client=1`: the client drives, the rig is out of sight. */
export const clientMode = (): boolean => { try { return new URLSearchParams(window.location.search).get('client') === '1'; } catch { return false; } };

export function DemoControl() {
  const { session, persona, switchPersona, startScenario, go, setActivityOpen } = useApp();
  const { mode, setMode } = useTheme();
  const { data: sc } = useApi<any>('/scenarios');
  const [busy, setBusy] = useState<string | null>(null);
  if (!session || !persona || clientMode()) return null;
  const clock = async (days: number) => { setBusy('clock'); try { await post('/control/clock', { days }); bump(); } finally { setBusy(null); } };
  const reset = async () => {
    if (!confirm('Rebuild the synthetic world from scratch? Sixty days of history are replayed; about two minutes.')) return;
    setBusy('reset');
    try { await post('/control/reset', {}); bump(); } finally { setBusy(null); }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground active:scale-[0.97]" title="Everything the presenter needs: Present mode, the scenarios, the persona, the clock, the phone, the data">
          <SlidersHorizontal className="h-3.5 w-3.5" />Demo
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Demo control</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => go('present')}><Presentation className="me-2 h-4 w-4 text-primary" />Present<span className="ms-auto text-[11px] text-muted-foreground">the demo without PowerPoint</span></DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Play className="me-2 h-4 w-4" />Scenarios</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[70vh] w-96 overflow-y-auto">
            {(sc?.scenarios ?? []).map((s: any) => (
              <DropdownMenuItem key={s.key} onSelect={() => { startScenario(s.key); }} className="items-start gap-2 py-2">
                <Play className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0"><span className="block text-sm">{s.key} · {s.name}</span><span className="block text-[11px] text-muted-foreground">{s.shape} · {s.steps.length} steps</span></span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => go('scenarios')}>All scenarios, with what each shows</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><UserRound className="me-2 h-4 w-4" />Persona<span className="ms-auto truncate text-[11px] text-muted-foreground">{persona.role.split(' (')[0]}</span></DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-96">
            <DropdownMenuLabel>Switching changes the inbox, the scope, what is approvable and what Dalil will do</DropdownMenuLabel>
            {session.personas.map((p) => (
              <DropdownMenuItem key={p.key} onSelect={() => switchPersona(p.key)} className="items-start gap-3 py-2">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${p.key === persona.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{p.initials}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{p.role}</span><span className="block truncate text-xs text-muted-foreground">{p.name} · sees {p.sees.toLowerCase()}</span></span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><CalendarClock className="me-2 h-4 w-4" />Clock<span className="ms-auto font-mono text-[11px] text-muted-foreground">{session.clock.today}{session.clock.virtual ? ' · virtual' : ''}</span></DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            <DropdownMenuLabel>{session.clock.virtual ? 'The virtual clock: every scan, reminder and deadline follows it' : 'Real time; a scenario that passes days moves to a virtual clock'}</DropdownMenuLabel>
            {[1, 7, 30].map((d) => <DropdownMenuItem key={d} disabled={!!busy} onSelect={(e) => { e.preventDefault(); clock(d); }}>{busy === 'clock' ? 'Advancing…' : `Advance ${d} day${d === 1 ? '' : 's'}`}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => go('triggers')}>Triggers and the clock, in full</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => go('customer-app')}><Smartphone className="me-2 h-4 w-4" />The customer's phone</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setActivityOpen(true)}><Activity className="me-2 h-4 w-4" />Activity console</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Database className="me-2 h-4 w-4" />Demo data</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-80">
            <DropdownMenuLabel>Every customer, document, employer and figure is synthetic (ids start with DEMO-); the core bank, the channels and One Click are simulated behind a connector. Policy v{session.policyVersion} is active.</DropdownMenuLabel>
            <DropdownMenuItem disabled={!!busy} onSelect={(e) => { e.preventDefault(); reset(); }}><RotateCcw className="me-2 h-4 w-4" />{busy === 'reset' ? 'Rebuilding…' : 'Reset the demo data'}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => go('settings')}>Distributions and the data parameters</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{mode === 'dark' ? <Moon className="me-2 h-4 w-4" /> : mode === 'light' ? <Sun className="me-2 h-4 w-4" /> : <Monitor className="me-2 h-4 w-4" />}Interface<span className="ms-auto text-[11px] text-muted-foreground">{session.ai?.mode === 'claude' ? 'Claude connected' : 'AI offline'}</span></DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            {([['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]] as const).map(([id, label, Icon]) => (
              <DropdownMenuItem key={id} onSelect={() => setMode(id)}><Icon className="me-2 h-4 w-4" />{label}{mode === id ? <Check className="ms-auto h-3.5 w-3.5" /> : null}</DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => go('settings')}><SettingsIcon className="me-2 h-4 w-4" />Settings · personas, AI, connectors, storylines</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
