import { NextResponse } from 'next/server';
import { ccpStatus } from '@/lib/chapchappay';
import { buyerClient, payEnv, serviceClient } from '@/lib/payServer';
import { settle } from '@/lib/settlePayment';

/**
 * Retour de l'acheteur après la page de paiement : on demande le statut à Chap Chap Pay (au cas où la notification
 * tarde ou s'est perdue) et on l'applique. Ne crée jamais de second paiement.
 */
export async function POST(req: Request) {
  const env = payEnv();
  if (!env) return NextResponse.json({ error: 'paiement non configuré' }, { status: 503 });
  const buyer = buyerClient(env, req);
  if (!buyer) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  const { order } = (await req.json().catch(() => ({}))) as { order?: string };
  if (!order) return NextResponse.json({ error: 'Commande invalide.' }, { status: 400 });
  // La règle de lecture de la base ne montre la commande qu'à son acheteur (ou à l'équipe).
  const mine = await buyer.from('orders').select('id,payment_status').eq('id', order).maybeSingle();
  if (!mine.data) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  if ((mine.data as { payment_status: string }).payment_status !== 'en_attente') return NextResponse.json({ state: (mine.data as { payment_status: string }).payment_status });

  const sb = serviceClient(env);
  const pay = await sb.from('payments').select('operation_id,provider_status').eq('order_id', order).maybeSingle();
  const op = (pay.data as { operation_id: string | null } | null)?.operation_id;
  if (!op) return NextResponse.json({ state: (pay.data as { provider_status: string | null } | null)?.provider_status ?? 'aucun' });
  const r = await ccpStatus(env.ccpKey, op);
  if (!r) return NextResponse.json({ state: 'inconnu' });
  const out = await settle(sb, order, r);
  return NextResponse.json({ state: out.state });
}
