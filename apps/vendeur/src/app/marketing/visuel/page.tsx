'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { discountPercent } from '@hailandx/commerce';
import { BackHeader, browserClient, Chips, HAILANDX_URL, Icon, mediaUrl, Notice, Screen } from '@hailandx/kit';
import { SellerGate, type SellerCtx } from '@/components/SellerGate';
import { type Net, trackedLink } from '@/components/ShareSheet';
import { BRAND, canvasFile, downloadCanvas, drawCover, gnf, loadImage, roundRect, wrapText } from '@/lib/visual';

interface Offer { id: string; price_gnf: number; compare_at_gnf: number | null; photo_paths: string[] | null; catalog_products: { name: string; slug: string; photo_paths: string[] | null } | null }
type Format = 'statut' | 'carre';
const SIZE: Record<Format, [number, number]> = { statut: [1080, 1920], carre: [1080, 1080] };
const NETS: { id: Net; label: string }[] = [{ id: 'whatsapp', label: 'WhatsApp' }, { id: 'tiktok', label: 'TikTok' }, { id: 'facebook', label: 'Facebook' }];

/** Visuel prêt à publier (maquette v6 B3) : photo, prix (barré si promotion), lien suivi du réseau choisi, nom de la boutique. */
export default function VisualPage() {
  return <SellerGate title="Visuel à publier">{(ctx) => <Visual {...ctx} />}</SellerGate>;
}

