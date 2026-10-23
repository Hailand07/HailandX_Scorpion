'use client';
import { useState } from 'react';
import { formatGnf } from '@hailandx/commerce';
import { browserClient, errText, HAILANDX_URL, Icon } from '@hailandx/kit';

/** Ce qu'on partage : un produit (lien direct vers sa page) ou toute la boutique. */
export interface ShareTarget { shopId: string; shopSlug: string; shopName: string; offerId?: string; productSlug?: string; name?: string; priceGnf?: number }
export type Net = 'whatsapp' | 'tiktok' | 'facebook' | 'autre';

/** Lien suivi d'un produit ou de la boutique pour ce réseau : réutilisé s'il existe déjà, sinon créé (`fallback` sans base). */
export async function trackedLink(target: ShareTarget, net: Net, fallback: string): Promise<string> {
  const sb = browserClient();
  if (!sb) return fallback;
  const kind = target.offerId ? 'produit' : 'boutique';
  let q = sb.from('share_links').select('code').eq('shop_id', target.shopId).eq('kind', kind).eq('source', net).limit(1);
  if (target.offerId) q = q.contains('offer_ids', [target.offerId]);
  const found = await q.maybeSingle();
  if (found.data) return `${HAILANDX_URL}/s/${(found.data as { code: string }).code}`;
  const code = `${net.slice(0, 2)}${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await sb.from('share_links').insert({ code, shop_id: target.shopId, kind, offer_ids: target.offerId ? [target.offerId] : [], source: net });
  if (error) throw new Error(errText(error));
  return `${HAILANDX_URL}/s/${code}`;
}

/**
 * Partager un produit ou la boutique (HAILANDX.md §36), comme Shopify : le client qui clique arrive DIRECTEMENT sur le produit.
 * Chaque réseau reçoit son propre lien suivi (`/s/<code>`), pour savoir d'où viennent les clics et les ventes (Statistiques).
 */
export function ShareSheet({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const [busy, setBusy] = useState<Net | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const direct = target.productSlug ? `${HAILANDX_URL}/p/${target.productSlug}?b=${target.shopSlug}` : `${HAILANDX_URL}/b/${target.shopSlug}`;
  const label = target.name ?? target.shopName;
  const text = target.productSlug ? `${label}${target.priceGnf ? ` — ${formatGnf(target.priceGnf)}` : ''}\nLivré à votre porte avec HailandX :` : `Ma boutique ${target.shopName} sur HailandX :`;

  const tracked = (net: Net) => trackedLink(target, net, direct);

  async function share(net: Net) {
    setBusy(net); setNote(null);
    try {
      const url = await tracked(net);
      if (net === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
      } else if (net === 'facebook') {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener');
      } else {
        await navigator.clipboard.writeText(url);
        setNote({ ok: true, text: net === 'tiktok' ? 'Lien copié : collez-le dans votre bio TikTok ou en commentaire épinglé de votre vidéo.' : 'Lien copié : collez-le où vous voulez (bio Instagram, statut, SMS…).' });
      }
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error && e.message ? e.message : 'Copie refusée : appuyez longuement sur le lien pour le copier.' });
    }
    setBusy(null);
  }

  async function native() {
    try { await navigator.share({ title: label, text, url: await tracked('autre') }); } catch { /* partage annulé */ }
  }

  const btn = 'flex h-[52px] items-center justify-center gap-2 rounded-2xl text-[14px] font-extrabold disabled:opacity-50';
  return (
    <div role="dialog" aria-modal="true" aria-label={`Partager ${label}`} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div className="flex w-full max-w-md flex-col gap-3 rounded-t-[26px] bg-card px-5 pb-[max(22px,env(safe-area-inset-bottom))] pt-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="text-[12px] font-bold text-muted">{target.productSlug ? 'Partager ce produit' : 'Partager ma boutique'}</span>
            <span className="truncate font-display text-[18px] font-semibold">{label}</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg"><Icon name="close" size={18} /></button>
        </div>
        <p className="text-[12.5px] font-semibold leading-relaxed text-muted">{target.productSlug ? 'Le client qui clique arrive directement sur ce produit, prêt à commander.' : 'Le client qui clique arrive sur votre vitrine.'} Chaque réseau a son lien : vous verrez d’où viennent vos ventes dans Statistiques.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!!busy} onClick={() => void share('whatsapp')} className={`${btn} bg-[#1f8f4e] text-white`}>WhatsApp</button>
          <button type="button" disabled={!!busy} onClick={() => void share('tiktok')} className={`${btn} bg-ink text-white`}>TikTok (copier)</button>
          <button type="button" disabled={!!busy} onClick={() => void share('facebook')} className={`${btn} bg-[#1b4fd8] text-white`}>Facebook</button>
          <button type="button" disabled={!!busy} onClick={() => void share('autre')} className={`${btn} border border-line`}>Copier le lien</button>
        </div>
        {typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" onClick={() => void native()} className="h-11 rounded-2xl bg-bg text-[13.5px] font-extrabold">Autres applications…</button>}
        <p className="truncate rounded-xl bg-bg px-3 py-2 text-[12px] font-semibold text-muted" title={direct}>Lien direct : {direct.replace(/^https?:\/\//, '')}</p>
        {note && <p role="status" className={`text-[12.5px] font-bold ${note.ok ? 'text-ok' : 'text-[#a3321f]'}`}>{note.text}</p>}
      </div>
    </div>
  );
}
