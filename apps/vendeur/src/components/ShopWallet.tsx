'use client';
import { useState } from 'react';
import { formatSyli } from '@hailandx/commerce';
import { browserClient, MovementList, TestBand, useWallet, WalletCard, WithdrawForm } from '@hailandx/kit';

/**
 * Portefeuille HailandPay de la boutique (HAILANDX.md §42, maquette v8 B1) : les ventes payées en Syli y arrivent
 * à la remise du colis ; le propriétaire les passe vers son portefeuille ou fait un retrait simulé.
 */
export function ShopWallet({ shopId }: { shopId: string }) {
  const { wallet, reload } = useWallet();
  const [mode, setMode] = useState<'move' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const shop = wallet?.shops.find((s) => s.shop_id === shopId);
  if (!wallet || !shop) return null;
  const n = Number(amount.replace(/\D/g, '')) || 0;
  async function done(m: string) { setMsg(m); setMode(null); setAmount(''); await reload(); setTick((t) => t + 1); }
  async function move() {
    setErr(null); setBusy(true);
    const { error } = await browserClient()!.rpc('fn_shop_wallet_to_owner', { p_shop: shopId, p_amount: n });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?:\s*/, ''));
    await done(`${formatSyli(n)} passés vers votre portefeuille personnel.`);
  }
  const btn = 'flex h-11 flex-1 items-center justify-center rounded-2xl text-[13.5px] font-extrabold';
  return (
    <section aria-label="HailandPay de la boutique" className="flex flex-col gap-2.5">
      <h2 className="mx-1 mt-1.5 font-display text-[16px] font-semibold">HailandPay</h2>
      <WalletCard label="Solde de la boutique" balance={shop.balance} owner={shop.name} sub={shop.pending > 0 ? `+ ${formatSyli(shop.pending)} à recevoir à la remise des colis payés en Syli` : 'Les ventes payées en Syli arrivent ici à la remise du colis (commission déduite).'} />
      <div className="flex gap-2">
        <button type="button" disabled={shop.balance <= 0} onClick={() => { setMode(mode === 'move' ? null : 'move'); setMsg(null); }} className={`${btn} bg-ink text-white disabled:opacity-40`}>Vers mon portefeuille</button>
        <button type="button" disabled={shop.balance <= 0} onClick={() => { setMode(mode === 'withdraw' ? null : 'withdraw'); setMsg(null); }} className={`${btn} border border-line bg-card disabled:opacity-40`}>Retirer (simulé)</button>
      </div>
      {mode === 'move' && (
        <div className="flex flex-col gap-2 rounded-[20px] border border-line-soft bg-card p-3.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Montant à passer vers votre portefeuille
            <span className="flex h-12 items-center gap-2 rounded-2xl border border-line px-4"><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder={String(shop.balance)} className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none" /><span className="text-[13px] font-extrabold text-muted">Syli</span></span>
          </label>
          <button type="button" onClick={() => setAmount(String(shop.balance))} className="self-start text-[12.5px] font-bold text-blue-ink">Tout ({formatSyli(shop.balance)})</button>
          {err && <p role="alert" className="text-[13px] font-bold text-[#a3321f]">{err}</p>}
          <button type="button" disabled={busy || n <= 0 || n > shop.balance} onClick={move} className="h-12 rounded-2xl bg-lime text-[14.5px] font-extrabold text-ink disabled:opacity-40">{busy ? '…' : `Passer ${n > 0 ? formatSyli(n) : ''}`}</button>
        </div>
      )}
      {mode === 'withdraw' && <div className="rounded-[20px] border border-line-soft bg-card p-3.5"><WithdrawForm max={shop.balance} shopId={shopId} onDone={done} /></div>}
      {msg && <p role="status" className="rounded-2xl bg-ok-soft px-4 py-3 text-[13px] font-bold text-ok">{msg}</p>}
      <TestBand />
      <MovementList walletId={shop.wallet_id} limit={20} refreshKey={tick} empty="Aucun mouvement HailandPay : les ventes payées en Syli apparaîtront ici." />
    </section>
  );
}
