import { Activity, CalendarClock, Play, RotateCcw, Settings, Smartphone, Presentation } from 'lucide-react';
import { Guidelines, Stack } from '../parts';
import { ConfirmCard, DemoControl, Provenance } from '../../components/archetypes';

/** The rig control, the assistant's confirm card and the proof disclosure, with sample content. */
export function DemoKitDemo() {
  const noop = () => undefined;
  return (
    <div className="max-w-3xl space-y-8">
      <Stack label="DemoControl — the rig, in one menu beside the person in the title bar">
        <div className="flex items-center justify-end gap-3 rounded-xl border bg-card px-4 py-2">
          <span className="text-[12px] text-muted-foreground">… title bar …</span>
          <DemoControl
            groups={[
              [
                { id: 'present', label: 'Present', icon: <Presentation className="h-4 w-4" />, onSelect: noop },
                { id: 'scenarios', label: 'Scenarios', icon: <Play className="h-4 w-4" />, onSelect: noop },
                { id: 'phone', label: "The customer's phone", icon: <Smartphone className="h-4 w-4" />, onSelect: noop },
              ],
              [
                { id: 'activity', label: 'What the agents are doing now', icon: <Activity className="h-4 w-4" />, onSelect: noop },
                { id: 'clock', label: 'The clock: 24 Oct 2026, 10:00', icon: <CalendarClock className="h-4 w-4" />, onSelect: noop },
                { id: 'reset', label: 'Reset the demo', icon: <RotateCcw className="h-4 w-4" />, onSelect: noop },
                { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, onSelect: noop },
              ],
            ]}
            note="Synthetic data; every identifier starts with DEMO-. Rules at version 7."
          />
          <DemoControl offline groups={[[{ id: 'present', label: 'Present', onSelect: noop }]]} />
        </div>
        <Guidelines
          items={[
            { kind: 'do', text: 'Put every demo-only control here: Present, Scenarios, persona, clock, demo data and Reset, interface, skin.' },
            { kind: 'do', text: 'Open the prototype with ?client=1 when a client explores alone: the control disappears.' },
            { kind: 'do', text: 'Pass offline when Claude is not connected: the control reads OFFLINE, the one place the room sees it.' },
            { kind: 'dont', text: 'Put Scenarios, Settings or the connector log in a lens menu.' },
          ]}
        />
      </Stack>

      <Stack label="ConfirmCard — what the assistant shows before it writes">
        <ConfirmCard
          sentence="Approve SAR 90,000 for the lockers pilot"
          facts={[
            { label: 'Room left after this', value: 'SAR 110,000 of 500,000' },
            { label: 'Rule', value: 'Pilot spend up to SAR 250,000 needs the lab lead' },
          ]}
          action="Approve"
          onConfirm={() => new Promise((r) => setTimeout(r, 600))}
        />
        <Guidelines
          items={[
            { kind: 'do', text: 'One sentence the person would say, the facts once, one button.' },
            { kind: 'dont', text: 'Show the payload, the tool name, or a sentence about what Confirm does not do.' },
          ]}
        />
      </Stack>

      <Stack label="Provenance — the proof, one click down">
        <div className="rounded-xl border bg-card p-4">
          <p className="font-semibold">Ravi Reddy asks for 4 days of annual leave, 26 to 29 October</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Balance after: 28 days · Team cover: two on duty · Notice: 5 days (policy asks 10)</p>
          <Provenance>
            <p>Balance read from the HR system on 24 Oct 09:12.</p>
            <p>Rule HR-04 §4.1: notice of ten working days for leave over three days.</p>
            <p>Team calendar: two of four on duty on every day requested.</p>
          </Provenance>
        </div>
        <Guidelines
          items={[
            { kind: 'do', text: 'Name it for the question it answers: "How this was checked", "What the agents did".' },
            { kind: 'dont', text: 'Open it by default, or put a second one on the same view.' },
          ]}
        />
      </Stack>
    </div>
  );
}
