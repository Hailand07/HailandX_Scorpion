import Link from 'next/link';
import { Icon } from '@hailandx/kit';

/** Briques d'affichage de « Ouvrir ma boutique » : étape ouverte, faite, à venir, ligne de suivi, décor de plan. */
export function Open({ n, title, text, children }: { n: number; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <section aria-current="step" className="flex flex-col gap-3.5 rounded-[20px] border-2 border-ink bg-card p-[18px]">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-extrabold text-blue">Étape {n}</span>
        <h2 className="font-display text-[20px] font-semibold">{title}</h2>
        {text && <p className="text-[14px] font-semibold leading-snug text-muted">{text}</p>}
      </div>
      {children}
    </section>
  );
}

export function Done({ title, sub, href, onChange }: { title: string; sub: string; href?: string; onChange?: () => void }) {
  return (
    <section className="flex items-center gap-3 rounded-[20px] border border-line-soft bg-card px-4 py-3.5">
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-ok text-white"><Icon name="check" size={15} stroke={3} /></span>
      <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[15px] font-extrabold">{title}</span><span className="truncate text-[13px] font-semibold text-muted">{sub}</span></span>
      {onChange ? <button type="button" onClick={onChange} className="flex h-10 items-center px-2 text-[13px] font-extrabold text-blue">Changer</button>
        : href && <Link href={href} className="flex h-10 items-center px-2 text-[13px] font-extrabold text-blue">Changer</Link>}
    </section>
  );
}

export const Locked = ({ n, title }: { n: number; title: string }) => (
  <section className="flex items-center gap-3 rounded-[20px] border border-dashed border-[#d6d1c4] px-4 py-3.5 text-faint">
    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-sand text-[13px] font-extrabold">{n}</span>
    <span className="text-[15px] font-extrabold">{title}</span>
  </section>
);

export function Timeline({ state, title, sub, last }: { state: 'done' | 'now' | 'todo'; title: string; sub?: string; last?: boolean }) {
  return (
    <li className={`flex items-start gap-3 ${last ? '' : 'pb-3.5'}`}>
      {state === 'done' && <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-ok text-white"><Icon name="check" size={12} stroke={3.4} /></span>}
      {state === 'now' && <span className="h-[22px] w-[22px] shrink-0 rounded-full border-[6px] border-blue" />}
      {state === 'todo' && <span className="h-[22px] w-[22px] shrink-0 rounded-full bg-sand" />}
      <span className="flex flex-col"><span className={`text-[14px] font-extrabold ${state === 'todo' ? 'text-faint' : ''}`}>{title}</span>{sub && <span className="text-[12px] font-semibold text-muted">{sub}</span>}</span>
    </li>
  );
}

/** Illustration d'un plan de quartier (décor), le bâtiment repéré en bleu. */
export const MapArt = () => (
  <div aria-hidden="true" className="relative h-32 overflow-hidden rounded-2xl bg-[#e9efe4]">
    <span className="absolute -inset-x-2 top-[58px] h-3.5 bg-white" />
    <span className="absolute -inset-y-2 left-[42%] w-3 bg-white" />
    <span className="absolute left-[9%] top-4 h-[34px] w-[70px] rounded bg-[#d6dccd]" />
    <span className="absolute left-[50%] top-3.5 h-9 w-[84px] rounded bg-blue opacity-85" />
    <span className="absolute left-[9%] top-[82px] h-8 w-24 rounded bg-[#d6dccd]" />
    <span className="absolute left-[50%] top-[82px] h-8 w-[60px] rounded bg-[#d6dccd]" />
    <span className="absolute left-[calc(50%+32px)] top-[22px] h-5 w-5 rounded-full border-4 border-ink bg-white" />
  </div>
);
