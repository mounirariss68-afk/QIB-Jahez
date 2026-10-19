/**
 * Plain language for the live log. The engine writes activity for its own
 * trail ("Examined HR_LETTER #46 for DEMO-C-00003 (Claude, assurance
 * APP_UPLOAD) → HR_LETTER verified at 0.90 confidence: Explained gap
 * 2026-07: UNPAID_LEAVE"); a room cannot follow that. Each line becomes
 * "who: what happened", the way a colleague would say it ("Fahis: HR letter
 * validated, unpaid leave"). The original line stays available on hover.
 */
export type PlainLine = { who: string; text: string; kind: 'agent' | 'person' | 'customer' | 'system' | 'reset' | 'skip'; clause?: string | null };

const AGENT: Record<string, string> = { raqib: 'Raqib', munadi: 'Munadi', mustaqbil: 'Mustaqbil', fahis: 'Fahis', muhaddith: 'Muhaddith', muwathiq: 'Muwathiq', muahil: 'Muahil', munabbih: 'Munabbih', hami: 'Hami', dalil: 'Dalil' };
const PERSON: Record<string, string> = { head: 'Head of Retail Credit', credit: 'Credit Policy', ops: 'Operations', supervisor: 'Operations Supervisor', compliance: 'Compliance', rm: 'The RM', collections: 'Collections', steward: 'Data Steward' };
const DOC: Record<string, string> = { QID: 'QID', PASSPORT: 'passport', HR_LETTER: 'HR letter', SALARY_CERT: 'salary certificate', BANK_STATEMENT: 'bank statement', LIABILITY_LETTER: 'liability letter', EMPLOYMENT_LETTER: 'employment letter' };
const MSG: Record<string, string> = { REQUEST: 'request', REMINDER: 'reminder', FINAL_NOTICE: 'final notice', OFFER: 'offer', PRE_EXPIRY: 'pre-expiry notice', DOC_REJECTED: 'document-rejected notice', OPTOUT_CONFIRM: 'opt-out confirmation', CURRENT_ACCOUNT_OFFER: 'current account offer', ESCALATION: 'escalation notice', SERVICE: 'service message' };
const CHANNEL: Record<string, string> = { PUSH: 'push', INAPP: 'in-app message', EMAIL: 'e-mail', SMS: 'SMS', LETTER: 'letter', WHATSAPP: 'WhatsApp' };
const CLASSIFY: Record<string, string> = { DOCUMENT: 'it is a document', OPT_OUT: 'the customer opted out', QUESTION: 'it is a question', DISPUTE: 'it is a dispute', HARDSHIP: 'the customer reports hardship', COMPLAINT: 'it is a complaint', OUT_OF_OFFICE: 'an out-of-office reply', UNRELATED: 'not about the request' };
/** Human steps: [matches the engine's step label, who decides, what it says when done, what it says while waiting]. */
const STEP_DONE: [RegExp, string, string, string][] = [
  [/checker approves the qid update/i, 'Operations Supervisor', 'QID update approved', 'approve the QID update'],
  [/accept the explained gap/i, 'Credit Policy', 'explained gap accepted', 'accept the explained gap'],
  [/decides the employer/i, 'Credit Policy', 'employer approved', 'decide on the employer'],
  [/decides the restriction/i, 'Operations Supervisor', 'restriction approved', 'decide on the restriction'],
  [/acknowledges the hand-off/i, 'Collections', 'hand-off acknowledged', 'acknowledge the hand-off'],
  [/domain approver decides/i, 'Head of Retail Credit', 'policy change approved', 'approve the policy change'],
  [/rm.*approv|approves the message/i, 'The RM', 'message approved', 'approve the message'],
];

const num = (n: string | number) => Number(String(n).replace(/,/g, '')).toLocaleString('en-US');
const dateOf = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
const monthOf = (ym: string) => { const [y, m] = ym.split('-'); const d = new Date(Number(y), Number(m) - 1, 1); return isNaN(+d) ? ym : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); };
const low = (s: string) => s.replace(/_/g, ' ').toLowerCase();
const lead = (s: string) => s.trim().replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase());
const persona = (k: string) => PERSON[k.trim().toLowerCase()] ?? k.trim();
const idsOut = (s: string) => s.replace(/\bDEMO-[A-Z]+-\d+\b/g, '').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();

