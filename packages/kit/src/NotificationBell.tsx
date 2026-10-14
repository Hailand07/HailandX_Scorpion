'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from './supabase';
import { useSession } from './useSession';
import { unreadNotifications } from './Notifications';

/** Cloche : nombre de notifications non lues (relevé toutes les 30 s tant que la page est ouverte). */
export function NotificationBell({ className = '', scope = 'acheteur' }: { className?: string; scope?: 'acheteur' | 'vendeur' }) {
  const session = useSession();
  const [count, setCount] = useState(0);
  const poll = useCallback(async () => {
    const sb = browserClient(); if (!sb || !session) return;
    setCount(await unreadNotifications(sb, scope));
  }, [session, scope]);
  useEffect(() => { void poll(); const i = setInterval(poll, 30_000); return () => clearInterval(i); }, [poll]);
  if (!session) return null;
  return (
    <Link href="/notifications" aria-label={count > 0 ? `Notifications, ${count} non lue${count > 1 ? 's' : ''}` : 'Notifications'} className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-card ${className}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12141c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      {count > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue px-1 text-[11px] font-extrabold text-white">{count > 9 ? '9+' : count}</span>}
    </Link>
  );
}
