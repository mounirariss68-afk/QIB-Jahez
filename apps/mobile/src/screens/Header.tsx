/** The blue page header used by every screen except Home. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, SP } from '../theme';
import { useApp } from '../state';

export function Header({ title, back, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const nav = useNavigation<any>();
  const { rtl } = useApp();
  return (
    <View style={st.wrap}>
      <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
        {back ? <Pressable onPress={() => nav.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={24} color="#fff" /></Pressable> : null}
        <Text style={[st.title, { textAlign: rtl ? 'right' : 'left' }]}>{title}</Text>
        <View style={{ flex: 1 }} />
        {right}
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  wrap: { backgroundColor: C.navy, paddingTop: 56, paddingBottom: 14, paddingHorizontal: SP.md },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
