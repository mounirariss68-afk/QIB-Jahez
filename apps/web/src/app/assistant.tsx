/**
 * The chat rail: Dalil. The rail says which resolver is answering (Claude or
 * Offline) and every answer shows the policy clauses it cites. An action
 * Dalil prepares is a card with a Confirm button: nothing is sent or changed
 * on its say-so.
 */
import { useEffect, useRef, useState } from 'react';
import { ChatAssistantTurn, ChatComposer, ChatRail, ChatStatusBadge, ChatSuggestions, ChatUserTurn, RailBrandCard, type ChatRailState } from '@cognirise/atelier/layout';
import { FileCheck2, RotateCcw } from 'lucide-react';
import { api, bump, post, useApi } from '../lib/api';
import { useApp } from './state';
import { Btn, Chip } from './ui';

type Msg = { id: number; role: 'user' | 'assistant'; content: string; mode?: string; citations?: { id: string; heading: string }[]; tool_calls?: { name: string }[]; pending?: any; navigate?: string | null };

function Answer({ m, onConfirmed }: { m: Msg; onConfirmed: () => void }) {
  const { go, open } = useApp();
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [err, setErr] = useState('');
  const pending = m.pending;
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap text-foreground">{m.content}</p>
      {m.citations?.length ? <div className="flex flex-wrap gap-1">{m.citations.map((c) => <button key={c.id} type="button" onClick={() => go('policies', c.id.split(' ')[0])} className="mono-chip is-primary hover:opacity-80" title={c.heading}>{c.id}</button>)}</div> : null}
      {pending ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground"><FileCheck2 className="h-3.5 w-3.5 text-primary" />{pending.label}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{Object.entries(pending.body ?? {}).filter(([k, v]) => k !== 'type' && v !== null && v !== '' && typeof v !== 'object').map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
          {pending.confirmed ? <p className="mt-1.5 text-[12px] text-success">Confirmed: {pending.result}</p> : (
            <div className="mt-2 flex items-center gap-2">
              <Btn small kind="primary" disabled={state === 'busy'} onClick={async () => { setState('busy'); try { const r = await post('/assistant/confirm', { message_id: m.id }); bump(); onConfirmed(); if (r.navigate) open(r.navigate); setState('idle'); } catch (e: any) { setErr(e.message); setState('error'); } }}>Confirm</Btn>
              <span className="text-[11px] text-muted-foreground">Nothing is sent or changed until you confirm; Hami checks at that moment.</span>
            </div>
          )}
          {state === 'error' ? <p className="mt-1 text-[11px] text-danger">{err}</p> : null}
        </div>
      ) : null}
      {m.tool_calls?.length ? <p className="font-mono text-[10px] text-muted-foreground">Read: {[...new Set(m.tool_calls.map((c) => c.name))].join(', ')}{m.mode === 'offline' ? ' · Offline' : ''}</p> : null}
    </div>
  );
}

export function AssistantRail({ rail }: { rail: ChatRailState }) {
  const { persona, session, route, open } = useApp();
  const { data: history, reload } = useApi<Msg[]>(persona ? `/assistant/history?k=${persona.key}` : null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (history) setMsgs(history); }, [history]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);
  const mode = session?.ai.mode ?? 'offline';
  const send = async (text: string) => {
    const q = text.trim(); if (!q || busy) return;
    setDraft(''); setMsgs((m) => [...m, { id: -Date.now(), role: 'user', content: q }]); setBusy(true);
    try { const r = await post<Msg>('/assistant', { text: q, lang: 'en', screen: route.screen }); setMsgs((m) => [...m, r]); if (r.navigate) open(r.navigate); }
    catch (e: any) { setMsgs((m) => [...m, { id: -Date.now(), role: 'assistant', content: `Something went wrong: ${e.message}` }]); }
    finally { setBusy(false); }
  };
  return (
    <ChatRail rail={rail} label="Dalil"
      brand={<RailBrandCard className="dark:border-white/10 dark:bg-card/80" onCollapse={() => rail.setOpen(false)}><img src="/brand/logo-on-light.png" alt="QIB" className="h-8 w-auto dark:hidden" /><img src="/brand/logo-on-dark.png" alt="QIB" className="hidden h-8 w-auto dark:block" /></RailBrandCard>}
      collapsedBrand={<><img src="/brand/mark.png" alt="" className="h-6 w-6 dark:hidden" /><img src="/brand/mark-on-dark.png" alt="" className="hidden h-6 w-6 dark:block" /></>}
      header={
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">D</span>
          <div className="min-w-0 leading-tight"><p className="text-sm font-semibold">Dalil <span className="ar text-muted-foreground">دليل</span></p><p className="truncate text-[11px] text-muted-foreground">Co-pilot · answers from the same database, cites the clause</p></div>
          <span className="ms-auto flex items-center gap-1.5">
            <ChatStatusBadge state={mode === 'claude' ? 'live' : 'idle'}>{mode === 'claude' ? 'Claude' : 'Offline'}</ChatStatusBadge>
            <button type="button" title="New conversation" aria-label="New conversation" className="text-muted-foreground hover:text-foreground" onClick={async () => { await api('/assistant/history', { method: 'DELETE' }); setMsgs([]); reload(); }}><RotateCcw className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      }
      transcript={
        <div className="space-y-3 text-[13px]">
          {!msgs.length ? (
            <ChatAssistantTurn avatar="D">
              <p className="text-foreground">Ask me why a customer is not eligible, what is waiting on you, what Hami blocked, or what a policy says. I answer from the same data the screens use, cite the clause, and prepare actions for you to confirm.</p>
              {mode === 'offline' ? <p className="mt-1.5 text-[11px]"><Chip tone="warn">Offline</Chip> Replit AI Integrations is not connected, so answers come from fixed matching over the same tools.</p> : null}
            </ChatAssistantTurn>
          ) : null}
          {msgs.map((m) => (m.role === 'user' ? <ChatUserTurn key={m.id}>{m.content}</ChatUserTurn> : <ChatAssistantTurn key={m.id} avatar="D"><Answer m={m} onConfirmed={reload} /></ChatAssistantTurn>))}
          {busy ? <ChatAssistantTurn avatar="D"><span className="animate-pulse">Checking the policy and the records…</span></ChatAssistantTurn> : null}
          <div ref={end} />
        </div>
      }
      suggestions={<ChatSuggestions items={persona?.suggestions ?? []} onSelect={send} />}
      composer={<ChatComposer value={draft} onChange={setDraft} onSend={() => send(draft)} placeholder="Ask Dalil…" busy={busy} />}
    />
  );
}
