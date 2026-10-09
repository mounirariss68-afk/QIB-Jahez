/**
 * The customised dashboard: greeting and bell, the thing the bank is asking
 * for (if any), the One Click offer (if any), accounts, quick actions and the
 * latest notifications. Everything comes from /api/mobile/:id/home.
 */
import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../state';
import { C, R, SP, qar, dateTime } from '../theme';
import { Btn, Card, Chip, DemoBanner, IconTile, Row, Section, T } from '../ui';

export function HomeScreen({ navigation }: any) {
  const { home, lang, tr, refresh, loading, rtl } = useApp();
  if (!home) return null;
  const c = home.customer;
  const unread = home.inbox.filter((m) => !m.read_at && m.kind !== 'OUTGOING').length;
  const name = (lang === 'ar' ? c.nameAr : c.nameEn).split(' ')[0];
  const current = home.accounts.find((a) => a.type === 'CURRENT') ?? home.accounts[0];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={[C.navy, C.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
        <Row between>
          <Pressable onPress={() => navigation.navigate('Profile')} style={st.avatar} accessibilityRole="button" accessibilityLabel="Profile"><Text style={{ color: '#fff', fontWeight: '700' }}>{c.nameEn.split(' ').map((x) => x[0]).slice(0, 2).join('')}</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[st.hello, rtl && { textAlign: 'right' }]}>{lang === 'ar' ? `أهلاً ${name}` : `Hello, ${name}`}</Text>
            <Text style={[st.tier, rtl && { textAlign: 'right' }]}>{c.tier} · {c.rimNo}</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('Inbox')} style={st.bell} accessibilityRole="button" accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {unread ? <View style={st.badge}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{unread}</Text></View> : null}
          </Pressable>
        </Row>
        {current ? (
          <View style={st.balance}>
            <Text style={{ color: '#CCE3EF', fontSize: 12 }}>{tr('available')} · {current.type === 'CURRENT' ? (lang === 'ar' ? 'الحساب الجاري' : 'Current account') : current.type} ···· {current.iban.slice(-4)}</Text>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '700' }}>{qar(current.balance)}</Text>
          </View>
        ) : null}
      </LinearGradient>
      <DemoBanner />
      <ScrollView contentContainerStyle={{ padding: SP.md, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
        {home.offer ? (
          <Card tone="navy" style={{ marginBottom: SP.md }}>
            <Row between><T size={11} bold color="#CCE3EF" style={{ letterSpacing: 1 }}>{tr('oneClick').toUpperCase()}</T><Ionicons name="flash" size={16} color={C.orange} /></Row>
            <T size={14} color="#fff" style={{ marginTop: 6 }}>{tr('preApproved')}</T>
            <T size={28} bold color="#fff">{qar(home.offer.amount)}</T>
            <T size={12} color="#CCE3EF">{home.offer.tenor} {tr('months')} · {lang === 'ar' ? 'بدون أوراق، خلال دقائق' : 'no paperwork, in minutes'}</T>
            <Btn label={tr('acceptOneClick')} kind="orange" icon="flash-outline" onPress={() => navigation.navigate('Offer')} style={{ marginTop: SP.md }} />
          </Card>
        ) : null}
        {home.ask ? (
          <Card style={{ marginBottom: SP.md, borderColor: C.orange, borderWidth: 1.5 }}>
            <Row between><Chip tone="warn">{tr('actionNeeded')}</Chip><T size={11} dim>{tr('reference')} {home.ask.ref}</T></Row>
            <T size={16} bold style={{ marginTop: 8 }}>{lang === 'ar' ? home.ask.ar : home.ask.en}</T>
            <T size={12} dim style={{ marginTop: 4 }}>{tr('whatHappensText')}</T>
            {home.ask.doc ? <Btn label={tr('uploadDoc')} icon="cloud-upload-outline" onPress={() => navigation.navigate('Documents', { upload: home.ask?.doc })} style={{ marginTop: SP.md }} /> : <Btn label={tr('messages')} icon="chatbubble-ellipses-outline" onPress={() => navigation.navigate('Inbox')} style={{ marginTop: SP.md }} />}
          </Card>
        ) : null}
        {!home.ask && !home.offer ? <Card style={{ marginBottom: SP.md }}><Row><Ionicons name="checkmark-circle" size={20} color={C.ok} /><T size={14}>{tr('nothingToDo')}</T></Row></Card> : null}

        <Section title={tr('quickActions')}>
          <Row between style={{ alignItems: 'flex-start' }}>
            <IconTile icon="swap-horizontal-outline" label={tr('pay')} onPress={() => navigation.navigate('Pay')} />
            <IconTile icon="card-outline" label={tr('cards')} onPress={() => navigation.navigate('Products')} />
            <IconTile icon="document-text-outline" label={tr('documents')} onPress={() => navigation.navigate('Documents')} />
            <IconTile icon="flash-outline" label={tr('oneClick')} tone="orange" onPress={() => navigation.navigate(home.offer ? 'Offer' : 'Products')} />
          </Row>
        </Section>

        <Section title={tr('accounts')} action={<Pressable onPress={() => navigation.navigate('Products')}><T size={12} color={C.blue} bold>{tr('seeAll')}</T></Pressable>}>
          {home.accounts.map((a) => (
            <Card key={a.id} style={{ marginBottom: 8 }}>
              <Row between>
                <View><T bold>{a.type === 'CURRENT' ? (lang === 'ar' ? 'الحساب الجاري' : 'Current account') : a.type === 'SAVINGS' ? (lang === 'ar' ? 'حساب التوفير' : 'Savings account') : a.type}</T><T size={12} dim>{a.iban}</T></View>
                <View><T bold size={16} align={rtl ? 'left' : 'right'}>{qar(a.balance)}</T>{a.status !== 'ACTIVE' ? <Chip tone="warn">{a.status}</Chip> : null}</View>
              </Row>
            </Card>
          ))}
        </Section>

        <Section title={tr('inbox')} action={<Pressable onPress={() => navigation.navigate('Inbox')}><T size={12} color={C.blue} bold>{tr('seeAll')}</T></Pressable>}>
          {home.inbox.filter((m) => m.kind !== 'OUTGOING').slice(0, 3).map((m) => (
            <Pressable key={m.id} onPress={() => navigation.navigate('Inbox')}>
              <Card style={{ marginBottom: 8 }}>
                <Row between><Chip tone={m.meta?.type === 'OFFER' ? 'blue' : 'muted'}>{m.channel}</Chip><T size={11} dim>{dateTime(m.at, lang)}</T></Row>
                <T bold size={14} style={{ marginTop: 6 }}>{m.subject ?? m.body.slice(0, 60)}</T>
                <T size={12} dim style={{ marginTop: 2 }}>{m.body.slice(0, 120)}</T>
              </Card>
            </Pressable>
          ))}
          {!home.inbox.length ? <T dim>{tr('noMessages')}</T> : null}
        </Section>
      </ScrollView>
    </View>
  );
}
const st = StyleSheet.create({
  hero: { paddingTop: 58, paddingHorizontal: SP.md, paddingBottom: SP.lg, borderBottomLeftRadius: R.lg, borderBottomRightRadius: R.lg },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  hello: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tier: { color: '#CCE3EF', fontSize: 12 },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: C.orange, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  balance: { marginTop: SP.lg },
});
