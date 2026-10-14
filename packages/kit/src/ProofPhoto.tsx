'use client';
import { useEffect, useState } from 'react';
import { browserClient } from './supabase';

/** Photo prise par le livreur à la remise : lien temporaire (10 min) vers le stockage privé, lisible par l'acheteur, le vendeur et l'équipe. */
export function ProofPhoto({ parcelId }: { parcelId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => {
    const sb = browserClient(); if (!sb) return;
    (async () => {
      const { data } = await sb.from('delivery_events').select('photo_path,created_at').eq('parcel_id', parcelId).eq('kind', 'remis').not('photo_path', 'is', null).order('id', { ascending: false }).limit(1).maybeSingle();
      const row = data as { photo_path: string; created_at: string } | null;
      if (!row) return;
      const s = await sb.storage.from('hx-preuves').createSignedUrl(row.photo_path, 600);
      if (s.data?.signedUrl) { setUrl(s.data.signedUrl); setAt(row.created_at); }
    })();
  }, [parcelId]);
  if (!url) return null;
  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-[12px] font-extrabold text-muted">Preuve de remise{at ? ` · ${new Date(at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Photo du colis prise par le livreur à la remise" className="max-h-[220px] w-full rounded-2xl border border-line-soft object-cover" />
    </figure>
  );
}
