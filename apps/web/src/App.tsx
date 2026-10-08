/**
 * Jahiz — the shell. Atelier frame: backdrop, Dalil in the chat rail, pinned
 * title bar, the menu as chrome beside the display area, every screen inside
 * <MainPanel>, the Demo Director docked at the bottom when a scenario runs.
 */
import { useMemo, type ReactNode } from 'react';
import { AppShell, ContextNav, MainPanel, TitleBar, UserBadge, Wordmark, useAppChrome, useChatRail, type ContextNavItem } from '@cognirise/atelier/layout';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@cognirise/atelier/components/ui/dropdown-menu';
import { Activity, Bot, Building2, CalendarClock, FileText, GitBranch, HeartPulse, Inbox, LayoutGrid, MessageSquare, Play, ScrollText, Settings as SettingsIcon, ShieldCheck, Smartphone, Users, Zap, Briefcase } from 'lucide-react';
import { useApp } from './app/state';
import { AssistantRail } from './app/assistant';
import { CaseDrawer } from './app/case';
import { ActivityDrawer, DirectorBar } from './app/director';
import { Chip } from './app/ui';
import { Overview } from './screens/overview';
import { InboxScreen } from './screens/inbox';
import { CustomersScreen, EmployersScreen } from './screens/customers';
import { HealthScreen } from './screens/health';
import { CasesScreen } from './screens/cases';
import { CommsScreen } from './screens/comms';
import { DocumentsScreen } from './screens/documents';
import { PoliciesScreen } from './screens/policies';
import { AgentsScreen, WorkflowsScreen, TriggersScreen, ScenariosScreen } from './screens/agents';
import { AuditScreen } from './screens/audit';
import { CustomerAppScreen } from './screens/customerapp';
import { SettingsScreen } from './screens/settings';

try { if (!localStorage.getItem('atelier-nav-orientation')) localStorage.setItem('atelier-nav-orientation', 'vertical'); } catch { /* */ }

const I = (n: ReactNode) => n;
const ITEMS: (ContextNavItem & { steward?: boolean })[] = [
  { id: 'overview', label: 'Overview', icon: I(<LayoutGrid size={14} />), steward: true },
  { id: 'inbox', label: 'Inbox', icon: I(<Inbox size={14} />) },
  { id: 'customers', label: 'Customers', icon: I(<Users size={14} />) },
  { id: 'employers', label: 'Employers', icon: I(<Building2 size={14} />), steward: true },
  { id: 'health', label: 'Data health', icon: I(<HeartPulse size={14} />), steward: true },
  { id: 'cases', label: 'Cases', icon: I(<Briefcase size={14} />) },
  { id: 'comms', label: 'Communications', icon: I(<MessageSquare size={14} />) },
  { id: 'documents', label: 'Documents', icon: I(<FileText size={14} />) },
  { id: 'policies', label: 'Policies', icon: I(<ShieldCheck size={14} />), steward: true },
  { id: 'agents', label: 'Agents', icon: I(<Bot size={14} />), steward: true },
  { id: 'workflows', label: 'Workflows', icon: I(<GitBranch size={14} />), steward: true },
  { id: 'triggers', label: 'Triggers', icon: I(<Zap size={14} />), steward: true },
  { id: 'scenarios', label: 'Scenarios', icon: I(<Play size={14} />), steward: true },
  { id: 'audit', label: 'Audit trail', icon: I(<ScrollText size={14} />), steward: true },
  { id: 'customer-app', label: 'Customer app', icon: I(<Smartphone size={14} />) },
  { id: 'settings', label: 'Settings', icon: I(<SettingsIcon size={14} />), steward: true },
];
const SCREENS: Record<string, () => ReactNode> = {
  overview: () => <Overview />, inbox: () => <InboxScreen />, customers: () => <CustomersScreen />, employers: () => <EmployersScreen />, health: () => <HealthScreen />, cases: () => <CasesScreen />, comms: () => <CommsScreen />,
  documents: () => <DocumentsScreen />, policies: () => <PoliciesScreen />, agents: () => <AgentsScreen />, workflows: () => <WorkflowsScreen />, triggers: () => <TriggersScreen />, scenarios: () => <ScenariosScreen />, audit: () => <AuditScreen />, 'customer-app': () => <CustomerAppScreen />, settings: () => <SettingsScreen />,
};

function PersonaMenu() {
  const { persona, session, switchPersona, go } = useApp();
  if (!persona || !session) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><span><UserBadge name={persona.name} role={persona.role} initials={persona.initials} /></span></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel>Act as (switching changes the inbox, the scope, what is approvable, and what Dalil will do)</DropdownMenuLabel>
        {session.personas.map((p) => (
          <DropdownMenuItem key={p.key} onSelect={() => switchPersona(p.key)} className="items-start gap-3 py-2">
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${p.key === persona.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{p.initials}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{p.role}</span><span className="block truncate text-xs text-muted-foreground">{p.name} · sees {p.sees.toLowerCase()}</span></span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go('settings')}><SettingsIcon className="me-2 h-4 w-4" />Settings · personas and authority</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClockChip() {
  const { session, go } = useApp();
  if (!session) return null;
  return <button type="button" onClick={() => go('triggers')} title="Virtual clock: advance it from Triggers" className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-[12px] hover:bg-card"><CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-mono">{session.clock.today}</span>{session.clock.virtual ? <Chip tone="warn">virtual</Chip> : null}<Chip>policy v{session.policyVersion}</Chip></button>;
}

export default function App() {
  const rail = useChatRail(true);
  const chrome = useAppChrome();
  const { persona, route, go, session, setActivityOpen, director } = useApp();
  const items = useMemo(() => ITEMS.filter((i) => !persona?.scope?.metricsOnly || i.steward).map((i) => ({ id: i.id, label: i.label, icon: i.icon, onSelect: () => go(i.id), badge: i.id === 'inbox' && session?.inbox ? String(session.inbox) : undefined })), [persona, go, session?.inbox]);
  const screen = SCREENS[route.screen];
  return (
    <>
      <AppShell rail={rail} chrome={chrome} chatRail={<AssistantRail rail={rail} />}
        titleBar={<TitleBar
          brand={<button type="button" onClick={() => go(persona?.home ?? 'overview')} className="flex items-center gap-2"><img src="/brand/mark.png" alt="" className="h-7 w-7 dark:hidden" /><img src="/brand/mark-on-dark.png" alt="" className="hidden h-7 w-7 dark:block" /><Wordmark className="text-lg">Jahiz</Wordmark><span className="hidden text-[11px] text-muted-foreground sm:inline">One Click readiness · QIB (demo)</span></button>}
          search={<ClockChip />}
          utilities={<div className="flex items-center gap-3"><button type="button" onClick={() => setActivityOpen(true)} title="Activity console: what the agents are doing right now" className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><Activity className="h-4 w-4" /><span className="hidden sm:inline">Activity</span></button></div>}
          user={<PersonaMenu />} />}
        contextNav={<ContextNav items={items as any} value={route.screen} chrome={chrome} />}>
        <MainPanel><div className={director ? 'pb-56' : ''}>{persona && screen ? screen() : <div className="p-10 text-center text-sm text-muted-foreground">Loading the synthetic world… (the first run builds it, about two minutes)</div>}</div></MainPanel>
      </AppShell>
      <CaseDrawer />
      <ActivityDrawer />
      <DirectorBar />
    </>
  );
}
