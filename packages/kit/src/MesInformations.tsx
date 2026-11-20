'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { formatGnPhone } from '@hailandx/commerce';
import { browserClient } from './supabase';
import { Icon } from './Screen';

interface Adresse {
  id: string; declared_label: string | null; hailand_code: string | null; location_floor: string | null; location_door: string | null;
  declared_landmark: string | null; certification_status: string | null; temporary_until: string | null; created_at: string;
  quartier: string | null; commune: string | null; level: number | null;
}

/**
 * « Mes informations » (§63) : tout ce que le compte Hailand contient, en clair, au même endroit — nom, téléphone, e-mail, et
 * chaque adresse liée au compte avec son quartier, sa commune, son code Hailand et ses précisions. Commun à HailandX et Vendeur.
 * `boutique` marque l'adresse de la boutique (vendeur) ; `securiteHref` mène au changement d'e-mail et de mot de passe.
 */
export function MesInformations({ boutique, securiteHref, ajouterHref }: { boutique?: { nom: string; declarationId: string | null } | null; securiteHref: string; ajouterHref?: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [adresses, setAdresses] = useState<Adresse[] | null>(null);

  useEffect(() => {
    const sb = browserClient(); if (!sb) return;
    void (async () => {
      const u = (await sb.auth.getUser()).data.user;
      setUser(u);
      if (!u) return;
      const { data } = await sb.from('declarations')
        .select('id,declared_label,hailand_code,location_floor,location_door,declared_landmark,certification_status,temporary_until,created_at,quartiers(nom),communes(nom)')
        .eq('user_id', u.id).eq('status', 'active').order('created_at', { ascending: false });
      type Row = Omit<Adresse, 'quartier' | 'commune' | 'level'> & { quartiers?: { nom: string } | null; communes?: { nom: string } | null };
      const rows = ((data as unknown as Row[] | null) ?? []).filter((a) => !a.temporary_until || Date.parse(a.temporary_until) > Date.now());
      const avecNiveau = await Promise.all(rows.map(async ({ quartiers, communes, ...a }) => {
        const r = await sb.rpc('fn_declaration_level', { p_declaration: a.id });
        return { ...a, quartier: quartiers?.nom ?? null, commune: communes?.nom ?? null, level: typeof r.data === 'number' ? r.data : null };
      }));
      setAdresses(avecNiveau);
    })();
  }, []);

  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as { full_name?: string };
  const tel = user.phone ? formatGnPhone(user.phone.startsWith('+') ? user.phone : `+${user.phone}`) : null;
  const depuis = new Date(user.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const ligne = (label: string, valeur: React.ReactNode, last = false) => (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${last ? '' : 'border-b border-line-soft'}`}>
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-[14.5px] font-extrabold">{valeur}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="identite" className="flex flex-col gap-2">
        <h2 id="identite" className="mx-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">Identité</h2>
        <div className="overflow-hidden rounded-[20px] border border-line-soft bg-card">
          {ligne('Nom', meta.full_name?.trim() || '—')}
          {ligne('Téléphone', tel ?? '—')}
          {ligne('E-mail', user.email || (user.new_email ? <span className="text-muted">{user.new_email} (à confirmer)</span> : <Link href={securiteHref} className="text-blue-ink">Ajouter</Link>))}
          {ligne('Compte Hailand depuis', depuis, true)}
        </div>
        <Link href={securiteHref} className="mx-1 self-start text-[13px] font-extrabold text-blue-ink">Changer le mot de passe ou l’e-mail</Link>
      </section>

      <section aria-labelledby="adresses" className="flex flex-col gap-2">
        <h2 id="adresses" className="mx-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">Adresses liées au compte</h2>
        {adresses === null && <p className="mx-1 text-[13px] font-semibold text-muted">Chargement…</p>}
        {adresses?.length === 0 && <p className="rounded-[20px] border border-dashed border-line px-4 py-4 text-center text-[13px] font-semibold text-muted">Aucune adresse enregistrée.</p>}
        {adresses?.map((a) => {
          const lieu = [a.quartier, a.commune].filter(Boolean).join(' · ');
          const details = [a.location_floor && `Étage ${a.location_floor}`, a.location_door && `Porte ${a.location_door}`, a.declared_landmark].filter(Boolean).join(' · ');
          const estBoutique = boutique?.declarationId === a.id;
          return (
            <div key={a.id} className="flex items-start gap-3 rounded-[20px] border border-line-soft bg-card px-4 py-3.5">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-blue-soft text-blue"><Icon name={estBoutique ? 'shop' : 'pin'} size={19} stroke={2} /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[15px] font-extrabold">{lieu || 'Quartier en cours d’identification'}</span>
                  {estBoutique && <span className="rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-extrabold text-white">Boutique {boutique?.nom}</span>}
                  {a.temporary_until && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[10.5px] font-extrabold text-[#7a5500]">Temporaire</span>}
                  {a.level === 3 && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[10.5px] font-extrabold text-ok">Certifiée</span>}
                </span>
                {a.hailand_code && <span className="font-display text-[13px] font-semibold tracking-[0.04em] text-blue-ink">{a.hailand_code}</span>}
                <span className="text-[12.5px] font-semibold text-muted">{[a.declared_label, details].filter(Boolean).join(' · ') || 'Sans précision'}{a.level ? ` · niveau ${a.level}` : ''}</span>
              </span>
            </div>
          );
        })}
        {ajouterHref && <Link href={ajouterHref} className="mx-1 self-start text-[13px] font-extrabold text-blue-ink">+ Ajouter une adresse</Link>}
      </section>
    </div>
  );
}
