'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient, useSession } from '@hailandx/kit';

interface ShopChip { slug: string; name: string; initials: string; color: string; logoUrl: string | null; isNew: boolean }

/**
 * « La rue » : les boutiques, les plus proches d'abord quand on connaît la position (adresse enregistrée, sinon bouton « Autour de moi »).
 * Seule la distance arrondie (0,1 km) est connue du navigateur : jamais les coordonnées de la boutique.
 */
export function RueStrip({ shops, real }: { shops: ShopChip[]; real: boolean }) {
  const session = useSession();
  const [dist, setDist] = useState<Record<string, number> | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function fetchDistances(lat: number, lng: number) {
    const sb = browserClient(); if (!sb) return;
    const { data } = await sb.rpc('fn_shops_nearby', { p_lat: lat, p_lng: lng });
    const m: Record<string, number> = {};
    for (const r of (data as { slug: string; distance_km: string | number }[]) ?? []) m[r.slug] = Number(r.distance_km);
    setDist(m);
  }
  // Adresse enregistrée : la position de livraison du compte (lue par la base, jamais stockée dans la page).
  useEffect(() => {
    const sb = browserClient(); if (!real || !sb || !session) return;
    sb.from('declarations').select('anchor_point,gps_point').eq('user_id', session.user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      const pt = (data as { anchor_point: { coordinates: [number, number] } | null; gps_point: { coordinates: [number, number] } | null } | null);
      const c = pt?.anchor_point?.coordinates ?? pt?.gps_point?.coordinates;
      if (c) void fetchDistances(c[1], c[0]);
    });
  }, [real, session]);

  function around() {
    setNote(null);
    if (!navigator.geolocation) return setNote('Localisation indisponible sur cet appareil.');
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setAsking(false); void fetchDistances(p.coords.latitude, p.coords.longitude); },
      () => { setAsking(false); setNote('Position refusée ou introuvable : enregistrez votre adresse pour voir les boutiques proches.'); },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 120_000 },
    );
  }
  const sorted = dist ? [...shops].sort((a, b) => (dist[a.slug] ?? 1e9) - (dist[b.slug] ?? 1e9)) : shops;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3.5 overflow-x-auto pb-1">
        {sorted.map((s) => (
          <Link key={s.slug} href={`/b/${s.slug}`} className="flex w-[64px] shrink-0 flex-col items-center gap-1.5">
            <span className={`flex h-[58px] w-[58px] rounded-[20px] p-[3px] ${s.isNew ? 'bg-blue' : 'bg-line'}`}>
              <span className="flex flex-1 items-center justify-center overflow-hidden rounded-[17px] border-2 border-bg font-display text-[15px] font-bold" style={{ background: s.color }}>{s.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logoUrl} alt="" className="h-full w-full object-cover" /> : s.initials}</span>
            </span>
            <span className="w-[64px] truncate text-center text-[11px] font-semibold">{s.name}</span>
            {dist && dist[s.slug] !== undefined && <span className="-mt-1 text-[10.5px] font-bold text-blue-ink">{dist[s.slug]!.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} km</span>}
          </Link>
        ))}
      </div>
      {real && !dist && <button type="button" onClick={around} disabled={asking} className="h-9 self-start rounded-full border border-line bg-card px-3.5 text-[12.5px] font-bold">{asking ? 'Recherche…' : '📍 Boutiques autour de moi'}</button>}
      {dist && <p className="text-[11.5px] font-semibold text-muted">Les plus proches d’abord (distance à vol d’oiseau).</p>}
      {note && <p role="alert" className="text-[12px] font-semibold text-muted">{note}</p>}
    </div>
  );
}
