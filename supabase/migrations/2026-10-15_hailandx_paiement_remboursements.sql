-- Console équipe : remboursements à effectuer (avec le téléphone de l'acheteur, réservé à l'équipe). APPLIQUÉE le 2026-10-15.
create or replace function public.fn_refunds_due()
returns table (buyer_id uuid, amount_gnf integer, buyer_phone text) language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  return query
    select l.account_id, sum(l.amount_gnf)::integer,
           (select o.buyer_phone from public.orders o where o.buyer_id = l.account_id order by o.created_at desc limit 1)
    from public.ledger_entries l where l.account = 'buyer' group by l.account_id having sum(l.amount_gnf) > 0;
end $$;
revoke all on function public.fn_refunds_due() from public, anon;
grant execute on function public.fn_refunds_due() to authenticated;
