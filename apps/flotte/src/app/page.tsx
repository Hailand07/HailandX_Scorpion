import { deliveryFeeGnf, doorPrecision, formatGnf, type AddressLevel } from '@hailandx/commerce';

/** Missions d'exemple (fictives) : la table `deliveries` sera reliée aux colis en phase 4. */
const MISSIONS: { from: string; to: string; level: AddressLevel; km: number; minutes: number }[] = [
  { from: 'Kadi Wax · Marché Niger, Kaloum', to: 'Domicile · Coleah Domino, Matam', level: 3, km: 4.2, minutes: 18 },
  { from: 'Kadi Tech · Madina, Matam', to: 'Hamdallaye 2, Ratoma', level: 1, km: 3.1, minutes: 14 },
];

const PRECISION = { portail: 'Adresse niveau 3 · jusqu’au portail', batiment: 'Niveau 2 · bâtiment, entrée non vérifiée', zone: 'Niveau 1 · zone approximative, repère écrit' } as const;

export default function Missions() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3.5 px-5 pb-28 pt-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-bold tracking-[-0.03em]">Hailand <span className="text-lime">Flotte</span></div>
          <div className="text-xs font-semibold text-night-muted">Application des livreurs</div>
        </div>
        <span className="rounded-full bg-night-card px-3.5 py-2 text-[13px] font-extrabold">Disponible</span>
      </header>

      <h1 className="text-[13px] font-extrabold tracking-[0.05em] text-night-muted">MISSIONS PROCHES</h1>
      {MISSIONS.map((m) => (
        <article key={m.to} className="flex flex-col gap-3 rounded-[22px] border border-night-line bg-night-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-xl font-semibold text-lime">{formatGnf(deliveryFeeGnf(m.km))}</span>
            <span className="text-[12.5px] font-bold text-night-muted">{m.km.toString().replace('.', ',')} km · ≈ {m.minutes} min</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <div><div className="text-[11.5px] font-bold text-night-muted">RETRAIT</div><div className="text-sm font-extrabold">{m.from}</div></div>
            <div><div className="text-[11.5px] font-bold text-night-muted">LIVRAISON</div><div className="text-sm font-extrabold">{m.to}</div><div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold ${m.level === 3 ? 'bg-ok/30 text-[#8fe0b0]' : 'bg-amber/20 text-amber'}`}>{PRECISION[doorPrecision(m.level)]}</div></div>
          </div>
          <button type="button" className="h-[50px] rounded-2xl bg-lime text-[15px] font-extrabold text-night">Accepter la mission</button>
        </article>
      ))}
      <p className="text-center text-[11.5px] font-semibold text-night-muted">Données d’exemple : la Flotte n’est pas encore reliée à la base.</p>
    </main>
  );
}
