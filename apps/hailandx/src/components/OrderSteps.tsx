/** Barre d'étapes de la commande (maquettes v9) : 1 Panier · 2 Adresse · 3 Paiement · 4 Confirmé. */
const STEPS = ['Panier', 'Adresse', 'Paiement', 'Confirmé'] as const;

export function OrderSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex flex-col gap-1.5">
      <ol aria-label="Étapes de la commande" className="grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => <li key={s} aria-current={i + 1 === current ? 'step' : undefined} className={`h-1.5 rounded-full ${i + 1 <= current ? 'bg-blue' : 'bg-line'}`}><span className="sr-only">{i + 1}. {s}</span></li>)}
      </ol>
      <span aria-hidden="true" className="text-[11.5px] font-bold text-muted">{STEPS.map((s, i) => <span key={s} className={i + 1 === current ? 'text-ink' : ''}>{i ? ' · ' : ''}{i + 1} {s}</span>)}</span>
    </div>
  );
}
