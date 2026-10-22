import { NextResponse } from 'next/server';
import { serverClient } from '@hailandx/kit';

/** Lien suivi court : /s/<code> → compte le clic, puis ouvre la boutique ou le produit (offre de la boutique qui partage) en gardant la source (?src=). */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sb = serverClient();
  const home = new URL('/', req.url);
  if (!sb || !/^[a-z0-9-]{4,40}$/i.test(code)) return NextResponse.redirect(home);
  const { data } = await sb.rpc('fn_open_share_link', { p_code: code });
  const l = (data as { kind: string; shop_slug: string; source: string | null; product_slug: string | null }[] | null)?.[0];
  if (!l) return NextResponse.redirect(home);
  const target = new URL(l.kind === 'produit' && l.product_slug ? `/p/${l.product_slug}` : `/b/${l.shop_slug}`, req.url);
  // Lien d'un produit : toujours l'offre de la boutique qui a partagé (jamais celle d'un concurrent qui vend le même produit).
  if (l.kind === 'produit' && l.product_slug) target.searchParams.set('b', l.shop_slug);
  if (l.source) target.searchParams.set('src', l.source);
  return NextResponse.redirect(target);
}
