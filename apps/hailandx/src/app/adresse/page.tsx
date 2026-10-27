'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Wordmark } from '@hailandx/ui';
import { browserClient, Icon, useSession } from '@hailandx/kit';
import { AdresseClient } from '@/components/AdresseClient';

interface Decl { id: string; declared_label: string | null; hailand_code: string | null; location_floor: string | null; location_door: string | null; declared_landmark: string | null }

/**
 * Mes adresses de livraison. Phase de lancement (§49, 2026-10-27) : l'emplacement s'enregistre ICI, avec le parcours recopié
 * de NavigationX (il n'y a plus de détour par NavigationX). `?next=` ramène à la page demandée à la fin (ex. la commande).
 */
function Page() {
  const nextParam = useSearchParams().get('next');
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/adresse';
  const session = useSession();
  const sb = browserClient();
  const [list, setList] = useState<Decl[] | null>(null);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    if (!sb || !session) return;
    const { data } = await sb.from('declarations').select('id,declared_label,hailand_code,location_floor,location_door,declared_landmark').eq('user_id', session.user.id).eq('status', 'active').order('created_at', { ascending: false });
    const rows = (data as Decl[]) ?? [];
    setList(rows);
    const lv: Record<string, number> = {};
    await Promise.all(rows.map(async (d) => { const r = await sb.rpc('fn_declaration_level', { p_declaration: d.id }); if (typeof r.data === 'number') lv[d.id] = r.data; }));
    setLevels(lv);
  }, [sb, session]);
  useEffect(() => { void load(); }, [load]);

  if (adding) return <AdresseClient cta={next === '/adresse' ? 'Voir mes adresses' : 'Continuer'} onDone={() => { setAdding(false); if (next === '/adresse') void load(); else router.replace(next); }} onClose={() => setAdding(false)} />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-6">
      <Link href="/" aria-label="Accueil"><Wordmark /></Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-semibold tracking-tight">Où livrer ?</h1>
        <p className="text-[14px] font-medium text-muted">Votre adresse guide le livreur jusqu’à votre porte, sans appel.</p>
      </div>
      {session === null && <Link href={`/connexion?next=${encodeURIComponent('/adresse' + (nextParam ? `?next=${nextParam}` : ''))}`} className="inline-flex h-[54px] items-center justify-center rounded-2xl bg-ink px-7 text-[15px] font-extrabold text-white">Me connecter</Link>}
      {session && list && list.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Mes adresses">
          {list.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-card px-4 py-3">
              <span className="flex flex-col"><span className="text-[14px] font-extrabold">{d.declared_label ?? 'Adresse'}</span><span className="text-[12px] font-semibold text-muted">{d.hailand_code}{levels[d.id] ? ` · niveau ${levels[d.id]}` : ''}{d.declared_landmark ? ` · ${d.declared_landmark}` : ''}</span></span>
              <Badge tone="sand">{[d.location_floor && `Étage ${d.location_floor}`, d.location_door && `Porte ${d.location_door}`].filter(Boolean).join(' · ') || 'Enregistrée'}</Badge>
            </div>
          ))}
        </section>
      )}
      {session && list && (
        <section className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-4">
          <p className="text-[14px] font-medium leading-relaxed text-muted">{list.length ? 'Une autre adresse ? ' : 'Pour être livré jusqu’à votre porte, '}repérez le bâtiment ici même : position GPS, vue satellite, vous confirmez. Elle servira pour toutes vos commandes.</p>
          <button type="button" onClick={() => setAdding(true)} className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-blue text-[15px] font-extrabold text-white"><Icon name="pin" size={18} />Repérer mon bâtiment</button>
        </section>
      )}
    </main>
  );
}

export default function AdressePage() { return <Suspense><Page /></Suspense>; }
