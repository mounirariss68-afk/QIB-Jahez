/**
 * QIB Mobile (demo) — an Expo Go mock-up of the customer's phone, wired to
 * the Jahiz server. Structure follows the real app as QIB describes it:
 * Home (customised dashboard) · My Products · Smart button · Pay & Transfer ·
 * More; Profile with My Personal Data (document upload); notifications; and
 * One Click Finance in four steps. Every record is synthetic (DEMO-).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider, useApp } from './src/state';
import { C } from './src/theme';
import { LoginScreen } from './src/screens/Login';
import { HomeScreen } from './src/screens/Home';
import { ProductsScreen } from './src/screens/Products';
import { DocumentsScreen } from './src/screens/Documents';
import { OfferScreen } from './src/screens/Offer';
import { InboxScreen } from './src/screens/Inbox';
import { MoreScreen, PayScreen, ProfileScreen, SmartSheet } from './src/screens/Other';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function SmartButton({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress} style={st.smart}><Ionicons name="sparkles" size={26} color="#fff" /></Pressable>;
}

function Tabs({ navigation }: any) {
  const { tr } = useApp();
  const [smart, setSmart] = useState(false);
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = { Home: 'home-outline', Products: 'wallet-outline', Pay: 'swap-horizontal-outline', More: 'grid-outline' };
  return (
    <>
      <Tab.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: C.blue, tabBarInactiveTintColor: C.muted, tabBarStyle: { height: 84, paddingTop: 8, borderTopColor: C.line }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }, tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} size={size} color={color} /> })}>
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: tr('home') }} />
        <Tab.Screen name="Products" component={ProductsScreen} options={{ title: tr('products') }} />
        <Tab.Screen name="SmartTab" component={View} options={{ title: '', tabBarButton: () => <View style={{ width: 70 }} /> }} />
        <Tab.Screen name="Pay" component={PayScreen} options={{ title: tr('payTab') }} />
        <Tab.Screen name="More" component={MoreScreen} options={{ title: tr('more') }} />
      </Tab.Navigator>
      <SmartButton onPress={() => setSmart(true)} />
      <SmartSheet visible={smart} onClose={() => setSmart(false)} navigation={navigation} />
    </>
  );
}

function Root() {
  const { customerId, home } = useApp();
  return (
    <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, primary: C.blue } }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!customerId || !home ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="Documents" component={DocumentsScreen} />
            <Stack.Screen name="Offer" component={OfferScreen} />
            <Stack.Screen name="Inbox" component={InboxScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
const st = StyleSheet.create({
  smart: { position: 'absolute', bottom: 38, alignSelf: 'center', width: 62, height: 62, borderRadius: 31, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6, borderWidth: 4, borderColor: '#fff' },
});
