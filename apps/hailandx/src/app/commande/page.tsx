'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Chargement } from '@hailandx/ui';
import { formatGnf, formatSyli, formatGnPhone, normalizeGnPhone, normalizePromoCode } from '@hailandx/commerce';
import { aUnNom, browserClient, Icon, LienHailand, lienEnregistrement, PhoneLoginInline, useSession, useWallet } from '@hailandx/kit';
import { cartSubtotal, clearCart, useCart } from '@/lib/cart';
import { OrderSteps } from '@/components/OrderSteps';
import { currentSource } from '@/lib/source';
import { explainOrderError } from '@/lib/orderError';

interface Decl { id: string; declared_label: string | null; hailand_code: string | null; detected_level: number }
const input = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-medium outline-none focus:border-blue';

/**
 * Commande : adresse (niveau 1 au minimum), téléphone, paiement à la livraison. Le serveur recalcule prix, stock et frais.
 * Sans adresse : enregistrement dans NavigationX, retour ici avec `?adresse=<id>` (le panier est resté sur l'appareil).
 */
function Checkout() {
  const router = useRouter();
  const recue = useSearchParams().get('adresse');
  const session = useSession();
  const sb = browserClient();
  const lines = useCart();
  const [decls, setDecls] = useState<Decl[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [decl, setDecl] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pay, setPay] = useState<'livraison' | 'orange_money' | 'hailandpay'>('livraison');
  const { wallet } = useWallet();
  const [promo, setPromo] = useState('');
  const [promoCheck, setPromoCheck] = useState<{ code: string; discount: number; lines: { shop_name: string; discount_gnf: number; reason: string | null }[] } | null>(null);
  const [omAvailable, setOmAvailable] = useState<{ ok: boolean; trial: boolean }>({ ok: false, trial: false });
  // Frais de livraison connus AVANT de commander (A9) : un colis par boutique, chacun avec ses frais (comme Jumia ou Amazon).
  const [quote, setQuote] = useState<{ shop_id: string; shop_name: string; distance_km: number; fee_gnf: number }[] | null>(null);
  const offerKey = lines.map((l) => l.offerId).sort().join(',');
  useEffect(() => {
    if (!sb || !decl || !offerKey) { setQuote(null); return; }
    let live = true;
    sb.rpc('fn_delivery_quote', { p_declaration: decl, p_offers: offerKey.split(',') }).then(({ data, error }) => {
      if (live) setQuote(error ? null : ((data as { shop_id: string; shop_name: string; distance_km: number; fee_gnf: number }[]) ?? []));
    });
    return () => { live = false; };
  }, [sb, decl, offerKey]);
  const feeTotal = (quote ?? []).reduce((n, x) => n + x.fee_gnf, 0);

  useEffect(() => {
    if (!sb || !session) return;
    const uid = session.user.id;
    if (session.user.phone) setPhone(formatGnPhone(session.user.phone.startsWith('+') ? session.user.phone : `+${session.user.phone}`));
    (async () => {
      // Paiement en ligne (Chap Chap Pay ou Djomy) : ouvert à tous en mode « chapchappay » ou « djomy » ; en essai (« simulation », « …_test »), réservé à l'équipe.
      const [m, a] = await Promise.all([sb.from('settings').select('value').eq('key', 'payment_mode').maybeSingle(), sb.rpc('is_admin')]);
      const mode = (m.data as { value: string } | null)?.value ?? 'simulation';
      const open = mode === 'chapchappay' || mode === 'djomy';
      setOmAvailable({ ok: open || a.data === true, trial: !open });
      const { data } = await sb.from('declarations').select('id,declared_label,hailand_code,detected_level').eq('user_id', uid).eq('status', 'active').order('created_at', { ascending: false });
      const list = (data as Decl[]) ?? [];
      const lv: Record<string, number> = {};
      await Promise.all(list.map(async (d) => { const r = await sb.rpc('fn_declaration_level', { p_declaration: d.id }); lv[d.id] = typeof r.data === 'number' ? r.data : d.detected_level; }));
      const ok = list.filter((d) => (lv[d.id] ?? 0) >= 1);
      setDecls(ok); setLevels(lv); setDecl((recue && ok.some((d) => d.id === recue) ? recue : ok[0]?.id) ?? ''); setReady(true);
    })();
  }, [sb, session, recue]);

  async function place(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = normalizeGnPhone(phone);
    if (!n) return setError('Entrez un numéro guinéen valide pour que le livreur puisse vous joindre.');
    if (pay === 'hailandpay' && (!wallet || wallet.balance < toPay)) return setError('Solde HailandPay insuffisant : rechargez votre portefeuille (argent de test) ou choisissez un autre moyen.');
    if (!decl) return setError('Choisissez une adresse de livraison.');
    setBusy(true);
    const items = lines.map((l) => ({ offer_id: l.offerId, variant_id: l.variantId, qty: l.qty }));
    const code = promoCheck && promoCheck.discount > 0 ? promoCheck.code : null;
    const { data, error: err } = await sb!.rpc('fn_place_order', { p_items: items, p_declaration: decl, p_phone: n, p_payment: pay, p_source: currentSource(), ...(code ? { p_promo: code } : {}) });
    setBusy(false);
    if (err) return setError(explainOrderError(err.message.replace(/^.*?:\s*/, ''), lines).slice(0, 300) || 'La commande n’a pas pu être passée.');
    clearCart();
    router.replace(`/commandes/${data as string}${pay === 'orange_money' ? '?paiement=payer' : ''}`);
  }

  /** Vérifie le code auprès de la base (réduction par boutique du panier) ; la commande le revérifie. */
  async function checkPromo() {
    const code = normalizePromoCode(promo);
    if (code.length < 3) return setPromoCheck(null);
    const items = lines.map((l) => ({ offer_id: l.offerId, qty: l.qty }));
    const { data } = await sb!.rpc('fn_promo_check', { p_code: code, p_items: items });
    const rows = (data as { shop_name: string; discount_gnf: number; reason: string | null }[]) ?? [];
    setPromoCheck({ code, discount: rows.reduce((a, r) => a + r.discount_gnf, 0), lines: rows });
  }
  const discount = promoCheck?.discount ?? 0;
  const toPay = Math.max(0, cartSubtotal(lines) - discount) + feeTotal;

  const Head = (
    <header className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Link href="/panier" aria-label="Retour au panier" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full"><Icon name="back" size={22} stroke={2.2} /></Link>
        <h1 className="flex-1 font-display text-[19px] font-semibold">Adresse et paiement</h1>
      </div>
      <OrderSteps current={decl ? 3 : 2} />
    </header>
  );

  if (session === undefined) return <main className="mx-auto max-w-md px-5 pt-6">{Head}</main>;
  if (lines.length === 0) {
    return <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-6">{Head}<p className="text-[14px] font-medium text-muted">Votre panier est vide.</p><Link href="/commandes" className="font-bold text-blue-ink">Mes commandes</Link></main>;
  }
  // Un panier = une boutique (§49) : un ancien panier mélangé se corrige d'abord au panier.
  if (new Set(lines.map((l) => l.shopSlug)).size > 1) {
    return <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-6">{Head}<p className="text-[14px] font-medium text-muted">Votre panier contient plusieurs boutiques : une commande = une seule boutique.</p><Link href="/panier" className="font-bold text-blue-ink">Corriger le panier</Link></main>;
  }
  if (!aUnNom(session)) {
    return <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-6">{Head}<PhoneLoginInline /></main>;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-10 pt-6">
      {Head}
      <form onSubmit={place} className="flex flex-col gap-4">
        <section className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[13px] font-extrabold text-muted">Livraison à</h2>
          {!ready ? <Chargement enLigne texte="Chargement de vos adresses" /> : decls.length === 0 ? (
            <div className="flex flex-col gap-2"><p className="text-[13.5px] font-medium leading-relaxed text-muted">Pour être livré jusqu’à votre porte, enregistrez votre adresse une fois dans <b className="font-extrabold text-ink">NavigationX</b>. Elle servira pour toutes vos commandes.</p><LienHailand app="navigationx" href={lienEnregistrement('hailandx', '/commande')} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink text-[14.5px] font-extrabold text-white"><Icon name="pin" size={18} />Enregistrer mon adresse avec NavigationX</LienHailand><p className="text-[12px] font-semibold text-muted">Votre panier vous attend ici : vous revenez à cette étape à la fin.</p></div>
          ) : (
            <select value={decl} onChange={(e) => setDecl(e.target.value)} className={input} aria-label="Adresse de livraison">
              {decls.map((d) => <option key={d.id} value={d.id}>{d.declared_label || d.hailand_code || 'Mon adresse'} — niveau {levels[d.id]}</option>)}
            </select>
          )}
          {ready && decls.length > 0 && <LienHailand app="navigationx" href={lienEnregistrement('hailandx', '/commande')} className="text-[13px] font-bold text-blue-ink">+ Ajouter une autre adresse (NavigationX)</LienHailand>}
        </section>
        <section className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[13px] font-extrabold text-muted">Téléphone du livreur</h2>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" className={input} aria-label="Téléphone" />
        </section>
        <section className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[13px] font-extrabold text-muted">Paiement</h2>
          <label className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-bold ${pay === 'livraison' ? 'border-2 border-ink' : 'border border-line'}`}><input type="radio" name="pay" checked={pay === 'livraison'} onChange={() => setPay('livraison')} /> Espèces à la livraison</label>
          <label className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-bold ${omAvailable.ok ? (pay === 'orange_money' ? 'border-2 border-ink' : 'border border-line') : 'border border-line text-muted'}`}>
            <input type="radio" name="pay" disabled={!omAvailable.ok} checked={pay === 'orange_money'} onChange={() => setPay('orange_money')} /> <span className="flex flex-col">Mobile Money ou carte<span className="text-[11.5px] font-semibold text-muted">Orange Money, MTN MoMo, PayCard, Visa…</span></span>
            <span className="ml-auto text-[11.5px]">{omAvailable.ok ? (omAvailable.trial ? 'essai équipe' : 'argent bloqué jusqu’à la remise') : 'bientôt'}</span>
          </label>
          <label className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-bold ${pay === 'hailandpay' ? 'border-2 border-ink' : 'border border-line'}`}>
            <input type="radio" name="pay" disabled={!wallet} checked={pay === 'hailandpay'} onChange={() => setPay('hailandpay')} /> <span>Hailand<span className="text-blue">Pay</span></span>
            <span className="ml-auto text-[11.5px]">{wallet ? `${formatSyli(wallet.balance)} · TEST` : '…'}</span>
          </label>
          {pay === 'hailandpay' && wallet && (wallet.balance >= toPay
            ? <p className="text-[12.5px] font-medium text-muted">Payé tout de suite en Syli (argent de test, 1 Syli = 1 GNF). L’argent reste bloqué par Hailand jusqu’à la remise du colis, et vous est rendu si la commande est annulée. Solde après paiement : <b className="text-ink">{formatSyli(wallet.balance - toPay)}</b>.</p>
            : <p className="text-[12.5px] font-bold text-[#a3321f]">Solde insuffisant ({formatSyli(wallet.balance)} pour {formatSyli(toPay)}). <Link href="/compte/hailandpay/recharger" className="text-blue-ink underline">Recharger</Link></p>)}
          {pay === 'orange_money' && <p className="text-[12.5px] font-medium text-muted">Vous payez juste après, sur la page sécurisée de Chap Chap Pay. L’argent reste bloqué par Hailand et n’est versé au vendeur qu’une fois le colis remis ; il vous est rendu si la commande est annulée.</p>}
        </section>
        <section className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[13px] font-extrabold text-muted">Code promo</h2>
          <div className="flex gap-2">
            <input value={promo} onChange={(e) => { setPromo(normalizePromoCode(e.target.value)); setPromoCheck(null); }} autoCapitalize="characters" placeholder="Ex. KADI10" aria-label="Code promo" className={`${input} font-display tracking-[0.06em]`} />
            <button type="button" onClick={checkPromo} disabled={promo.length < 3} className="h-12 shrink-0 rounded-2xl border border-line px-4 text-[14px] font-extrabold disabled:opacity-40">Appliquer</button>
          </div>
          {promoCheck && (promoCheck.discount > 0
            ? <p role="status" className="text-[13px] font-bold text-ok">Code {promoCheck.code} : − {formatGnf(promoCheck.discount)} ({promoCheck.lines.filter((r) => r.discount_gnf > 0).map((r) => r.shop_name).join(', ')}).</p>
            : <p role="status" className="text-[13px] font-bold text-[#a3321f]">Code non valable : {promoCheck.lines[0]?.reason ?? 'inconnu'}.</p>)}
        </section>
        <section className="flex flex-col gap-1 text-[13.5px] font-semibold">
          <div className="flex justify-between"><span className="text-muted">Articles</span><span>{formatGnf(cartSubtotal(lines))}</span></div>
          {discount > 0 && <div className="flex justify-between text-ok"><span>Réduction</span><span>− {formatGnf(discount)}</span></div>}
          {quote && quote.length > 0 ? (
            <>
              {quote.map((x) => (
                <div key={x.shop_id} className="flex justify-between gap-3"><span className="min-w-0 truncate text-muted">Livraison depuis {x.shop_name} · {Number(x.distance_km).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km</span><span className="shrink-0">{formatGnf(x.fee_gnf)}</span></div>
              ))}
                            <div className="mt-1 flex justify-between border-t border-line-soft pt-2 text-[15px] font-extrabold"><span>Total à payer</span><span>{formatGnf(toPay)}</span></div>
            </>
          ) : <div className="flex justify-between"><span className="text-muted">Livraison</span><span>{decl ? 'calcul…' : 'choisissez une adresse'}</span></div>}
        </section>
        {error && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13.5px] font-semibold text-[#8a2a1c]">{error}</p>}
        <Button type="submit" disabled={busy || !decl}>{busy ? 'Envoi…' : 'Passer la commande'}</Button>
      </form>
    </main>
  );
}

export default function CheckoutPage() { return <Suspense><Checkout /></Suspense>; }
