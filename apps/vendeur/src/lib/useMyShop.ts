'use client';
import { useCallback, useEffect, useState } from 'react';
import { browserClient, useSession } from '@hailandx/kit';

export interface MyShop {
  id: string; slug: string; name: string; tagline: string | null; status: string; declaration_id: string | null; category_id: string | null; logo_path: string | null; cover_path: string | null; whatsapp: string | null;
  /** Boutique en ligne (HAILANDX.md §37) : horaires par jour, congés, politique d'échange. */
  hours: Record<string, [string, string] | null> | null; vacation_until: string | null; vacation_note: string | null; policy: string | null;
  /** Rôle du compte connecté : le propriétaire voit tout ; un employé ne voit ni l'argent, ni les réglages, ni l'équipe. */
  role: 'proprietaire' | 'employe';
}
export interface MyDecl { id: string; declared_label: string | null; hailand_code: string | null; detected_level: number; certification_status: string | null; level: number }

/** Demande de certification de la boutique, vue de la console : à vérifier par l'équipe, transmise à HailandMap ou refusée (avec motif). */
export interface MyCert { declaration_id: string; status: 'a_verifier' | 'transmise' | 'refusee'; console_note: string | null }

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
  const [certs, setCerts] = useState<MyCert[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const sb = browserClient();
    if (!sb || !uid) return;
    const [s, d] = await Promise.all([
      // Boutique dont le compte est membre (propriétaire d'abord, sinon employé).
      sb.from('shop_members').select('role,shops(id,slug,name,tagline,status,declaration_id,category_id,logo_path,cover_path,whatsapp,hours,vacation_until,vacation_note,policy)').eq('user_id', uid).order('role', { ascending: false }).limit(1).maybeSingle(),
      sb.from('declarations').select('id,declared_label,hailand_code,detected_level,certification_status').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);
    const list = (d.data as Omit<MyDecl, 'level'>[]) ?? [];
    const withLevel = await Promise.all(list.map(async (x) => {
      const r = await sb.rpc('fn_declaration_level', { p_declaration: x.id });
      return { ...x, level: typeof r.data === 'number' ? r.data : x.detected_level };
    }));
    const m = s.data as unknown as { role: MyShop['role']; shops: Omit<MyShop, 'role'> | null } | null;
    const myShop: MyShop | null = m?.shops ? { ...m.shops, role: m.role } : null;
    const c = myShop ? await sb.from('certification_priorities').select('declaration_id,status,console_note').eq('shop_id', myShop.id) : null;
    setCerts((c?.data as MyCert[] | null) ?? []);
    setShop(myShop);
    setDecls(withLevel);
    setReady(true);
  }, [uid]);

  useEffect(() => { if (uid) void reload(); }, [uid, reload]);

  const state: 'chargement' | 'visiteur' | 'pret' = session === null || (session !== undefined && !browserClient()) ? 'visiteur' : ready ? 'pret' : 'chargement';
  const decl = decls.find((x) => x.id === shop?.declaration_id) ?? null;
  const cert = certs.find((x) => x.declaration_id === decl?.id) ?? null;
  return { state, session, uid, shop, decls, decl, cert, reload };
}
