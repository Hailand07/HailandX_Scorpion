-- Stockage privé des photos de remise (Supabase Storage). Non rejoué par le banc d'essai local (pas de schéma `storage`).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hx-preuves', 'hx-preuves', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Écriture : le livreur du colis, colis retiré, dans <livreur>/<colis>/… ; lecture : lui, l'acheteur, le vendeur et l'équipe.
create policy hx_preuves_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'hx-preuves' and public.fn_proof_writable(name));
create policy hx_preuves_select on storage.objects for select to authenticated
  using (bucket_id = 'hx-preuves' and public.fn_proof_readable(name));
