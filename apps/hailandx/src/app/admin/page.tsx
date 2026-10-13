'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Courier { user_id: string; full_name: string; vehicle: string; status: string; cash_balance_gnf: number; cash_limit_gnf: number; created_at: string }
interface Shop { id: string; name: string; slug: string; status: string }
interface Dispute { id: string; reason: string; details: string | null; created_at: string; parcels: { subtotal_gnf: number; delivery_fee_gnf: number; shops: { name: string } | null } | null }
const REASON: Record<string, string> = { non_recu: 'Colis non reçu', endommage: 'Produit abîmé', different: 'Produit différent', autre: 'Autre problème' };

/** Console d'équipe (administrateurs Hailand) : valider les livreurs, enregistrer leurs reversements d'espèces, suspendre une boutique. */
export default function AdminPage() {
  const session = useSession();
  const sb = browserClient();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [kpi, setKpi] = useState<{ shops: number; orders: number; delivered: number; couriers: number; sales: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const a = await sb.rpc('is_admin');
    setAdmin(a.data === true);
    if (a.data !== true) return;
    const [c, s, d] = await Promise.all([
      sb.from('couriers').select('user_id,full_name,vehicle,status,cash_balance_gnf,cash_limit_gnf,created_at').order('created_at', { ascending: false }),
      sb.from('shops').select('id,name,slug,status').order('created_at', { ascending: false }).limit(100),
      sb.from('disputes').select('id,reason,details,created_at,parcels(subtotal_gnf,delivery_fee_gnf,shops(name))').eq('status', 'ouvert').order('created_at'),
    ]);
    setDisputes((d.data as unknown as Dispute[]) ?? []);
    const count = async (table: string, f?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Une colonne précise (jamais « * ») : certaines colonnes sensibles ne sont pas lisibles directement.
      let q = sb.from(table).select(table === 'couriers' ? 'user_id' : 'id', { count: 'exact', head: true });
      if (f) q = f(q);
      return (await q).count ?? 0;
    };
    const [shopsOpen, orders, delivered, couriersOk, sales] = await Promise.all([
      count('shops', (q) => q.eq('status', 'ouverte')), count('orders'), count('parcels', (q) => q.eq('status', 'remis')), count('couriers', (q) => q.eq('status', 'valide')),
      sb.from('parcels').select('subtotal_gnf').eq('status', 'remis').limit(2000),
    ]);
    setKpi({ shops: shopsOpen, orders, delivered, couriers: couriersOk, sales: ((sales.data as { subtotal_gnf: number }[]) ?? []).reduce((n, r) => n + r.subtotal_gnf, 0) });
    setCouriers((c.data as Courier[]) ?? []); setShops((s.data as Shop[]) ?? []);
  }, [sb]);
  useEffect(() => { if (session) void load(); }, [session, load]);

  async function act(p: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    const { error } = await p; setMsg(error ? error.message.replace(/^.*?:\s*/, '') : ok); await load();
  }

  if (session === null) return <main className="mx-auto max-w-md px-5 pt-6"><Link href="/connexion?next=/admin" className="font-bold text-blue-ink">Se connecter</Link></main>;
  if (admin === false) return <main className="mx-auto max-w-md px-5 pt-6"><p className="text-[14px] font-medium text-muted">Cet espace est réservé à l’équipe Hailand.</p></main>;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-12 pt-6">
      <Link href="/" aria-label="Accueil"><Wordmark /></Link>
      <h1 className="font-display text-[22px] font-semibold tracking-tight">Équipe Hailand</h1>
      {msg && <p role="status" className="rounded-2xl bg-sand px-4 py-3 text-[13.5px] font-semibold">{msg}</p>}

      {kpi && (
        <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-2.5">
          {[['Boutiques ouvertes', String(kpi.shops)], ['Commandes', String(kpi.orders)], ['Colis remis', String(kpi.delivered)], ['Livreurs validés', String(kpi.couriers)]].map(([l, v]) => <div key={l} className="rounded-2xl border border-line-soft bg-card px-3.5 py-3"><div className="text-[11.5px] font-bold text-muted">{l}</div><div className="font-display text-[22px] font-semibold">{v}</div></div>)}
          <div className="col-span-2 rounded-2xl bg-ink px-3.5 py-3 text-white"><div className="text-[11.5px] font-bold text-white/70">Ventes livrées (hors livraison)</div><div className="font-display text-[22px] font-semibold">{formatGnf(kpi.sales)}</div></div>
        </section>
      )}

      <h2 className="font-display text-lg font-semibold">Litiges ouverts ({disputes.length})</h2>
      {disputes.length === 0 && <p className="text-[13.5px] font-medium text-muted">Aucun litige ouvert.</p>}
      {disputes.map((d) => (
        <section key={d.id} className="flex flex-col gap-2 rounded-2xl border border-line-soft bg-card p-3.5">
          <div className="flex items-center justify-between"><span className="text-[14px] font-bold">{REASON[d.reason] ?? d.reason}</span><Badge tone="lime">{d.parcels?.shops?.name ?? 'Boutique'}</Badge></div>
          {d.details && <p className="text-[13px] font-medium text-muted">« {d.details} »</p>}
          <p className="text-[12px] font-semibold text-muted">{d.parcels ? `${formatGnf(d.parcels.subtotal_gnf)} + livraison ${formatGnf(d.parcels.delivery_fee_gnf)} · ` : ''}{new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => act(sb!.rpc('fn_resolve_dispute', { p_dispute: d.id, p_in_favor_of: 'acheteur' }), 'Tranché en faveur de l’acheteur : colis annulé.')} className="h-10 flex-1 rounded-xl bg-ink text-[13px] font-bold text-white">Pour l’acheteur</button>
            <button type="button" onClick={() => act(sb!.rpc('fn_resolve_dispute', { p_dispute: d.id, p_in_favor_of: 'vendeur' }), 'Tranché en faveur du vendeur : livraison confirmée.')} className="h-10 flex-1 rounded-xl border border-line text-[13px] font-bold">Pour le vendeur</button>
          </div>
        </section>
      ))}

      <h2 className="font-display text-lg font-semibold">Livreurs</h2>
      {couriers.length === 0 && <p className="text-[13.5px] font-medium text-muted">Aucun livreur.</p>}
      {couriers.map((c) => (
        <section key={c.user_id} className="flex flex-col gap-2 rounded-2xl border border-line-soft bg-card p-3.5">
          <div className="flex items-center justify-between"><span className="text-[14px] font-bold">{c.full_name} · {c.vehicle}</span><Badge tone={c.status === 'valide' ? 'ok' : c.status === 'candidat' ? 'lime' : 'sand'}>{c.status}</Badge></div>
          <div className="flex gap-2">
            {c.status !== 'valide' && <button type="button" onClick={() => act(sb!.from('couriers').update({ status: 'valide' }).eq('user_id', c.user_id), 'Livreur validé.')} className="h-10 flex-1 rounded-xl bg-ink text-[13px] font-bold text-white">Valider</button>}
            {c.status !== 'suspendu' && <button type="button" onClick={() => act(sb!.from('couriers').update({ status: 'suspendu', available: false }).eq('user_id', c.user_id), 'Livreur suspendu.')} className="h-10 flex-1 rounded-xl border border-line text-[13px] font-bold">Suspendre</button>}
          </div>
          {c.cash_balance_gnf > 0 && (
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act(sb!.rpc('fn_courier_cash_settle', { p_courier: c.user_id, p_amount: Number(f.get('amount')) }), 'Reversement enregistré.'); }}>
              <span className="shrink-0 text-[12.5px] font-semibold text-muted">Espèces : {formatGnf(c.cash_balance_gnf)}</span>
              <input name="amount" inputMode="numeric" defaultValue={c.cash_balance_gnf} aria-label="Montant reversé" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 text-[14px]" />
              <Button type="submit" variant="secondary" className="h-10 px-3 text-[12.5px]">Reçu</Button>
            </form>
          )}
        </section>
      ))}

      <h2 className="font-display text-lg font-semibold">Boutiques</h2>
      {shops.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-2 rounded-2xl border border-line-soft bg-card px-3.5 py-3">
          <span className="flex min-w-0 flex-col"><Link href={`/b/${s.slug}`} className="truncate text-[14px] font-bold">{s.name}</Link><span className="text-[12px] font-semibold text-muted">{s.status}</span></span>
          <button type="button" onClick={() => act(sb!.from('shops').update({ status: s.status === 'suspendue' ? 'bientot' : 'suspendue' }).eq('id', s.id), s.status === 'suspendue' ? 'Boutique réactivée.' : 'Boutique suspendue.')} className="h-10 shrink-0 rounded-xl border border-line px-3 text-[13px] font-bold">{s.status === 'suspendue' ? 'Réactiver' : 'Suspendre'}</button>
        </div>
      ))}
    </main>
  );
}
