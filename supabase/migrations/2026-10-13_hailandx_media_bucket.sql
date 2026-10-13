-- Stockage des images de HailandX (photos de produits, logos). APPLIQUÉE le 2026-10-13 avec l'accord du fondateur (ajout seulement).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hx-media', 'hx-media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Lecture publique des images (vitrine) ; écriture seulement dans son propre dossier <identifiant du compte>/…
create policy hx_media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'hx-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy hx_media_update_own on storage.objects for update to authenticated
  using (bucket_id = 'hx-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'hx-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy hx_media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'hx-media' and (storage.foldername(name))[1] = auth.uid()::text);
