-- HAILANDX.md §54 (2026-11-14, demande du fondateur) : une boutique choisit AUTANT de catégories qu'elle veut (voire toutes),
-- et la liste des catégories est élargie au commerce de Conakry.
--  * shops.category_ids : toutes les catégories de la boutique, dans l'ordre choisi. `shops.category_id` reste la catégorie
--    principale (la première) : rien de ce qui la lit ne change.
--  * Un déclencheur garde les deux cohérents et écarte les identifiants inconnus (pas de clé étrangère possible sur un tableau).
-- Ajouts seulement (catégories, colonne, déclencheur) ; la seule mise à jour recopie la catégorie actuelle de chaque boutique.

insert into public.categories (id, name, position) values
  ('tissus-pagnes', 'Tissus et pagnes', 10),
  ('chaussures', 'Chaussures', 11),
  ('sacs-accessoires', 'Sacs et accessoires', 12),
  ('bijoux-montres', 'Bijoux et montres', 13),
  ('meches-perruques', 'Mèches et perruques', 14),
  ('parfums', 'Parfums', 15),
  ('informatique', 'Informatique', 16),
  ('electromenager', 'Électroménager', 17),
  ('meubles-deco', 'Meubles et décoration', 18),
  ('cuisine', 'Cuisine et vaisselle', 19),
  ('bebe', 'Bébé et puériculture', 20),
  ('jouets', 'Jouets et jeux', 21),
  ('sport', 'Sport et loisirs', 22),
  ('fournitures', 'Livres et fournitures', 23),
  ('bricolage', 'Bricolage et quincaillerie', 24),
  ('materiaux', 'Matériaux de construction', 25),
  ('agriculture', 'Agriculture et élevage', 26),
  ('boissons', 'Boissons', 27),
  ('restauration', 'Plats et restauration', 28),
  ('animaux', 'Animaux', 29),
  ('artisanat', 'Artisanat', 30)
on conflict (id) do nothing;

alter table public.shops add column if not exists category_ids text[] not null default '{}';
alter table public.shops drop constraint if exists shops_category_ids_max;
alter table public.shops add constraint shops_category_ids_max check (cardinality(category_ids) <= 60);
update public.shops set category_ids = array[category_id] where category_id is not null and category_ids = '{}';

create or replace function public.shops_categories_before() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Identifiants connus seulement, sans doublon, dans l'ordre choisi.
  new.category_ids := coalesce((
    select array_agg(c order by o) from (
      select u.c, min(u.o) o from unnest(coalesce(new.category_ids, '{}'::text[])) with ordinality as u(c, o)
      where exists (select 1 from public.categories k where k.id = u.c) group by u.c
    ) x), '{}'::text[]);
  -- La catégorie principale fait toujours partie de la liste ; sans principale, c'est la première de la liste.
  if new.category_id is not null and not (new.category_id = any(new.category_ids)) then
    new.category_ids := array_prepend(new.category_id, new.category_ids);
  elsif new.category_id is null and cardinality(new.category_ids) > 0 then
    new.category_id := new.category_ids[1];
  end if;
  return new;
end $$;
revoke all on function public.shops_categories_before() from public, anon, authenticated;
drop trigger if exists shops_categories on public.shops;
create trigger shops_categories before insert or update of category_id, category_ids on public.shops
  for each row execute function public.shops_categories_before();
