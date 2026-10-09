/** Pay & Transfer, More, the Smart button sheet and Profile — the parts of the real app that the demo shows but does not execute. */
import React from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../state';
import { C, R, SP, qar } from '../theme';
import { Btn, Card, Chip, ListItem, Row, Section, T } from '../ui';
import { Header } from './Header';

const demoOnly = (title: string, note: string) => Alert.alert(title, note);

export function PayScreen() {
  const { home, tr, lang } = useApp();
  if (!home) return null;
  const items: [keyof typeof Ionicons.glyphMap, string, string][] = [
    ['swap-horizontal-outline', tr('ownAccounts'), lang === 'ar' ? 'فوري' : 'Instant'],
    ['person-outline', tr('localTransfer'), lang === 'ar' ? 'إلى أي بنك في قطر' : 'To any bank in Qatar'],
    ['globe-outline', tr('intlTransfer'), lang === 'ar' ? 'بسعر صرف شفاف' : 'With a transparent rate'],
    ['receipt-outline', tr('billPayment'), 'Kahramaa · Ooredoo · Vodafone'],
    ['cash-outline', tr('requestMoney'), lang === 'ar' ? 'طلب أموال من جهة اتصال' : 'Ask a contact to pay you'],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={tr('pay')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={{ padding: SP.md }}><Card tone="blue"><T color="#CCE3EF" size={12}>{tr('available')}</T><T color="#fff" bold size={24}>{qar(home.accounts[0]?.balance ?? 0)}</T></Card></View>
        {items.map(([icon, title, sub]) => <ListItem key={title} icon={icon} title={title} subtitle={sub} onPress={() => demoOnly(title, tr('demoOnly'))} />)}
        <T size={11} dim style={{ padding: SP.md }}>{tr('demoOnly')}</T>
      </ScrollView>
    </View>
  );
}

export function MoreScreen({ navigation }: any) {
  const { tr } = useApp();
  const items: [keyof typeof Ionicons.glyphMap, string, () => void][] = [
    ['person-circle-outline', tr('profile'), () => navigation.navigate('Profile')],
    ['id-card-outline', tr('personalData'), () => navigation.navigate('Documents')],
    ['notifications-outline', tr('inbox'), () => navigation.navigate('Inbox')],
    ['cash-outline', tr('currency'), () => demoOnly(tr('currency'), tr('demoOnly'))],
    ['document-text-outline', tr('cheques'), () => demoOnly(tr('cheques'), tr('demoOnly'))],
    ['construct-outline', tr('requests'), () => demoOnly(tr('requests'), tr('demoOnly'))],
    ['add-circle-outline', tr('apply'), () => demoOnly(tr('apply'), tr('demoOnly'))],
    ['trending-up-outline', tr('ipo'), () => demoOnly(tr('ipo'), tr('demoOnly'))],
    ['help-circle-outline', tr('help'), () => demoOnly(tr('help'), tr('demoOnly'))],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={tr('more')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>{items.map(([icon, title, go]) => <ListItem key={title} icon={icon} title={title} onPress={go} />)}</ScrollView>
    </View>
  );
}

export function SmartSheet({ visible, onClose, navigation }: { visible: boolean; onClose: () => void; navigation: any }) {
  const { home, tr, lang } = useApp();
  if (!home) return null;
  const debt = home.facilities.reduce((s, f) => s + Number(f.outstanding), 0) + home.cards.reduce((s, k) => s + Number(k.outstanding), 0);
  const assets = home.accounts.reduce((s, a) => s + Number(a.balance), 0);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.scrim} onPress={onClose} />
      <View style={st.sheet}>
        <Row between><T bold size={17}>{lang === 'ar' ? 'الزر الذكي' : 'Smart button'}</T><Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={C.muted} /></Pressable></Row>
        <Card tone="navy" style={{ marginTop: SP.md }}><T size={12} color="#CCE3EF">{tr('netWorth')}</T><T size={26} bold color="#fff">{qar(assets - debt)}</T><T size={11} color="#CCE3EF">{lang === 'ar' ? 'الأصول' : 'Assets'} {qar(assets)} · {lang === 'ar' ? 'الالتزامات' : 'Liabilities'} {qar(debt)}</T></Card>
        <Row style={{ marginTop: SP.md }}>
          <Card style={{ flex: 1 }}><T size={11} dim>{tr('absher')}</T><T bold size={18}>{(1240 + (home.customer.id.charCodeAt(home.customer.id.length - 1) * 37) % 900).toLocaleString('en-US')}</T></Card>
          <Card style={{ flex: 1 }}><T size={11} dim>{tr('carbon')}</T><T bold size={18}>0.42 t</T></Card>
        </Row>
        <View style={{ marginTop: SP.md, gap: 8 }}>
          <Btn label={tr('contactRm')} icon="call-outline" kind="ghost" onPress={() => { onClose(); demoOnly(tr('contactRm'), home.customer.segment === 'VVIP' || home.customer.segment === 'HNWI' ? (lang === 'ar' ? 'سيتصل بك مدير علاقتك خلال ساعة (محاكاة).' : 'Your relationship manager will call you within the hour (simulated).') : tr('demoOnly')); }} />
          <Btn label={tr('bookBranch')} icon="calendar-outline" kind="ghost" onPress={() => { onClose(); demoOnly(tr('bookBranch'), tr('demoOnly')); }} />
          <Btn label={tr('faqs')} icon="help-buoy-outline" kind="ghost" onPress={() => { onClose(); demoOnly(tr('faqs'), tr('demoOnly')); }} />
        </View>
      </View>
    </Modal>
  );
}

