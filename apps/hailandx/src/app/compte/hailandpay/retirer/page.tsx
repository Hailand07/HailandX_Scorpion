'use client';
import { useState } from 'react';
import { formatSyli } from '@hailandx/commerce';
import { BackHeader, Screen, TestBand, useWallet, WithdrawForm } from '@hailandx/kit';
import { Chargement } from '@hailandx/ui';

/** Retrait simulé : on teste le parcours ; aucun argent réel n'est versé. */
export default function WithdrawPage() {
  const { wallet, reload } = useWallet();
  const [msg, setMsg] = useState<string | null>(null);
  if (!wallet) return <Screen><BackHeader href="/compte/hailandpay" title="Retirer (simulé)" /><Chargement /></Screen>;
  return (
    <Screen className="gap-4">
      <BackHeader href="/compte/hailandpay" title="Retirer (simulé)" />
      <TestBand />
      <p className="text-[13.5px] font-bold">Disponible : {formatSyli(wallet.balance)}</p>
      <WithdrawForm max={wallet.balance} onDone={async (m) => { setMsg(m); await reload(); }} />
      {msg && <p role="status" className="rounded-2xl bg-ok-soft px-4 py-3 text-[13.5px] font-bold text-ok">{msg}</p>}
    </Screen>
  );
}
