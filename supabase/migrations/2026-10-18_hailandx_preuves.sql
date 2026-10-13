-- HailandX — photo de remise exigée (maquette 14 de Flotte) : le livreur photographie le colis à l'adresse ; la photo est une preuve
-- visible de l'acheteur, du vendeur et de l'équipe (stockage privé, voir 2026-10-18_hailandx_preuves_stockage.sql).
begin;

-- Chemin attendu : <identifiant du livreur>/<identifiant du colis>/<nom du fichier>.
create or replace function public.fn_proof_path_ok(p_path text, p_parcel uuid, p_courier uuid) returns boolean
language sql immutable as $$
  select p_path ~ ('^' || p_courier::text || '/' || p_parcel::text || '/[A-Za-z0-9._-]{1,80}$')
$$;

-- Remise : par code (livreur, photo obligatoire) ou par scan (acheteur, sans photo). La photo est rattachée à l'événement « remis ».
create or replace function public.fn_parcel_handover_proof(p_parcel uuid, p_method text, p_value text, p_photo text default null)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels; r text;
begin
  select * into p from public.parcels where id = p_parcel;
  if not found then raise exception 'colis introuvable'; end if;
  if p_method = 'code' and not public.fn_proof_path_ok(coalesce(p_photo, ''), p_parcel, coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)) then
    raise exception 'photo de remise obligatoire : prenez le colis en photo à l''adresse';
  end if;
  r := public.fn_parcel_handover(p_parcel, p_method, p_value);
  if r = 'remis' and p_photo is not null and public.fn_proof_path_ok(p_photo, p_parcel, p.courier_id) then
    update public.delivery_events set photo_path = p_photo
    where id = (select max(e.id) from public.delivery_events e where e.parcel_id = p_parcel and e.kind = 'remis');
  end if;
  return r;
end $$;

-- La fonction d'origine ne sert plus qu'en interne : tout passe par la remise avec preuve.
revoke execute on function public.fn_parcel_handover(uuid, text, text) from authenticated;
revoke all on function public.fn_parcel_handover_proof(uuid, text, text, text) from public, anon;
grant execute on function public.fn_parcel_handover_proof(uuid, text, text, text) to authenticated;

-- Règles du stockage privé (utilisées par les politiques de storage.objects).
create or replace function public.fn_proof_readable(p_path text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    public.is_admin()
    or split_part(p_path, '/', 1) = auth.uid()::text
    or exists (select 1 from public.parcels p join public.orders o on o.id = p.order_id
               where p.id::text = split_part(p_path, '/', 2) and (o.buyer_id = auth.uid() or public.fn_is_shop_member(p.shop_id))), false)
$$;
create or replace function public.fn_proof_writable(p_path text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(split_part(p_path, '/', 1) = auth.uid()::text
    and exists (select 1 from public.parcels p where p.id::text = split_part(p_path, '/', 2) and p.courier_id = auth.uid() and p.status = 'retire'), false)
$$;
revoke all on function public.fn_proof_readable(text), public.fn_proof_writable(text) from public, anon;
grant execute on function public.fn_proof_readable(text), public.fn_proof_writable(text) to authenticated;

commit;
