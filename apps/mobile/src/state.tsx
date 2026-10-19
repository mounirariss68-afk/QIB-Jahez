/** Session: which demo customer is signed in, their language, and the home payload every screen reads. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { api, type Home } from './api';
import { createHomeSession } from './homeSession';
import { t, type Key, type Lang } from './i18n';

type Ctx = {
  customerId: string | null; signIn: (id: string) => Promise<void>; signOut: () => void;
  lang: Lang; setLang: (l: Lang) => void; rtl: boolean; tr: (k: Key) => string;
  home: Home | null; refreshing: boolean; error: string | null; refresh: () => Promise<void>;
  refreshAfterAction: () => Promise<void>;
};
const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session] = useState(() => createHomeSession(api.home));
  const { customerId, home, refreshing, error } = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [lang, setLang] = useState<Lang>('en');
  const signIn = useCallback(async (id: string) => {
    const result = await session.signIn(id);
    if (result && session.getSnapshot().home === result) setLang(result.customer.lang);
  }, [session]);
  const { signOut, refresh, refreshAfterAction } = session;

  // The phone polls so a push sent by Jahiz appears within a few seconds.
  useEffect(() => session.startPolling(), [session]);

  const value = useMemo<Ctx>(() => ({ customerId, signIn, signOut, lang, setLang, rtl: lang === 'ar', tr: (k) => t(k, lang), home, refreshing, error, refresh, refreshAfterAction }), [customerId, signIn, signOut, lang, home, refreshing, error, refresh, refreshAfterAction]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('AppProvider missing'); return c; };
