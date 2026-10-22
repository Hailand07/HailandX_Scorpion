-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- QUESTIONS-RÉPONSES SUR LES PRODUITS ET « SOUVENT ACHETÉS ENSEMBLE » (demande du fondateur, 2026-10-22 ; HAILANDX.md §35).
--
-- A. `product_questions` : un acheteur connecté pose une question sur une fiche produit ; un vendeur qui vend ce produit
--    (offre active) répond publiquement ; l'équipe peut masquer une question ou une réponse abusive (journal de la console).
--    Lecture publique des questions visibles, SANS l'identité de l'auteur (colonnes accordées une par une).
--    Écriture uniquement par les fonctions ci-dessous (5 questions par compte et par 24 h au plus).
-- B. `fn_bought_together` : produits achetés dans les mêmes commandes qu'un produit donné. Seuls des nombres agrégés
--    sortent, et seulement à partir de 2 commandes distinctes (aucune commande isolée ne peut être devinée).
-- Ajouts seulement ; aucune donnée existante n'est modifiée.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- ── A. Questions-réponses ───────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.product_questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.catalog_products (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  question text not null check (length(btrim(question)) between 5 and 500),
  answer text check (answer is null or length(btrim(answer)) between 2 and 1000),
  answer_shop_id uuid references public.shops (id) on delete set null,
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  hidden boolean not null default false,
  hidden_reason text,
  created_at timestamptz not null default now()
);
create index if not exists product_questions_product_idx on public.product_questions (product_id, created_at desc);
create index if not exists product_questions_author_idx on public.product_questions (author_id, created_at desc);
alter table public.product_questions enable row level security;
drop policy if exists product_questions_read on public.product_questions;
create policy product_questions_read on public.product_questions for select to anon using (not hidden);
drop policy if exists product_questions_read_auth on public.product_questions;
create policy product_questions_read_auth on public.product_questions for select to authenticated using (not hidden or public.is_admin());
revoke all on public.product_questions from anon, authenticated;
-- Lecture publique sans l'auteur ni le compte qui a répondu.
grant select (id, product_id, question, answer, answer_shop_id, answered_at, hidden, created_at) on public.product_questions to anon, authenticated;