export function ProfileScreen() {
  const { home, tr, lang, setLang, signOut } = useApp();
  if (!home) return null;
  const c = home.customer;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={tr('profile')} back />
      <ScrollView contentContainerStyle={{ padding: SP.md, paddingBottom: 60 }}>
        <Card><Row><View style={st.avatar}><T color="#fff" bold size={18}>{c.nameEn.split(' ').map((x) => x[0]).slice(0, 2).join('')}</T></View><View style={{ flex: 1 }}><T bold size={16}>{lang === 'ar' ? c.nameAr : c.nameEn}</T><T size={12} dim>{c.id} · {c.rimNo}</T><Chip tone="blue">{c.tier}</Chip></View></Row></Card>
        <Section title={tr('personalData')}>
          <Card>
            {[[tr('mobile'), c.mobile ?? '—'], [tr('email'), c.email ?? '—'], [tr('employer'), c.employer ?? '—'], [tr('salary'), qar(c.salaryTotal)], [lang === 'ar' ? 'الجنسية' : 'Nationality', c.nationality], [tr('marketingConsent'), c.marketing ? tr('on') : tr('off')]].map(([k, v]) => <Row key={String(k)} between style={{ paddingVertical: 6 }}><T dim size={13}>{k}</T><T bold size={13}>{v}</T></Row>)}
          </Card>
        </Section>
        <Section title={lang === 'ar' ? 'الإعدادات' : 'Settings'}>
          <Card>
            <Row between style={{ paddingVertical: 6 }}><T>{tr('language')}</T><Row><T size={13} dim>English</T><Switch value={lang === 'ar'} onValueChange={(v) => setLang(v ? 'ar' : 'en')} trackColor={{ true: C.blue }} /><T size={13} dim>العربية</T></Row></Row>
            <Row between style={{ paddingVertical: 6 }}><T>{tr('theme')}</T><T size={13} dim>{lang === 'ar' ? 'فاتح' : 'Light'}</T></Row>
          </Card>
        </Section>
        <Btn label={tr('logout')} kind="danger" icon="log-out-outline" onPress={signOut} style={{ marginTop: SP.lg }} />
      </ScrollView>
    </View>
  );
}
const st = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,17,26,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: SP.lg, paddingBottom: 40 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
});
