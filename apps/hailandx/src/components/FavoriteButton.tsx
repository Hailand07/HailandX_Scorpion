'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

/** Cœur « favori » d'un produit. Visiteur : renvoi vers la connexion, puis retour sur la fiche. */
export function FavoriteButton({ productId, next }: { productId: string; next: string }) {
  const router = useRouter();
  const session = useSession();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const sb = browserClient(); if (!sb || !session) return;
    sb.from('product_favorites').select('product_id').eq('product_id', productId).eq('user_id', session.user.id).maybeSingle().then(({ data }) => setOn(Boolean(data)));
  }, [session, productId]);
  async function toggle() {
    if (session === null) return router.push(`/connexion?next=${encodeURIComponent(next)}`);
    const sb = browserClient(); if (!sb) return;
    setBusy(true);
    const { error } = await sb.rpc('fn_toggle_favorite', { p_product: productId, p_on: !on });
    setBusy(false);
    if (!error) setOn(!on);
  }
  return (
    <button type="button" onClick={toggle} disabled={busy || session === undefined} aria-pressed={on} aria-label={on ? 'Retirer des favoris' : 'Ajouter aux favoris'} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card">
      <svg width="19" height="19" viewBox="0 0 24 24" fill={on ? '#e0245e' : 'none'} stroke={on ? '#e0245e' : '#12141c'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>
    </button>
  );
}