/** Poser une question sur un produit (compte connecté). Prévient les boutiques qui vendent ce produit. */
create or replace function public.fn_ask_question(p_product uuid, p_question text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); p public.catalog_products; v_id uuid; s record;
begin
  if u is null then raise exception 'connexion requise pour poser une question'; end if;
  select * into p from public.catalog_products where id = p_product and status = 'actif';
  if not found then raise exception 'produit introuvable'; end if;
  if length(btrim(coalesce(p_question, ''))) not between 5 and 500 then raise exception 'la question doit faire entre 5 et 500 caractères'; end if;
  if (select count(*) from public.product_questions where author_id = u and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'limite atteinte : 5 questions par jour';
  end if;
  insert into public.product_questions (product_id, author_id, question) values (p_product, u, btrim(p_question)) returning id into v_id;
  for s in select distinct o.shop_id from public.offers o join public.shops sh on sh.id = o.shop_id where o.product_id = p_product and o.active and sh.status = 'ouverte' loop
    perform private.notify_shop(s.shop_id, 'question', 'Nouvelle question sur « ' || p.name || ' »', left(btrim(p_question), 140), '/vendeur/questions');
  end loop;
  return v_id;
end $$;

/** Répondre (ou corriger sa réponse) : membre d'une boutique qui vend ce produit, ou l'équipe. Prévient l'auteur. */
create or replace function public.fn_answer_question(p_question uuid, p_answer text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); q public.product_questions; v_shop uuid; v_slug text; v_name text;
begin
  if u is null then raise exception 'connexion requise'; end if;
  select * into q from public.product_questions where id = p_question for update;
  if not found or q.hidden then raise exception 'question introuvable'; end if;
  if length(btrim(coalesce(p_answer, ''))) not between 2 and 1000 then raise exception 'la réponse doit faire entre 2 et 1 000 caractères'; end if;
  select o.shop_id into v_shop from public.offers o join public.shop_members m on m.shop_id = o.shop_id and m.user_id = u
   where o.product_id = q.product_id and o.active order by (o.shop_id = q.answer_shop_id) desc limit 1;
  if v_shop is null and not public.is_admin() then raise exception 'seule une boutique qui vend ce produit peut répondre'; end if;
  if q.answer_shop_id is not null and q.answer_shop_id is distinct from v_shop and not public.is_admin() then
    raise exception 'une autre boutique a déjà répondu à cette question';
  end if;
  update public.product_questions set answer = btrim(p_answer), answer_shop_id = coalesce(v_shop, answer_shop_id), answered_by = u, answered_at = now() where id = p_question;
  select slug, name into v_slug, v_name from public.catalog_products where id = q.product_id;
  if q.answer is null then
    perform private.notify(q.author_id, 'reponse', 'Réponse à votre question sur « ' || v_name || ' »', left(btrim(p_answer), 140), '/p/' || v_slug);
  end if;
end $$;

/** Questions sur les produits que vend ma boutique (espace vendeur), les plus récentes d'abord. */
create or replace function public.fn_shop_questions(p_shop uuid) returns table (
  id uuid, product_id uuid, product_slug text, product_name text, question text, answer text, answered_by_me boolean, answered_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public, pg_temp as $$
  select q.id, c.id, c.slug, c.name, q.question, q.answer, q.answer_shop_id = p_shop, q.answered_at, q.created_at
    from public.product_questions q join public.catalog_products c on c.id = q.product_id
   where not q.hidden and public.fn_is_shop_member(p_shop)
     and exists (select 1 from public.offers o where o.product_id = q.product_id and o.shop_id = p_shop and o.active)
   order by (q.answer is null) desc, q.created_at desc
   limit 300
$$;

/** Équipe : masquer ou rétablir une question (et sa réponse). Inscrit au journal de la console. */
create or replace function public.fn_moderate_question(p_question uuid, p_hide boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare q public.product_questions;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  select * into q from public.product_questions where id = p_question for update;
  if not found then raise exception 'question introuvable'; end if;
  update public.product_questions set hidden = p_hide, hidden_reason = case when p_hide then nullif(btrim(p_note), '') else null end where id = p_question;
  perform private.journal(case when p_hide then 'question_masquee' else 'question_retablie' end, 'question', p_question::text,
    jsonb_build_object('question', left(q.question, 200)), p_note);
end $$;

-- ── B. Souvent achetés ensemble ─────────────────────────────────────────────────────────────────────────────────────────
/** Produits commandés avec p_product dans au moins 2 commandes distinctes (colis non annulés), du plus fréquent au moins fréquent. */
create or replace function public.fn_bought_together(p_product uuid, p_limit integer default 8) returns table (product_id uuid, orders bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  with mine as (
    select distinct oi.order_id from public.order_items oi
      join public.offers o on o.id = oi.offer_id
      join public.parcels pa on pa.id = oi.parcel_id
     where o.product_id = p_product and pa.status <> 'annule'
  )
  select o.product_id, count(distinct oi.order_id) as orders
    from mine join public.order_items oi on oi.order_id = mine.order_id
    join public.offers o on o.id = oi.offer_id
    join public.parcels pa on pa.id = oi.parcel_id
    join public.catalog_products c on c.id = o.product_id
   where o.product_id <> p_product and pa.status <> 'annule' and c.status = 'actif'
   group by o.product_id
  having count(distinct oi.order_id) >= 2
   order by orders desc, o.product_id
   limit least(greatest(coalesce(p_limit, 8), 1), 20)
$$;

revoke all on function public.fn_ask_question(uuid, text), public.fn_answer_question(uuid, text), public.fn_shop_questions(uuid),
  public.fn_moderate_question(uuid, boolean, text), public.fn_bought_together(uuid, integer) from public, anon, authenticated;
grant execute on function public.fn_ask_question(uuid, text), public.fn_answer_question(uuid, text), public.fn_shop_questions(uuid),
  public.fn_moderate_question(uuid, boolean, text) to authenticated;
grant execute on function public.fn_bought_together(uuid, integer) to anon, authenticated;
