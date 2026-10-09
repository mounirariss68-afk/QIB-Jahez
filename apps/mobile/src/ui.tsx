/** Small building blocks shared by the screens: card, row, chip, button, header. */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, SP } from './theme';
import { useApp } from './state';

export function Card({ children, style, tone }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'navy' | 'blue' | 'orange' }) {
  const bg = tone === 'navy' ? C.navy : tone === 'blue' ? C.blue : tone === 'orange' ? C.orange : C.card;
  return <View style={[st.card, { backgroundColor: bg }, tone ? { borderWidth: 0 } : null, style]}>{children}</View>;
}
export function T({ children, style, size = 15, bold, color, dim, align }: { children: React.ReactNode; style?: StyleProp<TextStyle>; size?: number; bold?: boolean; color?: string; dim?: boolean; align?: 'left' | 'right' | 'center' }) {
  const { rtl } = useApp();
  return <Text style={[{ fontSize: size, color: color ?? (dim ? C.muted : C.ink), fontWeight: bold ? '700' : '400', textAlign: align ?? (rtl ? 'right' : 'left'), writingDirection: rtl ? 'rtl' : 'ltr' }, style]}>{children}</Text>;
}
export function Row({ children, style, between }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; between?: boolean }) {
  const { rtl } = useApp();
  return <View style={[{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: SP.sm }, between ? { justifyContent: 'space-between' } : null, style]}>{children}</View>;
}
export function Chip({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'ok' | 'warn' | 'danger' | 'blue' }) {
  const m = { muted: [C.bg, C.muted], ok: [C.okSoft, C.ok], warn: [C.warnSoft, C.warn], danger: [C.dangerSoft, C.danger], blue: [C.skySoft, C.navy] }[tone];
  return <View style={{ backgroundColor: m[0], borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: m[1], fontSize: 11, fontWeight: '700' }}>{children}</Text></View>;
}
export function Btn({ label, onPress, kind = 'primary', icon, disabled, busy, style }: { label: string; onPress?: () => void; kind?: 'primary' | 'orange' | 'ghost' | 'danger'; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = kind === 'primary' ? C.blue : kind === 'orange' ? C.orange : kind === 'danger' ? C.danger : 'transparent';
  const fg = kind === 'ghost' ? C.blue : '#fff';
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={({ pressed }) => [st.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderWidth: kind === 'ghost' ? 1 : 0, borderColor: C.blue }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <>{icon ? <Ionicons name={icon} size={18} color={fg} /> : null}<Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{label}</Text></>}
    </Pressable>
  );
}
export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: SP.lg }}>
      <Row between style={{ marginBottom: SP.sm, paddingHorizontal: 2 }}><T size={13} bold color={C.muted} style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>{title}</T>{action}</Row>
      {children}
    </View>
  );
}
export function IconTile({ icon, label, onPress, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; tone?: 'orange' }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.tile, { opacity: pressed ? 0.8 : 1 }]}>
      <View style={[st.tileIcon, tone === 'orange' ? { backgroundColor: '#FFF1E0' } : null]}><Ionicons name={icon} size={22} color={tone === 'orange' ? C.orange : C.blue} /></View>
      <Text style={{ fontSize: 12, color: C.ink, textAlign: 'center', fontWeight: '600' }} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}
export function ListItem({ icon, title, subtitle, right, onPress }: { icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void }) {
  const { rtl } = useApp();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.item, { opacity: pressed ? 0.8 : 1 }]}>
      <Row between>
        <Row style={{ flex: 1 }}>
          {icon ? <View style={st.itemIcon}><Ionicons name={icon} size={18} color={C.blue} /></View> : null}
          <View style={{ flex: 1 }}><T bold size={15}>{title}</T>{subtitle ? <T size={12} dim>{subtitle}</T> : null}</View>
        </Row>
        {right ?? <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={C.muted} />}
      </Row>
    </Pressable>
  );
}
export function DemoBanner() {
  const { tr } = useApp();
  return <View style={st.banner}><Ionicons name="flask-outline" size={13} color={C.muted} /><Text style={{ fontSize: 11, color: C.muted, flex: 1 }}>{tr('synthetic')}</Text></View>;
}

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: C.line },
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: R.sm, paddingVertical: 13, paddingHorizontal: 16 },
  tile: { width: '23%', alignItems: 'center', gap: 6 },
  tileIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#E8F3FA', alignItems: 'center', justifyContent: 'center' },
  item: { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 13, paddingHorizontal: SP.md },
  itemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8F3FA', alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: SP.md, paddingVertical: 6, backgroundColor: '#EEF3F7' },
});
