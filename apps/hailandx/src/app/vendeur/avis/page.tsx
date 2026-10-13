'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Wordmark } from '@hailandx/ui';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Review { id: string; rating: number; comment: string | null; created_at: string; hidden: boolean; review_reports: { status: string; reason: string }[] | null }
const REASONS: [string, string][] = [['faux', 'Cette personne n’a pas commandé'], ['injurieux', 'Propos injurieux'], ['hors_sujet', 'Sans rapport avec le produit ou la livraison'], ['autre', 'Autre raison']];

/** Avis reçus : le vendeur peut signaler un avis abusif ; l'équipe Hailand décide (un avis masqué ne compte plus dans l'indice). */
export default function SellerReviewsPage() {
  const session = useSession();
  const [list, setList] = useState<Review[] | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState('faux');
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const sb = browserClient(); if (!sb || !session) return;
    const { data: shop } = await sb.from('shops').select('id').eq('owner_id', session.user.id).limit(1).maybeSingle();
    if (!shop) return setList([]);
    const { data } = await sb.from('reviews').select('id,rating,comment,created_at,hidden,review_reports(status,reason)').eq('shop_id', (shop as { id: string }).id).order('created_at', { ascending: false }).limit(100);
    setList((data as unknown as Review[]) ?? []);
  }, [session]);
  useEffect(() => { void load(); }, [load]);

  async function send(id: string) {
    const { error } = await browserClient()!.rpc('fn_report_review', { p_review: id, p_reason: reason, p_details: details || null });
    setMsg(error ? error.message.replace(/^.*?:\s*/, '') : 'Signalement envoyé : l’équipe Hailand l’examine.');
    setReporting(null); setDetails(''); await load();
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-6">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><Link href="/vendeur" className="text-[13px] font-bold text-blue-ink">Mon espace</Link></div>
      <h1 className="font-display text-[22px] font-semibold tracking-tight">Mes avis</h1>
      {session === null && <Link href="/connexion?next=/vendeur/avis" className="font-bold text-blue-ink">Se connecter</Link>}
      {msg && <p role="status" className="rounded-2xl bg-sand px-4 py-3 text-[13.5px] font-semibold">{msg}</p>}
      {list?.length === 0 && <p className="text-[14px] font-medium text-muted">Aucun avis pour l’instant.</p>}
      {list?.map((r) => {
        const rep = r.review_reports?.[0];
        return (
          <section key={r.id} className={`flex flex-col gap-1.5 rounded-2xl border border-line-soft bg-card p-3.5 ${r.hidden ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between"><span className="font-display text-[16px] font-semibold">{'★'.repeat(r.rating)}<span className="text-line">{'★'.repeat(5 - r.rating)}</span></span><span className="text-[11.5px] font-semibold text-muted">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span></div>
            {r.comment && <p className="text-[13.5px] font-medium">{r.comment}</p>}
            {r.hidden && <Badge tone="sand">Masqué par l’équipe Hailand</Badge>}
            {rep && !r.hidden && <Badge tone={rep.status === 'ouvert' ? 'blue' : 'sand'}>{rep.status === 'ouvert' ? 'Signalé : en cours d’examen' : 'Signalement examiné : avis maintenu'}</Badge>}
            {!rep && !r.hidden && reporting !== r.id && <button type="button" onClick={() => setReporting(r.id)} className="h-10 self-start rounded-full border border-line px-3.5 text-[12.5px] font-bold">Signaler cet avis</button>}
            {reporting === r.id && (
              <div className="flex flex-col gap-2 rounded-2xl bg-sand p-3">
                <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Raison" className="h-11 rounded-xl border border-line bg-card px-3 text-[15px]">{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={2} placeholder="Précisions (facultatif)" className="rounded-xl border border-line bg-card px-3 py-2 text-[15px]" />
                <div className="flex gap-2"><button type="button" onClick={() => send(r.id)} className="h-11 flex-1 rounded-xl bg-ink text-[13.5px] font-extrabold text-white">Envoyer</button><button type="button" onClick={() => setReporting(null)} className="h-11 rounded-xl border border-line px-4 text-[13.5px] font-bold">Annuler</button></div>
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
