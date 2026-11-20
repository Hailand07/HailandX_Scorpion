'use client';
import { useEffect, useState } from 'react';
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

  // iPhone (§63) : Safari n'ouvre WhatsApp, ne copie et n'ouvre le menu de partage QUE pendant le toucher lui-même ; une attente
  // réseau entre le toucher et l'action annule tout (ça marchait sur Android, pas sur iPhone). Les liens suivis sont donc
  // préparés dès l'ouverture de la fenêtre ; au toucher, on utilise le lien prêt (ou le lien direct s'il ne l'est pas encore).
  const [links, setLinks] = useState<Partial<Record<Net, string>>>({});
  useEffect(() => {
    let live = true;
    (['whatsapp', 'tiktok', 'facebook', 'autre'] as Net[]).forEach((net) => {
      trackedLink(target, net, direct).then((url) => { if (live) setLinks((l) => ({ ...l, [net]: url })); }).catch(() => { /* lien direct en secours */ });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.shopId, target.offerId]);
  const url = (net: Net) => links[net] ?? direct;

  function share(net: Net) {
    setNote(null);
    const u = url(net);
    if (net === 'whatsapp') {
      // Ouverture directe, dans le geste : sur iPhone, WhatsApp s'ouvre ; dans l'application installée aussi.
      window.location.href = `https://wa.me/?text=${encodeURIComponent(`${text} ${u}`)}`;
    } else if (net === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`, '_blank', 'noopener');
    } else {
      setBusy(net);
      navigator.clipboard.writeText(u)
        .then(() => setNote({ ok: true, text: net === 'tiktok' ? 'Lien copié : collez-le dans votre bio TikTok ou en commentaire épinglé de votre vidéo.' : 'Lien copié : collez-le où vous voulez (bio Instagram, statut, SMS…).' }))
        .catch(() => setNote({ ok: false, text: 'Copie refusée par le téléphone : appuyez longuement sur le lien ci-dessous pour le copier.' }))
        .finally(() => setBusy(null));
    }
  }

  function native() {
    navigator.share({ title: label, text, url: url('autre') }).catch(() => { /* partage annulé */ });
  }

  const btn = 'flex h-[54px] items-center justify-center gap-2 rounded-2xl text-[14px] font-extrabold disabled:opacity-50';
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
        <p className="text-[13px] font-semibold leading-relaxed text-muted">{target.productSlug ? 'Le client qui clique arrive directement sur ce produit, prêt à commander.' : 'Le client qui clique arrive sur votre vitrine.'} Chaque réseau a son lien : vous verrez d’où viennent vos ventes dans Statistiques.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!!busy} onClick={() => void share('whatsapp')} className={`${btn} bg-[#1f8f4e] text-white`}>WhatsApp</button>
          <button type="button" disabled={!!busy} onClick={() => void share('tiktok')} className={`${btn} bg-ink text-white`}>TikTok (copier)</button>
          <button type="button" disabled={!!busy} onClick={() => void share('facebook')} className={`${btn} bg-[#1b4fd8] text-white`}>Facebook</button>
          <button type="button" disabled={!!busy} onClick={() => void share('autre')} className={`${btn} border border-line`}>Copier le lien</button>
        </div>
        {typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" onClick={() => void native()} className="h-11 rounded-2xl bg-bg text-[14px] font-extrabold">Autres applications…</button>}
        {/* Lien sélectionnable : copie à la main si le téléphone refuse la copie automatique. */}
        <p className="select-all break-all rounded-xl bg-bg px-3 py-2 text-[12px] font-semibold text-muted">{url('autre')}</p>
        {note && <p role="status" className={`text-[13px] font-bold ${note.ok ? 'text-ok' : 'text-danger'}`}>{note.text}</p>}
      </div>
    </div>
  );
}
