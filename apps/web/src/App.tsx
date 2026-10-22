/**
 * Jahiz — the shell. Atelier frame: backdrop, Dalil in the chat rail, pinned
 * title bar, the menu as chrome beside the display area, every screen inside
 * <MainPanel>, the Demo Director docked at the bottom when a scenario runs.
 *
 * The menu follows MENU-DISCIPLINE.md: lenses are hats, one lens's items are
 * visible at a time (three to six, filtered by persona), the rig lives in the
 * Demo control beside the person, and the title bar holds four things.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { AppShell, ContextNav, LensPicker, MainPanel, TitleBar, UserBadge, Wordmark, useAppChrome, useChatRail, type ContextNavItem, type Lens } from '@cognirise/atelier/layout';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@cognirise/atelier/components/ui/dropdown-menu';
import { Activity, Bot, Briefcase, Building2, Inbox, LayoutGrid, MessageSquare, ScrollText, ShieldCheck, Users, Workflow } from 'lucide-react';
import { useApp } from './app/state';
import { AssistantRail } from './app/assistant';
import { CaseDrawer } from './app/case';
import { ActivityDrawer, DirectorBar } from './app/director';
import { DemoControl, clientMode } from './app/demo-control';
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
type Item = ContextNavItem & { personas?: string[]; labelFor?: Record<string, string> };
/**
 * Three lenses. Readiness is for those who run the base (the Head, the Data
 * Steward); Remediation for the six who do the work, each seeing only the
 * items of their job; How it works is the governance exhibit for the
 * technical session. Documents, the customer's phone, Scenarios and Settings
 * are not items: a document decision is an Inbox item, the queue is a tab on
 * the customer, and the rest is the rig, in the Demo control.
 */
const LENSES: { id: string; label: string; personas: string[]; landing: Record<string, string>; items: Item[] }[] = [
  { id: 'readiness', label: 'Readiness', personas: ['head', 'steward'], landing: { head: 'overview', steward: 'health' }, items: [
    { id: 'overview', label: 'Overview', icon: I(<LayoutGrid size={14} />) },
    { id: 'health', label: 'Data health', icon: I(<Activity size={14} />) },
    { id: 'customers', label: 'Customers', icon: I(<Users size={14} />) },
    { id: 'employers', label: 'Employers', icon: I(<Building2 size={14} />) },
    { id: 'policies', label: 'Policies', icon: I(<ShieldCheck size={14} />) },
  ] },
  { id: 'remediation', label: 'Remediation', personas: ['head', 'credit', 'ops', 'supervisor', 'compliance', 'rm', 'collections'], landing: { '*': 'inbox' }, items: [
    { id: 'inbox', label: 'Inbox', icon: I(<Inbox size={14} />) },
    { id: 'cases', label: 'Cases', icon: I(<Briefcase size={14} />) },
    { id: 'customers', label: 'Customers', icon: I(<Users size={14} />), labelFor: { rm: 'My clients' } },
    { id: 'employers', label: 'Employers', icon: I(<Building2 size={14} />), personas: ['head', 'credit'] },
    { id: 'comms', label: 'Messages', icon: I(<MessageSquare size={14} />), personas: ['head', 'ops', 'supervisor', 'compliance'] },
    { id: 'policies', label: 'Policies', icon: I(<ShieldCheck size={14} />), personas: ['head', 'credit', 'supervisor', 'compliance'] },
  ] },
  { id: 'how', label: 'How it works', personas: ['head', 'credit', 'compliance', 'steward'], landing: { '*': 'agents' }, items: [
    { id: 'agents', label: 'Agents', icon: I(<Bot size={14} />) },
    { id: 'workflows', label: 'Workflows', icon: I(<Workflow size={14} />) },
    { id: 'audit', label: 'Audit trail', icon: I(<ScrollText size={14} />) },
  ] },
];
/** Routes that are not items: the lens that holds their parent, so the menu still shows where the person is. */
const PARENT: Record<string, string> = { documents: 'inbox', triggers: 'agents', scenarios: 'agents', 'customer-app': 'inbox', settings: 'overview' };
const SCREENS: Record<string, () => ReactNode> = {
  overview: () => <Overview />, inbox: () => <InboxScreen />, customers: () => <CustomersScreen />, employers: () => <EmployersScreen />, health: () => <HealthScreen />, cases: () => <CasesScreen />, comms: () => <CommsScreen />,
  documents: () => <DocumentsScreen />, policies: () => <PoliciesScreen />, agents: () => <AgentsScreen />, workflows: () => <WorkflowsScreen />, triggers: () => <TriggersScreen />, scenarios: () => <ScenariosScreen />, audit: () => <AuditScreen />, 'customer-app': () => <CustomerAppScreen />, settings: () => <SettingsScreen />,
  present: () => null, // Present mode draws its cards in an overlay; while a scenario runs the Director's screens show here
};
/** People who work in lists start with the assistant rail closed; those whose work starts in a question start with it open. */
const RAIL_OPEN = new Set(['head', 'credit', 'compliance', 'steward']);

