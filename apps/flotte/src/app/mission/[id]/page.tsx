'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QrScanner } from '@hailandx/ui';
import { MAX_HANDOVER_ATTEMPTS, formatGnf, formatGnPhone, doorPrecision, type AddressLevel } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { mapsUrl, useGeo } from '@/lib/useGeo';

interface Info { status: 'accepte' | 'retire'; shop_name: string; shop_lat: number; shop_lng: number; buyer_phone: string; buyer_lat: number; buyer_lng: number; buyer_level: AddressLevel; buyer_accuracy_m: number | null; buyer_floor: string | null; buyer_door: string | null; buyer_landmark: string | null; cod_amount_gnf: number }

const cta = 'flex h-[54px] w-full items-center justify-center rounded-2xl bg-lime text-[15px] font-extrabold text-ink disabled:opacity-40';
const ghost = 'flex h-12 w-full items-center justify-center rounded-2xl border border-night-line bg-night-card text-[14px] font-bold';
const PRECISION = { portail: 'Niveau 3 · guidage jusqu’au portail', batiment: 'Niveau 2 · bâtiment repéré, entrée non vérifiée', zone: 'Niveau 1 · zone approximative : appelez l’acheteur et suivez son repère' } as const;

/** Mission en cours : retrait chez le vendeur (scan du QR du colis), puis remise à l'acheteur (code à 4 chiffres, ou scan par l'acheteur). */
export default function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSession();
  const sb = browserClient();
  const { fix } = useGeo(true);
  const [info, setInfo] = useState<Info | null>(null);
  const [gone, setGone] = useState(false);
  const [scan, setScan] = useState(false);
  const [code, setCode] = useState('');
  const [failures, setFailures] = useState(0);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [done, setDone] = useState<{ cod: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sb || done) return;
    const r = await sb.rpc('fn_mission_info', { p_parcel: id });
    const row = (r.data as Info[] | null)?.[0];
    if (!row) { setGone(true); return; }
    setInfo(row);
    const p = await sb.from('parcels').select('handover_failures').eq('id', id).maybeSingle();
    setFailures((p.data as { handover_failures: number } | null)?.handover_failures ?? 0);
  }, [sb, id, done]);

  useEffect(() => { if (session) void load(); }, [session, load]);
  useEffect(() => { if (session === undefined || !sb || !fix) return; void sb.rpc('fn_courier_ping', { p_lat: fix.lat, p_lng: fix.lng }); }, [sb, fix, session]);

  async function pickup(qr: string) {
    setScan(false); setBusy(true); setMsg(null);
    const { error } = await sb!.rpc('fn_parcel_pickup', { p_qr: qr, p_lat: fix?.lat ?? null, p_lng: fix?.lng ?? null });
    setBusy(false);
    if (error) return setMsg({ tone: 'err', text: error.message.replace(/^.*?:\s*/, '') });
    setMsg({ tone: 'ok', text: 'Colis retiré. L’acheteur est prévenu : en route !' });
    await load();
  }
  async function release() {
    setBusy(true);
    const { error } = await sb!.rpc('fn_courier_release', { p_parcel: id });
    setBusy(false);
    if (error) return setMsg({ tone: 'err', text: error.message.replace(/^.*?:\s*/, '') });
    window.location.href = '/';
  }
  async function handover(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setBusy(true);
    // La position la plus récente est envoyée juste avant : le serveur vérifie la proximité de l'adresse.
    if (fix) await sb!.rpc('fn_courier_ping', { p_lat: fix.lat, p_lng: fix.lng });
    const { data, error } = await sb!.rpc('fn_parcel_handover', { p_parcel: id, p_method: 'code', p_value: code });
    setBusy(false);
    if (error) return setMsg({ tone: 'err', text: error.message.replace(/^.*?:\s*/, '') });
    if (data === 'remis') return setDone({ cod: info?.cod_amount_gnf ?? 0 });
    setCode(''); await load();
    setMsg({ tone: 'err', text: 'Code incorrect. Demandez-le à l’acheteur (visible dans son suivi de commande).' });
  }

  if (session === null) return <main className="mx-auto max-w-md px-5 pt-6"><Link href="/connexion" className="font-bold text-lime">Se connecter</Link></main>;
  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-lime text-4xl text-ink" aria-hidden="true">✓</div>
        <h1 className="font-display text-[26px] font-semibold">Livraison terminée</h1>
        {done.cod > 0 && <p className="rounded-2xl bg-[#3a2f12] px-5 py-3 text-[15px] font-bold text-amber">Vous avez encaissé {formatGnf(done.cod)} en espèces.</p>}
        <Link href="/" className={cta}>Retour aux missions</Link>
      </main>
    );
  }
  if (gone) return <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-6"><p className="text-[14px] font-medium text-night-muted">Cette mission n’est plus à vous (annulée, remise ou reprise).</p><Link href="/" className={cta}>Retour</Link></main>;
  if (!info) return <main className="mx-auto max-w-md px-5 pt-6"><p className="text-[14px] font-medium text-night-muted">Chargement…</p></main>;

  const left = Math.max(0, MAX_HANDOVER_ATTEMPTS - failures);
  const precision = PRECISION[doorPrecision(info.buyer_level)];
  const phoneUri = `tel:${info.buyer_phone.replace(/\s/g, '')}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3.5 px-5 pb-16 pt-5">
      <Link href="/" className="text-[13px] font-bold text-night-muted">← Missions</Link>
      <h1 className="font-display text-[24px] font-semibold tracking-tight">{info.status === 'accepte' ? 'Retrait du colis' : 'Livraison à l’acheteur'}</h1>
      {msg && <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${msg.tone === 'err' ? 'bg-[#3a1a1a] text-[#ffb4a8]' : 'bg-night-card text-lime'}`}>{msg.text}</p>}
      {info.cod_amount_gnf > 0 && <div className="rounded-2xl bg-[#3a2f12] px-4 py-3 text-[14px] font-bold text-amber">Espèces à encaisser : {formatGnf(info.cod_amount_gnf)}</div>}

      {info.status === 'accepte' ? (
        <section className="flex flex-col gap-3 rounded-[22px] border border-night-line bg-night-card p-4">
          <div><div className="text-[11.5px] font-bold text-night-muted">RETRAIT CHEZ</div><div className="text-[17px] font-extrabold">{info.shop_name}</div></div>
          <a href={mapsUrl(info.shop_lat, info.shop_lng)} target="_blank" rel="noreferrer" className={ghost}>Itinéraire vers la boutique</a>
          <button type="button" disabled={busy} onClick={() => setScan(true)} className={cta}>Scanner le QR du colis</button>
          <button type="button" disabled={busy} onClick={release} className="h-11 text-[13px] font-bold text-night-muted">Je ne peux plus faire cette mission</button>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-[22px] border border-night-line bg-night-card p-4">
            <div className="text-[11.5px] font-bold text-night-muted">LIVRAISON</div>
            <div className="text-[13px] font-semibold text-night-muted">{precision}{info.buyer_accuracy_m ? ` · précision ≈ ${Math.round(info.buyer_accuracy_m)} m` : ''}</div>
            {(info.buyer_landmark || info.buyer_floor || info.buyer_door) && <div className="text-[14.5px] font-bold">{[info.buyer_landmark, info.buyer_floor && `étage ${info.buyer_floor}`, info.buyer_door && `porte ${info.buyer_door}`].filter(Boolean).join(' · ')}</div>}
            <a href={mapsUrl(info.buyer_lat, info.buyer_lng)} target="_blank" rel="noreferrer" className={ghost}>Itinéraire vers l’acheteur</a>
            <a href={phoneUri} className={ghost}>Appeler l’acheteur · {formatGnPhone(info.buyer_phone.startsWith('+') ? info.buyer_phone : `+${info.buyer_phone}`)}</a>
          </section>
          <form onSubmit={handover} className="flex flex-col gap-3 rounded-[22px] border border-night-line bg-night-card p-4">
            <h2 className="text-[14px] font-extrabold">Remise : code de l’acheteur</h2>
            <p className="text-[12.5px] font-medium text-night-muted">L’acheteur voit un code à 4 chiffres dans son suivi, ou scanne lui-même le QR du colis. Vous devez être à son adresse.</p>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="off" aria-label="Code de remise à 4 chiffres" placeholder="••••" disabled={left === 0}
              className="h-14 rounded-2xl border border-night-line bg-night text-center font-display text-[26px] tracking-[0.5em] outline-none focus:border-lime" />
            <button type="submit" disabled={busy || code.length !== 4 || left === 0} className={cta}>{busy ? 'Vérification…' : 'Confirmer la remise'}</button>
            <p className="text-[12px] font-semibold text-night-muted">{left === 0 ? 'Colis verrouillé : contactez l’équipe Hailand.' : failures > 0 ? `${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}.` : ''}</p>
          </form>
        </>
      )}
      {scan && <QrScanner dark onClose={() => setScan(false)} onResult={pickup} />}
    </main>
  );
}
