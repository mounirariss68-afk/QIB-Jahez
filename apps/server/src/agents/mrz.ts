/** ICAO 9303 TD3 (passport) machine-readable zone: build and verify check digits. Synthetic data only. */
const W = [7, 3, 1];
const val = (ch: string) => (ch === '<' ? 0 : ch >= '0' && ch <= '9' ? Number(ch) : ch.charCodeAt(0) - 55);
export const checkDigit = (s: string) => String([...s].reduce((sum, ch, i) => sum + val(ch) * W[i % 3], 0) % 10);
const pad = (s: string, n: number) => (s.toUpperCase().replace(/[^A-Z0-9<]/g, '<') + '<'.repeat(n)).slice(0, n);
const ymd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);

export function buildMrz(p: { surname: string; given: string; number: string; nationality: string; dob: string; sex: 'M' | 'F'; expiry: string; issuer?: string }) {
  const names = pad(`${p.surname.replace(/ /g, '<')}<<${p.given.replace(/ /g, '<')}`, 39);
  const l1 = `P<${pad(p.issuer ?? p.nationality, 3)}${names}`;
  const num = pad(p.number, 9), dob = ymd(p.dob), exp = ymd(p.expiry);
  const personal = '<'.repeat(14);
  const body = `${num}${checkDigit(num)}${pad(p.nationality, 3)}${dob}${checkDigit(dob)}${p.sex}${exp}${checkDigit(exp)}${personal}${checkDigit(personal)}`;
  const composite = checkDigit(num + checkDigit(num) + dob + checkDigit(dob) + exp + checkDigit(exp) + personal + checkDigit(personal));
  return { line1: l1, line2: body + composite };
}
export function verifyMrz(line2: string): { valid: boolean; number: string; dob: string; expiry: string; problems: string[] } {
  const problems: string[] = [];
  if (line2.length !== 44) problems.push('length');
  const num = line2.slice(0, 9), c1 = line2[9], dob = line2.slice(13, 19), c2 = line2[19], exp = line2.slice(21, 27), c3 = line2[27], pers = line2.slice(28, 42), c4 = line2[42], c5 = line2[43];
  if (checkDigit(num) !== c1) problems.push('number check digit');
  if (checkDigit(dob) !== c2) problems.push('date of birth check digit');
  if (checkDigit(exp) !== c3) problems.push('expiry check digit');
  if (checkDigit(pers) !== c4) problems.push('personal number check digit');
  if (checkDigit(num + c1 + dob + c2 + exp + c3 + pers + c4) !== c5) problems.push('composite check digit');
  const d = (s: string) => `${Number(s.slice(0, 2)) > 40 ? '19' : '20'}${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
  return { valid: problems.length === 0, number: num.replace(/</g, ''), dob: d(dob), expiry: d(exp), problems };
}
