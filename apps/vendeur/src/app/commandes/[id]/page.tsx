'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { CANCEL_REASONS, formatGnf, type ParcelStatus, sellerNet } from '@hailandx/commerce';
import { BackHeader, browserClient, DisputeThread, errText, Icon, mediaUrl, Notice, ProofPhoto, Screen } from '@hailandx/kit';
import { SellerGate } from '@/components/SellerGate';
import { orderCode, payLabel, statusPill } from '@/lib/orders';
import { Chargement } from '@hailandx/ui';

interface Detail {
  id: string; status: ParcelStatus; created_at: string; subtotal_gnf: number; discount_gnf: number; promo_code: string | null; delivery_fee_gnf: number; commission_bps: number;
  payment_method: string; payment_status: string; source: string | null; cancel_reason: string | null; cancelled_by: string | null;
  client: { label: string; quartier: string | null; level: number | null; orders_here: number };
  items: { name: string; variant: string | null; qty: number; price_gnf: number; photo: string | null }[];
  events: { kind: string; at: string }[];
}

/** Étapes affichées au vendeur, dans l'ordre ; chacune est cochée quand l'événement correspondant existe. */
const STEPS: [string, string][] = [['cree', 'Commandée'], ['prepare', 'Colis prêt — QR affiché'], ['accepte', 'Livreur Hailand en route vers vous'], ['retire', 'Retiré par le livreur'], ['remis', 'Remis au client contre son code']];
const time = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const SOURCE: Record<string, string> = { application: 'HailandX', tiktok: 'TikTok', whatsapp: 'WhatsApp', facebook: 'Facebook', autre: 'un lien partagé' };

/** Fiche d'une commande (maquette v6 A3) : articles, argent, client sans données personnelles, suivi, actions. */
export default function SellerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SellerGate title="Commande">{() => <Order id={id} />}</SellerGate>;
}

