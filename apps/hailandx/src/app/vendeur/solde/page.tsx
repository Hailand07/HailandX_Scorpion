'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Entry { id: number; kind: string; amount_gnf: number; created_at: string }
const LABEL: Record<string, string> = { reglement_vendeur: 'Vente remise (commission déduite)', annulation_vendeur: 'Vente reprise (litige en faveur de l’acheteur)', reversement_vendeur: 'Versement reçu de Hailand' };

/** Solde du vendeur : ce que Hailand lui doit (ventes remises moins commission, moins ce qui a déjà été versé). */
export default function BalancePage() {
  const session = useSession();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [commission, setCommission] = useState<number | null>(null);
  useEffect(() => {
    const sb = browserClient(); if (!sb || !session) return;
    sb.from('ledger_entries').select('id,kind,amount_gnf,created_at').eq('account', 'shop').order('id', { ascending: false }).limit(200).then(({ data }) => setEntries((data as Entry[]) ?? []));
    sb.from('settings').select('value').eq('key', 'commission_bps').maybeSingle().then(({ data }) => setCommission(data ? Number((data as { value: string }).value) / 100 : null));
  }, [session]);
  const balance = (entries ?? []).reduce((n, e) => n + e.amount_gnf, 0);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-12 pt-6">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><Link href="/vendeur" className="text-[13px] font-bold text-blue-ink">Mon espace</Link></div>
      <h1 className="font-display text-[22px] font-semibold tracking-tight">Mon solde</h1>
      {session === null && <Link href="/connexion?next=/vendeur/solde" className="font-bold text-blue-ink">Se connecter</Link>}
      {entries && (
        <>
          <div className="rounded-[22px] bg-ink px-5 py-4 text-white"><div className="text-[12px] font-bold text-white/70">Hailand vous doit</div><div className="font-display text-[28px] font-semibold">{formatGnf(balance)}</div>{commission !== null && <div className="text-[12px] font-semibold text-white/70">Commission de {String(commission).replace('.', ',')} % déduite des articles ; les frais de livraison ne vous concernent pas.</div>}</div>
          {entries.length === 0 && <p className="text-[13.5px] font-medium text-muted">Aucun mouvement pour l’instant : votre solde se remplit à chaque colis remis.</p>}
          {entries.map((e) => <div key={e.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-card px-3.5 py-3"><span className="flex min-w-0 flex-col"><span className="text-[13.5px] font-bold">{LABEL[e.kind] ?? e.kind}</span><span className="text-[11.5px] font-semibold text-muted">{new Date(e.created_at).toLocaleDateString('fr-FR')}</span></span><span className={`shrink-0 font-display text-[14.5px] font-semibold ${e.amount_gnf < 0 ? 'text-[#8a2a1c]' : ''}`}>{e.amount_gnf > 0 ? '+' : ''}{formatGnf(e.amount_gnf)}</span></div>)}
        </>
      )}
    </main>
  );
}
