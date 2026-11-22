/**
 * Créneau de livraison de la Flotte (HAILANDX.md §64) : ce que renvoie `fn_delivery_window` et les phrases montrées au client
 * et au vendeur. Conakry est à l'heure UTC toute l'année : les dates « AAAA-MM-JJ » se lisent en UTC.
 */
export interface DeliveryWindow {
  jour: string; aujourdhui: boolean; debut: string; fin: string; limite: string; jours: string;
  partout: boolean; communes: string[]; zone_ok: boolean | null; commune: string | null;
}

const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** « 14:00 » → « 14 h » ; « 12:30 » → « 12 h 30 ». */
export function heureTexte(t: string): string {
  const [h, m] = t.split(':');
  return `${Number(h)} h${m && m !== '00' ? ` ${m}` : ''}`;
}

/** « aujourd’hui », « demain » ou « lundi 24 novembre ». */
export function jourTexte(jour: string, now: Date = new Date()): string {
  const today = ymd(now);
  const tomorrow = ymd(new Date(Date.parse(`${today}T00:00:00Z`) + 86400e3));
  if (jour === today) return 'aujourd’hui';
  if (jour === tomorrow) return 'demain';
  return new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** « aujourd’hui entre 14 h et 18 h ». */
export function creneauTexte(jour: string, debut: string, fin: string, now: Date = new Date()): string {
  return `${jourTexte(jour, now)} entre ${heureTexte(debut)} et ${heureTexte(fin)}`;
}

/** « 1,2,3,4,5,6 » → « du lundi au samedi » ; jours non suivis → « lundi, mercredi et vendredi ». */
export function joursTexte(jours: string): string {
  const n = [...new Set(jours.split(',').map(Number).filter((x) => x >= 1 && x <= 7))].sort((a, b) => a - b);
  if (n.length === 0) return '';
  if (n.length === 7) return 'tous les jours';
  if (n.length === 1) return `le ${JOURS[n[0]!]}`;
  if (n.length > 2 && n[n.length - 1]! - n[0]! === n.length - 1) return `du ${JOURS[n[0]!]} au ${JOURS[n[n.length - 1]!]}`;
  const names = n.map((x) => JOURS[x]!);
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

/** « Ratoma » ; « Dixinn et Ratoma » ; « Dixinn, Matam et Ratoma ». */
export function communesTexte(communes: string[]): string {
  if (communes.length <= 1) return communes[0] ?? '';
  return `${communes.slice(0, -1).join(', ')} et ${communes[communes.length - 1]}`;
}
