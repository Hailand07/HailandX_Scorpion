import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

/**
 * Banc d'essai local de la migration de commerce : un Postgres embarqué (PGlite) avec des DÉCORS qui imitent ce dont dépend la migration
 * dans Supabase (rôles, auth.uid(), cadastre, PostGIS réduit à st_x / st_y). Rien ne touche jamais la base de production.
 */
export const U = {
  vendeur: '11111111-1111-4111-8111-111111111111',
  vendeur2: '22222222-2222-4222-8222-222222222222',
  acheteur: '33333333-3333-4333-8333-333333333333',
  acheteur2: '44444444-4444-4444-8444-444444444444',
  livreur: '55555555-5555-4555-8555-555555555555',
  livreur2: '66666666-6666-4666-8666-666666666666',
  admin: '77777777-7777-4777-8777-777777777777',
} as const;

const DECORS = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create domain public.geometry as point;
create function public.st_x(g public.geometry) returns double precision language sql immutable as $$ select (g::point)[0] $$;
create function public.st_y(g public.geometry) returns double precision language sql immutable as $$ select (g::point)[1] $$;
create table public.buildings (id text primary key, status text, is_validated boolean);
create table public.quartiers (id text primary key, nom text);
create table public.declarations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, gps_point public.geometry not null, anchor_point public.geometry,
  gps_accuracy_m real, detected_level smallint not null default 1, certified_building_id text, quartier_id text, location_floor text, location_door text, declared_landmark text);
create table public.agents (id uuid primary key, role text not null, active boolean not null default true);
create function public.is_admin() returns boolean language sql stable security definer as $$ select exists (select 1 from public.agents a where a.id = auth.uid() and a.role = 'admin' and a.active) $$;
revoke execute on function public.is_admin() from public, anon; grant execute on function public.is_admin() to authenticated;
create function public.is_agent() returns boolean language sql stable security definer as $$ select exists (select 1 from public.agents a where a.id = auth.uid() and a.active) $$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(', ')};
insert into public.agents (id, role) values ('${U.admin}', 'admin');
insert into public.quartiers (id, nom) values ('qtr-coleah', 'Coleah Domino');
`;

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(DECORS);
  await db.exec(readFileSync(new URL('../migrations/2026-10-12_hailandx_commerce.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/2026-10-13_hailandx_orders_hide_phone.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/2026-10-13_hailandx_vitrine_visiteurs.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/2026-10-13_hailandx_phase4.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/2026-10-13_hailandx_liens_suivis.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/2026-10-13_hailandx_score_init.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/2026-10-14_hailandx_litiges.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/2026-10-15_hailandx_paiement.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/2026-10-15_hailandx_paiement_remboursements.sql', import.meta.url), 'utf8'));
  return db;
}

/** Exécute `fn` en se faisant passer pour un utilisateur connecté (rôle `authenticated`) ou un visiteur (`anon`). */
export async function as<T>(db: PGlite, who: string | 'anon', fn: () => Promise<T>): Promise<T> {
  if (who === 'anon') {
    await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false)");
  } else {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${who}', false)`);
  }
  try {
    return await fn();
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Le résultat attendu est une erreur : renvoie son message (ou échoue si rien n'a été refusé). */
export async function refused(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return String((e as Error).message);
  }
  throw new Error("l'opération aurait dû être refusée");
}