function Visual({ shop }: SellerCtx) {
  const sb = browserClient();
  const ref = useRef<HTMLCanvasElement>(null);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [pick, setPick] = useState('');
  const [format, setFormat] = useState<Format>('statut');
  const [net, setNet] = useState<Net>('whatsapp');
  const [link, setLink] = useState('');
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!sb) return;
    const want = new URLSearchParams(window.location.search).get('produit');
    sb.from('offers').select('id,price_gnf,compare_at_gnf,photo_paths,catalog_products(name,slug,photo_paths)').eq('shop_id', shop.id).eq('active', true).order('updated_at', { ascending: false }).then(({ data }) => {
      const list = (data as unknown as Offer[]) ?? [];
      setOffers(list); setPick(list.find((o) => o.id === want)?.id ?? list[0]?.id ?? '');
    });
  }, [sb, shop.id]);
  const offer = offers?.find((o) => o.id === pick) ?? null;

  // Le lien suivi est créé (ou retrouvé) pour ce produit et ce réseau : les ventes du visuel remontent dans Statistiques.
  useEffect(() => {
    if (!offer?.catalog_products) return;
    const direct = `${HAILANDX_URL}/p/${offer.catalog_products.slug}?b=${shop.slug}`;
    trackedLink({ shopId: shop.id, shopSlug: shop.slug, shopName: shop.name, offerId: offer.id }, net, direct).then(setLink, () => setLink(direct));
  }, [offer, net, shop]);

  const draw = useCallback(async () => {
    const c = ref.current;
    if (!c || !offer?.catalog_products || !link) return;
    setReady(false);
    const [W, H] = SIZE[format];
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    await document.fonts.ready;
    const panel = format === 'statut' ? 520 : 400;
    ctx.fillStyle = '#f0c79f'; ctx.fillRect(0, 0, W, H);
    const img = await loadImage(mediaUrl(offer.photo_paths?.[0] ?? offer.catalog_products.photo_paths?.[0]));
    if (img) drawCover(ctx, img, 0, 0, W, H - panel);
    const pct = discountPercent(offer.price_gnf, offer.compare_at_gnf);
    if (pct) {
      ctx.fillStyle = BRAND.ink; roundRect(ctx, 48, 48, 230, 92, 46); ctx.fill();
      ctx.fillStyle = BRAND.lime; ctx.font = '800 50px Manrope, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`−${pct} %`, 163, 112);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, H - panel, W, panel);
    ctx.textAlign = 'left'; ctx.fillStyle = BRAND.ink; ctx.font = '800 58px Manrope, sans-serif';
    let y = H - panel + 100;
    y += wrapText(ctx, offer.catalog_products.name, 64, y, W - 128, 70, 2);
    ctx.font = '700 88px Sora, sans-serif';
    const price = gnf(offer.price_gnf);
    ctx.fillText(price, 64, y + 70);
    if (pct) {
      const x = 64 + ctx.measureText(price).width + 28;
      ctx.font = '700 44px Manrope, sans-serif'; ctx.fillStyle = BRAND.muted;
      const old = gnf(offer.compare_at_gnf!);
      ctx.fillText(old, x, y + 66);
      ctx.fillRect(x, y + 50, ctx.measureText(old).width, 4);
    }
    ctx.fillStyle = BRAND.blue; ctx.font = '800 40px Manrope, sans-serif';
    ctx.fillText(`${link.replace(/^https?:\/\//, '')} · Livré chez vous`, 64, y + 150);
    ctx.fillStyle = BRAND.muted; ctx.font = '700 36px Manrope, sans-serif';
    ctx.fillText(`${shop.name} · vendeur à adresse certifiée Hailand`, 64, y + 205);
    setReady(true);
  }, [offer, format, link, shop.name]);
  useEffect(() => { void draw(); }, [draw]);

  const fileName = `${offer?.catalog_products?.slug ?? 'produit'}-${format}.png`;
  async function share() {
    const c = ref.current;
    if (!c) return;
    const file = await canvasFile(c, fileName);
    const text = `${offer?.catalog_products?.name} — ${gnf(offer?.price_gnf ?? 0)}\nCommandez ici, livré chez vous : ${link}`;
    try {
      if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    } catch { return; /* partage annulé */ }
    downloadCanvas(c, fileName);
    try { await navigator.clipboard.writeText(text); } catch { /* copie refusée */ }
    setMsg({ tone: 'ok', text: 'Image enregistrée et texte copié : publiez l’image puis collez le texte avec le lien.' });
  }

  return (
    <Screen className="pb-[120px]">
      <BackHeader href="/marketing" title="Visuel à publier" />
      {offers?.length === 0 && <p className="rounded-[20px] border border-dashed border-line px-4 py-6 text-center text-[13.5px] font-bold text-muted">Mettez d’abord un produit en vente.</p>}
      {offers && offers.length > 0 && (
        <>
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Produit" className="h-12 rounded-2xl border border-line bg-card px-3 text-[15px] font-bold">
            {offers.map((o) => <option key={o.id} value={o.id}>{o.catalog_products?.name}</option>)}
          </select>
          <Chips label="Format" value={format} onChange={setFormat} items={[{ id: 'statut', label: 'Statut / TikTok (9:16)' }, { id: 'carre', label: 'Carré (1:1)' }]} />
          <Chips label="Réseau du lien" value={net} onChange={setNet} items={NETS} />
          <canvas ref={ref} role="img" aria-label="Aperçu du visuel" className={`mx-auto rounded-[20px] shadow-[0_12px_30px_rgba(18,20,28,.18)] ${format === 'statut' ? 'w-[64%]' : 'w-full'}`} />
          <p className="text-center text-[12.5px] font-semibold text-muted">Le lien sur l’image est suivi : vous verrez combien de ventes ce visuel a rapportées.</p>
          <Notice msg={msg} />
        </>
      )}
      {offers && offers.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-md grid-cols-2 gap-2.5 border-t border-line bg-card px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
          <button type="button" disabled={!ready} onClick={() => ref.current && downloadCanvas(ref.current, fileName)} className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-line text-[14px] font-extrabold disabled:opacity-50"><Icon name="download" size={18} />Enregistrer</button>
          <button type="button" disabled={!ready} onClick={share} className="h-[52px] rounded-2xl bg-ink text-[14px] font-extrabold text-white disabled:opacity-50">Publier…</button>
        </div>
      )}
    </Screen>
  );
}