function Order({ id }: { id: string }) {
  const sb = browserClient();
  const [d, setD] = useState<Detail | null | undefined>(undefined);
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sb) return;
    const r = await sb.rpc('fn_seller_parcel', { p_parcel: id });
    setD(r.error ? null : (r.data as Detail));
  }, [sb, id]);
  useEffect(() => { void load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  async function showQr() {
    const r = await sb!.rpc('fn_parcel_qr', { p_parcel: id });
    if (r.error || typeof r.data !== 'string') return setMsg({ tone: 'err', text: 'Le QR n’est pas disponible.' });
    setQr(await QRCode.toDataURL(r.data, { margin: 1, width: 360, errorCorrectionLevel: 'M' }));
  }
  async function ready() {
    setBusy(true); setMsg(null);
    const { error } = await sb!.rpc('fn_parcel_ready', { p_parcel: id });
    setBusy(false);
    if (error) return setMsg({ tone: 'err', text: errText(error) });
    setMsg({ tone: 'ok', text: 'Colis prêt : les livreurs proches sont prévenus. Montrez ce QR au livreur.' });
    await load(); await showQr();
  }

  if (d === undefined) return <Screen><BackHeader href="/commandes" title="Commande" /><Chargement /></Screen>;
  if (d === null) return <Screen><BackHeader href="/commandes" title="Commande" /><p className="text-[14px] font-semibold text-muted">Commande introuvable.</p></Screen>;

  const [pillClass, pillText] = statusPill(d.status, d.created_at);
  const pay = payLabel(d.payment_method, d.payment_status);
  const gross = d.items.reduce((s, i) => s + i.price_gnf * i.qty, 0);
  const { commission, net } = sellerNet(d.subtotal_gnf, d.commission_bps);
  const waitingPay = d.status === 'attente_vendeur' && d.payment_method === 'orange_money' && d.payment_status === 'en_attente';
  const canCancel = ['attente_vendeur', 'prepare', 'mission_proposee', 'accepte'].includes(d.status);
  const readyish = ['prepare', 'mission_proposee', 'accepte'].includes(d.status);
  const done = new Map(d.events.map((e) => [e.kind, e.at]));
  const initials = d.client.label.replace(/^Client\s+/, '').slice(0, 2);
  const bar = d.status === 'attente_vendeur' && !waitingPay ? 'pret' : readyish ? 'qr' : null;

  return (
    <Screen className={bar ? 'pb-[120px]' : ''}>
      <BackHeader href="/commandes" title={`Commande ${orderCode(d.id)}`} right={<span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${pillClass}`}>{pillText}</span>} />
      <Notice msg={msg} />

      {waitingPay && <p className="rounded-2xl bg-amber-soft px-4 py-3 text-[13px] font-bold">Le client paie par Orange Money : attendez que l’argent soit bloqué par Hailand avant de préparer. Vous serez prévenu.</p>}
      {d.status === 'annule' && (
        <p className="rounded-2xl bg-sand px-4 py-3 text-[13px] font-bold">
          Annulée {d.cancelled_by === 'vendeur' ? 'par vous' : d.cancelled_by === 'acheteur' ? 'par le client' : 'par l’équipe Hailand'}{d.cancel_reason ? ` : « ${d.cancel_reason} »` : '.'}
        </p>
      )}
      {qr && (
        <section className="flex flex-col items-center gap-1.5 rounded-[22px] border border-line-soft bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR du colis, à faire scanner par le livreur" className="h-[230px] w-[230px]" />
          <span className="text-[12.5px] font-bold text-muted">À faire scanner par le livreur au retrait</span>
        </section>
      )}

      <section aria-label="Articles" className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-4">
        <h2 className="text-[14px] font-extrabold">Articles</h2>
        {d.items.map((i, k) => (
          <div key={k} className="flex items-center gap-3">
            {i.photo && mediaUrl(i.photo)
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={mediaUrl(i.photo)!} alt="" className="h-14 w-14 shrink-0 rounded-[14px] bg-sand object-cover" />
              : <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-sand text-muted"><Icon name="image" size={20} /></span>}
            <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[14px] font-extrabold">{i.name}</span><span className="text-[12.5px] font-semibold text-muted">{i.variant ? `${i.variant} · ` : ''}×{i.qty}</span></span>
            <span className="shrink-0 text-[14px] font-extrabold">{formatGnf(i.price_gnf * i.qty)}</span>
          </div>
        ))}
        <div className="flex flex-col gap-1 border-t border-[#f0ede6] pt-2.5 text-[13px] font-semibold">
          <span className="flex justify-between"><span>Articles</span><span>{formatGnf(gross)}</span></span>
          {d.discount_gnf > 0 && <span className="flex justify-between text-blue-ink"><span>Code promo {d.promo_code}</span><span>− {formatGnf(d.discount_gnf)}</span></span>}
          <span className="flex justify-between text-muted"><span>Commission Hailand ({(d.commission_bps / 100).toLocaleString('fr-FR')} %)</span><span>− {formatGnf(commission)}</span></span>
          <span className="flex justify-between text-[14px] font-extrabold"><span>Vous recevez</span><span>{formatGnf(net)}</span></span>
          <span className="text-[12px] font-bold text-muted">{pay.text}{d.source && d.source !== 'application' ? ` · venue de ${SOURCE[d.source] ?? d.source}` : ''}</span>
        </div>
      </section>

      <section aria-label="Client" className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
        <h2 className="text-[14px] font-extrabold">Client</h2>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-soft text-[13px] font-extrabold text-blue">{initials}</span>
          <span className="flex flex-col">
            <span className="text-[14.5px] font-extrabold">{d.client.label}</span>
            <span className="text-[12.5px] font-semibold text-muted">{d.client.orders_here > 1 ? `${d.client.orders_here}ᵉ commande chez vous · client fidèle` : 'Première commande chez vous'}</span>
          </span>
        </div>
        <p className="flex items-start gap-2.5 border-t border-[#f0ede6] pt-2.5 text-[13px] font-bold">
          <span className="text-muted"><Icon name="pin" size={18} /></span>
          <span>{d.client.quartier ?? 'Quartier non précisé'} · adresse niveau {d.client.level ?? '?'}{d.client.level === 3 ? ' (certifiée)' : ''} · le livreur Hailand a l’emplacement exact.</span>
        </p>
        <p className="text-[11.5px] font-semibold leading-snug text-muted">Le numéro et l’adresse exacte du client restent protégés : seul le livreur les reçoit pendant la livraison.</p>
      </section>

      <section aria-label="Suivi" className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
        <h2 className="text-[14px] font-extrabold">Suivi</h2>
        <ol className="flex flex-col gap-2.5">
          {STEPS.map(([kind, label]) => {
            const at = done.get(kind);
            return (
              <li key={kind} className={`flex items-center gap-2.5 text-[13px] ${at ? 'font-extrabold' : 'font-semibold text-muted'}`}>
                <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full border-2 ${at ? 'border-ok bg-ok' : 'border-[#c9c4b6] bg-card'}`} />
                <span className="flex-1">{label}</span>{at && <span className="text-[12px] font-bold text-muted">{time(at)}</span>}
              </li>
            );
          })}
          {done.get('annule') && <li className="flex items-center gap-2.5 text-[13px] font-extrabold text-[#a3321f]"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#a3321f]" /><span className="flex-1">Annulée</span><span className="text-[12px] font-bold">{time(done.get('annule')!)}</span></li>}
        </ol>
      </section>

      {d.status === 'litige' && <SellerDispute parcel={d.id} />}
      {(d.status === 'remis' || d.status === 'litige') && <ProofPhoto parcelId={d.id} />}

      <div className="flex flex-col items-center gap-1">
        {(d.status === 'attente_vendeur' || readyish) && <Link href={`/commandes/etiquette?colis=${d.id}`} className="flex h-11 items-center gap-2 text-[13.5px] font-extrabold"><Icon name="print" size={18} />Imprimer l’étiquette du colis</Link>}
        {canCancel && <button type="button" onClick={() => setCancelling(true)} className="h-11 text-[13px] font-extrabold text-[#a3321f]">Annuler la commande</button>}
      </div>

      {bar && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-card px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
          {bar === 'pret'
            ? <button type="button" disabled={busy} onClick={ready} className="h-[54px] w-full rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-50">{busy ? 'Envoi…' : 'Colis prêt — appeler un livreur'}</button>
            : <button type="button" onClick={showQr} className="h-[54px] w-full rounded-2xl bg-lime text-[15px] font-extrabold">{qr ? 'QR affiché ci-dessus' : 'Afficher le QR du colis'}</button>}
        </div>
      )}
      {cancelling && <CancelSheet parcel={d.id} courierFee={d.status === 'accepte' ? d.delivery_fee_gnf : 0} onClose={() => setCancelling(false)} onDone={async (text) => { setCancelling(false); setMsg({ tone: 'ok', text }); setQr(null); await load(); }} />}
    </Screen>
  );
}

