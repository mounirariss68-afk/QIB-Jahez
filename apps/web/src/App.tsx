/**
 * Jahiz — the shell. Atelier frame: backdrop, Dalil in the chat rail, pinned
 * title bar, the menu as chrome beside the display area, every screen inside
 * <MainPanel>, the Demo Director docked at the bottom when a scenario runs.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { AppShell, ContextNav, MainPanel, TitleBar, UserBadge, Wordmark, useAppChrome, useChatRail, type ContextNavItem } from '@cognirise/atelier/layout';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@cognirise/atelier/components/ui/dropdown-menu';
import { Activity, Bot, CalendarClock, FileText, FlaskConical, Inbox, LayoutGrid, MessageSquare, Play, Presentation, ScrollText, Settings as SettingsIcon, ShieldCheck, Smartphone, Users, Briefcase } from 'lucide-react';
import { useApp } from './app/state';
import { AssistantRail } from './app/assistant';
import { CaseDrawer } from './app/case';
import { ActivityDrawer, DirectorBar } from './app/director';
import { Chip } from './app/ui';
import { PresentBar, PresentOverlay, PresentProvider, usePresent } from './app/present';
import { Stage } from './app/stage';
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
/**
 * The menu a first-time user sees: twelve items in three groups — the bank's
 * day-to-day work, the governance of the agents (rules, team, evidence), and
 * the demo controls. Routes that used to be menu items of their own
 * (employers, data health, workflows, triggers) still exist as tabs inside
 * their parent screen, so every deep link and every Director step keeps
 * working; the menu highlights the parent.
 */
const ITEMS: (ContextNavItem & { steward?: boolean })[] = [
  { group: 'Work', id: 'overview', label: 'Overview', icon: I(<LayoutGrid size={14} />), steward: true },
  { group: 'Work', id: 'inbox', label: 'Inbox', icon: I(<Inbox size={14} />) },
  { group: 'Work', id: 'customers', label: 'Customers', icon: I(<Users size={14} />), steward: true },
  { group: 'Work', id: 'cases', label: 'Cases', icon: I(<Briefcase size={14} />) },
  { group: 'Work', id: 'comms', label: 'Communications', icon: I(<MessageSquare size={14} />) },
  { group: 'Work', id: 'documents', label: 'Documents', icon: I(<FileText size={14} />) },
  { group: 'Governance', id: 'policies', label: 'Policies', icon: I(<ShieldCheck size={14} />), steward: true },
  { group: 'Governance', id: 'agents', label: 'Agents & workflows', icon: I(<Bot size={14} />), steward: true },
  { group: 'Governance', id: 'audit', label: 'Audit trail', icon: I(<ScrollText size={14} />), steward: true },
  { group: 'Demo', id: 'customer-app', label: 'Customer app', icon: I(<Smartphone size={14} />) },
  { group: 'Demo', id: 'scenarios', label: 'Scenarios', icon: I(<Play size={14} />), steward: true },
  { group: 'Demo', id: 'settings', label: 'Settings', icon: I(<SettingsIcon size={14} />), steward: true },
];
/** Which menu item a route belongs to (merged screens live as tabs). */
const PARENT: Record<string, string> = { employers: 'customers', health: 'overview', workflows: 'agents', triggers: 'agents' };
const SCREENS: Record<string, () => ReactNode> = {
  overview: () => <Overview />, inbox: () => <InboxScreen />, customers: () => <CustomersScreen />, employers: () => <EmployersScreen />, health: () => <HealthScreen />, cases: () => <CasesScreen />, comms: () => <CommsScreen />,
  documents: () => <DocumentsScreen />, policies: () => <PoliciesScreen />, agents: () => <AgentsScreen />, workflows: () => <WorkflowsScreen />, triggers: () => <TriggersScreen />, scenarios: () => <ScenariosScreen />, audit: () => <AuditScreen />, 'customer-app': () => <CustomerAppScreen />, settings: () => <SettingsScreen />,
  present: () => null, // Present mode draws its cards in an overlay; while a scenario runs the Director's screens show here
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
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => go('triggers')} title="Virtual clock and active policy version. Advance the clock from Agents & workflows → Triggers & clock." className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-[12px] hover:bg-card"><CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-mono">{session.clock.today}</span>{session.clock.virtual ? <Chip tone="warn">virtual</Chip> : null}<Chip>policy v{session.policyVersion}</Chip></button>
      <span title="Every customer, document, employer and figure is fictional and generated for this demo; identifiers start with DEMO-. The core bank, the channels and One Click are simulated behind a connector." className="hidden items-center gap-1 whitespace-nowrap rounded-full border border-border/70 bg-card/50 px-2.5 py-1.5 text-[11px] text-muted-foreground lg:flex"><FlaskConical className="h-3.5 w-3.5" /><span className="hidden 2xl:inline">Synthetic data</span></span>
    </div>
  );
}

