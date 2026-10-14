'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatGnf } from '@hailandx/commerce';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';
import { phoneText } from '@/lib/format';

interface Owed { shopId: string; name: string; amount: number }
interface Refund { buyer_id: string; amount_gnf: number; buyer_phone: string | null }
interface Totals { platform: number; escrow: number; courier: number }

/**
 * Argent : ce que Hailand doit verser aux boutiques et rembourser aux acheteurs (grand livre), et les soldes globaux.
 * Chaque versement enregistré est inscrit au journal.
 */
export default function MoneyPage() {
  const { sb } = useConsole();
  const { busy, msg, run } = useAction();
  const [owed, setOwed] = useState<Owed[] | null>(null);
  const [refunds, setRefunds] = useState<Refund[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [led, shops, due] = await Promise.all([
      sb.from('ledger_entries').select('account,account_id,amount_gnf').limit(20000),
      sb.from('shops').select('id,name').limit(2000),
      sb.rpc('fn_refunds_due'),
    ]);
    const names = new Map(((shops.data as { id: string; name: string }[]) ?? []).map((s) => [s.id, s.name]));
    const byShop = new Map<string, number>();
    const t: Totals = { platform: 0, escrow: 0, courier: 0 };
    for (const r of (led.data as { account: string; account_id: string | null; amount_gnf: number }[]) ?? []) {
      if (r.account === 'shop' && r.account_id) byShop.set(r.account_id, (byShop.get(r.account_id) ?? 0) + r.amount_gnf);
      if (r.account === 'platform') t.platform += r.amount_gnf;
      if (r.account === 'escrow') t.escrow += r.amount_gnf;
      if (r.account === 'courier') t.courier += r.amount_gnf;
    }
    setOwed([...byShop].filter(([, v]) => v > 0).map(([id, v]) => ({ shopId: id, name: names.get(id) ?? 'Boutique', amount: v })).sort((a, b) => b.amount - a.amount));
    setRefunds((due.data as Refund[]) ?? []);
    setTotals(t);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);
  const after = async () => { setConfirm(null); await load(); };

  const owedTotal = (owed ?? []).reduce((n, o) => n + o.amount, 0);
  const refundTotal = (refunds ?? []).reduce((n, r) => n + r.amount_gnf, 0);

  return (
    <>
      <PageHead title="Argent" sub="Grand livre Hailand" />
      <section aria-label="Soldes" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile label="Commission Hailand (cumul)" value={totals ? formatGnf(totals.platform) : '…'} />
        <Tile label="En séquestre" value={totals ? formatGnf(totals.escrow) : '…'} sub="Payé, pas encore livré" />
        <Tile label="À verser aux boutiques" value={owed ? formatGnf(owedTotal) : '…'} sub={owed ? `${owed.length} boutique${owed.length > 1 ? 's' : ''}` : ''} />
        <Tile label="À rembourser" value={refunds ? formatGnf(refundTotal) : '…'} sub={refunds ? `${refunds.length} acheteur${refunds.length > 1 ? 's' : ''}` : ''} />
      </section>
      <Flash msg={msg} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="À verser aux boutiques" className="overflow-hidden">
          {owed?.length === 0 && <p className="border-t border-[#f0ede6] px-[18px] py-4 text-[14px] font-semibold text-muted">Rien à verser.</p>}
          <ul>
            {owed?.map((o) => (
              <li key={o.shopId} className="flex flex-wrap items-center gap-3 border-t border-[#f0ede6] px-[18px] py-3">
                <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[14.5px] font-extrabold">{o.name}</span><span className="text-[12.5px] font-semibold text-muted">{formatGnf(o.amount)}</span></span>
                {confirm === `s${o.shopId}` ? (
                  <span className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => run(sb.rpc('fn_shop_payout', { p_shop: o.shopId, p_amount: o.amount }), `Versement de ${formatGnf(o.amount)} à « ${o.name} » enregistré.`, after)} className={`${btn.small} bg-ink text-white`}>Confirmer le versement</button>
                    <button type="button" onClick={() => setConfirm(null)} className={btn.small}>Annuler</button>
                  </span>
                ) : <button type="button" onClick={() => setConfirm(`s${o.shopId}`)} className={btn.small}>Versé</button>}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Remboursements à effectuer" className="overflow-hidden">
          {refunds?.length === 0 && <p className="border-t border-[#f0ede6] px-[18px] py-4 text-[14px] font-semibold text-muted">Aucun remboursement en attente.</p>}
          <ul>
            {refunds?.map((r) => (
              <li key={r.buyer_id} className="flex flex-wrap items-center gap-3 border-t border-[#f0ede6] px-[18px] py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14.5px] font-extrabold">{r.buyer_phone ? <a href={`tel:+${r.buyer_phone.replace(/\D/g, '')}`} className="hover:text-blue">{phoneText(r.buyer_phone)}</a> : 'Acheteur'}</span>
                  <span className="text-[12.5px] font-semibold text-muted">{formatGnf(r.amount_gnf)}</span>
                </span>
                {confirm === `r${r.buyer_id}` ? (
                  <span className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => run(sb.rpc('fn_refund_paid', { p_buyer: r.buyer_id, p_amount: r.amount_gnf }), `Remboursement de ${formatGnf(r.amount_gnf)} enregistré.`, after)} className={`${btn.small} bg-ink text-white`}>Confirmer le remboursement</button>
                    <button type="button" onClick={() => setConfirm(null)} className={btn.small}>Annuler</button>
                  </span>
                ) : <button type="button" onClick={() => setConfirm(`r${r.buyer_id}`)} className={btn.small}>Remboursé</button>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <p className="text-[12.5px] font-semibold text-muted">« Versé » et « Remboursé » enregistrent un paiement déjà fait (Orange Money ou espèces) : la console ne déplace pas d’argent elle-même.</p>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-line-soft bg-card px-[18px] py-4">
      <span className="text-[12.5px] font-bold text-muted">{label}</span>
      <span className="font-display text-[20px] font-semibold lg:text-[22px]">{value}</span>
      {sub && <span className="text-[12px] font-bold text-muted">{sub}</span>}
    </div>
  );
}
