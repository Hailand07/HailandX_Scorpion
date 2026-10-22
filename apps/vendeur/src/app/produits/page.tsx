'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatGnf } from '@hailandx/commerce';
import { BackHeader, browserClient, colorOf, errText, Icon, mediaUrl, Notice, Screen, Switch } from '@hailandx/kit';
import { SellerGate } from '@/components/SellerGate';
import { ShareSheet, type ShareTarget } from '@/components/ShareSheet';

interface Offer { id: string; section_id: string | null; price_gnf: number; active: boolean; photo_paths: string[] | null; offer_variants: { stock: number }[] | null; catalog_products: { name: string; slug: string } | null }
interface Section { id: string; name: string }

/** Produits de ma boutique (v2) : recherche, rayons en puces, visibilité d'un geste ; l'ajout et la modification ont leur écran. */
export default function ProductsPage() {
  return <SellerGate title="Produits">{({ shop }) => <Products shopId={shop.id} shopSlug={shop.slug} shopName={shop.name} />}</SellerGate>;
}

function Products({ shopId, shopSlug, shopName }: { shopId: string; shopSlug: string; shopName: string }) {
  const [sharing, setSharing] = useState<ShareTarget | null>(null);
  const sb = browserClient();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [rayon, setRayon] = useState<string>('tous');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [sname, setSname] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => { if (new URLSearchParams(window.location.search).get('filtre') === 'rupture') setRayon('rupture'); }, []);

  const load = useCallback(async () => {
    if (!sb) return;
    const [o, s] = await Promise.all([
      sb.from('offers').select('id,section_id,price_gnf,active,photo_paths,offer_variants(stock),catalog_products(name,slug)').eq('shop_id', shopId).order('created_at', { ascending: false }),
      sb.from('shop_sections').select('id,name').eq('shop_id', shopId).order('position').order('name'),
    ]);
    setOffers((o.data as unknown as Offer[]) ?? []);
    setSections((s.data as Section[]) ?? []);
  }, [sb, shopId]);
  useEffect(() => { void load(); }, [load]);

  const stockOf = (o: Offer) => (o.offer_variants ?? []).reduce((n, v) => n + v.stock, 0);
  const all = offers ?? [];
  const term = q.trim().toLowerCase();
  const list = all.filter((o) => (rayon === 'tous' || (rayon === 'rupture' ? stockOf(o) === 0 : o.section_id === rayon)) && (!term || (o.catalog_products?.name ?? '').toLowerCase().includes(term)));
  const ruptures = all.filter((o) => stockOf(o) === 0).length;
  const visible = all.filter((o) => o.active).length;

  async function toggle(o: Offer, active: boolean) {
    setOffers((xs) => xs?.map((x) => (x.id === o.id ? { ...x, active } : x)) ?? null);
    const { error } = await sb!.from('offers').update({ active }).eq('id', o.id);
    if (error) { setMsg({ tone: 'err', text: errText(error) }); await load(); }
  }
  async function addSection() {
    const name = sname.trim();
    if (name.length < 2) return setMsg({ tone: 'err', text: 'Donnez un nom au rayon (2 lettres au minimum).' });
    const { error } = await sb!.from('shop_sections').insert({ shop_id: shopId, name, position: sections.length });
    if (error) return setMsg({ tone: 'err', text: error.code === '23505' ? 'Ce rayon existe déjà.' : errText(error) });
    setSname(''); setAdding(false); setMsg({ tone: 'ok', text: `Rayon « ${name} » ajouté. Rangez-y un produit depuis sa fiche.` }); await load();
  }
  async function removeSection(s: Section) {
    if (!confirm(`Supprimer le rayon « ${s.name} » ? Ses produits restent en vente, sans rayon.`)) return;
    const { error } = await sb!.from('shop_sections').delete().eq('id', s.id);
    if (error) return setMsg({ tone: 'err', text: errText(error) });
    setRayon('tous'); await load();
  }

  const chip = (on: boolean) => `h-9 shrink-0 rounded-full px-3.5 text-[12.5px] font-extrabold ${on ? 'bg-ink text-white' : 'border border-line bg-card'}`;
  const current = sections.find((s) => s.id === rayon);
  return (
    <Screen className="pb-28">
      <BackHeader href="/" title="Produits" label="Retour au tableau de bord" right={offers ? <span className="text-[13px] font-bold text-muted">{visible} visible{visible > 1 ? 's' : ''} sur {all.length}</span> : null} />
      <label className="flex h-[46px] items-center gap-2.5 rounded-[14px] border border-line bg-card px-3.5">
        <Icon name="search" size={17} stroke={2} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Chercher dans mes produits" aria-label="Chercher dans mes produits" className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-medium outline-none" />
      </label>
      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="tablist" aria-label="Rayons">
        <button type="button" role="tab" aria-selected={rayon === 'tous'} onClick={() => setRayon('tous')} className={chip(rayon === 'tous')}>Tous</button>
        {sections.map((s) => <button key={s.id} type="button" role="tab" aria-selected={rayon === s.id} onClick={() => setRayon(s.id)} className={chip(rayon === s.id)}>{s.name}</button>)}
        {ruptures > 0 && <button type="button" role="tab" aria-selected={rayon === 'rupture'} onClick={() => setRayon('rupture')} className={`${chip(rayon === 'rupture')} ${rayon === 'rupture' ? '' : 'text-[#c2410c]'}`}>Rupture · {ruptures}</button>}
        <button type="button" onClick={() => setAdding((x) => !x)} className="h-9 shrink-0 rounded-full border border-dashed border-[#c9c4b6] px-3 text-[12.5px] font-extrabold text-muted">+ Rayon</button>
      </div>
      {adding && (
        <form onSubmit={(e) => { e.preventDefault(); void addSection(); }} className="flex gap-2">
          <input autoFocus value={sname} onChange={(e) => setSname(e.target.value)} maxLength={40} placeholder="Nom du rayon (ex. Boubous)" aria-label="Nom du rayon" className="h-12 min-w-0 flex-1 rounded-[14px] border border-line bg-card px-3.5 text-[16px] font-semibold outline-none focus:border-blue" />
          <button type="submit" className="h-12 rounded-[14px] bg-ink px-4 text-[14px] font-extrabold text-white">Ajouter</button>
        </form>
      )}
      {current && <button type="button" onClick={() => removeSection(current)} className="self-start text-[12.5px] font-bold text-muted underline">Supprimer le rayon « {current.name} »</button>}
      <Notice msg={msg} />

      {offers === null && <p className="text-[14px] font-semibold text-muted">Chargement…</p>}
      {offers && all.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-line px-5 py-8 text-center">
          <p className="text-[15px] font-extrabold">Aucun produit pour l’instant</p>
          <p className="text-[13px] font-semibold text-muted">Une photo réelle, un prix, un stock : vos clients achètent en confiance.</p>
        </div>
      )}
      {offers && all.length > 0 && list.length === 0 && <p className="mt-4 text-center text-[13.5px] font-semibold text-muted">Aucun produit ici.</p>}
      <div className="flex flex-col gap-2">
        {list.map((o) => {
          const stock = stockOf(o);
          const photo = mediaUrl(o.photo_paths?.[0]);
          const name = o.catalog_products?.name ?? 'Produit';
          return (
            <div key={o.id} className={`flex items-center gap-3 rounded-[18px] border border-line-soft bg-card py-2.5 pl-2.5 pr-3 ${o.active ? '' : 'opacity-55'}`}>
              <Link href={`/produits/${o.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                {photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo} alt="" className="h-[52px] w-[52px] shrink-0 rounded-[14px] object-cover" /> : <span className="h-[52px] w-[52px] shrink-0 rounded-[14px]" style={{ background: colorOf(name) }} />}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[14px] font-extrabold">{name}</span>
                  <span className="text-[12.5px] font-bold"><span className="font-display font-semibold">{formatGnf(o.price_gnf)}</span> · <span className={stock === 0 ? 'font-extrabold text-[#c2410c]' : stock < 5 ? 'text-[#9a6b00]' : 'text-muted'}>{stock === 0 ? 'Rupture' : `${stock} en stock`}</span></span>
                </span>
              </Link>
              {o.active && o.catalog_products && (
                <button type="button" onClick={() => setSharing({ shopId, shopSlug, shopName, offerId: o.id, productSlug: o.catalog_products!.slug, name, priceGnf: o.price_gnf })} aria-label={`Partager le lien de ${name}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="m16 6-4-4-4 4" /><path d="M12 2v13" /></svg>
                </button>
              )}
              <Switch on={o.active} onChange={(v) => toggle(o, v)} label={`Visible dans la boutique : ${name}`} />
            </div>
          );
        })}
      </div>

      {sharing && <ShareSheet target={sharing} onClose={() => setSharing(null)} />}
      <Link href="/produits/nouveau" className="fixed inset-x-5 bottom-[104px] z-30 mx-auto flex h-[54px] max-w-[calc(28rem-2.5rem)] items-center justify-center gap-2 rounded-[18px] bg-ink text-[15px] font-extrabold text-white shadow-[0_8px_24px_rgba(18,20,28,0.22)]">
        <Icon name="plus" size={18} stroke={2.4} />Ajouter un produit
      </Link>
    </Screen>
  );
}
