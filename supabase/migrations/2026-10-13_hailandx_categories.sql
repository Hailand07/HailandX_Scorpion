-- Catégories de départ de HailandX (données de référence, ajout seulement). APPLIQUÉE le 2026-10-13 avec l'accord du fondateur.
insert into public.categories (id, name, position) values
  ('mode', 'Mode', 1),
  ('beaute', 'Beauté', 2),
  ('telephones', 'Téléphones', 3),
  ('maison', 'Maison', 4),
  ('alimentation', 'Alimentation', 5),
  ('electronique', 'Électronique', 6),
  ('enfants', 'Enfants', 7),
  ('sante', 'Santé', 8),
  ('auto-moto', 'Auto et moto', 9),
  ('autres', 'Autres', 99)
on conflict (id) do nothing;
