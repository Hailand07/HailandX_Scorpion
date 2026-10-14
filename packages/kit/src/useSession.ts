'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { browserClient } from './supabase';

/** Session du compte connecté (téléphone + code). `undefined` = en cours de lecture, `null` = visiteur. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const sb = browserClient();
    if (!sb) { setSession(null); return; }
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}
