'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient, useSession } from '@hailandx/kit';

/** « Suivre » une boutique : l'abonné retrouve ses boutiques dans « Commandes ». Visiteur : renvoi vers la connexion. */
export function FollowButton({ shopId, shopSlug, initialCount }: { shopId: string; shopSlug: string; initialCount: number }) {
  const router = useRouter();
  const session = useSession();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = browserClient();
    if (!sb || !session) return;
    sb.from('shop_follows').select('shop_id').eq('shop_id', shopId).eq('user_id', session.user.id).maybeSingle().then(({ data }) => setFollowing(Boolean(data)));
  }, [session, shopId]);

  async function toggle() {
    if (session === null) return router.push(`/connexion?next=${encodeURIComponent(`/b/${shopSlug}`)}`);
    const sb = browserClient();
    if (!sb) return;
    setBusy(true);
    const { data, error } = await sb.rpc('fn_follow_shop', { p_shop: shopId, p_follow: !following });
    setBusy(false);
    if (error) return;
    setFollowing(!following);
    if (typeof data === 'number') setCount(data);
  }

  return (
    <button type="button" onClick={toggle} disabled={busy || session === undefined} aria-pressed={following}
      className={`flex h-11 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-extrabold ${following ? 'border border-line bg-card' : 'bg-ink text-white'}`}>
      {following ? 'Suivie ✓' : 'Suivre'}<span className={`text-[12px] font-bold ${following ? 'text-muted' : 'text-white/70'}`}>{count}</span>
    </button>
  );
}
