/**
 * Who is asking. The persona comes from the x-persona header (the switcher in
 * the shell); every data route applies that persona's scope on the server.
 */
import type { Request } from 'express';
import { PERSONA, PERSONAS, may, type ActionType, type PersonaKey, type Persona, type Subject } from '@jahiz/domain';

export const RM_ID_FOR_PERSONA = 'DEMO-RM-01';

export function personaOf(req: Request): Persona {
  const key = String(req.header('x-persona') ?? req.query.persona ?? 'head') as PersonaKey;
  return PERSONA[key] ?? PERSONA.head;
}
export const personaRmId = (p: Persona) => (p.key === 'rm' ? RM_ID_FOR_PERSONA : null);

/** SQL fragment restricting cases (alias k) and customers (alias cu) to the persona's scope. */
export function scopeSql(p: Persona, kAlias = 'k', cuAlias = 'cu'): { sql: string; params: unknown[] } {
  const s = p.scope;
  if (s.metricsOnly) return { sql: 'FALSE', params: [] };
  const parts: string[] = []; const params: unknown[] = [];
  if (s.segments) { params.push(s.segments); parts.push(`${cuAlias}.segment = ANY($${params.length})`); }
  if (s.classes) { params.push(s.classes); parts.push(`${kAlias}.cls = ANY($${params.length})`); }
  if (s.ownBook) { params.push(RM_ID_FOR_PERSONA); parts.push(`${cuAlias}.rm_id = $${params.length}`); }
  return { sql: parts.length ? parts.join(' AND ') : 'TRUE', params };
}
/** Rebase $n placeholders of a scope fragment after `offset` earlier params. */
export function rebase(sql: string, offset: number) { return sql.replace(/\$(\d+)/g, (_m, n) => `$${Number(n) + offset}`); }

export function allowed(p: Persona, action: ActionType, subject: Subject = {}) { return !!may(p.key, action, subject, personaRmId(p)); }
export function assertAllowed(p: Persona, action: ActionType, subject: Subject = {}) {
  if (!allowed(p, action, subject)) { const e: any = new Error(`${p.role} may not ${action.replace(/_/g, ' ').toLowerCase()}${subject.segment ? ` for ${subject.segment}` : ''} (authority matrix, DESIGN §8)`); e.status = 403; throw e; }
}
export const personas = () => PERSONAS.map((p) => ({ key: p.key, name: p.name, name_ar: p.name_ar, role: p.role, role_ar: p.role_ar, initials: p.initials, sees: p.sees, owns: p.owns, home: p.home, suggestions: p.suggestions, suggestions_ar: p.suggestions_ar }));
