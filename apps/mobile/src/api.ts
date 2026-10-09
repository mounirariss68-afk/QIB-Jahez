/**
 * The Jahiz server. On Replit the mobile workflow sets EXPO_PUBLIC_API_URL to
 * the app's public domain; locally it defaults to the dev server's host on
 * port 5000. Everything the phone does goes through /api/mobile.
 */
import Constants from 'expo-constants';

function defaultBase(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');
  // Expo Go on a phone: the Metro host is the computer running the server.
  const host = (Constants.expoConfig as any)?.hostUri?.split(':')[0];
  return host ? `http://${host}:5000` : 'http://localhost:5000';
}
export const API_BASE = defaultBase();

export type Home = {
  now: string; today: string;
  customer: { id: string; nameEn: string; nameAr: string; lang: 'en' | 'ar'; segment: string; tier: string; isQatari: boolean; nationality: string; mobile: string | null; email: string | null; rimNo: string; employer: string | null; salaryTotal: number; marketing: boolean; optouts: string[]; status: string };
  accounts: { id: number; type: string; iban: string; status: string; balance: number; last_txn_on: string | null }[];
  cards: { id: number; card_limit: number; outstanding: number; min_due: number; dpd: number; status: string }[];
  facilities: { id: number; product: string; principal: number; outstanding: number; instalment: number; maturity: string; dpd: number }[];
  standingOrders: { id: number; beneficiary_type: string; beneficiary_name: string; amount: number }[];
  deposits: number;
  documents: { type: string; number: string; expiresOn: string; issuedOn: string; expired: boolean; expiringSoon: boolean }[];
  inbox: { id: number; channel: string; kind: string; at: string; subject: string | null; body: string; lang: string; ref: string | null; read_at: string | null; meta: any }[];
  case: { ref: string; state: string; cls: string; primary_reason: string; reasons: string[]; paused: boolean; opened_at: string } | null;
  ask: { en: string; ar: string; doc?: string; reason: string; ref: string } | null;
  uploads: { id: number; type: string; state: string; received_at: string; recommendation: string | null; overall_confidence: number | null }[];
  offer: { amount: number; tenor: number; since: string | null; ref: string | null } | null;
  accepted: boolean;
  eligibility: { eligible: boolean; amount: number | null; reason_codes: string[] } | null;
};
export type DemoCustomer = { id: string; nameEn: string; nameAr: string; segment: string; lang: 'en' | 'ar'; edge: string | null; title: string | null };
export type Specimen = { kind: string; label: string; label_ar: string; type: string; flaw: string | null };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}/api/mobile${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const text = await r.text();
  let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = { error: text.slice(0, 200) }; }
  if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
  return body as T;
}
export const api = {
  customers: () => call<DemoCustomer[]>('/customers'),
  specimens: () => call<Specimen[]>('/specimens'),
  home: (id: string) => call<Home>(`/${id}/home`),
  upload: (id: string, body: { specimen?: string; image?: { data: string; mime: string; name?: string; type?: string }; text?: string }) => call<{ ok: boolean; documentIds: number[] }>(`/${id}/upload`, { method: 'POST', body: JSON.stringify(body) }),
  reply: (id: string, text: string) => call<{ ok: boolean }>(`/${id}/reply`, { method: 'POST', body: JSON.stringify({ text }) }),
  accept: (id: string, amount: number, tenor: number) => call<{ ok: boolean; reference: string }>(`/${id}/accept-offer`, { method: 'POST', body: JSON.stringify({ amount, tenor }) }),
  read: (id: string) => call<{ ok: boolean }>(`/${id}/read`, { method: 'POST', body: '{}' }),
};
