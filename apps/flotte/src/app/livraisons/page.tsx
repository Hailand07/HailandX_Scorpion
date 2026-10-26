'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatGnf } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { Stat, WARN } from '@/components/Frame';
import { Ico } from '@/components/Icons';
import { CourierWallet } from '@/components/CourierWallet';
import { CourierPayout } from '@/components/CourierPayout';
import { Chargement } from '@hailandx/ui';

interface Row { id: string; delivered_at: string; delivery_fee_gnf: number; cod_amount_gnf: number; distance_km: number | null; shops: { name: string } | null }
interface Cash { cash_balance_gnf: number; cash_limit_gnf: number }

const jour = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** Menu → « Mes livraisons » : gains du jour et des 7 derniers jours, espèces à reverser, historique des remises (lecture seule). */
export default function Livraisons() {
  const router = useRouter();
  const session = useSession();
  const sb = browserClient();
  const uid = session?.user.id;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cash, setCash] = useState<Cash | null>(null);

  useEffect(() => {
    if (session === null) { router.replace('/connexion'); return; }
    if (!sb || !uid) return;
    void (async () => {
      const [p, c] = await Promise.all([
        sb.from('parcels').select('id,delivered_at,delivery_fee_gnf,cod_amount_gnf,distance_km,shops(name)').eq('courier_id', uid).eq('status', 'remis').order('delivered_at', { ascending: false }).limit(60),
        sb.from('couriers').select('cash_balance_gnf,cash_limit_gnf').eq('user_id', uid).maybeSingle(),
      ]);
      setRows((p.data as unknown as Row[] | null) ?? []);
      setCash((c.data as Cash | null) ?? null);
    })();
  }, [session, sb, uid, router]);

  const sums = useMemo(() => {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const d7 = new Date(d0); d7.setDate(d7.getDate() - 6);
    const sum = (since: Date) => (rows ?? []).filter((r) => new Date(r.delivered_at) >= since);
    const t = sum(d0), w = sum(d7);
    return { today: t.reduce((n, r) => n + r.delivery_fee_gnf, 0), todayN: t.length, week: w.reduce((n, r) => n + r.delivery_fee_gnf, 0), weekN: w.length };
  }, [rows]);
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows ?? []) { const k = jour(new Date(r.delivered_at)); m.set(k, [...(m.get(k) ?? []), r]); }
    return [...m.entries()];
  }, [rows]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-16 pt-[max(18px,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Retour" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-night-line bg-night-card">{Ico.back()}</Link>
        <h1 className="font-display text-[22px] font-semibold">Mes livraisons</h1>
      </header>
      <div className="flex gap-2">
        <Stat label="Aujourd’hui" value={formatGnf(sums.today)} accent />
        <Stat label="7 derniers jours" value={formatGnf(sums.week)} />
      </div>
      <p className="-mt-2 text-[12.5px] font-semibold text-night-muted">{sums.todayN} livraison{sums.todayN > 1 ? 's' : ''} aujourd’hui · {sums.weekN} en 7 jours</p>

      <section id="especes" aria-label="Espèces à reverser" className="flex flex-col gap-2 rounded-[20px] border border-night-line bg-night-card p-4">
        <span className="text-[12.5px] font-bold text-night-muted">Espèces à reverser à Hailand</span>
        <span className="font-display text-[26px] font-semibold">{cash ? formatGnf(cash.cash_balance_gnf) : '…'}</span>
        {cash && <span className="text-[12.5px] font-semibold text-night-muted">Votre part de chaque livraison en espèces est déjà déduite : vous la gardez. Plafond : {formatGnf(cash.cash_limit_gnf)} ; au-delà, plus de mission payable à la livraison avant le reversement.</span>}
        {cash && cash.cash_balance_gnf >= cash.cash_limit_gnf && <p className={WARN}>Plafond atteint : reversez vos espèces à l’équipe Hailand.</p>}
      </section>

      <CourierPayout />

      <CourierWallet />

      {rows === null && <Chargement />}
      {rows?.length === 0 && <p className="text-[14px] font-medium text-night-muted">Aucune livraison terminée pour l’instant.</p>}
      {groups.map(([day, list]) => (
        <section key={day} aria-label={day} className="flex flex-col gap-2">
          <h2 className="text-[12.5px] font-extrabold capitalize tracking-[0.02em] text-night-muted">{day}</h2>
          {list.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-night-line bg-night-card px-4 py-3">
              <span className="flex min-w-0 flex-col"><span className="truncate text-[14.5px] font-extrabold">{r.shops?.name ?? 'Boutique'}</span><span className="text-[12px] font-semibold text-night-muted">{new Date(r.delivered_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{r.distance_km ? ` · ${Number(r.distance_km).toLocaleString('fr-FR')} km` : ''}{r.cod_amount_gnf > 0 ? ` · espèces ${formatGnf(r.cod_amount_gnf)}` : ''}</span></span>
              <span className="shrink-0 font-display text-[15px] font-semibold text-lime">+ {formatGnf(r.delivery_fee_gnf)}</span>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
