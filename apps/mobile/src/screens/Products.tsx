/** My Products: accounts, cards, finance, deposits — and the One Click entry when an offer exists. */
import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../state';
import { C, SP, qar, dateShort } from '../theme';
import { Btn, Card, Chip, Row, Section, T } from '../ui';
import { Header } from './Header';

export function ProductsScreen({ navigation }: any) {
  const { home, lang, tr, refresh, loading, rtl } = useApp();
  if (!home) return null;
  const products: Record<string, string> = { PERSONAL: lang === 'ar' ? 'تمويل شخصي' : 'Personal finance', AUTO_IJARA: lang === 'ar' ? 'إجارة سيارات' : 'Auto Ijara', HOME: lang === 'ar' ? 'تمويل عقاري' : 'Home finance' };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={tr('products')} />
      <ScrollView contentContainerStyle={{ padding: SP.md, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
        {home.offer ? (
          <Card tone="navy"><Row between><T color="#fff" bold>{tr('oneClick')}</T><Ionicons name="flash" size={16} color={C.orange} /></Row><T color="#CCE3EF" size={13} style={{ marginTop: 4 }}>{tr('preApproved')} {qar(home.offer.amount)}</T><Btn label={tr('acceptOneClick')} kind="orange" onPress={() => navigation.navigate('Offer')} style={{ marginTop: SP.sm }} /></Card>
        ) : null}
        <Section title={tr('accounts')}>
          {home.accounts.map((a) => <Card key={a.id} style={{ marginBottom: 8 }}><Row between><View><T bold>{a.type === 'CURRENT' ? (lang === 'ar' ? 'الحساب الجاري' : 'Current account') : a.type === 'SAVINGS' ? (lang === 'ar' ? 'حساب التوفير' : 'Savings') : a.type}</T><T size={12} dim>{a.iban}</T></View><T bold size={16} align={rtl ? 'left' : 'right'}>{qar(a.balance)}</T></Row></Card>)}
          {!home.accounts.length ? <T dim>—</T> : null}
        </Section>
        <Section title={tr('cards')}>
          {home.cards.map((k) => <Card key={k.id} tone="blue" style={{ marginBottom: 8 }}><Row between><T color="#fff" bold>QIB Visa ···· {String(1000 + k.id).slice(-4)}</T>{k.dpd > 0 ? <Chip tone="danger">{k.dpd} {lang === 'ar' ? 'يوم تأخير' : 'days past due'}</Chip> : <Chip tone="ok">{k.status}</Chip>}</Row><Row between style={{ marginTop: 10 }}><View><T size={11} color="#CCE3EF">{tr('outstanding')}</T><T color="#fff" bold>{qar(k.outstanding)}</T></View><View><T size={11} color="#CCE3EF" align={rtl ? 'left' : 'right'}>{tr('limit')}</T><T color="#fff" bold align={rtl ? 'left' : 'right'}>{qar(k.card_limit)}</T></View></Row></Card>)}
          {!home.cards.length ? <T dim>{lang === 'ar' ? 'لا توجد بطاقات ائتمان.' : 'No credit cards.'}</T> : null}
        </Section>
        <Section title={tr('finance')}>
          {home.facilities.map((f) => <Card key={f.id} style={{ marginBottom: 8 }}><Row between><T bold>{products[f.product] ?? f.product}</T>{f.dpd > 0 ? <Chip tone="danger">{f.dpd} {tr('pastDue')}</Chip> : <Chip tone="ok">{lang === 'ar' ? 'منتظم' : 'Regular'}</Chip>}</Row><Row between style={{ marginTop: 8 }}><View><T size={11} dim>{tr('outstanding')}</T><T bold>{qar(f.outstanding)}</T></View><View><T size={11} dim>{tr('instalment')}</T><T bold>{qar(f.instalment)}</T></View><View><T size={11} dim>{tr('maturity')}</T><T bold>{dateShort(f.maturity, lang)}</T></View></Row></Card>)}
          {!home.facilities.length ? <T dim>{lang === 'ar' ? 'لا يوجد تمويل قائم.' : 'No finance outstanding.'}</T> : null}
        </Section>
        <Section title={tr('deposits')}>
          <Card><Row between><T>{lang === 'ar' ? 'إجمالي الودائع' : 'Total deposits'}</T><T bold size={16}>{qar(home.deposits)}</T></Row></Card>
        </Section>
      </ScrollView>
    </View>
  );
}
