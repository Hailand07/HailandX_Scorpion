'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatGnf } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { useGeo } from '@/lib/useGeo';

interface Courier { user_id: string; full_name: string; vehicle: string; status: 'candidat' | 'valide' | 'suspendu'; available: boolean; cash_balance_gnf: number; cash_limit_gnf: number }
interface Mission { parcel_id: string; fee_gnf: number; distance_km: number; from_label: string; to_label: string; to_level: number; cod_amount_gnf: number }
interface Mine { id: string; status: string; delivery_fee_gnf: number; shops: { name: string } | null }

const VEHICLES: [string, string][] = [['moto', 'Moto'], ['velo', 'Vélo'], ['voiture', 'Voiture'], ['pied', 'À pied']];
const field = 'h-12 w-full rounded-2xl border border-night-line bg-night-card px-4 text-[16px] font-medium outline-none focus:border-lime';
const cta = 'flex h-[54px] w-full items-center justify-center rounded-2xl bg-lime text-[15px] font-extrabold text-ink disabled:opacity-40';
const PRECISION: Record<number, string> = { 3: 'Niveau 3 · jusqu’au portail', 2: 'Niveau 2 · bâtiment', 1: 'Niveau 1 · zone, repère écrit' };

/** Hailand Flotte : candidature, disponibilité, missions proches, mission en cours, solde d'espèces. */
export default function Home() {
  const router = useRouter();
  const session = useSession();
  const sb = browserClient();
  const uid = session?.user.id;
  const [courier, setCourier] = useState<Courier | null | undefined>(undefined);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [earned, setEarned] = useState({ count: 0, fees: 0 });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { fix, error: geoError } = useGeo(courier?.status === 'valide' && courier.available);
  const lastPing = useRef(0);

  const loadCourier = useCallback(async () => {
    if (!sb || !uid) return;
    const { data } = await sb.from('couriers').select('user_id,full_name,vehicle,status,available,cash_balance_gnf,cash_limit_gnf').eq('user_id', uid).maybeSingle();
    setCourier((data as Courier | null) ?? null);
  }, [sb, uid]);

  useEffect(() => { if (session === null) router.replace('/connexion'); else if (uid) void loadCourier(); }, [session, uid, loadCourier, router]);

  // Position envoyée au serveur (au plus toutes les 20 s) : sert à proposer les missions proches et à contrôler la remise.
  useEffect(() => {
    if (!sb || !fix || courier?.status !== 'valide') return;
    if (Date.now() - lastPing.current < 20_000) return;
    lastPing.current = Date.now();
    void sb.rpc('fn_courier_ping', { p_lat: fix.lat, p_lng: fix.lng });
  }, [sb, fix, courier?.status]);

  const loadMissions = useCallback(async () => {
    if (!sb || courier?.status !== 'valide') return;
    const m = await sb.from('parcels').select('id,status,delivery_fee_gnf,shops(name)').eq('courier_id', uid!).in('status', ['accepte', 'retire']);
    setMine((m.data as unknown as Mine[]) ?? []);
    const d = await sb.from('parcels').select('delivery_fee_gnf').eq('courier_id', uid!).eq('status', 'remis');
    const rows = (d.data as { delivery_fee_gnf: number }[]) ?? [];
    setEarned({ count: rows.length, fees: rows.reduce((n, r) => n + r.delivery_fee_gnf, 0) });
    if (courier.available && fix) {
      const r = await sb.rpc('fn_missions_proches', { p_lat: fix.lat, p_lng: fix.lng, p_radius_km: 8 });
      setMissions((r.data as Mission[]) ?? []);
    } else setMissions([]);
  }, [sb, uid, courier?.status, courier?.available, fix]);

  useEffect(() => { void loadMissions(); const t = setInterval(loadMissions, 10_000); return () => clearInterval(t); }, [loadMissions]);

  async function apply(f: FormData) {
    setBusy(true); setMsg(null);
    const { error } = await sb!.from('couriers').insert({ user_id: uid, full_name: String(f.get('name') ?? '').trim(), phone: session?.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : null, vehicle: String(f.get('vehicle')) });
    setBusy(false);
    if (error) return setMsg('Le dossier n’a pas pu être envoyé : ' + error.message);
    await loadCourier();
  }
  async function toggle() {
    if (!courier) return;
    const { error } = await sb!.from('couriers').update({ available: !courier.available }).eq('user_id', courier.user_id);
    if (error) setMsg(error.message); else await loadCourier();
  }
  async function accept(id: string) {
    setMsg(null);
    const { error } = await sb!.rpc('fn_courier_accept', { p_parcel: id });
    if (error) { setMsg(error.message.replace(/^.*?:\s*/, '')); return loadMissions(); }
    router.push(`/mission/${id}`);
  }

  const Head = (
    <header className="flex items-center justify-between">
      <div><div className="font-display text-xl font-bold tracking-[-0.03em]">Hailand <span className="text-lime">Flotte</span></div><div className="text-xs font-semibold text-night-muted">Application des livreurs</div></div>
      {session && <button type="button" onClick={() => sb?.auth.signOut()} className="h-11 px-2 text-[13px] font-bold text-night-muted">Déconnexion</button>}
    </header>
  );
  const Shell = ({ children }: { children: React.ReactNode }) => <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3.5 px-5 pb-16 pt-5">{Head}{children}</main>;

  if (session === undefined || session === null || courier === undefined) return <Shell><p className="text-[14px] font-medium text-night-muted">Chargement…</p></Shell>;

  if (courier === null) {
    return (
      <Shell>
        <h1 className="font-display text-[24px] font-semibold tracking-tight">Devenir livreur</h1>
        <p className="text-[14px] font-medium text-night-muted">Livrez les commandes HailandX dans votre quartier. L’équipe Hailand valide votre dossier avant votre première mission.</p>
        <form action={apply} className="flex flex-col gap-3 rounded-[22px] border border-night-line bg-night-card p-4">
          <input name="name" required minLength={3} placeholder="Nom et prénom" className={field} />
          <select name="vehicle" className={field} defaultValue="moto" aria-label="Véhicule">{VEHICLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button type="submit" disabled={busy} className={cta}>Envoyer mon dossier</button>
        </form>
        {msg && <p role="alert" className="rounded-2xl bg-[#3a1a1a] px-4 py-3 text-[13.5px] font-semibold text-[#ffb4a8]">{msg}</p>}
      </Shell>
    );
  }
  if (courier.status !== 'valide') {
    return (
      <Shell>
        <h1 className="font-display text-[24px] font-semibold tracking-tight">{courier.status === 'candidat' ? 'Dossier en cours de validation' : 'Compte suspendu'}</h1>
        <p className="text-[14px] font-medium text-night-muted">{courier.status === 'candidat' ? `Merci ${courier.full_name}. Hailand vous prévient dès que votre compte est validé : revenez ici ensuite.` : 'Contactez l’équipe Hailand.'}</p>
        <button type="button" onClick={loadCourier} className={cta}>Actualiser</button>
      </Shell>
    );
  }

  const room = courier.cash_limit_gnf - courier.cash_balance_gnf;
  return (
    <Shell>
      <button type="button" onClick={toggle} aria-pressed={courier.available} className={`flex h-[58px] items-center justify-between rounded-2xl px-5 text-[15px] font-extrabold ${courier.available ? 'bg-lime text-ink' : 'border border-night-line bg-night-card'}`}>
        <span>{courier.available ? 'Disponible — missions proches' : 'Indisponible'}</span><span>{courier.available ? 'Arrêter' : 'Démarrer'}</span>
      </button>
      {courier.available && geoError && <p role="alert" className="rounded-2xl bg-[#3a2f12] px-4 py-3 text-[13px] font-semibold text-amber">{geoError}</p>}
      {courier.available && !fix && !geoError && <p className="text-[13px] font-semibold text-night-muted">Recherche de votre position…</p>}
      {msg && <p role="status" className="rounded-2xl bg-night-card px-4 py-3 text-[13.5px] font-semibold">{msg}</p>}

      {mine.length > 0 && (
        <section className="flex flex-col gap-2"><h2 className="text-[13px] font-extrabold tracking-[0.05em] text-night-muted">MA MISSION EN COURS</h2>
          {mine.map((p) => <Link key={p.id} href={`/mission/${p.id}`} className="flex items-center justify-between rounded-2xl bg-lime px-4 py-3.5 text-ink"><span className="flex flex-col"><span className="text-[14px] font-extrabold">{p.shops?.name ?? 'Boutique'}</span><span className="text-[12px] font-bold">{p.status === 'retire' ? 'En route vers l’acheteur' : 'À récupérer chez le vendeur'}</span></span><span className="font-display text-[15px] font-semibold">{formatGnf(p.delivery_fee_gnf)}</span></Link>)}
        </section>
      )}

      <section className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-night-line bg-night-card px-3.5 py-3"><div className="text-[11.5px] font-bold text-night-muted">Livraisons faites</div><div className="font-display text-[20px] font-semibold">{earned.count}</div><div className="text-[12px] font-bold text-lime">{formatGnf(earned.fees)} de frais</div></div>
        <div className="rounded-2xl border border-night-line bg-night-card px-3.5 py-3"><div className="text-[11.5px] font-bold text-night-muted">Espèces à reverser</div><div className="font-display text-[20px] font-semibold">{formatGnf(courier.cash_balance_gnf)}</div><div className="text-[12px] font-bold text-night-muted">plafond {formatGnf(courier.cash_limit_gnf)}</div></div>
      </section>
      {room <= 0 && <p className="rounded-2xl bg-[#3a2f12] px-4 py-3 text-[13px] font-semibold text-amber">Plafond d’espèces atteint : reversez vos espèces à Hailand avant de prendre une mission payable à la livraison.</p>}

      <h2 className="text-[13px] font-extrabold tracking-[0.05em] text-night-muted">MISSIONS PROCHES</h2>
      {!courier.available && <p className="text-[13.5px] font-medium text-night-muted">Passez en « Disponible » pour recevoir des missions.</p>}
      {courier.available && missions.length === 0 && fix && <p className="text-[13.5px] font-medium text-night-muted">Aucune mission pour l’instant. Cette liste se met à jour toute seule.</p>}
      {missions.map((m) => (
        <article key={m.parcel_id} className="flex flex-col gap-3 rounded-[22px] border border-night-line bg-night-card p-4">
          <div className="flex items-baseline justify-between"><span className="font-display text-xl font-semibold text-lime">{formatGnf(m.fee_gnf)}</span><span className="text-[12.5px] font-bold text-night-muted">{Number(m.distance_km).toString().replace('.', ',')} km</span></div>
          <div className="flex flex-col gap-2.5"><div><div className="text-[11.5px] font-bold text-night-muted">RETRAIT</div><div className="text-sm font-extrabold">{m.from_label}</div></div><div><div className="text-[11.5px] font-bold text-night-muted">LIVRAISON</div><div className="text-sm font-extrabold">{m.to_label}</div><div className="text-[12px] font-semibold text-night-muted">{PRECISION[m.to_level] ?? ''}</div></div></div>
          {m.cod_amount_gnf > 0 && <div className="rounded-xl bg-[#3a2f12] px-3 py-2 text-[12.5px] font-bold text-amber">Espèces à encaisser : {formatGnf(m.cod_amount_gnf)}</div>}
          <button type="button" onClick={() => accept(m.parcel_id)} className={cta}>Accepter la mission</button>
        </article>
      ))}
    </Shell>
  );
}
