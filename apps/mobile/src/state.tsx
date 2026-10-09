/** Session: which demo customer is signed in, their language, and the home payload every screen reads. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, type Home } from './api';
import { t, type Key, type Lang } from './i18n';

type Ctx = {
  customerId: string | null; signIn: (id: string) => Promise<void>; signOut: () => void;
  lang: Lang; setLang: (l: Lang) => void; rtl: boolean; tr: (k: Key) => string;
  home: Home | null; loading: boolean; error: string | null; refresh: () => Promise<void>;
};
const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [home, setHome] = useState<Home | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try { const h = await api.home(id); setHome(h); setError(null); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);
  const signIn = useCallback(async (id: string) => { setCustomerId(id); setHome(null); const h = await api.home(id); setHome(h); setLang(h.customer.lang); }, []);
  const signOut = useCallback(() => { setCustomerId(null); setHome(null); }, []);
  const refresh = useCallback(async () => { if (customerId) await load(customerId); }, [customerId, load]);

  // The phone polls so a push sent by Jahiz appears within a few seconds.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!customerId) return;
    timer.current = setInterval(() => load(customerId), 6000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [customerId, load]);

  const value = useMemo<Ctx>(() => ({ customerId, signIn, signOut, lang, setLang, rtl: lang === 'ar', tr: (k) => t(k, lang), home, loading, error, refresh }), [customerId, signIn, signOut, lang, home, loading, error, refresh]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('AppProvider missing'); return c; };