export default function App() {
  return <PresentProvider><Shell /></PresentProvider>;
}

function Shell() {
  const rail = useChatRail(true);
  const chrome = useAppChrome();
  const { persona, route, go, session, setActivityOpen, director, setHandSteps } = useApp();
  const { present, item } = usePresent();
  const onStage = !!present && item?.type === 'scenario' && present.view === 'stage';
  // While a scenario is presented (Stage or App view), hand steps (an upload, a decision) are reached without being executed: the room acts, or → lets the Director act.
  const presentingScenario = !!present && item?.type === 'scenario';
  useEffect(() => { document.documentElement.classList.toggle('on-stage', onStage); return () => document.documentElement.classList.remove('on-stage'); }, [onStage]);
  useEffect(() => { setHandSteps(presentingScenario); return () => setHandSteps(false); }, [presentingScenario, setHandSteps]);
  const items = useMemo(() => ITEMS.filter((i) => !persona?.scope?.metricsOnly || i.steward).map((i) => ({ id: i.id, label: i.label, icon: i.icon, group: i.group, onSelect: () => go(i.id), badge: i.id === 'inbox' && session?.inbox ? String(session.inbox) : undefined })), [persona, go, session?.inbox]);
  const screen = SCREENS[route.screen];
  const menuValue = PARENT[route.screen] ?? route.screen;
  const titleBar = present ? <PresentBar user={<PersonaMenu />} /> : (
    <TitleBar
      brand={<button type="button" onClick={() => go(persona?.home ?? 'overview')} className="flex items-center gap-2"><img src="/brand/mark.png" alt="" className="h-7 w-7 dark:hidden" /><img src="/brand/mark-on-dark.png" alt="" className="hidden h-7 w-7 dark:block" /><Wordmark className="text-lg">Jahiz</Wordmark><span className="hidden text-[11px] text-muted-foreground sm:inline">One Click readiness · QIB (demo)</span></button>}
      search={<ClockChip />}
      utilities={<div className="flex items-center gap-3"><button type="button" onClick={() => setActivityOpen(true)} title="Activity console: what the agents are doing right now" className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><Activity className="h-4 w-4" /><span className="hidden sm:inline">Activity</span></button><button type="button" onClick={() => go('present')} title="Present mode: the demo without PowerPoint (full screen, arrow keys)" className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-[12px] hover:bg-card"><Presentation className="h-3.5 w-3.5 text-primary" /><span className="hidden lg:inline">Present</span></button></div>}
      user={<PersonaMenu />} />
  );
  return (
    <>
      {/* While presenting: no menu, no chat rail, a slim bar — the room sees the screen the Director points at and nothing else. */}
      <AppShell rail={present ? undefined : rail} chrome={chrome} chatRail={present ? undefined : <AssistantRail rail={rail} />}
        titleBar={titleBar}
        contextNav={present ? undefined : <ContextNav items={items as any} value={menuValue} chrome={chrome} />}>
        {onStage ? <Stage /> : <MainPanel><div className={director ? 'pb-56' : ''}>{persona && screen ? screen() : <div className="p-10 text-center text-sm text-muted-foreground">Loading the synthetic world… (the first run builds it, about two minutes)</div>}</div></MainPanel>}
      </AppShell>
      {onStage ? null : <CaseDrawer />}
      <ActivityDrawer />
      {onStage ? null : <DirectorBar />}
      <PresentOverlay />
    </>
  );
}
