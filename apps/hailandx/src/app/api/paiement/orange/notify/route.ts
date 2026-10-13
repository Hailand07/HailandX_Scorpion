import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { parseNotice, verifySignature } from '@/lib/orange';

/**
 * Notification de paiement Orange Money → bloque l'argent en séquestre (`fn_payment_confirm`, clé de service).
 * Inactive (503) tant que les secrets ne sont pas configurés côté serveur : OM_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY (Vercel, jamais dans le dépôt).
 */
export async function POST(req: Request) {
  const secret = process.env.OM_WEBHOOK_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !serviceKey || !url) return NextResponse.json({ error: 'paiement non configuré' }, { status: 503 });

  const raw = await req.text();
  const signature = req.headers.get('x-signature') ?? req.headers.get('x-orange-signature');
  if (!verifySignature(secret, raw, signature)) return NextResponse.json({ error: 'signature invalide' }, { status: 401 });

  const notice = parseNotice(raw);
  if (!notice) return NextResponse.json({ error: 'avis illisible' }, { status: 400 });
  if (notice.status !== 'SUCCESS') return NextResponse.json({ ok: true, ignored: notice.status });

  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.rpc('fn_payment_confirm', { p_order: notice.orderId, p_ref: notice.reference, p_amount: notice.amountGnf });
  // Un avis déjà traité est accepté (le fournisseur peut le renvoyer) ; toute autre erreur est signalée pour qu'il réessaie.
  if (error && !/déjà payée/.test(error.message)) return NextResponse.json({ error: 'confirmation refusée' }, { status: 422 });
  return NextResponse.json({ ok: true });
}
