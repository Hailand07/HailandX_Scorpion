-- HailandX — boutique : rayons, « Suivre » une boutique, numéro WhatsApp contrôlé.
-- Écart signalé au §21 de HAILANDX.md (maquette 4 : indicateurs, Suivre, WhatsApp, rayons).
begin;

-- ── WhatsApp : la colonne existe déjà ; on contrôle son format (chiffres, indicatif facultatif) ────────────────────────────
alter table public.shops add constraint shops_whatsapp_format check (whatsapp is null or whatsapp ~ '^\+?[0-9]{8,15}$');

-- ── Rayons : regroupement des produits d'une boutique (« Boubous », « Chaussures »…) ───────────────────────────────────────
create table public.shop_sections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 40),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (shop_id, name)
);
alter table public.shop_sections enable row level security;
create policy sections_read on public.shop_sections for select to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id));
create policy sections_read_anon on public.shop_sections for select to anon
  using (exists (select 1 from public.shops s where s.id = shop_id and s.status <> 'suspendue'));
create policy sections_write on public.shop_sections for all to authenticated
  using (public.fn_is_shop_member(shop_id) or public.is_admin()) with check (public.fn_is_shop_member(shop_id) or public.is_admin());
revoke truncate on public.shop_sections from authenticated;
revoke insert, update, delete, truncate on public.shop_sections from anon;

alter table public.offers add column section_id uuid references public.shop_sections (id) on delete set null;
create or replace function public.offers_section_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.section_id is not null and not exists (select 1 from public.shop_sections s where s.id = new.section_id and s.shop_id = new.shop_id) then
    raise exception 'offre : ce rayon n''appartient pas à votre boutique';
  end if;
  return new;
end $$;
create trigger offers_section_guard before insert or update on public.offers for each row execute function public.offers_section_guard();
revoke all on function public.offers_section_guard() from public, anon, authenticated;

-- ── Suivre une boutique ───────────────────────────────────────────────────────────────────────────────────────────────
create table public.shop_follows (
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index shop_follows_user_idx on public.shop_follows (user_id);
alter table public.shop_follows enable row level security;
create policy follows_read on public.shop_follows for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete, truncate on public.shop_follows from anon, authenticated;
revoke select on public.shop_follows from anon;

-- Suivre / ne plus suivre ; renvoie le nombre d'abonnés.
create or replace function public.fn_follow_shop(p_shop uuid, p_follow boolean) returns integer language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'suivi : connexion requise'; end if;
  if not exists (select 1 from public.shops s where s.id = p_shop and s.status <> 'suspendue') then raise exception 'suivi : boutique introuvable'; end if;
  if p_follow then
    insert into public.shop_follows (shop_id, user_id) values (p_shop, auth.uid()) on conflict do nothing;
  else
    delete from public.shop_follows where shop_id = p_shop and user_id = auth.uid();
  end if;
  return (select count(*)::integer from public.shop_follows where shop_id = p_shop);
end $$;
create or replace function public.fn_shop_followers(p_shop uuid) returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::integer from public.shop_follows where shop_id = p_shop
$$;
revoke all on function public.fn_follow_shop(uuid, boolean), public.fn_shop_followers(uuid) from public, anon, authenticated;
grant execute on function public.fn_follow_shop(uuid, boolean) to authenticated;
grant execute on function public.fn_shop_followers(uuid) to anon, authenticated;

commit;
