'use client';
import { useCallback, useEffect, useState } from 'react';
import { browserClient } from './supabase';
import { useSession } from './useSession';

export interface MyShop { id: string; slug: string; name: string; tagline: string | null; status: string; declaration_id: string | null; category_id: string | null; logo_path: string | null; cover_path: string | null; whatsapp: string | null }
export interface MyDecl { id: string; declared_label: string | null; hailand_code: string | null; detected_level: number; certification_status: string | null; level: number }

export const declLabel = (d: Pick<MyDecl, 'declared_label' | 'hailand_code'>) => d.declared_label || d.hailand_code || 'Mon adresse';

/**
 * Boutique du compte connecté et ses adresses (avec leur niveau réel, 3 = certifié par Hailand).
 * `state` : 'chargement', 'visiteur' (pas connecté) ou 'pret'.
 */
export function useMyShop() {
  const session = useSession();
  const uid = session?.user.id;
  const [shop, setShop] = useState<MyShop | null>(null);
  const [decls, setDecls] = useState<MyDecl[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const sb = browserClient();
    if (!sb || !uid) return;
    const [s, d] = await Promise.all([
      sb.from('shops').select('id,slug,name,tagline,status,declaration_id,category_id,logo_path,cover_path,whatsapp').eq('owner_id', uid).limit(1).maybeSingle(),
      sb.from('declarations').select('id,declared_label,hailand_code,detected_level,certification_status').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);
    const list = (d.data as Omit<MyDecl, 'level'>[]) ?? [];
    const withLevel = await Promise.all(list.map(async (x) => {
      const r = await sb.rpc('fn_declaration_level', { p_declaration: x.id });
      return { ...x, level: typeof r.data === 'number' ? r.data : x.detected_level };
    }));
    setShop((s.data as MyShop | null) ?? null);
    setDecls(withLevel);
    setReady(true);
  }, [uid]);

  useEffect(() => { if (uid) void reload(); }, [uid, reload]);

  const state: 'chargement' | 'visiteur' | 'pret' = session === null || (session !== undefined && !browserClient()) ? 'visiteur' : ready ? 'pret' : 'chargement';
  const decl = decls.find((x) => x.id === shop?.declaration_id) ?? null;
  return { state, session, uid, shop, decls, decl, reload };
}
