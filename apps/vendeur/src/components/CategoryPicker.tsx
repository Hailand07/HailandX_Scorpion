'use client';
import { Icon } from '@hailandx/kit';

export interface Cat { id: string; name: string }

/**
 * Choix des catégories d'une boutique (§54) : autant qu'on veut, voire toutes. L'ordre de sélection compte : la première
 * choisie est la catégorie principale (affichée en premier). « Tout sélectionner » pour un commerce généraliste.
 */
export function CategoryPicker({ cats, value, onChange, disabled }: { cats: Cat[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const all = cats.length > 0 && value.length === cats.length;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-muted">{value.length === 0 ? 'Touchez une ou plusieurs catégories' : `${value.length} choisie${value.length > 1 ? 's' : ''}`}</span>
        <button type="button" disabled={disabled} onClick={() => onChange(all ? [] : cats.map((c) => c.id))} className="h-9 rounded-full px-3 text-[13px] font-extrabold text-blue-ink">{all ? 'Tout retirer' : 'Tout sélectionner'}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => {
          const on = value.includes(c.id);
          return (
            <button key={c.id} type="button" aria-pressed={on} disabled={disabled} onClick={() => toggle(c.id)}
              className={`flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold ${on ? 'bg-ink text-white' : 'border border-line bg-card'}`}>
              {on && <Icon name="check" size={14} stroke={3} />}{c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Résumé : « Mode, Beauté et 3 autres ». */
export function catsSummary(cats: Cat[], ids: string[]): string {
  const names = ids.map((id) => cats.find((c) => c.id === id)?.name).filter(Boolean) as string[];
  if (!names.length) return '';
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} et ${names.length - 2} autre${names.length > 3 ? 's' : ''}`;
}
