'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatSyli, SYLI_TOPUP_STEPS, topupRemaining } from '@hailandx/commerce';
import { BackHeader, browserClient, Screen, TestBand, useWallet } from '@hailandx/kit';
import { Chargement } from '@hailandx/ui';

/** Recharge de test (maquette v8 A2) : libre jusqu'au plafond cumulé (50 000 000 Syli par compte). */
export default function TopupPage() {
  const router = useRouter();
  const { wallet } = useWallet();
  const [amount, setAmount] = useState<number>(SYLI_TOPUP_STEPS[1]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!wallet) return <Screen><BackHeader href="/compte/hailandpay" title="Recharger (test)" /><Chargement /></Screen>;
  const left = topupRemaining(wallet.topped_up, wallet.topup_cap);
  const pct = Math.min(100, Math.round((wallet.topped_up / wallet.topup_cap) * 100));
  const chosen = Math.min(amount, left);
  async function go() {
    setErr(null); setBusy(true);
    const { error } = await browserClient()!.rpc('fn_wallet_topup', { p_amount: chosen });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?:\s*/, ''));
    router.replace('/compte/hailandpay');
  }
  return (
    <Screen className="gap-4">
      <BackHeader href="/compte/hailandpay" title="Recharger (test)" />
      <TestBand />
      <section className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-4">
        <span className="text-[13px] font-extrabold text-muted">Montant à ajouter</span>
        <span className="font-display text-[32px] font-semibold">{formatSyli(chosen, false)} <span className="text-[15px] text-muted">Syli</span></span>
        <div role="radiogroup" aria-label="Montant" className="grid grid-cols-2 gap-2">
          {SYLI_TOPUP_STEPS.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={amount === v} disabled={v > left} onClick={() => setAmount(v)} className={`h-[52px] rounded-2xl text-[15px] font-extrabold disabled:opacity-35 ${amount === v ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{formatSyli(v, false)}</button>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2 rounded-[18px] border border-line-soft bg-card p-3.5">
        <span className="flex justify-between text-[13.5px] font-bold"><span className="text-muted">Déjà rechargé</span><span>{formatSyli(wallet.topped_up, false)} / {formatSyli(wallet.topup_cap, false)}</span></span>
        <span className="h-2 overflow-hidden rounded bg-[#efece4]"><span className="block h-full bg-lime" style={{ width: `${pct}%` }} /></span>
        <span className="text-[12px] font-bold text-muted">{left > 0 ? `Vous pouvez encore ajouter ${formatSyli(left)}.` : 'Plafond atteint.'} Au-delà, l’équipe Hailand peut créditer votre compte.</span>
      </section>
      {err && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13.5px] font-bold text-[#8a2a1c]">{err}</p>}
      <button type="button" disabled={busy || chosen <= 0} onClick={go} className="mt-auto h-14 rounded-[18px] bg-ink text-[16px] font-extrabold text-white disabled:opacity-40">{busy ? 'Recharge…' : chosen > 0 ? `Ajouter ${formatSyli(chosen)}` : 'Plafond atteint'}</button>
    </Screen>
  );
}
