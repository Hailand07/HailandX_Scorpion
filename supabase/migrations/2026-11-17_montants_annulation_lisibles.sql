-- §56 : le client lit ce qui a été retenu sur son colis annulé tardivement (§45).
-- Sans ce droit, toute requête qui demandait ces colonnes était refusée (403) : la page de commande restait vide.
-- Les lignes restent filtrées par les règles RLS existantes (le client ne voit que ses colis).
grant select (cancel_courier_gnf, cancel_provider_gnf) on public.parcels to authenticated;
