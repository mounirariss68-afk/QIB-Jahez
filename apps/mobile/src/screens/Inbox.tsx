/** Notifications and secure messages: what Jahiz sent (push, in-app), what the customer sent back, and a reply box. */
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useApp } from '../state';
import { C, R, SP, dateTime } from '../theme';
import { Card, Chip, Row, T } from '../ui';
import { Header } from './Header';

export function InboxScreen() {
  const { home, customerId, lang, tr, refresh, loading, rtl } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (customerId && home?.inbox.some((m) => !m.read_at && m.kind !== 'OUTGOING')) api.read(customerId).catch(() => {}); }, [customerId, home?.inbox.length]);
  if (!home || !customerId) return null;
  const send = async () => { if (!text.trim()) return; setBusy(true); try { await api.reply(customerId, text.trim()); setText(''); await refresh(); } catch (e: any) { Alert.alert(tr('send'), e.message); } finally { setBusy(false); } };
  const items = [...home.inbox].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={tr('inbox')} back />
      <ScrollView contentContainerStyle={{ padding: SP.md, paddingBottom: 20 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
        {items.map((m) => {
          const mine = m.kind === 'OUTGOING';
          return (
            <View key={m.id} style={{ alignItems: mine ? (rtl ? 'flex-start' : 'flex-end') : (rtl ? 'flex-end' : 'flex-start'), marginBottom: 10 }}>
              <Card style={[st.bubble, mine ? { backgroundColor: C.skySoft, borderColor: C.skySoft } : null]}>
                <Row between><Row><Chip tone={m.meta?.type === 'OFFER' ? 'blue' : m.channel === 'PUSH' ? 'warn' : 'muted'}>{mine ? tr('you') : m.channel}</Chip>{m.ref ? <T size={10} dim>{m.ref}</T> : null}</Row><T size={10} dim>{dateTime(m.at, lang)}</T></Row>
                {m.subject ? <T bold size={14} style={{ marginTop: 6 }}>{m.subject}</T> : null}
                <T size={13} style={{ marginTop: 2 }}>{m.body}</T>
                {m.meta?.attachments?.length ? <Row style={{ marginTop: 6 }}><Ionicons name="attach" size={14} color={C.muted} /><T size={11} dim>{m.meta.attachments.join(', ')}</T></Row> : null}
              </Card>
            </View>
          );
        })}
        {!items.length ? <T dim>{tr('noMessages')}</T> : null}
      </ScrollView>
      <View style={st.composer}>
        <TextInput value={text} onChangeText={setText} placeholder={tr('replyPlaceholder')} style={[st.input, rtl && { textAlign: 'right' }]} multiline />
        <Pressable onPress={send} disabled={busy || !text.trim()} style={[st.sendBtn, (busy || !text.trim()) && { opacity: 0.5 }]}><Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={20} color="#fff" /></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const st = StyleSheet.create({
  bubble: { maxWidth: '88%' },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', padding: SP.sm, paddingBottom: 28, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line },
  input: { flex: 1, minHeight: 42, maxHeight: 110, borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
});
