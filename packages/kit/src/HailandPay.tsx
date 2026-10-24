'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatSyli, MOVEMENT_LABEL, type WalletMovementKind } from '@hailandx/commerce';
import { browserClient } from './supabase';
import { useSession } from './useSession';
import { Icon, type ICONS } from './Screen';

/**
 * HailandPay et le Syli, argent de test (HAILANDX.md §42) : briques communes à HailandX, HailandX Vendeur et Hailand Flotte.
 * Toute écriture passe par les fonctions de la base (fn_wallet_*) ; ici on lit et on affiche.
 */
export interface ShopWallet { shop_id: string; name: string; wallet_id: string; balance: number; pending: number }
export interface WalletInfo { wallet_id: string; balance: number; topped_up: number; topup_cap: number; held: number; shops: ShopWallet[] }
export interface WalletMovement { id: number; kind: WalletMovementKind; amount: number; balance_after: number; counterparty_label: string | null; note: string | null; order_id: string | null; created_at: string }

/** Mon portefeuille (créé à la première visite) et ceux de mes boutiques ; `reload` après une opération. */
export function useWallet(): { wallet: WalletInfo | null | undefined; reload: () => Promise<void> } {
  const session = useSession();
  const [wallet, setWallet] = useState<WalletInfo | null | undefined>(undefined);
  const reload = useCallback(async () => {
    const sb = browserClient();
    if (!sb || !session) { setWallet(session === null ? null : undefined); return; }
    const { data, error } = await sb.rpc('fn_wallet_me');
    if (error || !data) { setWallet(null); return; }
    const w = data as WalletInfo;
    setWallet({ ...w, balance: Number(w.balance), topped_up: Number(w.topped_up), topup_cap: Number(w.topup_cap), held: Number(w.held), shops: (w.shops ?? []).map((s) => ({ ...s, balance: Number(s.balance ?? 0), pending: Number(s.pending ?? 0) })) });
  }, [session]);
  useEffect(() => { void reload(); }, [reload]);
  return { wallet, reload };
}

