/**
 * One Click Finance, the four steps QIB describes: choose the amount and
 * tenor, confirm the summary, OTP and e-signature, funds on the way. The
 * acceptance is posted to Jahiz, which logs it with One Click (simulated).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useApp } from '../state';
import { C, R, SP, qar } from '../theme';
import { Btn, Card, Chip, Row, T } from '../ui';
import { Header } from './Header';

const RATE = 0.06; // indicative profit rate p.a. (POL-04 indicativeRatePct default)
const instalment = (amount: number, tenor: number) => { const r = RATE / 12; return amount * r / (1 - Math.pow(1 + r, -tenor)); };

export function OfferScreen({ navigation }: any) {
  const { home, customerId, lang, tr, refreshAfterAction } = useApp();
  const max = home?.offer?.amount ?? 0;
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState(max);
  const [tenor, setTenor] = useState(home?.offer?.tenor ?? 48);
  const [otp, setOtp] = useState('');
  const [signed, setSigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const inst = useMemo(() => instalment(amount, tenor), [amount, tenor]);
  if (!home || !customerId) return null;
  const amounts = [0.25, 0.5, 0.75, 1].map((p) => Math.round(max * p / 500) * 500).filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  const tenors = [12, 24, 36, 48, 60].filter((t) => t <= 60);
  const accept = async () => { setBusy(true); try { const r = await api.accept(customerId, amount, tenor); setRef(r.reference); setStep(4); await refreshAfterAction(); } finally { setBusy(false); } };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={tr('oneClick')} back />
      <View style={st.steps}>{[1, 2, 3, 4].map((n) => <View key={n} style={[st.dot, n <= step && { backgroundColor: C.orange }]} />)}<T size={12} dim style={{ marginStart: 8 }}>{tr('stepOf')} {step} {tr('of')} 4</T></View>
      <ScrollView contentContainerStyle={{ padding: SP.md, paddingBottom: 60 }}>
        {step === 1 ? (
          <>
            <Card tone="navy"><T size={12} color="#CCE3EF">{tr('preApproved')}</T><T size={30} bold color="#fff">{qar(max)}</T><T size={12} color="#CCE3EF">{lang === 'ar' ? 'مرابحة شخصية · بدون أوراق' : 'Personal Murabaha · no paperwork'}</T></Card>
            <T bold style={{ marginTop: SP.lg }}>{tr('chooseAmount')}</T>
            <Row style={{ flexWrap: 'wrap', marginTop: 8 }}>{amounts.map((v) => <Pressable key={v} onPress={() => setAmount(v)} style={[st.pill, amount === v && st.pillOn]}><T size={13} bold color={amount === v ? '#fff' : C.navy}>{qar(v)}</T></Pressable>)}</Row>
            <T bold style={{ marginTop: SP.lg }}>{tr('tenor')}</T>
            <Row style={{ flexWrap: 'wrap', marginTop: 8 }}>{tenors.map((v) => <Pressable key={v} onPress={() => setTenor(v)} style={[st.pill, tenor === v && st.pillOn]}><T size={13} bold color={tenor === v ? '#fff' : C.navy}>{v} {tr('months')}</T></Pressable>)}</Row>
            <Card style={{ marginTop: SP.lg }}><Row between><T dim>{tr('monthlyInstalment')}</T><T bold size={18}>{qar(Math.round(inst))}</T></Row><Row between style={{ marginTop: 6 }}><T dim>{tr('totalRepayable')}</T><T bold>{qar(Math.round(inst * tenor))}</T></Row></Card>
            <Btn label={tr('continue')} kind="orange" onPress={() => setStep(2)} style={{ marginTop: SP.lg }} />
          </>
        ) : step === 2 ? (
          <>
            <Card>
              <T bold size={16}>{lang === 'ar' ? 'ملخص التمويل' : 'Finance summary'}</T>
              {[[lang === 'ar' ? 'المبلغ' : 'Amount', qar(amount)], [tr('tenor'), `${tenor} ${tr('months')}`], [tr('monthlyInstalment'), qar(Math.round(inst))], [tr('totalRepayable'), qar(Math.round(inst * tenor))], [lang === 'ar' ? 'الحساب' : 'Account', home.accounts[0]?.iban ?? '—']].map(([k, v]) => <Row key={String(k)} between style={{ marginTop: 10 }}><T dim>{k}</T><T bold>{v}</T></Row>)}
            </Card>
            <T size={12} dim style={{ marginTop: SP.md }}>{lang === 'ar' ? 'القسط الاستدلالي بمعدل ربح 6% سنوياً؛ الشروط النهائية في اتفاقية المرابحة.' : 'Indicative instalment at a 6% p.a. profit rate; the final terms are in the Murabaha agreement.'}</T>
            <Btn label={tr('confirm')} kind="orange" onPress={() => setStep(3)} style={{ marginTop: SP.lg }} />
            <Btn label={tr('back')} kind="ghost" onPress={() => setStep(1)} style={{ marginTop: SP.sm }} />
          </>
        ) : step === 3 ? (
          <>
            <Card>
              <T bold>{tr('otp')}</T>
              <TextInput value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="••••••" style={st.otp} />
              <T size={11} dim>{lang === 'ar' ? 'تجريبي: أي 6 أرقام تُقبل.' : 'Demo: any 6 digits are accepted.'}</T>
            </Card>
            <Pressable onPress={() => setSigned(!signed)} style={[st.sign, signed && { borderColor: C.ok }]}><Ionicons name={signed ? 'checkbox' : 'square-outline'} size={22} color={signed ? C.ok : C.muted} /><T size={13} style={{ flex: 1 }}>{tr('esign')}</T></Pressable>
            <Btn label={tr('acceptOneClick')} kind="orange" icon="flash-outline" disabled={otp.length < 6 || !signed} busy={busy} onPress={accept} style={{ marginTop: SP.lg }} />
            <Btn label={tr('back')} kind="ghost" onPress={() => setStep(2)} style={{ marginTop: SP.sm }} />
          </>
        ) : (
          <>
            <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
              <View style={st.okRing}><Ionicons name="checkmark" size={40} color="#fff" /></View>
              <T bold size={18} align="center" style={{ marginTop: SP.md }}>{tr('disbursed')}</T>
              <T size={24} bold align="center" color={C.navy}>{qar(amount)}</T>
              <Chip tone="ok">{ref ?? ''}</Chip>
              <T size={12} dim align="center" style={{ marginTop: SP.md }}>{tr('disbursedNote')}</T>
            </Card>
            <Btn label={tr('done')} onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} style={{ marginTop: SP.lg }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
const st = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: SP.md, paddingBottom: 0 },
  dot: { width: 28, height: 6, borderRadius: 3, backgroundColor: C.line },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', marginEnd: 8, marginBottom: 8 },
  pillOn: { backgroundColor: C.blue, borderColor: C.blue },
  otp: { fontSize: 28, letterSpacing: 10, textAlign: 'center', borderWidth: 1, borderColor: C.line, borderRadius: R.sm, padding: 12, marginVertical: SP.sm, color: C.ink },
  sign: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#fff', borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: C.line, marginTop: SP.md },
  okRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.ok, alignItems: 'center', justifyContent: 'center' },
});
