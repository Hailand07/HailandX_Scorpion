'use client';
import { readDraft } from '@hailandx/scorpion/brouillon';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Chargement } from '@hailandx/ui';
import { communesTexte, creneauTexte, formatGnf, formatGnPhone, heureTexte, joursTexte, normalizeGnPhone, normalizePromoCode, type DeliveryWindow } from '@hailandx/commerce';
import { aUnNom, browserClient, HAILANDX_URL, Icon, PhoneLoginInline, useSession } from '@hailandx/kit';
import { cartSubtotal, clearCart, useCart } from '@/lib/cart';
import { OrderSteps } from '@/components/OrderSteps';
import { AdresseClient } from '@/components/AdresseClient';
import { LienAdresse } from '@/components/LienAdresse';
import { addrDetails, addrName, addrPlace, myAddresses, type Addr } from '@/lib/addresses';
import { currentSource } from '@/lib/source';
import { explainOrderError } from '@/lib/orderError';

type Decl = Addr;
const input = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-medium outline-none focus:border-blue';

/**
 * Commande : adresse (niveau 1 au minimum), téléphone, paiement. Le serveur recalcule prix, stock et frais.
 * Sans adresse (ou « + Nouvelle adresse ») : le parcours d'adresse s'ouvre ICI, recopié de NavigationX (§49 étape 3).
 * `?adresse=<id>` (retour d'un ancien lien NavigationX) reste accepté.
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
  // Numéro du compte proposé par défaut ; le client peut en donner un autre pour cette commande (§58).
  const [editPhone, setEditPhone] = useState(false);
  const showPhoneInput = editPhone || !session?.user.phone;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /** Parcours d'adresse ouvert, toujours sur place : le domicile, ou une adresse temporaire (client hors de chez lui, §53). */
  // Parcours interrompu (appareil photo, rechargement) : on le rouvre tel quel (§55).
  const [adding, setAdding] = useState<null | 'domicile' | 'ici'>(null);
  useEffect(() => { const d = readDraft('client'); if (d) setAdding(d.extra?.temporary ? 'ici' : 'domicile'); }, []);
  /** Choix « où livrer ? » déplié (adresse supplémentaire quand le compte en a déjà). */
  const [choosing, setChoosing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<string | null>(null);
  const [pay, setPay] = useState<'livraison' | 'orange_money'>('livraison');
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
  // Créneau et zone de la Flotte (§64) : jour promis, heures, communes servies. Sans réponse (base pas encore à jour), rien ne change.
  const [win, setWin] = useState<DeliveryWindow | null>(null);
  useEffect(() => {
    if (!sb) return;
    let live = true;
    sb.rpc('fn_delivery_window', decl ? { p_declaration: decl } : {}).then(({ data, error }) => { if (live) setWin(error ? null : (data as DeliveryWindow)); });
    return () => { live = false; };
  }, [sb, decl]);
  const horsZone = !!decl && win?.zone_ok === false;

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
      const list: Decl[] = await myAddresses(sb, uid);
      const lv: Record<string, number> = {};
      await Promise.all(list.map(async (d) => { const r = await sb.rpc('fn_declaration_level', { p_declaration: d.id }); lv[d.id] = typeof r.data === 'number' ? r.data : d.detected_level; }));
      const ok = list.filter((d) => (lv[d.id] ?? 0) >= 1);
      const want = added ?? recue;
      // Adresses reçues par un lien de localisation : on affiche le nom donné au lien (« Chez Maman »).
      const rq = await sb.from('address_requests').select('declaration_id,label').not('declaration_id', 'is', null);
      setNames(Object.fromEntries(((rq.data as { declaration_id: string; label: string }[] | null) ?? []).map((x) => [x.declaration_id, `Chez ${x.label}`])));
      setDecls(ok); setLevels(lv); setDecl((want && ok.some((d) => d.id === want) ? want : ok[0]?.id) ?? ''); setReady(true);
    })();
  }, [sb, session, recue, added]);

  async function place(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = normalizeGnPhone(phone);
    if (!n) return setError('Entrez un numéro guinéen valide pour que le livreur puisse vous joindre.');
    if (!decl) return setError('Choisissez une adresse de livraison.');
    setBusy(true);
    const items = lines.map((l) => ({ offer_id: l.offerId, variant_id: l.variantId, qty: l.qty }));
    const code = promoCheck && promoCheck.discount > 0 ? promoCheck.code : null;
    const { data, error: err } = await sb!.rpc('fn_place_order', { p_items: items, p_declaration: decl, p_phone: n, p_payment: pay, p_source: currentSource(), ...(code ? { p_promo: code } : {}) });
    if (err) { setBusy(false); return setError(explainOrderError(err.message.replace(/^.*?:\s*/, ''), lines).slice(0, 300) || 'La commande n’a pas pu être passée.'); }
    clearCart();
    const orderId = data as string;
    // Paiement en ligne : la page du fournisseur (Chap Chap Pay ou Djomy) s'ouvre tout de suite, sans étape intermédiaire.
    // En cas d'échec, la page de la commande garde le bouton « Payer maintenant » et affiche la raison.
    if (pay === 'orange_money') {
      try {
        const token = (await sb!.auth.getSession()).data.session?.access_token ?? '';
        const r = await fetch('/api/paiement/demarrer', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ order: orderId }) });
        const body = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
        if (body.url) { window.location.assign(body.url); return; }
        router.replace(`/commandes/${orderId}?paiement=erreur&raison=${encodeURIComponent((body.error ?? 'Le paiement n’a pas pu démarrer.').slice(0, 200))}`);
      } catch {
        router.replace(`/commandes/${orderId}?paiement=erreur&raison=${encodeURIComponent('Connexion interrompue : touchez « Payer maintenant ».')}`);
      }
      return;
    }
    setBusy(false);
    router.replace(`/commandes/${orderId}`);
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
  // Pendant l'envoi, le panier est déjà vidé : on garde l'écran « Ouverture du paiement… » jusqu'à la redirection.
  if (busy && lines.length === 0) return <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-6">{Head}<Chargement enLigne texte="Ouverture du paiement sécurisé…" /></main>;
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

  if (linking) return <LienAdresse onDone={(id) => { setLinking(false); setChoosing(false); setReady(false); setAdded(id); }} onClose={() => setLinking(false)} />;
  if (adding) return <AdresseClient cta="Revenir à ma commande" temporary={adding === 'ici'} onDone={(id) => { setAdding(null); setChoosing(false); setReady(false); setAdded(id); }} onClose={() => setAdding(null)} />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-10 pt-6">
      {Head}
      <form onSubmit={place} className="flex flex-col gap-4">
        <section className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[13px] font-extrabold text-muted">Livraison à</h2>
          {/* Une carte par bâtiment enregistré (§58) : le quartier et la commune, le code Hailand, puis le nom donné et les précisions. */}
          {!ready ? <Chargement enLigne texte="Chargement de vos adresses" /> : decls.length > 0 && (
            <div role="radiogroup" aria-label="Adresse de livraison" className="flex flex-col gap-2">
              {decls.map((d) => {
                const on = d.id === decl;
                const place = addrPlace(d);
                const more = [addrName(d, names[d.id]), addrDetails(d)].filter(Boolean).join(' · ');
                return (
                  <button key={d.id} type="button" role="radio" aria-checked={on} onClick={() => setDecl(d.id)}
                    className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 text-left ${on ? 'border-2 border-ink bg-bg' : 'border border-line'}`}>
                    <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-blue' : 'border-line'}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-blue" />}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-extrabold">{place || 'Quartier en cours d’identification'}</span>
                      {d.hailand_code && <span className="font-display text-[13px] font-semibold tracking-[0.04em] text-blue-ink">{d.hailand_code}</span>}
                      {more && <span className="truncate text-[12.5px] font-semibold text-muted">{more}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {ready && (decls.length === 0 || choosing) && <ChezVous first={!decls.some((d) => !d.temporary_until)} onHome={() => setAdding('domicile')} onHere={() => setAdding('ici')} onLink={() => setLinking(true)} />}
          {ready && decls.length > 0 && !choosing && <button type="button" onClick={() => setChoosing(true)} className="self-start text-[13px] font-bold text-blue-ink">+ Livrer à une autre adresse</button>}
          {win && decl && <Creneau win={win} />}
          {/* Le numéro où le livreur de la Flotte joindra le client : celui du compte par défaut, modifiable pour cette commande (§58). */}
          <div className="mt-1 flex items-center gap-3 border-t border-line-soft pt-3">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></svg></span>
            {showPhoneInput ? (
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[12px] font-semibold text-muted">Numéro où le livreur vous appelle</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus={editPhone} inputMode="tel" autoComplete="tel" placeholder="+224 6.. .. .. .." className={input} />
              </label>
            ) : (
              <>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[12px] font-semibold text-muted">Le livreur vous appelle au</span>
                  <span className="text-[15px] font-extrabold">{phone}</span>
                </span>
                <button type="button" onClick={() => setEditPhone(true)} className="shrink-0 px-1 text-[13px] font-bold text-blue-ink">Modifier</button>
              </>
            )}
          </div>
        </section>
        <section className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[13px] font-extrabold text-muted">Paiement</h2>
          <label className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-bold ${pay === 'livraison' ? 'border-2 border-ink' : 'border border-line'}`}><input type="radio" name="pay" checked={pay === 'livraison'} onChange={() => setPay('livraison')} /> Espèces à la livraison</label>
          <label className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-bold ${omAvailable.ok ? (pay === 'orange_money' ? 'border-2 border-ink' : 'border border-line') : 'border border-line text-muted'}`}>
            <input type="radio" name="pay" disabled={!omAvailable.ok} checked={pay === 'orange_money'} onChange={() => setPay('orange_money')} /> <span className="flex flex-col">Mobile Money ou carte<span className="text-[11.5px] font-semibold text-muted">Orange Money, MTN MoMo, PayCard, Visa…</span></span>
            <span className="ml-auto shrink-0 whitespace-nowrap text-[11.5px]">{omAvailable.ok ? (omAvailable.trial ? 'essai équipe' : 'argent bloqué jusqu’à la remise') : 'bientôt'}</span>
          </label>
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
        <Button type="submit" disabled={busy || !decl || horsZone}>{busy ? (pay === 'orange_money' ? 'Ouverture du paiement…' : 'Envoi…') : pay === 'orange_money' ? `Payer ${formatGnf(toPay)}` : 'Passer la commande'}</Button>
      </form>
    </main>
  );
}

export default function CheckoutPage() { return <Suspense><Checkout /></Suspense>; }

/**
 * Quand le colis arrive (§64) : « Livraison aujourd’hui entre 14 h et 18 h », avec l'heure limite pour le jour même ;
 * ou, si l'adresse choisie est hors des communes servies, la raison et les communes où Hailand livre déjà.
 */
function Creneau({ win }: { win: DeliveryWindow }) {
  if (win.zone_ok === false) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl bg-[#fde8e4] px-3.5 py-3 text-[#8a2a1c]">
        <Icon name="pin" size={18} stroke={2.2} />
        <span className="flex flex-col gap-0.5 text-[13px] font-semibold leading-snug">
          <span className="text-[14px] font-extrabold">Pas encore de livraison {win.commune ? `à ${win.commune}` : 'à cette adresse'}</span>
          Pour l’instant, Hailand livre à {communesTexte(win.communes)}. Choisissez une adresse dans cette zone, ou revenez bientôt : la zone s’agrandit.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-ok-soft px-3.5 py-3">
      <span aria-hidden="true" className="mt-0.5 text-ok"><Icon name="clock" size={18} stroke={2.2} /></span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] font-extrabold">Livraison {creneauTexte(win.jour, win.debut, win.fin)}</span>
        <span className="text-[12px] font-semibold leading-snug text-muted">Livraisons {joursTexte(win.jours)}, de {heureTexte(win.debut)} à {heureTexte(win.fin)}. Commandez avant {heureTexte(win.limite)} pour être livré le jour même.</span>
      </span>
    </div>
  );
}

/**
 * « Êtes-vous chez vous ? » (§53). Une seule question, et l'adresse se repère TOUJOURS sur place (GPS, vue satellite) :
 *  - oui → c'est le domicile, enregistré une fois pour toutes ;
 *  - non → « Me livrer ici » : même repérage, là où il est (séjour, travail, de passage), mais l'adresse est TEMPORAIRE
 *    (30 jours) et ne devient jamais son domicile. S'il préfère être livré chez lui, il envoie le lien à quelqu'un qui y est,
 *    ou garde son panier et termine une fois rentré.
 */
function ChezVous({ first, onHome, onHere, onLink }: { first: boolean; onHome: () => void; onHere: () => void; onLink: () => void }) {
  const [away, setAway] = useState(false);
  const [later, setLater] = useState(false);
  const reminder = `Rappel HailandX : terminer ma commande une fois chez moi. ${typeof window !== 'undefined' ? window.location.origin : HAILANDX_URL}/panier`;
  const big = 'flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold';
  if (away) {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="text-[16px] font-extrabold">Où voulez-vous être livré ?</p>
        <button type="button" onClick={onHere} className={`${big} bg-blue text-white`}><Icon name="pin" size={18} />Ici, là où je suis</button>
        <p className="-mt-1 text-[12px] font-semibold leading-snug text-muted">Le bâtiment où vous êtes se repère comme un domicile, mais l’adresse reste temporaire : elle ne remplace pas votre domicile.</p>
        {later ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-sand p-3.5">
            <p className="text-[13px] font-semibold leading-snug text-muted">Votre panier est gardé sur ce téléphone. Une fois chez vous, rouvrez le lien du produit : votre domicile s’enregistre en une minute.</p>
            <a href={`https://wa.me/?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center rounded-xl bg-ok text-[13px] font-extrabold text-white">M’envoyer un rappel sur WhatsApp</a>
            <button type="button" onClick={onLink} className="h-10 text-[13px] font-bold text-blue-ink">Quelqu’un est chez moi : je lui envoie le lien</button>
          </div>
        ) : <button type="button" onClick={() => setLater(true)} className={`${big} border border-line bg-card`}>Chez moi</button>}
        <button type="button" onClick={() => { setAway(false); setLater(false); }} className="h-10 text-[13px] font-bold text-muted">Retour</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-[16px] font-extrabold">{first ? 'Êtes-vous chez vous en ce moment ?' : 'Êtes-vous chez vous, dans un domicile pas encore enregistré ?'}</p>
        <p className="text-[13px] font-semibold leading-snug text-muted">L’adresse se repère sur place, en une minute : le livreur trouve ainsi la bonne porte du premier coup.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onHome} className={`${big} bg-blue text-white`}><Icon name="pin" size={18} />Oui</button>
        <button type="button" onClick={() => setAway(true)} className={`${big} border border-line bg-card`}>Non</button>
      </div>
      <button type="button" onClick={onLink} className="self-start text-[13px] font-bold text-blue-ink">Le colis est pour quelqu’un d’autre ? Envoyez-lui le lien</button>
    </div>
  );
}
