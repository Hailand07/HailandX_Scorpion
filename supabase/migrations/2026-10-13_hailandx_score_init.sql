-- Une boutique neuve a tout de suite un indice calculé (et non 0), qui suit aussi ses offres (photos, prix). APPLIQUÉE le 2026-10-13.
create or replace function public.shops_owner_member_after() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.shop_members (shop_id, user_id, role) values (new.id, new.owner_id, 'proprietaire') on conflict do nothing;
  insert into public.shop_scores (shop_id) values (new.id) on conflict do nothing;
  perform public.fn_refresh_shop_score(new.id);
  return new;
end $$;

create or replace function public.shop_score_after_offer() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin perform public.fn_refresh_shop_score(new.shop_id); return new; end $$;
create trigger offers_score after insert or update of price_gnf, active, photo_paths on public.offers for each row execute function public.shop_score_after_offer();

revoke all on function public.shop_score_after_offer() from public, anon, authenticated;
revoke all on function public.shops_owner_member_after() from public, anon, authenticated;
