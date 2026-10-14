'use client';
import { useEffect, useState } from 'react';
import { formatGnf } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { maskPhone } from '@/lib/seller';
import { useSession } from '@/lib/useSession';
import { BackHeader, Icon, Screen } from '@/components/Screen';
import { SellerGate } from '@/components/seller/SellerGate';

interface Entry { id: number; kind: string; amount_gnf: number; created_at: string; parcel_id: string | null }
const LABEL: Record<string, string> = { reglement_vendeur: 'Vente remise', annulation_vendeur: 'Vente reprise (litige)', reversement_vendeur: 'Versement reçu de Hailand' };

/** Argent (v2) : ce que Hailand doit à la boutique, l'argent bloqué en attente de remise, et les mouvements. */
export default function MoneyPage() {
  return <SellerGate title="Argent">{({ shop }) => <Money shopId={shop.id} />}</SellerGate>;
}

function Money({ shopId }: { shopId: string }) {
  const session = useSession();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [pending, setPending] = useState<{ n: number; sum: number } | null>(null);
  const [commission, setCommission] = useState<number | null>(null);
  useEffect(() => {
    const sb = browserClient(); if (!sb) return;
    sb.from('ledger_entries').select('id,kind,amount_gnf,created_at,parcel_id').eq('account', 'shop').eq('account_id', shopId).order('id', { ascending: false }).limit(200).then(({ data }) => setEntries((data as Entry[]) ?? []));
    sb.from('parcels').select('subtotal_gnf, orders!inner(payment_status)').eq('shop_id', shopId).not('status', 'in', '(remis,annule)').eq('orders.payment_status', 'bloque')
      .then(({ data }) => { const xs = (data as { subtotal_gnf: number }[]) ?? []; setPending({ n: xs.length, sum: xs.reduce((k, x) => k + x.subtotal_gnf, 0) }); });
    sb.from('settings').select('value').eq('key', 'commission_bps').maybeSingle().then(({ data }) => setCommission(data ? Number((data as { value: string }).value) / 100 : null));
  }, [shopId]);
  const balance = (entries ?? []).reduce((n, e) => n + e.amount_gnf, 0);
  const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <Screen>
      <BackHeader href="/vendeur" title="Argent" label="Retour à Ma boutique" />
      <section className="flex flex-col gap-3 rounded-[24px] bg-ink p-[18px] text-white">
        <span className="text-[12.5px] font-bold text-white/70">Hailand vous doit</span>
        <span className="font-display text-[32px] font-semibold tracking-tight">{entries ? formatGnf(balance, false) : '…'} <span className="text-[15px] text-white/65">GNF</span></span>
        <div className="flex items-center gap-2.5 rounded-[14px] bg-white/[0.08] px-3 py-2.5 text-[12.5px] font-bold leading-snug text-white/85">
          <Icon name="phone" size={18} stroke={2} className="text-lime" />Versé par Hailand sur votre Orange Money · {maskPhone(session?.user.phone)}
        </div>
      </section>

      {pending && pending.n > 0 && (
        <section className="flex items-center gap-3 rounded-[20px] border border-line-soft bg-card px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-amber-soft text-[#9a6b00]"><Icon name="clock" size={18} stroke={2} /></span>
          <span className="flex flex-col gap-px"><span className="text-[14px] font-extrabold">{formatGnf(pending.sum)} en attente</span><span className="text-[12px] font-semibold leading-snug text-muted">{pending.n} colis payé{pending.n > 1 ? 's' : ''}, pas encore remis. L’argent vous revient à la remise.</span></span>
        </section>
      )}

      <section aria-label="Mouvements" className="flex flex-col gap-2">
        <h2 className="mx-1 mt-1.5 font-display text-[16px] font-semibold">Mouvements</h2>
        {entries?.length === 0 && <p className="rounded-[20px] border border-dashed border-line px-4 py-6 text-center text-[13.5px] font-semibold text-muted">Aucun mouvement pour l’instant : votre solde se remplit à chaque colis remis.</p>}
        {entries && entries.length > 0 && (
          <div className="overflow-hidden rounded-[20px] border border-line-soft bg-card">
            {entries.map((e, i) => (
              <div key={e.id} className={`flex items-center gap-3 px-4 py-3 ${i < entries.length - 1 ? 'border-b border-[#f0ede6]' : ''}`}>
                <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[13.5px] font-extrabold">{LABEL[e.kind] ?? e.kind}{e.parcel_id && e.kind !== 'reversement_vendeur' ? ` · HX-${e.parcel_id.slice(0, 4).toUpperCase()}` : ''}</span><span className="text-[11.5px] font-semibold text-muted">{when(e.created_at)}</span></span>
                <span className={`shrink-0 whitespace-nowrap font-display text-[14px] font-semibold ${e.amount_gnf > 0 ? 'text-[#0f7a5c]' : ''}`}>{e.amount_gnf > 0 ? '+ ' : '− '}{formatGnf(Math.abs(e.amount_gnf), false)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="mx-1 text-[12px] font-semibold leading-snug text-muted">La commission Hailand{commission !== null ? ` (${String(commission).replace('.', ',')} %)` : ''} est déduite du prix des articles. Les frais de livraison sont payés par l’acheteur et ne vous concernent pas.</p>
    </Screen>
  );
}
