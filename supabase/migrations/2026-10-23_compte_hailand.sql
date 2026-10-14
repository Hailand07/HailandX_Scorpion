-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- COMPTE HAILAND UNIQUE — phase 3 du plan « Compte Hailand unique et passerelles » (HAILANDX.md §31, ECOSYSTEME §14).
--
-- 1. PASSAGE DE SESSION (solution provisoire, sans nom de domaine commun) : quand une application Hailand en ouvre une autre,
--    elle crée un code à usage unique (2 minutes, lié à l'application d'arrivée). L'application d'arrivée le remet à la
--    fonction serveur `passage` (Edge Function, clé de service), qui le consomme ici puis ouvre une session NEUVE pour le même
--    compte. Le code n'est jamais stocké en clair (empreinte SHA-256) ; personne ne lit la table depuis une application.
-- 2. RÉSUMÉ DU COMPTE : après le code SMS, l'écran « Ce numéro a déjà un compte Hailand » montre ce que le compte contient
--    déjà (adresses, boutique, livreur, équipe), uniquement pour la personne connectée.
--
-- APPLIQUÉE EN PRODUCTION le 2026-10-14 (accord du fondateur), en deux migrations : compte_hailand_table, compte_hailand_fonctions.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.account_passages (
  code_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  cible text not null check (cible in ('navigationx', 'hailandx', 'vendeur', 'console', 'flotte')),
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '2 minutes',
  utilise_le timestamptz
);
create index if not exists account_passages_user_idx on public.account_passages (user_id, cree_le desc);
alter table public.account_passages enable row level security;
-- Aucune politique : ni les visiteurs ni les comptes connectés ne lisent ou n'écrivent la table directement.
revoke all on table public.account_passages from anon, authenticated;

/** Crée un code de passage pour le compte connecté, vers l'application `p_cible`. Renvoie le code en clair (une seule fois). */
create or replace function public.fn_passage_creer(p_cible text)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_anonymous', 'false') = 'true' then
    raise exception 'Connexion requise pour ouvrir une autre application Hailand.';
  end if;
  if p_cible is null or p_cible not in ('navigationx', 'hailandx', 'vendeur', 'console', 'flotte') then
    raise exception 'Application Hailand inconnue : %', p_cible;
  end if;
  -- Garde-fou contre les abus : au plus 10 codes encore valides par compte. (Pas de ménage automatique : le connecteur de
  -- production bloque les migrations qui contiennent une suppression ; les lignes usées ou expirées sont sans effet.)
  if (select count(*) from public.account_passages where user_id = v_uid and utilise_le is null and expire_le > now()) >= 10 then
    raise exception 'Trop de passages en attente. Patientez deux minutes.';
  end if;
  v_code := translate(encode(gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.account_passages (code_hash, user_id, cible) values (encode(digest(v_code, 'sha256'), 'hex'), v_uid, p_cible);
  return v_code;
end $$;
revoke execute on function public.fn_passage_creer(text) from public, anon;
grant execute on function public.fn_passage_creer(text) to authenticated;

/**
 * Consomme un code de passage (réservé à la fonction serveur, clé de service) : renvoie le compte s'il est valide, non utilisé,
 * non expiré et destiné à `p_cible` ; sinon NULL. Un code ne sert qu'une fois, même en cas d'échec ensuite.
 */
create or replace function public.fn_passage_consommer(p_code text, p_cible text)
returns uuid
language sql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
  update public.account_passages
     set utilise_le = now()
   where code_hash = encode(digest(coalesce(p_code, ''), 'sha256'), 'hex')
     and cible = p_cible
     and utilise_le is null
     and expire_le > now()
  returning user_id
$$;
revoke execute on function public.fn_passage_consommer(text, text) from public, anon, authenticated;
grant execute on function public.fn_passage_consommer(text, text) to service_role;

/** Ce que le compte connecté contient déjà, toutes applications confondues (écran « Ce numéro a déjà un compte Hailand »). */
create or replace function public.fn_compte_resume()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'adresses', (select count(*) from public.declarations d where d.user_id = auth.uid() and coalesce(d.status, 'active') = 'active'),
    'niveau', (select max(case when d.certified_building_id is not null then 3 else d.detected_level end) from public.declarations d
                where d.user_id = auth.uid() and coalesce(d.status, 'active') = 'active'),
    'boutique', (select s.name from public.shops s where s.owner_id = auth.uid() order by s.created_at limit 1),
    'livreur', exists (select 1 from public.couriers c where c.user_id = auth.uid()),
    'equipe', exists (select 1 from public.agents a where a.id = auth.uid() and a.active)
  ) end
$$;
revoke execute on function public.fn_compte_resume() from public, anon;
grant execute on function public.fn_compte_resume() to authenticated;
