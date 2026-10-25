import type { SupabaseClient } from '@supabase/supabase-js';
import type { CcpResult } from './chapchappay';

/**
 * Applique un résultat Chap Chap Pay ou Djomy (notification ou vérification) à la commande, au nom du serveur de paiement.
 * Seul « success » confirme (montant vérifié par la base) ; les autres statuts sont notés sans rien clore. Idempotent.
 */
export async function settle(sb: SupabaseClient, orderId: string, r: CcpResult & { feesGnf?: number | null }): Promise<{ ok: boolean; state: string; error?: string }> {
  const st = await sb.rpc('fn_pay_provider_status', { p_order: orderId, p_status: r.status, p_method: r.method });
  if (st.error) return { ok: false, state: 'erreur', error: st.error.message };
  // Frais réellement prélevés par le fournisseur (Djomy les donne) : servent au calcul d'une annulation tardive (§45).
  if (r.feesGnf != null) await sb.rpc('fn_pay_provider_fee', { p_order: orderId, p_fee: r.feesGnf });
  if (r.status !== 'success') return { ok: true, state: r.status };
  const c = await sb.rpc('fn_payment_confirm', { p_order: orderId, p_ref: r.reference ?? r.operationId, p_amount: r.amountGnf });
  if (c.error && /déjà payée/.test(c.error.message)) return { ok: true, state: 'deja_paye' };
  if (c.error) return { ok: false, state: 'refuse', error: c.error.message };
  return { ok: true, state: 'bloque' };
}

/** Commande HailandX liée à une opération (Chap Chap Pay) ou une transaction (Djomy). */
export async function orderOfOperation(sb: SupabaseClient, operationId: string): Promise<string | null> {
  const { data } = await sb.from('payments').select('order_id').eq('operation_id', operationId).maybeSingle();
  return (data as { order_id: string } | null)?.order_id ?? null;
}
