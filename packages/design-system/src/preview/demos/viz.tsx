import type { ReactNode } from 'react';
import {
  BeforeAfter,
  Bullet,
  Bump,
  ControlChart,
  CumulativeFlow,
  DotStrip,
  Dumbbell,
  Funnel,
  Heatmap,
  Network,
  Sankey,
  SmallMultiples,
  Waterfall,
  sharedDomain,
  CapBar,
  Columns,
  CountUp,
  DeadlineField,
  Dots,
  Journey,
  Ring,
  Segments,
  Slope,
  Sparkline,
  StageRiver,
  FigureTile,
  Swatch,
  Swimlanes,
  TimeBar,
  Treemap,
} from '../../components/viz';

/**
 * Sample data only: a made-up innovation lab with five stages and six
 * initiatives. Each block names the question its picture answers.
 */

const TODAY = '2026-10-23';
const STAGES = [
  { id: 's1', label: 'Scout' },
  { id: 's2', label: 'Prove' },
  { id: 's3', label: 'Pilot' },
  { id: 's4', label: 'Scale' },
];
const aed = (v: number) => (v >= 1e6 ? `AED ${(v / 1e6).toFixed(1)}M` : `AED ${Math.round(v / 1e3)}k`);
const pct = (v: number) => `${Math.round(v)}%`;

function Block({ q, children }: { q: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-5">
      <p className="mb-4 font-semibold">{q}</p>
      {children}
    </section>
  );
}

