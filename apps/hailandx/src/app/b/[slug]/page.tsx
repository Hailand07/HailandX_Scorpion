import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, VerifiedMark } from '@hailandx/ui';
import { badgesOf } from '@/data/sample';
import { getCatalog, trustFor } from '@/lib/catalog';
import { serverClient } from '@hailandx/kit';
import { hoursSummary, isOpenNow, onVacation } from '@hailandx/commerce';
import { FollowButton } from '@/components/FollowButton';
import { ShopProducts, type Section } from '@/components/ShopProducts';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const s = (await getCatalog()).shops.find((x) => x.slug === slug);
  if (!s) return { title: 'Boutique introuvable' };
  const description = `${[s.tagline, s.place].filter(Boolean).join(' · ')}. Vendeur certifié Hailand, livré par la Flotte Hailand.`;
  return { title: s.name, description, openGraph: { title: s.name, description, type: 'website', siteName: 'HailandX', locale: 'fr_GN' } };
}

/** Boutique d'un vendeur : tous ses produits, comme si l'on entrait dans sa boutique depuis la rue. */
export default async function ShopPage({ params }: Params) {
  const { slug } = await params;
  const cat = await getCatalog();
  const s = cat.shops.find((x) => x.slug === slug);
  if (!s) notFound();
  // Produits mis en avant par le vendeur d'abord (HAILANDX.md §37).
  const products = cat.products.filter((p) => p.shopSlug === s.slug).sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  const away = onVacation(s.vacationUntil);
  const open = isOpenNow(s.hours);
  const summary = hoursSummary(s.hours);
  // Identifiant, rayons et abonnés : lus à la demande (la vitrine mise en cache ne les porte pas). Boutiques d'exemple : pas de suivi.
  let shopId: string | null = null; let sections: Section[] = []; let followers = 0;
  const sb = cat.source === 'base' ? serverClient() : null;
  if (sb) {
    const { data: row } = await sb.from('shops').select('id').eq('slug', s.slug).maybeSingle();
    shopId = (row as { id: string } | null)?.id ?? null;
    if (shopId) {
      const [sec, fol] = await Promise.all([sb.from('shop_sections').select('id,name').eq('shop_id', shopId).order('position').order('name'), sb.rpc('fn_shop_followers', { p_shop: shopId })]);
      sections = (sec.data as Section[]) ?? [];
      followers = typeof fol.data === 'number' ? fol.data : 0;
    }
  }
  const wa = s.whatsapp ? s.whatsapp.replace(/\D/g, '') : '';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 pb-10">
      <div className="h-[132px] bg-cover bg-center" style={{ background: s.coverUrl ? `center / cover url(${s.coverUrl})` : s.color }} />
      <section className="-mt-9 flex flex-col gap-3 px-5">
        <span className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-3xl border-4 border-bg bg-ink font-display text-2xl font-bold" style={{ color: s.color }}>{s.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logoUrl} alt="" className="h-full w-full object-cover" /> : s.initials}</span>
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 font-display text-[22px] font-semibold tracking-tight">{s.name}<VerifiedMark size={20} /></h1>
          <span className="text-[13px] font-semibold text-muted">{[s.tagline, s.place].filter(Boolean).join(' · ')}</span>
        </div>
        {away && (
          <p role="status" className="rounded-2xl bg-[#fff1e6] px-4 py-3 text-[13px] font-bold text-[#8a3a0c]">
            En congé jusqu’au {new Date(s.vacationUntil!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} inclus : les commandes reprennent ensuite.{s.vacationNote ? ` « ${s.vacationNote} »` : ''}
          </p>
        )}
        {summary && !away && (
          <p className="flex items-center gap-2 text-[13px] font-bold">
            <span className={`h-2 w-2 shrink-0 rounded-full ${open ? 'bg-ok' : 'bg-[#c9c4b6]'}`} />
            <span className={open ? 'text-ok' : 'text-muted'}>{open ? 'Ouvert maintenant' : 'Fermé pour le moment'}</span>
            <span className="truncate font-semibold text-muted">· {summary}</span>
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-line-soft bg-card px-3 py-2.5"><div className="font-display text-[17px] font-semibold">★ {s.stats.rating.toFixed(1).replace('.', ',')}</div><div className="text-[11.5px] font-semibold text-muted">{s.stats.reviewCount} avis vérifiés</div></div>
          <div className="rounded-2xl border border-line-soft bg-card px-3 py-2.5"><div className="font-display text-[17px] font-semibold">{Math.round(s.stats.reliability * 100)} %</div><div className="text-[11.5px] font-semibold text-muted">livrés sans litige</div></div>
          <div className="rounded-2xl border border-line-soft bg-card px-3 py-2.5"><div className="font-display text-[17px] font-semibold">{trustFor(s)}</div><div className="text-[11.5px] font-semibold text-muted">indice de confiance</div></div>
        </div>
        <div className="flex flex-wrap gap-1.5">{badgesOf(s).map((b) => <Badge key={b}>{b}</Badge>)}</div>
        <div className="flex flex-wrap items-center gap-2">
          {shopId && <FollowButton shopId={shopId} shopSlug={s.slug} initialCount={followers} />}
          {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Bonjour ${s.name}, je vous écris depuis HailandX.`)}`} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-[13.5px] font-extrabold text-ok">WhatsApp</a>}
        </div>
      </section>

      <ShopProducts shopSlug={s.slug} products={products} sections={sections} />
      {s.policy && (
        <section aria-labelledby="politique" className="mx-5 mt-2 flex flex-col gap-1 rounded-2xl border border-line-soft bg-card px-4 py-3">
          <h2 id="politique" className="text-[13px] font-extrabold">Échanges et garantie de la boutique</h2>
          <p className="whitespace-pre-line text-[13px] font-semibold leading-snug text-muted">{s.policy}</p>
        </section>
      )}
    </main>
  );
}
