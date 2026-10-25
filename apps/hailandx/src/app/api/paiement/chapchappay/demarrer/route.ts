import { NextResponse } from 'next/server';
import { ccpCreate, orderRefFor } from '@/lib/chapchappay';
import { buyerClient, clean, payEnv, serviceClient } from '@/lib/payServer';

/**
 * L'acheteur clique « Payer » → lien de paiement Chap Chap Pay (Orange Money, MTN MoMo, PayCard, carte…).
 * Un lien encore valide est réutilisé : le client ne doit jamais pouvoir payer deux fois la même commande.
 */
export async function POST(req: Request) {
  const env = payEnv();
  if (!env) return NextResponse.json({ error: 'Le paiement en ligne n’est pas encore configuré.' }, { status: 503 });
  const buyer = buyerClient(env, req);
  if (!buyer) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  const { order } = (await req.json().catch(() => ({}))) as { order?: string };
  if (!order || !/^[0-9a-f-]{36}$/i.test(order)) return NextResponse.json({ error: 'Commande invalide.' }, { status: 400 });

  // La base vérifie que c'est bien sa commande, qu'elle se paie en ligne, et le mode (essai équipe ou ouvert à tous).
  const start = await buyer.rpc('fn_pay_start', { p_order: order });
  if (start.error) return NextResponse.json({ error: clean(start.error.message) }, { status: 409 });
  const row = (start.data as { provider: string; amount_gnf: number }[])[0];
  const sb = serviceClient(env);
  const mode = ((await sb.from('settings').select('value').eq('key', 'payment_mode').maybeSingle()).data as { value: string } | null)?.value ?? 'simulation';
  if (!row || !mode.startsWith('chapchappay')) return NextResponse.json({ error: 'Le paiement en ligne est en mode essai (simulation).' }, { status: 409 });

  const pay = await sb.from('payments').select('checkout_url,provider_status').eq('order_id', order).maybeSingle();
  const cur = pay.data as { checkout_url: string | null; provider_status: string | null } | null;
  if (cur?.checkout_url) return NextResponse.json({ url: cur.checkout_url, reused: true });

  const origin = new URL(req.url).origin;
  try {
    const op = await ccpCreate(env.ccpKey, env.ccpEnc, {
      amount: row.amount_gnf, orderRef: orderRefFor(order), description: `Commande HailandX ${order.slice(0, 8).toUpperCase()}`,
      returnUrl: `${origin}/commandes/${order}?paiement=retour`, cancelUrl: `${origin}/commandes/${order}?paiement=annule`,
      callbackUrl: `${origin}/api/paiement/chapchappay/notification`,
    });
    const att = await sb.rpc('fn_pay_attach', { p_order: order, p_operation: op.operationId, p_url: op.paymentUrl, p_test: mode !== 'chapchappay' });
    if (att.error) return NextResponse.json({ error: clean(att.error.message) }, { status: 409 });
    return NextResponse.json({ url: op.paymentUrl });
  } catch (e) {
    return NextResponse.json({ error: `Chap Chap Pay indisponible : ${clean((e as Error).message)}` }, { status: 502 });
  }
}
