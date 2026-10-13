'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhotoSlot, Price, Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { mediaUrl } from '@/lib/media';
import { colorOf } from '@/lib/catalog';

interface Fav { catalog_products: { slug: string; name: string; offers: { price_gnf: number; photo_paths: string[] | null; active: boolean; shops: { slug: string; status: string } | null }[] } | null }

/** Mes favoris : les produits mis de côté, au meilleur prix actuellement proposé. */
export default function FavoritesPage() {
  const session = useSession();
  const [list, setList] = useState<Fav[] | null>(null);
  useEffect(() => {
    const sb = browserClient(); if (!sb || !session) return;
    sb.from('product_favorites').select('catalog_products(slug,name,offers(price_gnf,photo_paths,active,shops(slug,status)))').eq('user_id', session.user.id).order('created_at', { ascending: false })
      .then(({ data }) => setList((data as unknown as Fav[]) ?? []));
  }, [session]);
  const items = (list ?? []).map((f) => f.catalog_products).filter((p): p is NonNullable<Fav['catalog_products']> => Boolean(p)).map((p) => {
    const live = p.offers.filter((o) => o.active && o.shops?.status === 'ouverte').sort((a, b) => a.price_gnf - b.price_gnf);
    return { p, best: live[0] ?? null };
  });
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-6">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><Link href="/compte" className="text-[13px] font-bold text-blue-ink">Mon compte</Link></div>
      <h1 className="font-display text-[22px] font-semibold tracking-tight">Mes favoris</h1>
      {session === null && <Link href="/connexion?next=/favoris" className="font-bold text-blue-ink">Se connecter</Link>}
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
