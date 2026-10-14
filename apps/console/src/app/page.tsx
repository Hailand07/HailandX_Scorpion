'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatGnf } from '@hailandx/commerce';
import { PageHead, Panel, useConsole } from '@/components/ConsoleShell';
import { journalText, roleText, type JournalEntry } from '@/lib/format';

/** Vue d'ensemble : chiffres du jour, ce qui attend l'équipe, dernières actions. */
export default function OverviewPage() {
  const { sb, overview: o } = useConsole();
  const [log, setLog] = useState<JournalEntry[]>([]);
  useEffect(() => { void sb.rpc('fn_console_journal', { p_limit: 6 }).then(({ data }) => setLog((data as JournalEntry[]) ?? [])); }, [sb, o]);

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const todo = o ? [
    { n: o.certifs_pending, t: 'Demandes de certification', s: 'Boutiques en attente de vérification avant HailandMap', href: '/certifications', c: 'bg-blue-soft text-blue' },
    { n: o.couriers_pending, t: 'Dossiers de livreurs', s: 'Candidatures à vérifier et valider', href: '/livreurs', c: 'bg-lime text-ink' },
    { n: o.disputes_open, t: o.disputes_open > 1 ? 'Litiges ouverts' : 'Litige ouvert', s: 'Acheteur, vendeur et livreur attendent une décision', href: '/litiges', c: 'bg-[#fde8e4] text-[#a3321f]' },
    { n: o.cash_over_limit, t: 'Espèces à récupérer', s: 'Livreurs au-dessus de leur plafond d’espèces', href: '/livreurs', c: 'bg-amber-soft text-[#9a6b00]' },
    { n: o.reports_open, t: 'Avis signalés', s: 'Signalés par des vendeurs', href: '/litiges', c: 'bg-sand text-ink' },
  ].filter((x) => x.n > 0) : [];

  return (
    <>
      <PageHead title="Vue d’ensemble" sub={`${today[0]!.toUpperCase()}${today.slice(1)} · Conakry`} />
      <section aria-label="Chiffres du jour" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Commandes aujourd’hui" value={o ? String(o.orders_today) : '…'} sub={o ? `${o.shops_open} boutique${o.shops_open > 1 ? 's' : ''} ouverte${o.shops_open > 1 ? 's' : ''}` : ''} />
        <Kpi label="Ventes du jour" value={o ? formatGnf(o.sales_today) : '…'} sub={o ? `Commission : ${formatGnf(o.commission_today)}` : ''} />
        <Kpi label="Livreurs en service" value={o ? `${o.couriers_online} / ${o.couriers_valid}` : '…'} sub={o?.couriers_pending ? `${o.couriers_pending} dossier${o.couriers_pending > 1 ? 's' : ''} à valider` : 'Vus dans le dernier quart d’heure'} />
        <Kpi label="Colis bloqués" value={o ? String(o.parcels_stuck) : '…'} sub="Prêts depuis plus de 45 min" alert={Boolean(o?.parcels_stuck)} />
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="À traiter" className="overflow-hidden">
          {o && todo.length === 0 && <p className="border-t border-[#f0ede6] px-[18px] py-5 text-[14px] font-semibold text-muted">Rien n’attend l’équipe pour l’instant.</p>}
          {todo.map((x) => (
            <Link key={x.t} href={x.href} className="flex items-center gap-3.5 border-t border-[#f0ede6] px-[18px] py-3 hover:bg-[#faf9f5]">
              <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl font-display text-[16px] font-bold ${x.c}`}>{x.n}</span>
              <span className="flex min-w-0 flex-1 flex-col"><span className="text-[14.5px] font-extrabold">{x.t}</span><span className="text-[12.5px] font-semibold text-muted">{x.s}</span></span>
              <span className="hidden h-9 items-center rounded-[11px] border border-line px-3.5 text-[13px] font-extrabold sm:flex">Traiter</span>
            </Link>
          ))}
        </Panel>
        <Panel title="Journal récent" right={<Link href="/journal" className="text-[13px] font-extrabold text-blue">Tout voir</Link>}>
          <ul className="px-[18px] pb-3">
            {log.length === 0 && <li className="border-t border-[#f0ede6] py-3 text-[13px] font-semibold text-muted">Aucune action enregistrée pour l’instant.</li>}
            {log.map((e) => (
              <li key={e.id} className="flex gap-2.5 border-t border-[#f0ede6] py-2.5 text-[13px] font-semibold leading-snug">
                <span className="w-[52px] shrink-0 font-bold text-muted">{new Date(e.created_at).toDateString() === new Date().toDateString() ? new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                <span>{journalText(e)}<span className="text-muted"> · {e.actor_name}{e.actor_role ? ` (${roleText(e.actor_role)})` : ''}</span></span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function Kpi({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-line-soft bg-card px-[18px] py-4">
      <span className="text-[12.5px] font-bold text-muted">{label}</span>
      <span className={`font-display text-[22px] font-semibold lg:text-[26px] ${alert ? 'text-[#c2410c]' : ''}`}>{value}</span>
      <span className="text-[12px] font-bold text-muted">{sub}</span>
    </div>
  );
}