export function plainActivity(a: { agent?: string | null; trigger?: string | null; action?: string | null; result?: string | null; clause?: string | null }): PlainLine {
  const act = a.action ?? ''; const res = a.result ?? ''; const trig = a.trigger ?? '';
  const clause = a.clause ?? null;
  let m: RegExpMatchArray | null;

  if (a.agent) {
    const who = AGENT[a.agent] ?? a.agent;
    const line = (text: string): PlainLine => ({ who, text, kind: 'agent', clause });
    switch (a.agent) {
      case 'raqib':
        if ((m = res.match(/(\d[\d,]*) eligible/))) { const n = act.match(/on (\d[\d,]*) customer/); return line(`${n ? `${num(n[1])} customers checked, ` : ''}${num(m[1])} eligible${(m = res.match(/(\d+) opened/)) && Number(m[1]) ? `, ${m[1]} new case${m[1] === '1' ? '' : 's'}` : ''}`); }
        if (/opened/i.test(act)) return line(`case opened${(m = act.match(/\b(R\d\d)\b/)) ? ` (${m[1]})` : ''}`);
        break;
      case 'mustaqbil':
        if (/^Classified reply/i.test(act)) { const k = res.split(' ')[0]; return line(`reply read, ${CLASSIFY[k] ?? low(k)}`); }
        if (/^Received/i.test(act)) return line('document received');
        if (/^Routed/i.test(act)) return line('reply routed to the case');
        break;
      case 'fahis':
        if ((m = act.match(/^Examined (\w+)/))) {
          const doc = DOC[m[1]] ?? low(m[1]);
          if (/rejected/i.test(res)) return line(`${doc} rejected, ${/differs from the record|different person/i.test(res) ? 'it belongs to someone else' : (res.split(':')[1] ?? '').trim().toLowerCase() || 'it does not match the record'}`);
          const conf = (m = res.match(/at (\d\.\d+) confidence/)) ? ` (${Math.round(Number(m[1]) * 100)}%)` : '';
          let finding = (res.split('confidence:')[1] ?? '').trim();
          if ((m = finding.match(/Explained gap (\d{4}-\d{2}): (\w+)/))) finding = `${low(m[2])} in ${monthOf(m[1])}`;
          else if ((m = finding.match(/(\w+) expiry \S+ → (\S+)/))) finding = `valid to ${dateOf(m[2])}`;
          else finding = finding.replace(/→/g, 'to').toLowerCase();
          return line(`${doc} validated${conf}${finding ? `, ${finding}` : ''}`);
        }
        break;
      case 'hami':
        if ((m = act.match(/^Checked (\w+) (\w+) for/))) { const what = `${MSG[m[2]] ?? low(m[2])} by ${CHANNEL[m[1]] ?? low(m[1])}`; return line(/^Blocked|^Withheld/i.test(res) ? `${what} blocked, ${lead(res.split(':').slice(1).join(':') || res)}` : `${what} allowed`); }
        if (/^Checked the One Click offer/i.test(act)) return line(/^Withheld|^Blocked/i.test(res) ? `offer withheld, ${lead(res.split(':').slice(1).join(':') || res)}` : 'offer allowed');
        if (/opt-out/i.test(act)) return line('opt-out applied, offers blocked, the service channel kept');
        if (/^Effect preview/i.test(act)) return line(`effect of the change previewed${(m = res.match(/(\d+) scheduled reminder/)) ? `, ${m[1]} reminders move` : ''}`);
        if (/^Proposed a temporary restriction/i.test(act)) return line(`restriction proposed, waiting for ${res.replace(/^Waiting on /i, '').replace(/\(.*\)/, '').trim()}`);
        if (/^Re-planned/i.test(act)) return line(`${(m = res.match(/(\d+)/)) ? m[1] : 'the'} scheduled messages re-planned under the new policy`);
        if (/consent and suppression/i.test(act) || /passed/i.test(res)) return line('consent and suppression checks passed');
        break;
      case 'muahil':
        if (/^Re-ran the eligibility check/i.test(act)) { if ((m = res.match(/Eligible: QAR ([\d,]+) \/ (\d+) months/))) return line(`eligible, QAR ${m[1]} over ${m[2]} months`); return line(`still not eligible${(m = res.match(/\b(R\d\d)\b/)) ? ` (${m[1]})` : ''}`); }
        if ((m = act.match(/^Re-qualified (\d+) customer/))) return line(`${m[1]} customers re-qualified${(m = res.match(/(\d+) now eligible/)) ? `, ${m[1]} now eligible` : ''}`);
        if (/^Handed .* to One Click/i.test(act)) return line(/scheduled/i.test(res) ? `offer scheduled${(m = res.match(/at (.+)$/)) ? ` for ${m[1]}` : ''}` : 'offer handed to One Click, it is on the phone');
        break;
      case 'muhaddith':
        if (/^Applied/i.test(act)) { if (/QID/.test(res)) return line('record updated, QID renewed'); if (/passport/i.test(res)) return line('record updated, passport renewed'); if ((m = res.match(/salary_credits\.(\d{4}-\d{2})/))) return line(`record updated, ${monthOf(m[1])} salary explained`); return line(`record updated (${res.split('.').slice(-1)[0].replace(/_/g, ' ')})`); }
        break;
      case 'munadi':
        if ((m = act.match(/^Sent (\w+) by (\w+)/))) return line(`${MSG[m[1]] ?? low(m[1])} sent by ${CHANNEL[m[2]] ?? low(m[2])}${/Allowed by Hami/i.test(res) ? ', Hami allowed it' : ''}`);
        if (/^Planned/i.test(act)) return line(`${(m = res.match(/(\d+) attempt/)) ? `${m[1]} notices planned` : 'notices planned'}${(m = res.match(/first at (.+)$/)) ? `, first on ${m[1]}` : ''}`);
        if (/brief/i.test(act)) return line('brief for the RM drafted');
        break;
      case 'muwathiq':
        return line(`employer pack prepared${(m = res.match(/recommend\w*:? (\w+)/i)) ? `, recommends ${m[1].toLowerCase()}` : ''}`);
      case 'munabbih':
        if (/pause/i.test(act) || /pause/i.test(res)) return line('case paused, offers suppressed');
        if (/cool/i.test(res) || /cool/i.test(act)) return line('payment seen, cooling period started');
        if (/hand/i.test(act)) return line('handed to Collections');
        break;
    }
    return line(idsOut(act).replace(/^\w/, (c) => c.toLowerCase()).slice(0, 80));
  }

  // The Director's own rows: the customer, a person, or the clock.
  if (trig.startsWith('Director')) {
    if (/^Restored the seeded state/i.test(act)) return { who: 'Scenario', text: `reset${(m = res.match(/(\d+) record/)) ? `, ${m[1]} record${m[1] === '1' ? '' : 's'} restored` : ''}`, kind: 'reset', clause };
    // The engine logs the customer's events and the human steps itself; the Director's own line for them would repeat it.
    if (/^Customer app|^Inbound|^Payment|^Data health/i.test(act) || /^(APPROVED|REJECTED|Approved|Rejected) by |^Employer approved|^Done by hand|^Waiting for you/i.test(res)) return { who: '', text: '', kind: 'skip', clause };
    if (/^Due messages/i.test(act)) return { who: 'Scheduler', text: `messages due now checked${(m = res.match(/(\d+) sent, (\d+) blocked/)) ? `: ${m[1]} sent, ${m[2]} blocked` : ''}`, kind: 'system', clause };
    if (/^Virtual clock/i.test(act)) return { who: 'Clock', text: `${(m = act.match(/\+(\d+) day/)) ? `${m[1]} days pass` : 'time passes'}${(m = res.match(/(\d+) sent, (\d+) blocked, (\d+) deadline/)) ? `: ${m[1]} messages sent, ${m[2]} blocked, ${m[3]} deadlines reached` : ''}`, kind: 'system', clause };
    if (/escalation/i.test(act)) return { who: 'Scenario', text: 'escalated to the RM', kind: 'system', clause };
    if (/policy change/i.test(act)) return { who: 'Operations Supervisor', text: `policy change proposed${/waiting on head/i.test(res) ? ', waiting for the Head' : ''}`, kind: 'person', clause };
    return { who: 'Scenario', text: idsOut(res || act).slice(0, 80), kind: 'system', clause };
  }

  // System rows: the engine's human steps and inbound events.
  if ((m = act.match(/^App from .*: (\d+) attachment/))) return Number(m[1]) ? { who: 'Customer', text: 'document uploaded from the app', kind: 'customer', clause } : { who: 'Customer', text: `replied "${res.trim()}"`, kind: 'customer', clause };
  if (/^E-mail from/i.test(act)) return { who: 'Customer', text: 'e-mail received with an attachment', kind: 'customer', clause };
  if (/^Instalment paid/i.test(act)) return { who: 'Customer', text: 'instalment paid', kind: 'customer', clause };
  if ((m = act.match(/^Waiting on (.+)$/))) { const who = m[1].replace(/\s*\(.*\)/, '').replace(' Officer', '').replace(/ & Digital Finance/, ''); const done = STEP_DONE.find(([re]) => re.test(res)); return { who: `Waiting for ${who}`, text: done?.[3] ?? lead(res.replace(/ or park$/, '')), kind: 'person', clause }; }
  if ((m = act.match(/^(Approved|Declined): (.+)$/))) { const done = STEP_DONE.find(([re]) => re.test(m![2])); if (m[1] === 'Declined') return { who: done?.[1] ?? 'The checker', text: `rejected${res ? `, ${res.toLowerCase()}` : ''}`, kind: 'person', clause }; return { who: done?.[1] ?? 'The approver', text: done?.[2] ?? 'approved', kind: 'person', clause }; }
  if (/^Advanced/i.test(act)) return { who: '', text: '', kind: 'skip', clause }; // the Director's clock line carries the figures
  return { who: 'System', text: idsOut(act).slice(0, 80), kind: 'system', clause };
}
