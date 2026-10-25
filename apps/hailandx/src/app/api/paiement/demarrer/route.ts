import { NextResponse } from 'next/server';
import { ccpCreate, orderRefFor } from '@/lib/chapchappay';
import { djomyCreate, djomyPhone } from '@/lib/djomy';
import { buyerClient, clean, hasCcp, hasDjomy, payEnv, serviceClient } from '@/lib/payServer';

/**
 * L'acheteur clique « Payer » → lien de paiement chez le fournisseur choisi dans la Console (`payment_mode`) :
 * Chap Chap Pay (§43) ou Djomy (§47). Un lien encore valide est réutilisé : jamais deux paiements pour une commande.
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
  const provider = mode.startsWith('chapchappay') ? 'chapchappay' : mode.startsWith('djomy') ? 'djomy' : null;
  if (!row || !provider) return NextResponse.json({ error: 'Le paiement en ligne est en mode essai (simulation).' }, { status: 409 });

  const pay = await sb.from('payments').select('checkout_url,provider').eq('order_id', order).maybeSingle();
  const cur = pay.data as { checkout_url: string | null; provider: string } | null;
  if (cur?.checkout_url && cur.provider === provider) return NextResponse.json({ url: cur.checkout_url, reused: true });

  const origin = new URL(req.url).origin;
  const returnUrl = `${origin}/commandes/${order}?paiement=retour`; const cancelUrl = `${origin}/commandes/${order}?paiement=annule`;
  const description = `Commande HailandX ${order.slice(0, 8).toUpperCase()}`;
  const live = mode === provider; // « chapchappay » / « djomy » = production ; « …_test » = clés et serveur de test
  try {
    let op: { operationId: string; paymentUrl: string };
    if (provider === 'chapchappay') {
      if (!hasCcp(env)) return NextResponse.json({ error: 'Chap Chap Pay n’est pas encore configuré.' }, { status: 503 });
      op = await ccpCreate(env.ccpKey, env.ccpEnc, { amount: row.amount_gnf, orderRef: orderRefFor(order), description, returnUrl, cancelUrl, callbackUrl: `${origin}/api/paiement/chapchappay/notification` });
    } else {
      if (!hasDjomy(env)) return NextResponse.json({ error: 'Djomy n’est pas encore configuré.' }, { status: 503 });
      const phone = ((await sb.from('orders').select('buyer_phone').eq('id', order).maybeSingle()).data as { buyer_phone: string } | null)?.buyer_phone;
      const payerNumber = djomyPhone(phone);
      if (!payerNumber) return NextResponse.json({ error: 'Numéro de téléphone de la commande non reconnu : il faut un numéro guinéen.' }, { status: 409 });
      op = await djomyCreate({ clientId: env.djomyId, clientSecret: env.djomySecret, live }, { amount: row.amount_gnf, payerNumber, orderId: order, orderRef: orderRefFor(order), description, returnUrl, cancelUrl });
    }
    const att = await sb.rpc('fn_pay_attach', { p_order: order, p_operation: op.operationId, p_url: op.paymentUrl, p_test: !live });
    if (att.error) return NextResponse.json({ error: clean(att.error.message) }, { status: 409 });
    return NextResponse.json({ url: op.paymentUrl });
  } catch (e) {
    return NextResponse.json({ error: `${provider === 'djomy' ? 'Djomy' : 'Chap Chap Pay'} indisponible : ${clean((e as Error).message)}` }, { status: 502 });
  }
}
