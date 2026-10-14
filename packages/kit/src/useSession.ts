'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { browserClient, sessionPrete } from './supabase';

/** Session du compte connecté (Compte Hailand : téléphone + code, ou passage depuis une autre application Hailand). `undefined` = en cours de lecture, `null` = visiteur. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const sb = browserClient();
    if (!sb) { setSession(null); return; }
    let alive = true;
    let pret = false;
    // Le passage éventuel (arrivée depuis une autre application Hailand) est traité avant de lire la session : jusque-là, les
    // changements intermédiaires (ancienne session fermée, nouvelle ouverte) sont ignorés, sinon la page renverrait à la connexion.
    void sessionPrete().then(() => sb.auth.getSession()).then(({ data }) => { pret = true; if (alive) setSession(data.session); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => { if (alive && pret) setSession(s); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  return session;
}
