'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhotoSlot, Price } from '@hailandx/ui';
import { BackHeader, browserClient, mediaUrl, useSession } from '@hailandx/kit';
import { formatGnf } from '@hailandx/commerce';
import { colorOf } from '@/lib/catalog';

interface Fav { catalog_products: { slug: string; name: string; offers: { price_gnf: number; photo_paths: string[] | null; active: boolean; shops: { slug: string; status: string } | null }[] } | null }

/** Mes favoris : les produits mis de côté, au meilleur prix actuellement proposé. */
export default function FavoritesPage() {
  const session = useSession();
  const [list, setList] = useState<Fav[] | null>(null);
  const [followed, setFollowed] = useState<{ slug: string; name: string }[]>([]);
  useEffect(() => {
    const sb = browserClient(); if (!sb || !session) return;
    sb.from('product_favorites').select('catalog_products(slug,name,offers(price_gnf,photo_paths,active,shops(slug,status)))').eq('user_id', session.user.id).order('created_at', { ascending: false })
      .then(({ data }) => setList((data as unknown as Fav[]) ?? []));
    sb.from('shop_follows').select('shops(slug,name)').eq('user_id', session.user.id).order('created_at', { ascending: false }).then(({ data }) => {
      setFollowed(((data as unknown as { shops: { slug: string; name: string } | null }[]) ?? []).map((r) => r.shops).filter((x): x is { slug: string; name: string } => Boolean(x)));
    });
  }, [session]);
  const items = (list ?? []).map((f) => f.catalog_products).filter((p): p is NonNullable<Fav['catalog_products']> => Boolean(p)).map((p) => {
    const live = p.offers.filter((o) => o.active && o.shops?.status === 'ouverte').sort((a, b) => a.price_gnf - b.price_gnf);
    return { p, best: live[0] ?? null };
  });
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-4">
      <BackHeader href="/compte" title="Favoris" label="Retour au compte" />
      {session === null && <Link href="/connexion?next=/favoris" className="font-bold text-blue-ink">Se connecter</Link>}
      {followed.length > 0 && (
        <section aria-label="Boutiques suivies" className="flex flex-col gap-2">
          <h2 className="text-[13px] font-extrabold text-muted">Boutiques suivies</h2>
          <div className="flex flex-wrap gap-2">{followed.map((f) => <Link key={f.slug} href={`/b/${f.slug}`} className="flex h-10 items-center rounded-full border border-line bg-card px-3.5 text-[13px] font-bold">{f.name}</Link>)}</div>
        </section>
      )}
      {list?.length === 0 && <p className="text-[14px] font-medium text-muted">Aucun favori pour l’instant. Touchez le cœur sur la fiche d’un produit pour le retrouver ici.</p>}
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ p, best }) => (
          <Link key={p.slug} href={`/p/${p.slug}${best?.shops ? `?b=${best.shops.slug}` : ''}`} className={`flex flex-col overflow-hidden rounded-[18px] border border-line-soft bg-card ${best ? '' : 'opacity-60'}`}>
            <PhotoSlot src={mediaUrl(best?.photo_paths?.[0])} color={colorOf(p.slug)} className="h-[120px]" label={p.name} />
            <span className="flex flex-col gap-0.5 px-3 pb-3 pt-2.5"><span className="truncate text-[13px] font-bold">{p.name}</span>{best ? <Price className="text-[14.5px]">{formatGnf(best.price_gnf)}</Price> : <span className="text-[12px] font-semibold text-muted">Plus proposé</span>}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
