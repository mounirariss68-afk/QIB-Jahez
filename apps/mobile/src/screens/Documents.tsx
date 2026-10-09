/**
 * My Personal Data → documents: the QID and passport on record with their
 * expiry, the upload flow (camera, library, or a demo specimen), and the
 * state of each upload as Fahis and the checker move it along.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api, type Specimen } from '../api';
import { useApp } from '../state';
import { C, R, SP, dateShort, dateTime } from '../theme';
import { Btn, Card, Chip, Row, Section, T } from '../ui';
import { Header } from './Header';

const STATE_TONE: Record<string, 'muted' | 'ok' | 'warn' | 'danger'> = { RECEIVED: 'muted', PROPOSED: 'warn', REVIEW: 'warn', REJECT_RECOMMENDED: 'warn', APPLIED: 'ok', REJECTED: 'danger' };

export function DocumentsScreen({ route }: any) {
  const { home, customerId, lang, tr, refresh, loading } = useApp();
  const [open, setOpen] = useState<string | null>(route?.params?.upload ?? null);
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { api.specimens().then(setSpecimens).catch(() => {}); }, []);
  useEffect(() => { if (route?.params?.upload) setOpen(route.params.upload); }, [route?.params?.upload]);
  if (!home || !customerId) return null;

  const stateLabel = (s: string) => ({ RECEIVED: tr('received'), PROPOSED: tr('underReview'), REVIEW: tr('underReview'), REJECT_RECOMMENDED: tr('underReview'), APPLIED: tr('applied'), REJECTED: tr('rejected') } as Record<string, string>)[s] ?? s;
  const docLabel = (t: string) => ({ QID: tr('qid'), PASSPORT: tr('passport'), SALARY_CERTIFICATE: tr('salaryCert'), HR_LETTER: lang === 'ar' ? 'رسالة الموارد البشرية' : 'HR letter' } as Record<string, string>)[t] ?? t;

  const send = async (body: Parameters<typeof api.upload>[1]) => {
    setBusy(true);
    try { await api.upload(customerId, body); setOpen(null); setPreview(null); await refresh(); Alert.alert(tr('uploadDoc'), tr('uploaded')); }
    catch (e: any) { Alert.alert(tr('uploadDoc'), e.message); }
    finally { setBusy(false); }
  };
  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = camera ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ['images'] });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    const a = r.assets[0];
    setPreview(a.uri);
    await send({ image: { data: a.base64!, mime: a.mimeType ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg', type: open ?? 'QID' }, text: `Uploaded from QIB Mobile (demo, Expo Go): ${open ?? 'document'}` });
  };
  const kinds = specimens.filter((s) => !open || s.type === open || (open === 'SALARY_CERTIFICATE' && (s.type === 'HR_LETTER' || s.type === 'SALARY_CERT' || s.type === 'LIABILITY_LETTER')));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={tr('personalData')} back />
      <ScrollView contentContainerStyle={{ padding: SP.md, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
        {home.ask?.doc ? <Card style={{ borderColor: C.orange, borderWidth: 1.5, marginBottom: SP.md }}><Chip tone="warn">{tr('actionNeeded')}</Chip><T bold style={{ marginTop: 6 }}>{lang === 'ar' ? home.ask.ar : home.ask.en}</T><Btn label={tr('uploadDoc')} icon="cloud-upload-outline" onPress={() => setOpen(home.ask!.doc!)} style={{ marginTop: SP.sm }} /></Card> : null}
        <Section title={tr('documents')}>
          {home.documents.map((d) => (
            <Card key={d.type} style={{ marginBottom: 8 }}>
              <Row between>
                <View><T bold>{docLabel(d.type)}</T><T size={12} dim>{d.number}</T><T size={12} dim>{tr('expires')} {dateShort(d.expiresOn, lang)}</T></View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Chip tone={d.expired ? 'danger' : d.expiringSoon ? 'warn' : 'ok'}>{d.expired ? tr('expired') : d.expiringSoon ? tr('expiringSoon') : tr('valid')}</Chip>
                  <Pressable onPress={() => setOpen(d.type)}><T size={13} color={C.blue} bold>{tr('update')}</T></Pressable>
                </View>
              </Row>
            </Card>
          ))}
          <Card><Row between><View><T bold>{tr('salaryCert')}</T><T size={12} dim>{home.customer.employer ?? '—'}</T></View><Pressable onPress={() => setOpen('SALARY_CERTIFICATE')}><T size={13} color={C.blue} bold>{tr('upload')}</T></Pressable></Row></Card>
        </Section>
        <Section title={tr('recentUploads')}>
          {home.uploads.map((u) => <Card key={u.id} style={{ marginBottom: 8 }}><Row between><View><T bold>{docLabel(u.type)}</T><T size={12} dim>{dateTime(u.received_at, lang)}{u.overall_confidence ? ` · ${Math.round(Number(u.overall_confidence) * 100)}%` : ''}</T></View><Chip tone={STATE_TONE[u.state] ?? 'muted'}>{stateLabel(u.state)}</Chip></Row></Card>)}
          {!home.uploads.length ? <T dim>—</T> : null}
        </Section>
        <Card style={{ marginTop: SP.lg, backgroundColor: '#EEF3F7' }}><T size={12} bold dim>{tr('whatHappens')}</T><T size={12} dim style={{ marginTop: 4 }}>{tr('whatHappensText')}</T></Card>
      </ScrollView>

      <Modal visible={!!open} animationType="slide" transparent onRequestClose={() => setOpen(null)}>
        <Pressable style={st.scrim} onPress={() => !busy && setOpen(null)} />
        <View style={st.sheet}>
          <Row between><T bold size={17}>{tr('uploadDoc')} · {open ? docLabel(open) : ''}</T><Pressable onPress={() => setOpen(null)} hitSlop={10}><Ionicons name="close" size={22} color={C.muted} /></Pressable></Row>
          {preview ? <Image source={{ uri: preview }} style={{ width: '100%', height: 160, borderRadius: R.sm, marginTop: SP.sm }} resizeMode="cover" /> : null}
          <Btn label={tr('takePhoto')} icon="camera-outline" onPress={() => pick(true)} busy={busy} style={{ marginTop: SP.md }} />
          <Btn label={tr('chooseLibrary')} icon="images-outline" kind="ghost" onPress={() => pick(false)} busy={busy} style={{ marginTop: SP.sm }} />
          <T size={12} dim style={{ marginTop: SP.md }}>{tr('useSpecimen')}</T>
          <View style={{ gap: 6, marginTop: 6 }}>
            {kinds.map((s) => <Pressable key={s.kind} disabled={busy} onPress={() => send({ specimen: s.kind })} style={({ pressed }) => [st.spec, { opacity: pressed ? 0.7 : 1 }]}><Ionicons name={s.flaw ? 'warning-outline' : 'document-outline'} size={16} color={s.flaw ? C.warn : C.blue} /><T size={13} style={{ flex: 1 }}>{lang === 'ar' ? s.label_ar : s.label}</T>{s.flaw ? <Chip tone="warn">{s.flaw.replace(/_/g, ' ').toLowerCase()}</Chip> : null}</Pressable>)}
          </View>
        </View>
      </Modal>
    </View>
  );
}
const st = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,17,26,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: SP.lg, paddingBottom: 40, maxHeight: '85%' },
  spec: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10, borderRadius: R.sm, borderWidth: 1, borderColor: C.line },
});
