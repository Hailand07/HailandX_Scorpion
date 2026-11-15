import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { formatGnf } from '@hailandx/commerce';
import { getCatalog } from '@/lib/catalog';
import { pickOffers } from '@/lib/pickOffer';

export const runtime = 'nodejs';

const W = 1200;
const H = 630;
const PHOTO = 600;

/**
 * Polices de la marque (Manrope) pour la carte : chargées une fois par instance, au format TTF que lit le générateur d'images.
 * En cas d'échec réseau, la police par défaut est utilisée : l'aperçu sort quand même.
 */
type Font = { name: string; data: ArrayBuffer; weight: 600 | 800; style: 'normal' };
let fonts: Promise<Font[]> | null = null;
function loadFonts(): Promise<Font[]> {
  fonts ??= (async () => {
    try {
      const css = await (await fetch('https://fonts.googleapis.com/css2?family=Manrope:wght@600;800', { signal: AbortSignal.timeout(4000) })).text();
      const urls = [...css.matchAll(/font-weight:\s*(\d+);[\s\S]*?url\((https:[^)]+\.ttf)\)/g)].map((m) => ({ weight: Number(m[1]) as 600 | 800, url: m[2]! }));
      return await Promise.all(urls.map(async (u) => ({ name: 'Manrope', weight: u.weight, style: 'normal' as const, data: await (await fetch(u.url, { signal: AbortSignal.timeout(4000) })).arrayBuffer() })));
    } catch { fonts = null; return []; }
  })();
  return fonts;
}

/**
 * Image d'aperçu d'un lien de produit (§54) : ce que WhatsApp, Facebook et TikTok montrent quand un vendeur partage le lien.
 * Carte 1200 × 630 : la photo du produit EN ENTIER à gauche (sur un fond flou de la même photo), le nom, le prix et la boutique à
 * droite. Servie en JPEG léger (WhatsApp ignore les images trop lourdes et le WebP des photos de démonstration).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = new URL(req.url).searchParams.get('b') ?? undefined;
  const cat = await getCatalog();
  const p = pickOffers(cat, slug, b).selected;
  if (!p) return new Response('Produit introuvable', { status: 404 });
  const shop = cat.shops.find((x) => x.slug === p.shopSlug);

  // Panneau photo : la photo entière, centrée, sur la même photo agrandie et floutée.
  let photo: string | null = null;
  const src = p.photoUrls?.[0] ?? p.photoUrl;
  if (src) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const back = await sharp(buf).resize(PHOTO, H, { fit: 'cover' }).blur(28).modulate({ brightness: 0.92 }).toBuffer();
        const front = await sharp(buf).resize(PHOTO - 40, H - 40, { fit: 'inside' }).toBuffer();
        const panel = await sharp(back).composite([{ input: front, gravity: 'center' }]).jpeg({ quality: 82 }).toBuffer();
        photo = `data:image/jpeg;base64,${panel.toString('base64')}`;
      }
    } catch { photo = null; }
  }

  const fontList = await loadFonts();
  const name = p.name.length > 70 ? `${p.name.slice(0, 68)}…` : p.name;
  const png = await new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', background: '#f6f4ef', fontFamily: fontList.length ? 'Manrope' : 'sans-serif' }}>
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photo} width={PHOTO} height={H} alt="" style={{ width: PHOTO, height: H, objectFit: 'cover' }} />
          : <div style={{ width: PHOTO, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.color, fontSize: 120, color: '#12141c', opacity: 0.4 }}>{p.name.slice(0, 1).toUpperCase()}</div>}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 52px 48px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: '#5f6372' }}>{shop?.name ?? 'Boutique'} · vendeur certifié Hailand</div>
            <div style={{ display: 'flex', fontSize: name.length > 40 ? 46 : 56, fontWeight: 800, color: '#12141c', lineHeight: 1.12 }}>{name}</div>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: '#3346f0' }}>{formatGnf(p.priceGnf)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: '#0d6b47' }}>Livré à votre porte · paiement protégé</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: '#12141c' }}>Hailand<span style={{ color: '#3346f0' }}>X</span></div>
              <div style={{ display: 'flex', background: '#c8f25a', borderRadius: 999, padding: '8px 18px', fontSize: 24, fontWeight: 800, color: '#12141c' }}>Commander</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, ...(fontList.length ? { fonts: fontList } : {}) },
  ).arrayBuffer();
  const jpg = await sharp(Buffer.from(png)).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
