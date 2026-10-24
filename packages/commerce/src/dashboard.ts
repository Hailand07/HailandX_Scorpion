import { buyerStep, type ParcelStatus } from './parcel';

/** Logique pure de l'espace vendeur et des commandes de l'acheteur (testée dans dashboard.test.ts, sans base ni navigateur). */

// ── Ventes ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ventes d'un jour : `revenue_gnf` = commandé (colis non annulés), `delivered_gnf` = encaissé (colis remis). */
export interface SalesDay { day: string; parcels: number; revenue_gnf: number; delivered_gnf?: number }
export interface PeriodStats { revenue: number; parcels: number; previous: number; trendPct: number | null; delivered: number }

/**
 * Ventes des `days` derniers jours (aujourd'hui compris) et comparaison avec les `days` jours d'avant.
 * `series` va du plus ancien au plus récent (sortie de fn_shop_sales). Pas de tendance si la période précédente est vide.
 */
export function periodStats(series: SalesDay[], days: number): PeriodStats {
  const cur = series.slice(-days);
  const prev = series.slice(-2 * days, -days);
  const sum = (xs: SalesDay[]) => xs.reduce((n, d) => n + Number(d.revenue_gnf), 0);
  const revenue = sum(cur);
  const previous = sum(prev);
  return {
    revenue,
    parcels: cur.reduce((n, d) => n + d.parcels, 0),
    delivered: cur.reduce((n, d) => n + Number(d.delivered_gnf ?? 0), 0),
    previous,
    trendPct: prev.length === days && previous > 0 ? Math.round(((revenue - previous) / previous) * 100) : null,
  };
}

/** Hauteurs relatives (0 à 100) des barres, au moins 6 % pour un jour avec des ventes, 3 % sinon. */
export function barHeights(series: SalesDay[]): number[] {
  const max = Math.max(1, ...series.map((d) => Number(d.revenue_gnf)));
  return series.map((d) => (Number(d.revenue_gnf) > 0 ? Math.max(6, Math.round((Number(d.revenue_gnf) / max) * 100)) : 3));
}

/** Montant court pour une tuile : 1 250 000 → « 1,25 M », 740 000 → « 740 k ». */
export function shortGnf(n: number): string {
  const a = Math.abs(n);
  const fmt = (x: number, d: number) => x.toFixed(d).replace(/\.?0+$/, '').replace('.', ',');
  if (a >= 1_000_000) return `${fmt(n / 1_000_000, 2)} M`;
  if (a >= 10_000) return `${Math.round(n / 1000)} k`;
  return String(n);
}

// ── Colis du vendeur ───────────────────────────────────────────────────────────────────────────────────────────────

export type SellerTab = 'preparer' | 'route' | 'terminees' | 'problemes';

/** Onglet d'un colis côté vendeur : tant que le livreur ne l'a pas retiré, il est « à préparer » (le vendeur le détient encore). */
export function sellerTab(status: ParcelStatus): SellerTab {
  if (status === 'retire') return 'route';
  if (status === 'remis' || status === 'annule') return 'terminees';
  if (status === 'litige') return 'problemes';
  return 'preparer';
}

/** Minutes écoulées depuis une date, arrondies, jamais négatives. */
export const minutesSince = (iso: string, now = Date.now()) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));

/** « il y a 18 min », « il y a 3 h », « il y a 2 j ». */
export function ago(iso: string, now = Date.now()): string {
  const m = minutesSince(iso, now);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  if (m < 48 * 60) return `il y a ${Math.round(m / 60)} h`;
  return `il y a ${Math.round(m / 1440)} j`;
}

// ── Commandes de l'acheteur ────────────────────────────────────────────────────────────────────────────────────────

export const BUYER_STEPS = ['confirmee', 'preparee', 'en_route', 'remise'] as const;

/** Une commande est « en cours » tant qu'un de ses colis n'est ni remis ni annulé (un litige reste en cours). */
export const isOrderActive = (statuses: ParcelStatus[]) => statuses.some((s) => s !== 'remis' && s !== 'annule');

/** Étape affichée pour une commande en cours : celle du colis le moins avancé (hors colis terminés). */
export function orderStep(statuses: ParcelStatus[]): { index: number; litige: boolean } {
  const live = statuses.filter((s) => s !== 'remis' && s !== 'annule');
  if (live.includes('litige')) return { index: -1, litige: true };
  const idx = live.map((s) => BUYER_STEPS.indexOf(buyerStep(s) as (typeof BUYER_STEPS)[number])).filter((i) => i >= 0);
  return { index: idx.length ? Math.min(...idx) : BUYER_STEPS.length - 1, litige: false };
}

export const STEP_HEADLINE = ['Le vendeur prépare votre colis', 'Prêt, un livreur va le récupérer', 'Le livreur arrive', 'Colis remis'] as const;

/** Numéro masqué : +224 612 •• •• 42. */
export function maskPhone(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length < 8) return 'Compte HailandX';
  const local = d.startsWith('224') ? d.slice(3) : d;
  return `+224 ${local.slice(0, 3)} •• •• ${local.slice(-2)}`;
}
