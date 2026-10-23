'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatGnf } from '@hailandx/commerce';
import { browserClient, Icon, ICONS, mediaUrl, Screen } from '@hailandx/kit';
import { SellerGate, type SellerCtx } from '@/components/SellerGate';
import { ShareSheet } from '@/components/ShareSheet';

interface Src { source: string; parcels: number; revenue_gnf: number }
interface Offer { id: string; price_gnf: number; compare_at_gnf: number | null; photo_paths: string[] | null; catalog_products: { name: string; slug: string; photo_paths: string[] | null } | null }
const SRC: Record<string, string> = { application: 'HailandX', tiktok: 'TikTok', whatsapp: 'WhatsApp', facebook: 'Facebook', autre: 'Autre' };

/** Marketing (maquette v6 B1) : d'où viennent les ventes, et les outils pour en faire venir (codes, promotions, visuels, liens, QR). */
export default function MarketingPage() {
  return <SellerGate title="Marketing">{(ctx) => <Marketing {...ctx} />}</SellerGate>;
}

function Marketing({ shop }: SellerCtx) {
  const sb = browserClient();
  const [sources, setSources] = useState<Src[] | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [codes, setCodes] = useState<{ active: number; uses: number }>({ active: 0, uses: 0 });
  const [links, setLinks] = useState<{ n: number; clicks: number }>({ n: 0, clicks: 0 });
  const [sharing, setSharing] = useState<Offer | null>(null);

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const [s, o, c, u, l] = await Promise.all([
        sb.rpc('fn_shop_sources', { p_shop: shop.id, p_days: 30 }),
        sb.from('offers').select('id,price_gnf,compare_at_gnf,photo_paths,catalog_products(name,slug,photo_paths)').eq('shop_id', shop.id).eq('active', true).order('updated_at', { ascending: false }).limit(30),
        sb.from('promo_codes').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('active', true),
        sb.from('promo_uses').select('id', { count: 'exact', head: true }),
        sb.from('share_links').select('clicks').eq('shop_id', shop.id),
      ]);
      setSources(((s.data as Src[]) ?? []).map((x) => ({ ...x, revenue_gnf: Number(x.revenue_gnf) })));
      setOffers((o.data as unknown as Offer[]) ?? []);
      setCodes({ active: c.count ?? 0, uses: u.count ?? 0 });
      const ls = (l.data as { clicks: number }[]) ?? [];
      setLinks({ n: ls.length, clicks: ls.reduce((a, x) => a + x.clicks, 0) });
    })();
  }, [sb, shop.id]);

  const total = (sources ?? []).reduce((a, s) => a + s.revenue_gnf, 0);
  const shared = (sources ?? []).filter((s) => s.source !== 'application').reduce((a, s) => a + s.revenue_gnf, 0);
  const best = Math.max(1, ...(sources ?? []).map((s) => s.revenue_gnf));
  const promos = offers.filter((o) => o.compare_at_gnf).length;
  const photoOf = (o: Offer) => mediaUrl(o.photo_paths?.[0] ?? o.catalog_products?.photo_paths?.[0]);

  const tools: { href: string; icon: keyof typeof ICONS; label: string; sub: string; tone: string }[] = [
    { href: '/marketing/codes', icon: 'percent', label: 'Codes promo', sub: codes.active ? `${codes.active} actif${codes.active > 1 ? 's' : ''} · utilisés ${codes.uses} fois` : 'Offrez une réduction à vos clients', tone: 'bg-blue-soft text-blue' },
    { href: '/marketing/promotions', icon: 'tag', label: 'Promotions (prix barrés)', sub: promos ? `${promos} produit${promos > 1 ? 's' : ''} en promotion` : 'Baissez un prix, l’ancien reste barré', tone: 'bg-[#fff1e6] text-[#c2410c]' },
    { href: '/marketing/visuel', icon: 'image', label: 'Visuels prêts à publier', sub: 'Statut WhatsApp, TikTok, Facebook', tone: 'bg-[#fdf6dc] text-[#8a6400]' },
    { href: '/statistiques#liens', icon: 'link', label: 'Liens suivis', sub: links.n ? `${links.n} lien${links.n > 1 ? 's' : ''} · ${links.clicks} clic${links.clicks > 1 ? 's' : ''}` : 'Savoir quel réseau vous fait vendre', tone: 'bg-sand text-ink' },
    { href: '/marketing/qr', icon: 'qr', label: 'QR code de la boutique', sub: 'À imprimer pour votre vitrine ou vos sacs', tone: 'bg-sand text-ink' },
  ];

  return (
    <Screen className="pt-5">
      <h1 className="font-display text-[26px] font-semibold tracking-tight">Marketing</h1>

      <section aria-label="Ventes des 30 derniers jours" className="flex flex-col gap-2.5 rounded-[22px] bg-ink p-4 text-white">
        <span className="text-[12.5px] font-bold text-white/65">Ventes venues de vos partages · 30 jours</span>
        <span className="font-display text-[26px] font-semibold tracking-tight">{sources ? formatGnf(shared) : '…'}</span>
        {sources && sources.length === 0 && <span className="text-[12.5px] font-semibold text-white/65">Pas encore de vente : partagez un produit ci-dessous, chaque réseau aura son lien suivi.</span>}
        {(sources ?? []).map((s) => (
          <span key={s.source} className="grid grid-cols-[74px_1fr_auto] items-center gap-2 text-[12px] font-bold">
            <span>{SRC[s.source] ?? s.source}</span>
            <span className="block h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-lime" style={{ width: `${Math.max(4, (s.revenue_gnf / best) * 100)}%` }} /></span>
            <span className="text-right">{formatGnf(s.revenue_gnf)}</span>
          </span>
        ))}
        {sources && total > 0 && <span className="text-[11.5px] font-semibold text-white/65">Total des ventes : {formatGnf(total)}</span>}
      </section>

      <nav aria-label="Outils marketing" className="overflow-hidden rounded-[22px] border border-line-soft bg-card">
        {tools.map((t, i) => (
          <Link key={t.href} href={t.href} className={`flex min-h-[62px] items-center gap-3 px-4 py-2.5 ${i < tools.length - 1 ? 'border-b border-[#f0ede6]' : ''}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.tone}`}><Icon name={t.icon} size={19} /></span>
            <span className="flex min-w-0 flex-1 flex-col"><span className="text-[14.5px] font-extrabold">{t.label}</span><span className="truncate text-[12px] font-semibold text-muted">{t.sub}</span></span>
            <Icon name="chevron" size={16} stroke={2} className="text-[#9a9db0]" />
          </Link>
        ))}
      </nav>

      {offers.length > 0 && (
        <section aria-label="Partager un produit" className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[14.5px] font-extrabold">Partager un produit en un geste</h2>
          <p className="-mt-1 text-[12.5px] font-semibold text-muted">Le client arrive directement sur le produit, prêt à commander.</p>
          <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {offers.slice(0, 12).map((o) => (
              <button key={o.id} type="button" onClick={() => setSharing(o)} className="flex w-[112px] shrink-0 flex-col gap-1 text-left">
                {photoOf(o)
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={photoOf(o)!} alt="" className="h-[112px] w-[112px] rounded-[14px] bg-sand object-cover" />
                  : <span aria-hidden="true" className="flex h-[112px] w-[112px] items-center justify-center rounded-[14px] bg-sand text-muted"><Icon name="image" /></span>}
                <span className="truncate text-[12px] font-extrabold">{o.catalog_products?.name}</span>
                <span className="text-[11.5px] font-extrabold text-blue-ink">Partager</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {sharing?.catalog_products && <ShareSheet target={{ shopId: shop.id, shopSlug: shop.slug, shopName: shop.name, offerId: sharing.id, productSlug: sharing.catalog_products.slug, name: sharing.catalog_products.name, priceGnf: sharing.price_gnf }} onClose={() => setSharing(null)} />}
    </Screen>
  );
}
