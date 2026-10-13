-- HailandX — variantes de produit (taille, couleur) : libellé figé dans la commande, un libellé par offre.
-- Écart signalé au §21 de HAILANDX.md (maquette 11 : variantes).
begin;

-- Un libellé de variante par offre (« M · Rouge » ne se répète pas). Les offres existantes n'ont qu'une variante « Standard ».
create unique index offer_variants_label_uniq on public.offer_variants (offer_id, lower(btrim(label)));
alter table public.offer_variants add constraint offer_variants_label_len check (length(btrim(label)) between 1 and 40);

-- La commande garde le libellé de la variante achetée (le vendeur peut la renommer ensuite sans changer l'historique).
alter table public.order_items add column variant_label text;
create or replace function public.order_items_variant_label() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.variant_id is not null and new.variant_label is null then
    select v.label into new.variant_label from public.offer_variants v where v.id = new.variant_id;
  end if;
  return new;
end $$;
create trigger order_items_variant_label before insert on public.order_items for each row execute function public.order_items_variant_label();
revoke all on function public.order_items_variant_label() from public, anon, authenticated;

commit;
