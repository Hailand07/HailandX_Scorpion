'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BackHeader } from './Screen';
import { browserClient } from './supabase';
import { useSession } from './useSession';
import type { SupabaseClient } from '@supabase/supabase-js';

interface N { id: number; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }
const KIND: Record<string, string> = { commande: '🛍', suivi: '🚚', litige: '⚠️', avis: '★', certification: '✅' };

/** Les notifications du vendeur ont un lien « /vendeur… » ; chaque application ne montre que les siennes. */
export const SELLER_PREFIX = '/vendeur';
/** Lien d'une notification dans l'application vendeur : « /vendeur/commandes » → « /commandes ». */
const sellerLink = (l: string) => l.replace(/^\/vendeur(?=\/|$)/, '') || '/';

/**
 * Centre de notifications : commandes, suivi du colis, avis, litiges. Alertes du navigateur possibles tant que l'application est ouverte.
 * `scope` sépare les applications : l'acheteur ne voit pas les notifications de sa boutique, et inversement.
 */
export function Notifications({ scope, backHref }: { scope: 'acheteur' | 'vendeur'; backHref: string }) {
  const session = useSession();
  const [list, setList] = useState<N[] | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | 'indisponible'>('indisponible');
  const seen = useRef<number>(0);
  useEffect(() => { if (typeof Notification !== 'undefined') setPerm(Notification.permission); }, []);

  const load = useCallback(async () => {
    const sb = browserClient(); if (!sb || !session) return;
    const q = sb.from('notifications').select('id,kind,title,body,link,read_at,created_at');
    const { data } = await (scope === 'vendeur' ? q.like('link', `${SELLER_PREFIX}%`) : q.or(`link.is.null,link.not.like.${SELLER_PREFIX}%`)).order('id', { ascending: false }).limit(60);
    const rows = (data as N[]) ?? [];
    setList(rows);
    // Alerte du navigateur pour ce qui arrive pendant que la page est ouverte (pas d'envoi hors application : voir HAILANDX.md §23).
    const fresh = rows.filter((r) => !r.read_at && r.id > seen.current);
    if (seen.current > 0 && typeof Notification !== 'undefined' && Notification.permission === 'granted') fresh.forEach((r) => new Notification(r.title, { body: r.body ?? undefined }));
    seen.current = Math.max(seen.current, ...rows.map((r) => r.id), 0);
  }, [session, scope]);
  useEffect(() => { void load(); const i = setInterval(load, 20_000); return () => clearInterval(i); }, [load]);

  async function readAll() { const ids = (list ?? []).filter((n) => !n.read_at).map((n) => n.id); if (ids.length) await browserClient()?.rpc('fn_notifications_read', { p_ids: ids }); await load(); }
  async function openOne(n: N) { if (!n.read_at) await browserClient()?.rpc('fn_notifications_read', { p_ids: [n.id] }); }
  const unread = (list ?? []).filter((n) => !n.read_at).length;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-4">
      <BackHeader href={backHref} title="Notifications" label="Retour" right={unread > 0 ? <button type="button" onClick={readAll} className="h-10 rounded-full border border-line px-3.5 text-[12.5px] font-bold">Tout marquer lu</button> : null} />
      {session === null && <Link href="/connexion?next=/notifications" className="font-bold text-blue-ink">Se connecter</Link>}
      {perm === 'default' && <button type="button" onClick={async () => setPerm(await Notification.requestPermission())} className="rounded-2xl bg-blue-soft px-4 py-3 text-left text-[13px] font-bold text-blue-ink">Activer les alertes du navigateur (tant que cette page reste ouverte)</button>}
      {list?.length === 0 && <p className="text-[14px] font-medium text-muted">{scope === 'vendeur' ? 'Rien pour l’instant. Vous serez prévenu ici des nouvelles commandes, des avis et des litiges.' : 'Rien pour l’instant. Vous serez prévenu ici du suivi de vos colis, des avis et des litiges.'}</p>}
      {list?.map((n) => {
        const link = n.link ? (scope === 'vendeur' ? sellerLink(n.link) : n.link) : null;
        const inner = (<><span aria-hidden="true" className="mt-0.5 text-[18px]">{KIND[n.kind] ?? '•'}</span><span className="flex min-w-0 flex-1 flex-col"><span className={`text-[14px] ${n.read_at ? 'font-semibold' : 'font-extrabold'}`}>{n.title}</span>{n.body && <span className="truncate text-[12.5px] font-medium text-muted">{n.body}</span>}<span className="text-[11px] font-semibold text-muted">{new Date(n.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>{!n.read_at && <span aria-label="Non lue" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue" />}</>);
        const cls = `flex items-start gap-3 rounded-2xl border px-4 py-3 ${n.read_at ? 'border-line-soft bg-card' : 'border-blue bg-blue-soft'}`;
        return link ? <Link key={n.id} href={link} onClick={() => openOne(n)} className={cls}>{inner}</Link> : <div key={n.id} className={cls}>{inner}</div>;
      })}
    </main>
  );
}

/** Nombre de notifications non lues d'une application. */
export async function unreadNotifications(sb: SupabaseClient, scope: 'acheteur' | 'vendeur'): Promise<number> {
  const q = sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  const { count } = await (scope === 'vendeur' ? q.like('link', `${SELLER_PREFIX}%`) : q.or(`link.is.null,link.not.like.${SELLER_PREFIX}%`));
  return count ?? 0;
}