/** Annuler : motif obligatoire (le client le lit), choisi dans la liste ou écrit. */
function CancelSheet({ parcel, courierFee, onClose, onDone }: { parcel: string; courierFee: number; onClose: () => void; onDone: (text: string) => void }) {
  const [choice, setChoice] = useState<string>('');
  const [other, setOther] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Remettre les articles en rayon ? Non par défaut quand c'est une rupture (il n'y a plus rien à vendre).
  const [restock, setRestock] = useState(true);
  const reason = choice === 'autre' ? other.trim() : choice;
  const pick = (r: string) => { setChoice(r); setRestock(r !== 'Rupture de stock'); };

  async function confirm() {
    if (reason.length < 3) return setErr('Choisissez ou écrivez le motif : le client le verra.');
    setBusy(true); setErr(null);
    const { error } = await browserClient()!.rpc('fn_parcel_cancel', { p_parcel: parcel, p_reason: reason, p_restock: restock });
    setBusy(false);
    if (error) return setErr(errText(error));
    onDone(`Commande annulée. Le client est prévenu avec votre motif ; s’il avait payé, il est remboursé.${restock ? ' Les articles sont remis en stock.' : ' Le stock n’a pas été modifié.'}`);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Annuler la commande" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div className="flex w-full max-w-md flex-col gap-3 rounded-t-[26px] bg-card px-5 pb-[max(22px,env(safe-area-inset-bottom))] pt-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-display text-[18px] font-semibold">Pourquoi annuler ?</h2><button type="button" onClick={onClose} aria-label="Fermer" className="flex h-10 w-10 items-center justify-center rounded-full bg-bg"><Icon name="close" size={18} /></button></div>
        <p className="text-[12.5px] font-semibold text-muted">Le client reçoit ce motif. Les annulations du vendeur font baisser l’indice de confiance de la boutique.</p>
        <div role="radiogroup" aria-label="Motif" className="flex flex-col gap-1.5">
          {[...CANCEL_REASONS, 'autre'].map((r) => (
            <label key={r} className={`flex min-h-[48px] items-center gap-3 rounded-2xl px-4 text-[14px] font-bold ${choice === r ? 'border-2 border-ink' : 'border border-line'}`}>
              <input type="radio" name="motif" checked={choice === r} onChange={() => pick(r)} />{r === 'autre' ? 'Autre motif' : r}
            </label>
          ))}
          {choice === 'autre' && <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={300} placeholder="Expliquez en quelques mots" aria-label="Autre motif" className="h-12 rounded-2xl border border-line px-4 text-[15px] font-semibold outline-none focus:border-blue" />}
        </div>
        {choice && (
          <label className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl bg-bg px-4 text-[14px] font-bold">
            <span className="flex flex-col"><span>Remettre les articles en stock</span><span className="text-[12px] font-semibold text-muted">{restock ? 'Ils redeviennent disponibles à la vente.' : 'Le stock affiché ne change pas.'}</span></span>
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="h-5 w-5" />
          </label>
        )}
        {courierFee > 0 && <p className="rounded-2xl bg-amber-soft px-4 py-3 text-[12.5px] font-bold text-[#7a5500]">Un livreur est déjà en route vers vous : son déplacement (la moitié des frais de livraison, environ {formatGnf(Math.round(courierFee / 2))}) sera repris sur le solde de la boutique.</p>}
        {err && <p role="alert" className="text-[13px] font-bold text-[#a3321f]">{err}</p>}
        <button type="button" disabled={busy} onClick={confirm} className="h-[52px] rounded-2xl bg-[#a3321f] text-[15px] font-extrabold text-white disabled:opacity-50">{busy ? 'Annulation…' : 'Annuler la commande'}</button>
      </div>
    </div>
  );
}

/** Litige ouvert par l'acheteur sur ce colis : le vendeur répond dans le fil ; l'équipe tranche. */
function SellerDispute({ parcel }: { parcel: string }) {
  const [d, setD] = useState<{ id: string; status: string } | null>(null);
  useEffect(() => { browserClient()?.from('disputes').select('id,status').eq('parcel_id', parcel).maybeSingle().then(({ data }) => setD((data as { id: string; status: string } | null) ?? null)); }, [parcel]);
  if (!d) return null;
  return (
    <section className="flex flex-col gap-2">
      <p className="rounded-2xl bg-amber-soft px-4 py-3 text-[13px] font-bold">Le client a signalé un problème. Expliquez votre version : l’équipe Hailand tranche.</p>
      <DisputeThread disputeId={d.id} open={d.status === 'ouvert'} mine="vendeur" />
    </section>
  );
}
