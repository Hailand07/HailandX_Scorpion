-- Liens suivis : nouvelle fonction qui renvoie aussi la source (TikTok, WhatsApp, Facebook…) et le produit visé.
-- La source est conservée jusqu'à la commande (orders.source) pour mesurer ce qui vient de chaque réseau. APPLIQUÉE le 2026-10-13.
-- (Sur ce projet DROP se bloque : l'ancienne fn_resolve_share_link reste en place, inutilisée.)
create or replace function public.fn_open_share_link(p_code text)
returns table (kind text, shop_slug text, offer_ids uuid[], source text, product_slug text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.share_links set clicks = clicks + 1 where code = lower(p_code);
  return query
    select l.kind, s.slug, l.offer_ids, l.source,
           (select cp.slug from public.offers o join public.catalog_products cp on cp.id = o.product_id where o.id = l.offer_ids[1])
    from public.share_links l join public.shops s on s.id = l.shop_id
    where l.code = lower(p_code) and s.status <> 'suspendue';
end $$;
revoke all on function public.fn_open_share_link(text) from public;
grant execute on function public.fn_open_share_link(text) to anon, authenticated;
