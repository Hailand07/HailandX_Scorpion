-- HAILANDX.md §53 (2026-11-14, demande du fondateur) : livrer un client là où il est, sans en faire son domicile.
--  Un client en séjour, au travail ou de passage doit pouvoir commander : son emplacement actuel se repère SUR PLACE, comme le
--  domicile (GPS, vue satellite, bâtiment confirmé), mais l'adresse est TEMPORAIRE.
--  * declarations.temporary_until : vide = adresse durable (domicile, travail) ; une date = adresse temporaire, proposée pour de
--    nouvelles commandes jusqu'à cette date seulement. Elle n'est jamais présentée comme le domicile du client (HailandX la
--    nomme « Adresse temporaire », NavigationX ne l'affiche pas parmi ses adresses).
--  Ajout seulement : aucune règle existante n'est modifiée ; le déclencheur d'insertion de `declarations` ne lit pas cette colonne.
alter table public.declarations add column if not exists temporary_until timestamptz;
comment on column public.declarations.temporary_until is
  'Adresse temporaire (client hors de son domicile) : proposée jusqu''à cette date. Vide = adresse durable. HAILANDX.md §53.';
