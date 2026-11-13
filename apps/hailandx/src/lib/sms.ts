import type { SupabaseClient } from '@supabase/supabase-js';
import { formatGnf } from '@hailandx/commerce';
import { VENDEUR_URL } from '@hailandx/kit/src/links';

/**
 * SMS au vendeur à chaque commande payée (refonte §51, décision du fondateur). Côté serveur seulement.
 * Fournisseur : Twilio (déjà utilisé par Supabase pour les codes de connexion) — variables Vercel `TWILIO_ACCOUNT_SID`,
 * `TWILIO_AUTH_TOKEN` et `TWILIO_FROM` (numéro ou identifiant d'expéditeur). Sans elles, rien n'est envoyé (la notification
 * dans l'application reste). Un échec d'envoi ne bloque jamais la confirmation du paiement.
 */
export interface SmsConfig { sid: string; token: string; from: string }
export function smsConfig(): SmsConfig | null {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  return sid && token && from ? { sid, token, from } : null;
}

/** Numéro guinéen au format international (+224…) ; null si inutilisable. */
export function e164(phone: string | null | undefined): string | null {
  const d = (phone ?? '').replace(/[^0-9]/g, '');
  if (/^224[0-9]{9}$/.test(d)) return `+${d}`;
  if (/^6[0-9]{8}$/.test(d)) return `+224${d}`;
  return /^[1-9][0-9]{7,14}$/.test(d) ? `+${d}` : null;
}

/** Texte court (un seul SMS) : montant des articles, et où préparer. */
export function vendorOrderText(shopName: string, subtotalGnf: number, articles: number): string {
  return `HailandX - ${shopName} : nouvelle commande payee, ${articles} article${articles > 1 ? 's' : ''}, ${formatGnf(subtotalGnf)}. Preparez-la : ${VENDEUR_URL}/commandes`;
}

export async function sendSms(cfg: SmsConfig, to: string, body: string): Promise<boolean> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.sid)}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: cfg.from, Body: body }),
  });
  return res.ok;
}

interface ParcelRow { shop_id: string; subtotal_gnf: number; shops: { name: string; whatsapp: string | null } | null; order_items: { quantity: number }[] | null }

/** Prévient chaque boutique de la commande (une commande peut toucher plusieurs boutiques). Appelée une seule fois, à la confirmation. */
export async function notifyShopsOfOrder(sb: SupabaseClient, orderId: string, cfg: SmsConfig | null = smsConfig()): Promise<number> {
  if (!cfg) return 0;
  let sent = 0;
  try {
    const { data } = await sb.from('parcels').select('shop_id,subtotal_gnf,shops(name,whatsapp),order_items(quantity)').eq('order_id', orderId);
    for (const p of (data as unknown as ParcelRow[]) ?? []) {
      const { data: m } = await sb.from('shop_members').select('user_id').eq('shop_id', p.shop_id).eq('role', 'proprietaire').limit(1).maybeSingle();
      const uid = (m as { user_id: string } | null)?.user_id;
      const phone = uid ? (await sb.auth.admin.getUserById(uid)).data.user?.phone : null;
      const to = e164(phone) ?? e164(p.shops?.whatsapp);
      if (!to) continue;
      const articles = (p.order_items ?? []).reduce((n, i) => n + i.quantity, 0) || 1;
      if (await sendSms(cfg, to, vendorOrderText(p.shops?.name ?? 'votre boutique', p.subtotal_gnf, articles)).catch(() => false)) sent++;
    }
  } catch { /* le SMS est un plus : jamais bloquant */ }
  return sent;
}
