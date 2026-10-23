'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DAY_KEYS, DAY_LABELS, type DayKey, hoursSummary, onVacation, type ShopHours } from '@hailandx/commerce';
import { BackHeader, browserClient, errText, HAILANDX_URL, Icon, LienHailand, Notice, Screen, Switch } from '@hailandx/kit';
import { SellerGate, type SellerCtx } from '@/components/SellerGate';

interface Offer { id: string; featured: boolean; catalog_products: { name: string } | null }
const MAX_FEATURED = 6;
const DEFAULT_SLOT: [string, string] = ['08:00', '20:00'];
const field = 'h-11 min-w-0 rounded-xl bg-bg px-3 text-[15px] font-bold outline-none focus:ring-2 focus:ring-blue';
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Boutique en ligne (maquette v6 C2) : horaires, mode vacances (commandes fermées, vitrine visible), politique d'échange et de
 * garantie (affichée sur chaque produit), produits mis en avant (en tête de la vitrine). Logo, bannière et description : Réglages.
 */
export default function OnlineShopPage() {
  return <SellerGate title="Boutique en ligne" ownerOnly>{(ctx) => <OnlineShop {...ctx} />}</SellerGate>;
}

function OnlineShop({ shop, reload }: SellerCtx) {
  const sb = browserClient();
  const [hours, setHours] = useState<ShopHours>(shop.hours ?? {});
  const [vacation, setVacation] = useState(onVacation(shop.vacation_until));
  const [until, setUntil] = useState(shop.vacation_until ?? '');
  const [note, setNote] = useState(shop.vacation_note ?? '');
  const [policy, setPolicy] = useState(shop.policy ?? '');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    sb?.from('offers').select('id,featured,catalog_products(name)').eq('shop_id', shop.id).eq('active', true).order('updated_at', { ascending: false })
      .then(({ data }) => setOffers((data as unknown as Offer[]) ?? []));
  }, [sb, shop.id]);

  const setDay = (k: DayKey, slot: [string, string] | null) => setHours((h) => ({ ...h, [k]: slot }));
  const featured = offers.filter((o) => o.featured).length;

  async function toggleFeatured(o: Offer) {
    if (!o.featured && featured >= MAX_FEATURED) return setMsg({ tone: 'err', text: `${MAX_FEATURED} produits au plus en tête de vitrine.` });
    const { error } = await sb!.from('offers').update({ featured: !o.featured }).eq('id', o.id);
    if (error) return setMsg({ tone: 'err', text: errText(error) });
    setOffers((l) => l.map((x) => (x.id === o.id ? { ...x, featured: !o.featured } : x)));
  }

  async function save() {
    setMsg(null);
    if (vacation && (!until || until < today())) return setMsg({ tone: 'err', text: 'Indiquez le dernier jour de congé (aujourd’hui ou plus tard).' });
    for (const k of DAY_KEYS) { const s = hours[k]; if (s && s[0] >= s[1]) return setMsg({ tone: 'err', text: `${DAY_LABELS[k]} : l’heure de fermeture doit suivre l’ouverture.` }); }
    setBusy(true);
    const { error } = await sb!.from('shops').update({
      hours: Object.keys(hours).length ? hours : null, policy: policy.trim() || null,
      vacation_until: vacation ? until : null, vacation_note: vacation ? note.trim() || null : null,
    }).eq('id', shop.id);
    setBusy(false);
    if (error) return setMsg({ tone: 'err', text: errText(error) });
    setMsg({ tone: 'ok', text: vacation ? `Enregistré. Les commandes sont fermées jusqu’au ${new Date(until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} inclus.` : 'Enregistré : votre vitrine est à jour.' });
    await reload();
  }

  return (
    <Screen className="pb-[110px]">
      <BackHeader href="/plus" title="Boutique en ligne" right={
        <LienHailand app="hailandx" href={`${HAILANDX_URL}/b/${shop.slug}`} target="_blank" className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12.5px] font-extrabold"><Icon name="eye" size={16} />Aperçu</LienHailand>
      } />
      <Notice msg={msg} />

      <section aria-label="Mode vacances" className={`flex flex-col gap-3 rounded-[22px] border p-4 ${vacation ? 'border-[#f3c7a6] bg-[#fff8f2]' : 'border-line-soft bg-card'}`}>
        <div className="flex items-center gap-3">
          <span className="flex flex-1 flex-col"><span className="text-[14.5px] font-extrabold">Mode vacances</span><span className="text-[12px] font-semibold text-muted">{vacation ? 'Votre vitrine reste visible, les commandes sont fermées.' : 'Désactivé : vous vendez normalement.'}</span></span>
          <Switch on={vacation} onChange={(v) => { setVacation(v); if (v && !until) setUntil(today()); }} label="Mode vacances" />
        </div>
        {vacation && (
          <>
            <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Dernier jour de congé<input type="date" min={today()} value={until} onChange={(e) => setUntil(e.target.value)} className={field} /></label>
            <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Message aux clients (facultatif)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Ex. Fermé pour la Tabaski, de retour lundi" className={field} /></label>
          </>
        )}
      </section>

      <section aria-label="Horaires" className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
        <div className="flex items-baseline justify-between gap-2"><h2 className="text-[14.5px] font-extrabold">Horaires</h2><span className="truncate text-[12px] font-bold text-muted">{hoursSummary(hours) ?? 'Non renseignés'}</span></div>
        <p className="-mt-1 text-[12px] font-semibold text-muted">Affichés sur votre vitrine (« Ouvert maintenant »). Hors horaires, les clients peuvent quand même commander : vous préparez à l’ouverture.</p>
        {DAY_KEYS.map((k) => {
          const slot = hours[k] ?? null;
          return (
            <div key={k} className="grid grid-cols-[92px_auto_1fr] items-center gap-2.5">
              <span className="text-[13.5px] font-extrabold">{DAY_LABELS[k]}</span>
              <Switch on={!!slot} onChange={(v) => setDay(k, v ? DEFAULT_SLOT : null)} label={`${DAY_LABELS[k]} ouvert`} />
              {slot
                ? <span className="flex items-center gap-1.5"><input type="time" value={slot[0]} onChange={(e) => setDay(k, [e.target.value, slot[1]])} aria-label={`${DAY_LABELS[k]}, ouverture`} className={`${field} w-full`} /><span className="text-muted">–</span><input type="time" value={slot[1]} onChange={(e) => setDay(k, [slot[0], e.target.value])} aria-label={`${DAY_LABELS[k]}, fermeture`} className={`${field} w-full`} /></span>
                : <span className="text-[13px] font-bold text-muted">Fermé</span>}
            </div>
          );
        })}
      </section>

      <section aria-label="Échanges et garantie" className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
        <h2 className="text-[14.5px] font-extrabold">Échanges et garantie</h2>
        <p className="-mt-1 text-[12px] font-semibold text-muted">Affiché sur chacun de vos produits. Une règle claire rassure et fait vendre.</p>
        <textarea value={policy} onChange={(e) => setPolicy(e.target.value)} maxLength={600} rows={3} placeholder="Ex. Échange sous 3 jours si l’article n’a pas été porté, avec l’étiquette." className="rounded-xl bg-bg p-3 text-[15px] font-semibold outline-none focus:ring-2 focus:ring-blue" />
        <span className="self-end text-[11.5px] font-bold text-muted">{policy.length} / 600</span>
      </section>

      <section aria-label="Produits mis en avant" className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
        <div className="flex items-baseline justify-between"><h2 className="text-[14.5px] font-extrabold">Produits mis en avant</h2><span className="text-[12px] font-bold text-muted">{featured} / {MAX_FEATURED}</span></div>
        <p className="-mt-1 text-[12px] font-semibold text-muted">En tête de votre vitrine sur HailandX. Enregistré dès que vous touchez.</p>
        {offers.length === 0 && <Link href="/produits/nouveau" className="text-[13px] font-extrabold text-blue-ink">Ajouter un premier produit</Link>}
        <div className="flex flex-wrap gap-1.5">
          {offers.map((o) => (
            <button key={o.id} type="button" aria-pressed={o.featured} onClick={() => void toggleFeatured(o)} className={`flex h-10 max-w-full items-center gap-1.5 rounded-full px-3 text-[12.5px] font-extrabold ${o.featured ? 'bg-ink text-white' : 'border border-line'}`}>
              {o.featured && <Icon name="star" size={14} stroke={2.2} />}<span className="truncate">{o.catalog_products?.name}</span>
            </button>
          ))}
        </div>
      </section>

      <Link href="/reglages" className="flex items-center gap-3 rounded-[20px] border border-line-soft bg-card p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand"><Icon name="image" size={19} /></span>
        <span className="flex flex-1 flex-col"><span className="text-[14px] font-extrabold">Logo, bannière, description, WhatsApp</span><span className="text-[12px] font-semibold text-muted">Dans les réglages de la boutique</span></span>
        <Icon name="chevron" size={16} stroke={2} className="text-[#9a9db0]" />
      </Link>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-card px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
        <button type="button" disabled={busy} onClick={save} className="h-[54px] w-full rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </Screen>
  );
}