/** Mention obligatoire partout où des Syli s'affichent. */
export function TestBand({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  return (
    <p role="note" className={`rounded-[14px] px-3 py-2.5 text-[12px] font-extrabold leading-snug ${dark ? 'bg-lime/15 text-lime' : 'bg-[#fff2d6] text-[#8a5a00]'} ${className}`}>
      Syli : argent de test de Hailand, sans valeur réelle. 1 Syli = 1 GNF, pour que tous les prix restent identiques.
    </p>
  );
}

/** Logo texte « HailandPay ». */
export function HailandPayMark({ className = '', dark = true }: { className?: string; dark?: boolean }) {
  return <span className={`font-display font-semibold tracking-tight ${dark ? 'text-white' : 'text-ink'} ${className}`}>Hailand<span className={dark ? 'text-lime' : 'text-blue'}>Pay</span></span>;
}

/** Carte du solde (fond noir, « TEST »). */
export function WalletCard({ label, balance, sub, owner }: { label: string; balance: number; sub?: string | null; owner?: string }) {
  return (
    <section aria-label="Solde HailandPay" className="relative flex flex-col gap-3 overflow-hidden rounded-[26px] bg-ink p-[18px] text-white">
      <span aria-hidden="true" className="absolute -right-10 -top-10 h-[170px] w-[170px] rounded-full bg-[radial-gradient(circle,rgba(200,242,90,.22),rgba(200,242,90,0)_70%)]" />
      <span className="flex items-center justify-between"><HailandPayMark className="text-[17px]" /><span className="flex items-center gap-2">{owner && <span className="text-[12px] font-bold text-white/60">{owner}</span>}<span className="rounded-full bg-lime/15 px-2.5 py-1 text-[11px] font-extrabold text-lime">TEST</span></span></span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[12.5px] font-bold text-white/65">{label}</span>
        <span className="font-display text-[32px] font-semibold leading-tight tracking-tight">{formatSyli(balance, false)} <span className="text-[16px] text-lime">Syli</span></span>
        {sub && <span className="text-[12px] font-bold text-white/60">{sub}</span>}
      </span>
    </section>
  );
}

const TONE: Partial<Record<WalletMovementKind, { icon: keyof typeof ICONS; cls: string }>> = {
  recharge_test: { icon: 'plus', cls: 'bg-lime/40 text-ink' }, credit_equipe: { icon: 'plus', cls: 'bg-lime/40 text-ink' },
  paiement: { icon: 'box', cls: 'bg-blue-soft text-blue' }, remboursement: { icon: 'refresh', cls: 'bg-ok-soft text-ok' },
  reglement_vente: { icon: 'box', cls: 'bg-ok-soft text-ok' }, gain_livraison: { icon: 'truck', cls: 'bg-ok-soft text-ok' },
  reprise_vente: { icon: 'refresh', cls: 'bg-[#fde8e4] text-[#a3321f]' }, reception: { icon: 'arrowDown', cls: 'bg-ok-soft text-ok' },
  envoi: { icon: 'arrowUp', cls: 'bg-[#f2f0ea] text-ink' }, retrait: { icon: 'bank', cls: 'bg-[#f2f0ea] text-ink' },
  vers_proprietaire: { icon: 'arrowUp', cls: 'bg-[#f2f0ea] text-ink' }, depuis_boutique: { icon: 'arrowDown', cls: 'bg-ok-soft text-ok' },
  debit_equipe: { icon: 'alert', cls: 'bg-[#fde8e4] text-[#a3321f]' },
};

/** Historique d'un portefeuille (le mien ou celui d'une de mes boutiques ; la base ne montre que ce qui m'appartient). */
export function MovementList({ walletId, limit = 30, refreshKey = 0, empty = 'Aucun mouvement pour l’instant.' }: { walletId: string; limit?: number; refreshKey?: number; empty?: string }) {
  const [rows, setRows] = useState<WalletMovement[] | null>(null);
  useEffect(() => {
    browserClient()?.from('wallet_movements').select('id,kind,amount,balance_after,counterparty_label,note,order_id,created_at').eq('wallet_id', walletId).order('id', { ascending: false }).limit(limit)
      .then(({ data }) => setRows(((data as WalletMovement[]) ?? []).map((r) => ({ ...r, amount: Number(r.amount), balance_after: Number(r.balance_after) }))));
  }, [walletId, limit, refreshKey]);
  if (rows === null) return <p className="text-[13px] font-semibold text-muted">Chargement de l’historique…</p>;
  if (rows.length === 0) return <p className="rounded-[20px] border border-dashed border-line px-4 py-5 text-center text-[13px] font-semibold text-muted">{empty}</p>;
  return (
    <ul className="overflow-hidden rounded-[20px] border border-line-soft bg-card">
      {rows.map((m, i) => {
        const t = TONE[m.kind] ?? { icon: 'wallet' as const, cls: 'bg-[#f2f0ea] text-ink' };
        const sub = [m.counterparty_label, m.note, new Date(m.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ');
        return (
          <li key={m.id} className={`flex items-center gap-3 px-3.5 py-3 ${i < rows.length - 1 ? 'border-b border-[#f0ede6]' : ''}`}>
            <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl ${t.cls}`}><Icon name={t.icon} size={18} stroke={2} /></span>
            <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[14px] font-extrabold">{MOVEMENT_LABEL[m.kind] ?? m.kind}</span><span className="truncate text-[12px] font-semibold text-muted">{sub}</span></span>
            <span className={`shrink-0 whitespace-nowrap font-display text-[14.5px] font-semibold ${m.amount > 0 ? 'text-ok' : ''}`}>{m.amount > 0 ? '+' : '−'} {formatSyli(Math.abs(m.amount), false)}</span>
          </li>
        );
      })}
    </ul>
  );
}

const METHODS = [['orange_money', 'Orange Money'], ['soutra_money', 'Soutra Money'], ['paycard', 'PayCard'], ['banque', 'Compte bancaire']] as const;

/** Retrait simulé : depuis mon portefeuille, ou celui d'une boutique (`shopId`, propriétaire seulement). Rien n'est réellement versé. */
export function WithdrawForm({ max, shopId, onDone, dark = false }: { max: number; shopId?: string; onDone: (msg: string) => void; dark?: boolean }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number][0]>('orange_money');
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const n = Number(amount.replace(/\D/g, '')) || 0;
  const field = `h-12 rounded-2xl px-4 text-[16px] font-semibold outline-none ${dark ? 'border border-night-line bg-night-card text-night-text' : 'border border-line bg-card focus:border-blue'}`;
  async function go() {
    setErr(null);
    if (n <= 0) return setErr('Indiquez un montant.');
    if (n > max) return setErr(`Solde insuffisant : ${formatSyli(max)} disponibles.`);
    setBusy(true);
    const { error } = await browserClient()!.rpc('fn_wallet_withdraw', { p_amount: n, p_method: method, p_number: number || null, ...(shopId ? { p_shop: shopId } : {}) });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?:\s*/, ''));
    setAmount(''); onDone(`Retrait simulé de ${formatSyli(n)} enregistré (rien n’est réellement versé).`);
  }
  return (
    <div className="flex flex-col gap-2.5">
      <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder={`Montant (max ${formatSyli(max, false)})`} aria-label="Montant à retirer" className={field} />
      <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} aria-label="Vers" className={field}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l} (simulé)</option>)}</select>
      <input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="tel" placeholder="Numéro ou compte (facultatif)" aria-label="Numéro de destination" className={field} />
      {err && <p role="alert" className="text-[13px] font-bold text-[#c2410c]">{err}</p>}
      <button type="button" disabled={busy} onClick={go} className={`h-12 rounded-2xl text-[14.5px] font-extrabold disabled:opacity-50 ${dark ? 'bg-lime text-ink' : 'bg-ink text-white'}`}>{busy ? 'Retrait…' : 'Retirer (simulé)'}</button>
    </div>
  );
}