function PersonaMenu() {
  const { persona, session, switchPersona } = useApp();
  if (!persona || !session) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><span><UserBadge name={persona.name} role={persona.role} initials={persona.initials} /></span></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel>Act as</DropdownMenuLabel>
        {session.personas.map((p) => (
          <DropdownMenuItem key={p.key} onSelect={() => switchPersona(p.key)} className="items-start gap-3 py-2">
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${p.key === persona.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{p.initials}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{p.role}</span><span className="block truncate text-xs text-muted-foreground">{p.name} · sees {p.sees.toLowerCase()}</span></span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function App() {
  return <PresentProvider><Shell /></PresentProvider>;
}

function Shell() {
  const rail = useChatRail(true);
  const chrome = useAppChrome();
  const { persona, route, go, session, director, setHandSteps } = useApp();
  const { present, item } = usePresent();
  const onStage = !!present && item?.type === 'scenario' && present.view === 'stage';
  // While a scenario is presented (Stage or App view), hand steps (an upload, a decision) are reached without being executed: the room acts, or → lets the Director act.
  const presentingScenario = !!present && item?.type === 'scenario';
  useEffect(() => { document.documentElement.classList.toggle('on-stage', onStage); return () => document.documentElement.classList.remove('on-stage'); }, [onStage]);
  useEffect(() => { setHandSteps(presentingScenario); return () => setHandSteps(false); }, [presentingScenario, setHandSteps]);
  const key = persona?.key ?? '';
  // The rail opens for the persona's kind of work, when the persona changes (a manual toggle stays until the next switch).
  useEffect(() => { if (key) rail.setOpen(RAIL_OPEN.has(key) && window.innerWidth >= 1280); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const lenses = useMemo(() => LENSES.filter((l) => l.personas.includes(key)).map((l) => ({ ...l, items: l.items.filter((i) => !i.personas || i.personas.includes(key)) })), [key]);
  // The lens follows the screen: the first of the persona's lenses that holds the route (or its parent); the Director's screen choice wins over the lens rule.
  const screenId = PARENT[route.screen] ?? route.screen;
  const lens = useMemo(() => lenses.find((l) => l.items.some((i) => i.id === screenId)) ?? lenses[0], [lenses, screenId]);
  // A screen none of this persona's lenses holds (after a persona switch) goes to the persona's landing; the rig routes and a running scenario are exempt.
  const RIG = ['documents', 'customer-app', 'scenarios', 'settings', 'triggers', 'present'];
  useEffect(() => {
    if (!persona || director || !route.screen || RIG.includes(route.screen)) return;
    if (!lenses.some((l) => l.items.some((i) => i.id === route.screen))) go(persona.home);
  }, [persona, director, route.screen, lenses, go]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => (lens?.items ?? []).map((i) => ({ id: i.id, label: i.labelFor?.[key] ?? i.label, icon: i.icon, onSelect: () => go(i.id), badge: i.id === 'inbox' && session?.inbox ? String(session.inbox) : undefined })), [lens, key, go, session?.inbox]);
  const pickLens = (id: string) => { const l = lenses.find((x) => x.id === id); if (!l) return; go(l.landing[key] ?? l.landing['*'] ?? l.items[0].id); };
  const lensOptions: Lens[] = lenses.map((l) => ({ id: l.id, label: l.label }));
  const screen = SCREENS[route.screen];
  const titleBar = present ? <PresentBar user={<PersonaMenu />} /> : (
    <TitleBar theme={false}
      brand={<button type="button" onClick={() => go(persona?.home ?? 'overview')} className="flex items-center gap-2"><img src="/brand/mark.png" alt="" className="h-7 w-7 dark:hidden" /><img src="/brand/mark-on-dark.png" alt="" className="hidden h-7 w-7 dark:block" /><Wordmark className="text-lg">Jahiz</Wordmark><span className="hidden text-[11px] text-muted-foreground sm:inline">demo</span></button>}
      lens={lensOptions.length > 1 ? <LensPicker lenses={lensOptions} value={lens?.id ?? ''} onChange={pickLens} /> : undefined}
      user={<div className="flex items-center gap-3"><PersonaMenu />{clientMode() ? null : <DemoControl />}</div>} />
  );
  return (
    <>
      {/* While presenting: no menu, no chat rail, a slim bar — the room sees the screen the Director points at and nothing else. */}
      <AppShell rail={present ? undefined : rail} chrome={chrome} chatRail={present ? undefined : <AssistantRail rail={rail} />}
        titleBar={titleBar}
        contextNav={present ? undefined : <ContextNav items={items as any} value={screenId} chrome={chrome} />}>
        {onStage ? <Stage /> : <MainPanel><div className={director ? 'pb-56' : ''}>{persona && screen ? screen() : <div className="p-10 text-center text-sm text-muted-foreground">Loading the synthetic world… (the first run builds it, about two minutes)</div>}</div></MainPanel>}
      </AppShell>
      {onStage ? null : <CaseDrawer />}
      <ActivityDrawer />
      {onStage ? null : <DirectorBar />}
      <PresentOverlay />
    </>
  );
}
