'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatGnf, type ParcelStatus } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { mediaUrl } from '@/lib/media';
import { BUYER_STEPS, isOrderActive, orderStep, STEP_HEADLINE } from '@/lib/seller';
import { Screen, Segmented } from '@/components/Screen';

interface Item { name_snapshot: string; quantity: number; offers: { photo_paths: string[] | null; catalog_products: { slug: string } | null } | null }
interface Parcel { id: string; status: ParcelStatus; delivered_at: string | null; shops: { name: string; slug: string } | null; order_items: Item[] }
interface Order { id: string; total_gnf: number; created_at: string; parcels: Parcel[] }

const STEP_LABELS = ['Confirmée', 'Préparée', 'En route', 'Remise'];
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Mes commandes (v2) : « En cours » d'abord, avec l'étape et le code à donner au livreur ; « Terminées » pour l'avis et le rachat. */
export default function OrdersPage() {
  const session = useSession();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'cours' | 'fini'>('cours');

  const load = useCallback(async () => {
    const sb = browserClient(); const uid = session?.user.id;
    if (!sb || !uid) return;
    const [o, r] = await Promise.all([
      sb.from('orders').select('id,total_gnf,created_at,parcels(id,status,delivered_at,shops(name,slug),order_items(name_snapshot,quantity,offers(photo_paths,catalog_products(slug))))').eq('buyer_id', uid).order('created_at', { ascending: false }).limit(50),
      sb.from('reviews').select('parcel_id').eq('buyer_id', uid),
    ]);
    const list = (o.data as unknown as Order[]) ?? [];
    setOrders(list);
    setReviewed(new Set(((r.data as { parcel_id: string }[]) ?? []).map((x) => x.parcel_id)));
    const live = list.flatMap((x) => x.parcels).filter((p) => !['remis', 'annule', 'litige'].includes(p.status));
    const c: Record<string, string> = {};
    await Promise.all(live.map(async (p) => { const res = await sb.rpc('fn_my_handover_code', { p_parcel: p.id }); if (typeof res.data === 'string') c[p.id] = res.data; }));
    setCodes(c);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [session, load]);

  const active = (orders ?? []).filter((o) => isOrderActive(o.parcels.map((p) => p.status)));
  const done = (orders ?? []).filter((o) => !isOrderActive(o.parcels.map((p) => p.status)));

  return (
    <Screen className="gap-4 pt-6">
      <h1 className="font-display text-[26px] font-semibold tracking-tight">Mes commandes</h1>
      {session === null && (
        <section className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-5">
          <p className="text-[14px] font-semibold text-muted">Connectez-vous pour suivre vos colis.</p>
          <Link href="/connexion?next=/commandes" className="flex h-[52px] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white">Me connecter</Link>
        </section>
      )}
      {session && (
        <>
          <Segmented label="Filtrer les commandes" value={tab} onChange={setTab} items={[{ id: 'cours', label: `En cours · ${active.length}` }, { id: 'fini', label: `Terminées · ${done.length}` }]} />
          {orders === null && <p className="text-[14px] font-semibold text-muted">Chargement…</p>}

          {orders && tab === 'cours' && (
            <>
              {active.length === 0 && <Empty text="Aucune commande en cours." />}
              {active.map((o) => {
                const step = orderStep(o.parcels.map((p) => p.status));
                const shops = [...new Set(o.parcels.map((p) => p.shops?.name).filter(Boolean))].join(', ');
                const n = o.parcels.flatMap((p) => p.order_items).reduce((k, i) => k + i.quantity, 0);
                const liveCodes = o.parcels.filter((p) => codes[p.id]).map((p) => ({ shop: p.shops?.name ?? 'Colis', code: codes[p.id]! }));
                return (
                  <Link key={o.id} href={`/commandes/${o.id}`} className="flex flex-col gap-3.5 rounded-[22px] bg-ink p-4 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[12px] font-bold text-white/70">{shops || 'Commande'} · {n} article{n > 1 ? 's' : ''}</span>
                        <span className="font-display text-[19px] font-semibold">{step.litige ? 'Problème signalé, l’équipe s’en occupe' : STEP_HEADLINE[step.index]}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-lime px-2.5 py-1.5 text-[12px] font-extrabold text-ink">{day(o.created_at)}</span>
                    </div>
                    {!step.litige && (
                      <>
                        <div className="grid grid-cols-4 gap-1" aria-hidden="true">{BUYER_STEPS.map((s, i) => <span key={s} className={`h-[5px] rounded-full ${i <= step.index ? 'bg-lime' : 'bg-white/20'}`} />)}</div>
                        <div className="flex justify-between text-[11px] font-bold text-white/70">{STEP_LABELS.map((l) => <span key={l}>{l}</span>)}</div>
                      </>
                    )}
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.08] p-3">
                      {liveCodes.length > 0 ? (
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[11.5px] font-bold text-white/70">Code à donner au livreur</span>
                          {liveCodes.length === 1
                            ? <span className="font-display text-[22px] font-semibold tracking-[0.18em]">{liveCodes[0]!.code.split('').join(' ')}</span>
                            : liveCodes.map((c) => <span key={c.shop} className="truncate text-[13px] font-bold">{c.shop} : <b className="font-display tracking-[0.12em]">{c.code}</b></span>)}
                        </span>
                      ) : <span className="text-[12.5px] font-bold text-white/80">{formatGnf(o.total_gnf)}</span>}
                      <span className="flex h-10 shrink-0 items-center rounded-xl bg-white px-3.5 text-[13px] font-extrabold text-ink">Suivre</span>
                    </div>
                  </Link>
                );
              })}
              {active.length > 0 && <p className="text-center text-[12.5px] font-semibold text-muted">Un problème avec une commande ? Ouvrez-la, puis « Signaler un problème ».</p>}
            </>
          )}

          {orders && tab === 'fini' && (
            <>
              {done.length === 0 && <Empty text="Aucune commande terminée pour l’instant." />}
              {done.map((o) => {
                const items = o.parcels.flatMap((p) => p.order_items);
                const first = items[0];
                const firstParcel = o.parcels.find((p) => p.order_items.length) ?? o.parcels[0];
                const delivered = o.parcels.filter((p) => p.status === 'remis');
                const when = delivered.length ? `remise le ${day(delivered.map((p) => p.delivered_at ?? o.created_at).sort().at(-1)!)}` : 'annulée';
                const toReview = delivered.some((p) => !reviewed.has(p.id));
                const photo = mediaUrl(first?.offers?.photo_paths?.[0]);
                const slug = first?.offers?.catalog_products?.slug;
                return (
                  <section key={o.id} className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-card p-3.5">
                    <Link href={`/commandes/${o.id}`} className="flex items-center gap-3">
                      {photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo} alt="" className="h-[52px] w-[52px] shrink-0 rounded-[14px] object-cover" /> : <span className="h-[52px] w-[52px] shrink-0 rounded-[14px] bg-sand" />}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[14px] font-extrabold">{first?.name_snapshot ?? 'Commande'}{items.length > 1 ? ` et ${items.length - 1} autre${items.length > 2 ? 's' : ''}` : ''}</span>
                        <span className="truncate text-[12px] font-semibold text-muted">{firstParcel?.shops?.name ?? 'Boutique'} · {when}</span>
                      </span>
                      <span className="shrink-0 font-display text-[14px] font-semibold">{formatGnf(o.total_gnf)}</span>
                    </Link>
                    <div className="flex gap-2">
                      {toReview && <Link href={`/commandes/${o.id}`} className="flex h-[42px] flex-1 items-center justify-center rounded-xl bg-ink text-[13px] font-extrabold text-white">Donner mon avis</Link>}
                      {slug && <Link href={`/p/${slug}${firstParcel?.shops ? `?b=${firstParcel.shops.slug}` : ''}`} className="flex h-[42px] flex-1 items-center justify-center rounded-xl border border-line text-[13px] font-extrabold">Racheter</Link>}
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const Empty = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-line px-5 py-8 text-center">
    <p className="text-[14px] font-semibold text-muted">{text}</p>
    <Link href="/" className="flex h-11 items-center rounded-2xl bg-ink px-5 text-[14px] font-extrabold text-white">Découvrir les boutiques</Link>
  </div>
);
