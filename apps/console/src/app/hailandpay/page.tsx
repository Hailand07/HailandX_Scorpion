'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatSyli, MOVEMENT_LABEL, type WalletMovementKind } from '@hailandx/commerce';
import { TestBand } from '@hailandx/kit';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';

interface Overview {
  in_wallets: number; wallets_users: number; wallets_shops: number; held: number; topups: number; credits: number; debits: number; withdrawals: number; imbalanced: number;
  recent: { id: number; kind: WalletMovementKind; amount: number; created_at: string; counterparty_label: string | null; holder: string }[];
}

/**
 * HailandPay (HAILANDX.md §42, maquette v8 D1) : masse de Syli en circulation, sommes bloquées, contrôle d'équilibre
 * (chaque solde = grand livre), derniers mouvements, et crédit / débit par l'équipe (motif obligatoire, inscrit au journal).
 */
export default function HailandPayConsole() {
  const { sb } = useConsole();
  const { busy, msg, run } = useAction();
  const [o, setO] = useState<Overview | null>(null);
  const [target, setTarget] = useState<'compte' | 'boutique'>('compte');
  const [phone, setPhone] = useState('');
  const [shop, setShop] = useState('');
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [amount, setAmount] = useState('');
  const [sign, setSign] = useState<1 | -1>(1);
  const [motif, setMotif] = useState('');
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.rpc('fn_hailandpay_overview');
    if (data) { const d = data as Overview; setO({ ...d, recent: d.recent.map((r) => ({ ...r, amount: Number(r.amount) })) }); }
  }, [sb]);
  useEffect(() => { void load(); sb.from('shops').select('id,name').order('name').limit(2000).then(({ data }) => setShops((data as { id: string; name: string }[]) ?? [])); }, [sb, load]);

  const n = Number(amount.replace(/\D/g, '')) || 0;
  const ready = n > 0 && motif.trim().length >= 3 && (target === 'compte' ? phone.trim().length >= 8 : !!shop);
  const who = target === 'compte' ? phone.trim() : shops.find((s) => s.id === shop)?.name ?? '';
  const field = 'h-11 rounded-[14px] border border-line bg-card px-3.5 text-[14px] font-semibold outline-none focus:border-blue';
  const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <PageHead title="HailandPay" sub="Syli · argent de test" />
      <TestBand />
      <section aria-label="Masse de Syli" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile label="Dans les portefeuilles" value={o ? formatSyli(o.in_wallets) : '…'} sub={o ? `${o.wallets_users} comptes · ${o.wallets_shops} boutiques` : ''} />
        <Tile label="Bloqués (commandes en cours)" value={o ? formatSyli(o.held) : '…'} sub="Payés, pas encore remis" />
        <Tile label="Recharges de test" value={o ? formatSyli(o.topups) : '…'} sub={o ? `Équipe : + ${formatSyli(o.credits, false)} / − ${formatSyli(o.debits, false)}` : ''} />
        <Tile label="Retraits simulés" value={o ? formatSyli(o.withdrawals) : '…'} sub={o ? (o.imbalanced === 0 ? 'Équilibre : chaque solde = grand livre ✓' : `⚠️ ${o.imbalanced} portefeuille(s) déséquilibré(s)`) : ''} warn={!!o && o.imbalanced > 0} />
      </section>
      <Flash msg={msg} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="Créditer ou débiter">
          <div className="flex flex-col gap-3 border-t border-[#f0ede6] px-[18px] py-4">
            <div role="radiogroup" aria-label="Opération" className="flex gap-2">
              {([[1, 'Créditer'], [-1, 'Débiter']] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={sign === v} onClick={() => setSign(v)} className={`${btn.small} ${sign === v ? 'border-ink bg-ink text-white' : ''}`}>{l}</button>)}
              <span className="mx-1 w-px bg-line" />
              {(['compte', 'boutique'] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={target === v} onClick={() => setTarget(v)} className={`${btn.small} ${target === v ? 'border-ink bg-ink text-white' : ''}`}>{v === 'compte' ? 'Un compte' : 'Une boutique'}</button>)}
            </div>
            {target === 'compte'
              ? <label className="flex flex-col gap-1 text-[12.5px] font-extrabold text-muted">Numéro du compte<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="6XX XX XX XX" className={field} /></label>
              : <label className="flex flex-col gap-1 text-[12.5px] font-extrabold text-muted">Boutique<select value={shop} onChange={(e) => setShop(e.target.value)} className={field}><option value="">Choisir…</option>{shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
            <label className="flex flex-col gap-1 text-[12.5px] font-extrabold text-muted">Montant (Syli)<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="1 000 000" className={field} /></label>
            <label className="flex flex-col gap-1 text-[12.5px] font-extrabold text-muted">Motif (inscrit au journal)<input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} placeholder="Essai livreur, correction d’un envoi…" className={field} /></label>
            {confirm ? (
              <span className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => run(sb.rpc('fn_wallet_admin_adjust', { p_amount: sign * n, p_motif: motif.trim(), ...(target === 'compte' ? { p_phone: phone.trim() } : { p_shop: shop }) }),
                  `${sign > 0 ? 'Crédit' : 'Débit'} de ${formatSyli(n)} enregistré pour ${who}.`, async () => { setConfirm(false); setAmount(''); setMotif(''); await load(); })} className={btn.dark}>Confirmer : {sign > 0 ? '+' : '−'} {formatSyli(n)} · {who}</button>
                <button type="button" onClick={() => setConfirm(false)} className={btn.line}>Annuler</button>
              </span>
            ) : <button type="button" disabled={!ready} onClick={() => setConfirm(true)} className={`${btn.dark} self-start`}>{sign > 0 ? 'Créditer' : 'Débiter'}</button>}
          </div>
        </Panel>
        <Panel title="Derniers mouvements" className="overflow-hidden" right={<button type="button" onClick={() => void load()} className={btn.small}>Actualiser</button>}>
          {o?.recent.length === 0 && <p className="border-t border-[#f0ede6] px-[18px] py-4 text-[14px] font-semibold text-muted">Aucun mouvement.</p>}
          <ul>
            {o?.recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-t border-[#f0ede6] px-[18px] py-2.5">
                <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[13.5px] font-extrabold">{MOVEMENT_LABEL[r.kind] ?? r.kind} · {r.holder}</span><span className="truncate text-[12px] font-semibold text-muted">{when(r.created_at)}{r.counterparty_label ? ` · ${r.counterparty_label}` : ''}</span></span>
                <span className={`shrink-0 whitespace-nowrap font-display text-[14px] font-semibold ${r.amount > 0 ? 'text-[#0f7a5c]' : ''}`}>{r.amount > 0 ? '+ ' : '− '}{formatSyli(Math.abs(r.amount))}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function Tile({ label, value, sub, warn = false }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-line-soft bg-card px-[18px] py-4">
      <span className="text-[12.5px] font-bold text-muted">{label}</span>
      <span className="font-display text-[20px] font-semibold lg:text-[22px]">{value}</span>
      {sub && <span className={`text-[12px] font-bold ${warn ? 'text-[#a3321f]' : 'text-muted'}`}>{sub}</span>}
    </div>
  );
}
