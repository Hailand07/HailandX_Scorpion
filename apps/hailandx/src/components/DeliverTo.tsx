'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Row { declared_label: string | null; hailand_code: string | null; quartiers: { nom: string } | null }

/** « Livrer à » en tête de l'accueil : l'adresse la plus récente du compte, ou l'invitation à en enregistrer une. */
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
    <Link href="/adresse" aria-label={`Adresse de livraison : ${text}`} className="flex h-10 items-center gap-2 rounded-full bg-blue-soft px-3.5 text-[13px] font-bold text-blue-ink">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
      <span className="min-w-0 flex-1 truncate">{row === undefined && session !== null ? 'Livrer à…' : row ? `Livrer à : ${text}` : text}</span>
      <span aria-hidden="true">›</span>
    </Link>
  );
}
