'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Courier { user_id: string; full_name: string; vehicle: string; status: string; cash_balance_gnf: number; cash_limit_gnf: number; created_at: string }
interface Shop { id: string; name: string; slug: string; status: string }

/** Console d'équipe (administrateurs Hailand) : valider les livreurs, enregistrer leurs reversements d'espèces, suspendre une boutique. */
export default function AdminPage() {
  const session = useSession();
  const sb = browserClient();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const a = await sb.rpc('is_admin');
    setAdmin(a.data === true);
    if (a.data !== true) return;
    const [c, s] = await Promise.all([
      sb.from('couriers').select('user_id,full_name,vehicle,status,cash_balance_gnf,cash_limit_gnf,created_at').order('created_at', { ascending: false }),
      sb.from('shops').select('id,name,slug,status').order('created_at', { ascending: false }).limit(100),
    ]);
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