export function VizDemo() {
  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      <Block q="How much of the review period has run?">
        <div className="space-y-4">
          <TimeBar start="2026-09-01" end="2026-11-30" today={TODAY} />
          <TimeBar start="2026-08-01" end="2026-10-15" today={TODAY} />
          <TimeBar start="2026-09-10" end="2026-10-20" heldUntil="2026-11-10" today={TODAY} />
        </div>
      </Block>

      <Block q="Is there room inside the budget for this request?">
        <div className="space-y-4">
          <CapBar cap={500_000} used={240_000} pending={60_000} request={90_000} format={aed} />
          <CapBar cap={500_000} used={380_000} pending={70_000} request={90_000} format={aed} />
        </div>
      </Block>

      <Block q="Is the measure past its threshold?">
        <div className="space-y-4">
          <Bullet value={62} target={70} baseline={48} format={pct} />
          <Bullet value={18} target={12} direction="down" alarm format={pct} />
        </div>
      </Block>

      <Block q="How many of the deliverables are in?">
        <div className="space-y-3">
          <Segments items={['Charter', 'Sponsor', 'Data access', 'Pilot plan', 'Risk sign-off'].map((label, i) => ({ label, on: i < 3 }))} />
          <Dots n={4} of={12} tone="danger" />
        </div>
      </Block>

      <Block q="Headline figures, each with its picture">
        <div className="grid gap-3 sm:grid-cols-3">
          <FigureTile label="Live pilots" value={<CountUp value={5} />} sub="target 5 this year">
            <Ring value={5} max={5} size={40} stroke={5} tone="success" />
          </FigureTile>
          <FigureTile label="Stopped" value="4 of 12" sub="target 30% or more">
            <Dots n={4} of={12} />
          </FigureTile>
          <FigureTile label="Spend" value={aed(1_840_000)} sub="since July">
            <Sparkline points={[120, 180, 260, 240, 390, 650]} />
          </FigureTile>
        </div>
      </Block>

      <Block q="What did the lab spend, month by month?">
        <Columns points={[['Jul', 120], ['Aug', 180], ['Sep', 260], ['Oct', 240], ['Nov', 390]].map(([label, value]) => ({ label: String(label), value: Number(value) * 1000 }))} format={aed} />
      </Block>

      <div className="lg:col-span-2">
        <Block q="Which period runs out first?">
          <Swimlanes
            today={TODAY}
            rows={[
              { id: 'a', label: 'Last-mile lockers', sub: 'Pilot', start: '2026-08-15', end: '2026-11-15' },
              { id: 'b', label: 'Address resolution', sub: 'Prove', start: '2026-09-01', end: '2026-10-18' },
              { id: 'c', label: 'Returns kiosk', sub: 'Scout', start: '2026-09-20', end: '2026-12-01', tone: 'warn' },
              { id: 'd', label: 'Drone survey', sub: 'Scout', start: '2026-08-01', end: '2026-09-30', stopped: true },
            ]}
          />
        </Block>
      </div>

      <div className="lg:col-span-2">
        <Block q="How has each initiative moved through the stages?">
          <StageRiver
            stages={STAGES}
            today={TODAY}
            items={[
              { id: 'a', label: 'Last-mile lockers', path: [{ stage: 's1', from: '2026-07-01', to: '2026-07-28' }, { stage: 's2', from: '2026-07-28', to: '2026-08-15' }, { stage: 's3', from: '2026-08-15', to: null }] },
              { id: 'b', label: 'Address resolution', tone: 'danger', path: [{ stage: 's1', from: '2026-07-10', to: '2026-09-01' }, { stage: 's2', from: '2026-09-01', to: null }] },
              { id: 'c', label: 'Returns kiosk', tone: 'warn', path: [{ stage: 's2', from: '2026-07-15', to: '2026-09-20' }, { stage: 's1', from: '2026-09-20', to: null }] },
              { id: 'd', label: 'Drone survey', stopped: true, tone: 'muted', path: [{ stage: 's1', from: '2026-08-01', to: '2026-09-30' }] },
            ]}
          />
        </Block>
      </div>

      <div className="lg:col-span-2">
        <Block q="What is due soonest, and where is the money?">
          <DeadlineField
            lanes={STAGES.slice(0, 3)}
            items={[
              { id: 'a', label: 'Last-mile lockers', lane: 's3', daysLeft: 23, weight: 900_000 },
              { id: 'b', label: 'Address resolution', lane: 's2', daysLeft: -5, weight: 220_000, tone: 'danger' },
              { id: 'c', label: 'Returns kiosk', lane: 's1', daysLeft: 39, weight: 60_000, tone: 'warn' },
              { id: 'e', label: 'Parcel lockers v2', lane: 's1', daysLeft: 74, weight: 40_000 },
            ]}
            legend={<><Swatch tone="primary">on track</Swatch><Swatch tone="warn">held</Swatch><Swatch tone="danger">overdue</Swatch><span>size = money committed</span></>}
          />
        </Block>
      </div>

      <Block q="Where is the budget held?">
        <Treemap
          items={[
            { id: 'a', label: 'Last-mile lockers', size: 1_500_000, used: 0.6 },
            { id: 'b', label: 'Address resolution', size: 500_000, used: 0.92, tone: 'warn' },
            { id: 'c', label: 'Returns kiosk', size: 150_000, used: 0.3 },
            { id: 'e', label: 'Parcel lockers v2', size: 150_000, used: 0.1 },
          ]}
        />
      </Block>

      <Block q="Did the benefit move from where it started?">
        <div className="space-y-2">
          <Slope before={4.2} now={2.9} target={3} direction="down" format={(v) => `${v.toFixed(1)} days`} />
          <Slope before={61} now={66} target={75} state="claimed" format={pct} />
        </div>
      </Block>

      <div className="lg:col-span-2">
        <Block q="Did the pilot move the daily number, beyond the noise?">
          <BeforeAfter
            days={Array.from({ length: 70 }, (_, i) => {
              const d = new Date(Date.UTC(2026, 7, 10 + i)).toISOString().slice(0, 10);
              return { day: d, value: (i < 35 ? 4.2 : 3.0) + Math.sin(i * 1.7) * 0.35 };
            })}
            baseline={{ from: '2026-08-10', to: '2026-09-13', value: 4.2 }}
            measured={{ from: '2026-09-14', to: '2026-10-18', value: 3.0 }}
            liveOn="2026-09-14"
            target={3.2}
            format={(v) => `${v.toFixed(1)} days`}
          />
        </Block>
      </div>

      <div className="lg:col-span-2">
        <Block q="How did one initiative get here?">
          <Journey
            today={TODAY}
            end="2026-11-15"
            holds={[{ at: '2026-09-02', to: '2026-09-09' }]}
            steps={[
              { label: 'Scout', from: '2026-07-01', to: '2026-07-28', outcome: 'passed' },
              { label: 'Prove', from: '2026-07-28', to: '2026-08-15', outcome: 'passed' },
              { label: 'Pilot', from: '2026-08-15', to: null },
            ]}
          />
        </Block>
      </div>

      <div className="lg:col-span-2">
        <Block q="How did the budget get from plan to forecast?">
          <Waterfall
            start={{ label: 'Plan', value: 2_400_000 }}
            steps={[
              { label: 'Lockers scale-up', value: 650_000 },
              { label: 'Kiosk stopped', value: -180_000 },
              { label: 'Vendor discount', value: -240_000 },
              { label: 'Data access', value: 120_000 },
            ]}
            end="Forecast"
            good="down"
            format={aed}
          />
        </Block>
      </div>

      <div className="lg:col-span-2">
        <Block q="Where do this month's alerts end up?">
          <Sankey
            format={(v) => String(v)}
            nodes={[
              { id: 'rules', label: 'Rule alerts' },
              { id: 'model', label: 'Model alerts' },
              { id: 'agent', label: 'Agent triage' },
              { id: 'analyst', label: 'Analyst review' },
              { id: 'closed', label: 'Closed as noise', tone: 'muted' },
              { id: 'esc', label: 'Escalated', tone: 'warn' },
              { id: 'sar', label: 'Reported', tone: 'danger' },
            ]}
            links={[
              { source: 'rules', target: 'agent', value: 820 },
              { source: 'model', target: 'agent', value: 310 },
              { source: 'agent', target: 'closed', value: 690 },
              { source: 'agent', target: 'analyst', value: 440 },
              { source: 'analyst', target: 'closed', value: 310 },
              { source: 'analyst', target: 'esc', value: 105 },
              { source: 'analyst', target: 'sar', value: 25 },
            ]}
          />
        </Block>
      </div>

      <Block q="Where do applicants drop out?">
        <Funnel
          steps={[
            { label: 'Started', value: 4200 },
            { label: 'ID verified', value: 3650 },
            { label: 'Income checked', value: 2100 },
            { label: 'Offer accepted', value: 1720 },
          ]}
        />
      </Block>

      <Block q="How far is each region from its target?">
        <Dumbbell
          legend={['last quarter', 'this quarter']}
          format={pct}
          min={0}
          max={100}
          rows={[
            { id: 'r', label: 'Riyadh', from: 58, to: 74, target: 70 },
            { id: 'j', label: 'Jeddah', from: 61, to: 66, target: 70 },
            { id: 'd', label: 'Dammam', from: 49, to: 71, target: 70 },
            { id: 'm', label: 'Madinah', from: 64, to: 59, target: 70 },
          ]}
        />
      </Block>

      <div className="lg:col-span-2">
        <Block q="Where is work piling up?">
          <CumulativeFlow
            states={[
              { id: 'new', label: 'Waiting' },
              { id: 'work', label: 'In progress' },
              { id: 'appr', label: 'Approval' },
              { id: 'done', label: 'Done' },
            ]}
            days={Array.from({ length: 42 }, (_, i) => ({
              day: new Date(Date.UTC(2026, 8, 12 + i)).toISOString().slice(0, 10),
              counts: { new: 30 + Math.round(Math.sin(i / 4) * 4), work: 14 + (i % 3), appr: 6 + Math.max(0, i - 24), done: i * 2 },
            }))}
          />
        </Block>
      </div>

      <Block q="Which branches moved up the league table?">
        <Bump
          periods={['Q1', 'Q2', 'Q3', 'Q4']}
          focus={['c', 'e']}
          items={[
            { id: 'a', label: 'Olaya', ranks: [1, 1, 2, 2] },
            { id: 'b', label: 'Malaz', ranks: [2, 3, 3, 4] },
            { id: 'c', label: 'Al Khobar', ranks: [5, 4, 1, 1] },
            { id: 'd', label: 'Corniche', ranks: [3, 2, 4, 5] },
            { id: 'e', label: 'Tahlia', ranks: [4, 5, 5, 3] },
          ]}
        />
      </Block>

      <Block q="When do the alerts peak?">
        <Heatmap
          rows={['Sun', 'Mon', 'Tue', 'Wed', 'Thu']}
          cols={Array.from({ length: 12 }, (_, h) => `${h + 8}:00`)}
          values={Array.from({ length: 5 }, (_, d) => Array.from({ length: 12 }, (_, h) => Math.round(20 + 30 * Math.exp(-((h - 3 - (d === 0 ? 0 : 1)) ** 2) / 4) + (d === 0 ? 25 : 0) * Math.exp(-((h - 2) ** 2) / 3))))}
        />
      </Block>

      <div className="lg:col-span-2">
        <Block q="Is this week's turnaround spike a signal or noise?">
          <ControlChart
            baseline={20}
            floor={0}
            format={(v) => `${v.toFixed(1)} h`}
            points={Array.from({ length: 30 }, (_, i) => ({ label: new Date(Date.UTC(2026, 8, 20 + i)).toISOString().slice(5, 10), value: 6 + Math.sin(i * 1.9) * 0.9 + (i === 27 ? 4.5 : 0) + (i > 21 ? 0.6 : 0) }))}
          />
        </Block>
      </div>

      <div className="lg:col-span-2">
        <Block q="How old is every open case against the service level?">
          <DotStrip
            format={(v) => `${Math.round(v)} d`}
            marks={[{ value: 10, label: 'service level 10 days', tone: 'danger' }]}
            items={Array.from({ length: 46 }, (_, i) => {
              const v = Math.abs(Math.sin(i * 12.9898) * 14);
              return { id: `c${i}`, label: `Case ${i + 1}`, value: v, tone: v > 10 ? ('danger' as const) : ('primary' as const) };
            })}
          />
        </Block>
      </div>

      <div className="lg:col-span-2">
        <Block q="Which region's volume is rising?">
          {(() => {
            const regions: [string, number[]][] = [['Riyadh', [40, 42, 45, 44, 48, 52]], ['Jeddah', [30, 31, 29, 30, 31, 30]], ['Dammam', [18, 20, 24, 29, 35, 41]], ['Madinah', [12, 12, 11, 12, 13, 12]]];
            const domain = sharedDomain(regions.map(([, v]) => v), { zero: true });
            return <SmallMultiples panels={regions.map(([label, v]) => ({ id: label, title: label, figure: `${v[v.length - 1]}k`, tone: label === 'Dammam' ? 'warn' : undefined, children: <Sparkline points={v} domain={domain} className="h-10 w-full" /> }))} />;
          })()}
        </Block>
      </div>

      <div className="lg:col-span-2">
        <Block q="Which accounts share a device or an address?">
          <Network
            nodes={[
              { id: 'a1', label: 'Account 4471', tone: 'danger', weight: 3 },
              { id: 'a2', label: 'Account 2290', tone: 'danger', weight: 2 },
              { id: 'a3', label: 'Account 8812', weight: 1 },
              { id: 'a4', label: 'Account 1307', weight: 1 },
              { id: 'a5', label: 'Account 6650', weight: 1 },
              { id: 'd1', label: 'Device A', tone: 'muted' },
              { id: 'd2', label: 'Device B', tone: 'muted' },
              { id: 'ad', label: 'Address, Olaya', tone: 'muted' },
            ]}
            links={[
              { source: 'a1', target: 'd1' }, { source: 'a2', target: 'd1' }, { source: 'a3', target: 'd1' },
              { source: 'a1', target: 'ad' }, { source: 'a4', target: 'ad' },
              { source: 'a2', target: 'd2' }, { source: 'a5', target: 'd2' },
            ]}
          />
        </Block>
      </div>
    </div>
  );
}
