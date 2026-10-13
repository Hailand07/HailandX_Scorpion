-- Le téléphone de l'acheteur n'est plus lisible directement (ni par le vendeur, ni par le livreur) : il sera exposé au livreur
-- seulement pendant sa mission, par une fonction dédiée. APPLIQUÉE le 2026-10-13 avec l'accord du fondateur.
revoke select on public.orders from anon, authenticated;
grant select (id, buyer_id, delivery_declaration_id, payment_method, payment_status, subtotal_gnf, delivery_fee_gnf, total_gnf, source, created_at) on public.orders to authenticated;
