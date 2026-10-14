'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Row { declared_label: string | null; hailand_code: string | null; quartiers: { nom: string } | null }

/** « Livrer à » en tête de l'accueil (ligne discrète, v2) : l'adresse la plus récente du compte, ou l'invitation à en enregistrer une. */
export function DeliverTo() {
  const session = useSession();
  const [row, setRow] = useState<Row | null | undefined>(undefined);
  useEffect(() => {
    const sb = browserClient();
    if (!sb || !session) { setRow(null); return; }
    sb.from('declarations').select('declared_label,hailand_code,quartiers(nom)').eq('user_id', session.user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setRow((data as unknown as Row | null) ?? null));
  }, [session]);
  const text = row ? `${row.declared_label ?? 'Mon adresse'}${row.quartiers?.nom ? ` · ${row.quartiers.nom}` : ''}` : 'Où livrer ? Ajouter mon adresse';
  return (
    <Link href="/adresse" aria-label={`Adresse de livraison : ${text}`} className="flex min-h-9 items-center gap-2 text-[13px] font-semibold text-muted">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3346f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
      {row ? <span className="min-w-0 truncate">Livrer à <b className="font-extrabold text-ink">{text}</b></span> : <span className="min-w-0 truncate font-extrabold text-blue-ink">{row === undefined && session !== null ? 'Livrer à…' : text}</span>}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6372" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </Link>
  );
}
