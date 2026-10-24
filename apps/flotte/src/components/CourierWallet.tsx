'use client';
import { useEffect, useState } from 'react';
import { formatSyli } from '@hailandx/commerce';
import { HAILANDX_URL, HailandPayMark, TestBand, useWallet, WithdrawForm } from '@hailandx/kit';
import { browserClient } from '@/lib/supabase';

/**
 * Gains HailandPay du livreur (HAILANDX.md §42, maquette v8 C1) : pour une commande payée en Syli, sa part des frais
 * de livraison arrive dans son portefeuille à la remise (au lieu d'être due par Hailand). Même portefeuille que dans HailandX.
 */
export function CourierWallet() {
  const { wallet, reload } = useWallet();
  const [gains, setGains] = useState<{ n: number; sum: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!wallet) return;
    browserClient()?.from('wallet_movements').select('amount').eq('wallet_id', wallet.wallet_id).eq('kind', 'gain_livraison').limit(1000)
      .then(({ data }) => { const xs = (data as { amount: number }[]) ?? []; setGains({ n: xs.length, sum: xs.reduce((k, x) => k + Number(x.amount), 0) }); });
  }, [wallet]);
  if (!wallet) return null;
  return (
    <section id="hailandpay" aria-label="Gains HailandPay" className="flex flex-col gap-2.5 rounded-[20px] border border-night-line bg-night-card p-4">
      <span className="flex items-center justify-between"><HailandPayMark className="text-[16px]" /><span className="rounded-full bg-lime/15 px-2.5 py-1 text-[11px] font-extrabold text-lime">TEST</span></span>
      <span className="text-[12.5px] font-bold text-night-muted">Solde de mon portefeuille</span>
      <span className="font-display text-[26px] font-semibold">{formatSyli(wallet.balance, false)} <span className="text-[14px] text-lime">Syli</span></span>
      {gains && <span className="text-[12.5px] font-semibold text-night-muted">{gains.n > 0 ? `Dont ${formatSyli(gains.sum)} gagnés sur ${gains.n} livraison${gains.n > 1 ? 's' : ''} payée${gains.n > 1 ? 's' : ''} en Syli.` : 'Vos gains sur les commandes payées en Syli arriveront ici à chaque remise.'}</span>}
      <div className="flex gap-2">
        <button type="button" disabled={wallet.balance <= 0} onClick={() => { setOpen(!open); setMsg(null); }} className="h-11 flex-1 rounded-2xl bg-lime text-[13.5px] font-extrabold text-ink disabled:opacity-40">Retirer (simulé)</button>
        <a href={`${HAILANDX_URL}/compte/hailandpay`} className="flex h-11 flex-1 items-center justify-center rounded-2xl border border-night-line text-[13.5px] font-extrabold">Ouvrir dans HailandX</a>
      </div>
      {open && <WithdrawForm dark max={wallet.balance} onDone={async (m) => { setMsg(m); setOpen(false); await reload(); }} />}
      {msg && <p role="status" className="text-[13px] font-bold text-lime">{msg}</p>}
      <TestBand dark />
    </section>
  );
}
