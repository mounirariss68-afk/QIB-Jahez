/** Sign-in: the QIB look (logo on dark blue, Face ID), and under it the demo's customer picker. */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { api, API_BASE, type DemoCustomer } from '../api';
import { useApp } from '../state';
import { C, R, SP } from '../theme';
import { Btn, Chip } from '../ui';

export function LoginScreen() {
  const { signIn, tr, lang, setLang } = useApp();
  const [customers, setCustomers] = useState<DemoCustomer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<DemoCustomer | null>(null);
  const load = () => api.customers().then((c) => { setCustomers(c); setError(null); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const enter = async (c: DemoCustomer, biometric: boolean) => {
    setBusy(c.id);
    try {
      if (biometric) {
        const ok = await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
        if (ok) { const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'QIB Mobile (demo)' }); if (!r.success) { setBusy(null); return; } }
      }
      await signIn(c.id);
    } catch (e: any) { Alert.alert('Sign in', e.message); }
    finally { setBusy(null); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.navy }}>
      <View style={st.top}>
        <Image source={require('../../assets/qib-logo-on-dark.png')} style={{ width: 190, height: 65, resizeMode: 'contain' }} />
        <Text style={st.sub}>{tr('appName')} · {tr('demo')}</Text>
        <Pressable onPress={() => setLang(lang === 'ar' ? 'en' : 'ar')} style={st.langBtn}><Text style={{ color: '#fff', fontWeight: '700' }}>{lang === 'ar' ? 'English' : 'العربية'}</Text></Pressable>
      </View>
      <View style={st.sheet}>
        {picked ? (
          <View style={{ gap: SP.md }}>
            <Text style={st.h}>{tr('welcome')}</Text>
            <Text style={{ fontSize: 18, color: C.ink, fontWeight: '700', textAlign: lang === 'ar' ? 'right' : 'left' }}>{lang === 'ar' ? picked.nameAr : picked.nameEn}</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{picked.id} · {picked.segment.replace('_', ' ')}</Text>
            <Btn label={tr('faceId')} icon="scan-outline" onPress={() => enter(picked, true)} busy={busy === picked.id} />
            <Btn label={tr('signIn')} kind="ghost" onPress={() => enter(picked, false)} busy={busy === picked.id} />
            <Btn label={tr('cancel')} kind="ghost" onPress={() => setPicked(null)} style={{ borderWidth: 0 }} />
          </View>
        ) : (
          <>
            <Text style={st.h}>{tr('demoPick')}</Text>
            {error ? <View style={st.err}><Ionicons name="cloud-offline-outline" size={16} color={C.danger} /><Text style={{ color: C.danger, flex: 1, fontSize: 12 }}>{tr('notConnected')}: {API_BASE} — {error}</Text><Pressable onPress={load}><Text style={{ color: C.blue, fontWeight: '700' }}>{tr('refresh')}</Text></Pressable></View> : null}
            {!customers && !error ? <ActivityIndicator color={C.blue} style={{ marginTop: 30 }} /> : null}
            <FlatList data={customers ?? []} keyExtractor={(c) => c.id} contentContainerStyle={{ paddingBottom: 30 }} renderItem={({ item: c }) => (
              <Pressable onPress={() => setPicked(c)} style={({ pressed }) => [st.cust, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={st.avatar}><Text style={{ color: C.navy, fontWeight: '700' }}>{c.nameEn.split(' ').map((x) => x[0]).slice(0, 2).join('')}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: C.ink }}>{lang === 'ar' ? c.nameAr : c.nameEn}</Text>
                  <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>{c.id} · {c.segment.replace('_', ' ')}{c.title ? ` · ${c.title}` : ''}</Text>
                </View>
                {c.edge ? <Chip tone="blue">{c.edge}</Chip> : null}
              </Pressable>
            )} />
            <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center' }}>{tr('connectedTo')} {API_BASE}</Text>
          </>
        )}
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  top: { paddingTop: 70, paddingBottom: 24, alignItems: 'center', gap: 8 },
  sub: { color: '#CCE3EF', fontSize: 13, letterSpacing: 0.5 },
  langBtn: { position: 'absolute', right: 20, top: 60, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  sheet: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: R.lg + 6, borderTopRightRadius: R.lg + 6, padding: SP.lg, gap: SP.sm },
  h: { fontSize: 20, fontWeight: '700', color: C.navy, marginBottom: 6 },
  cust: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: R.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.skySoft, alignItems: 'center', justifyContent: 'center' },
  err: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.dangerSoft, padding: 10, borderRadius: R.sm, marginBottom: 8 },
});
