/**
 * Horaires d'une boutique (HAILANDX.md §37) : `{"lun": ["08:00", "20:00"], …, "dim": null}` (null ou absent = fermé).
 * Heure de Conakry = UTC toute l'année (pas d'heure d'été) : les calculs se font en UTC.
 */
export type ShopHours = Partial<Record<DayKey, [string, string] | null>>;
export const DAY_KEYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const DAY_LABELS: Record<DayKey, string> = { lun: 'Lundi', mar: 'Mardi', mer: 'Mercredi', jeu: 'Jeudi', ven: 'Vendredi', sam: 'Samedi', dim: 'Dimanche' };

const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); };
const dayOf = (d: Date): DayKey => DAY_KEYS[(d.getUTCDay() + 6) % 7]!;

/** Ouvert à cet instant ? `null` si la boutique n'a pas renseigné d'horaires. */
export function isOpenNow(hours: ShopHours | null | undefined, now = new Date()): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const slot = hours[dayOf(now)];
  if (!slot) return false;
  const t = now.getUTCHours() * 60 + now.getUTCMinutes();
  return t >= minutes(slot[0]) && t < minutes(slot[1]);
}

/** Résumé court : « Lun–sam 8 h–20 h · dim. fermé » quand les jours ouverts ont les mêmes heures, sinon jour par jour. */
export function hoursSummary(hours: ShopHours | null | undefined): string | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const h = (s: string) => s.replace(/^0/, '').replace(':00', ' h').replace(':', ' h ');
  const open = DAY_KEYS.filter((k) => hours[k]);
  if (open.length === 0) return 'Fermé toute la semaine';
  const same = open.every((k) => hours[k]![0] === hours[open[0]!]![0] && hours[k]![1] === hours[open[0]!]![1]);
  const contiguous = open.every((k, i) => i === 0 || DAY_KEYS.indexOf(k) === DAY_KEYS.indexOf(open[i - 1]!) + 1);
  if (same && contiguous) {
    const [a, b] = hours[open[0]!]!;
    const range = open.length === 1 ? DAY_LABELS[open[0]!] : `${DAY_LABELS[open[0]!]!.slice(0, 3)}–${DAY_LABELS[open[open.length - 1]!]!.slice(0, 3).toLowerCase()}`;
    const closed = DAY_KEYS.filter((k) => !hours[k]).map((k) => `${DAY_LABELS[k].slice(0, 3).toLowerCase()}.`);
    return `${range} ${h(a)}–${h(b)}${closed.length ? ` · ${closed.join(', ')} fermé` : ''}`;
  }
  return open.map((k) => `${DAY_LABELS[k].slice(0, 3)} ${h(hours[k]![0])}–${h(hours[k]![1])}`).join(' · ');
}

/** En congé aujourd'hui ? (`vacation_until` = dernier jour de congé, inclus.) */
export const onVacation = (until: string | null | undefined, now = new Date()): boolean =>
  !!until && until >= now.toISOString().slice(0, 10);
