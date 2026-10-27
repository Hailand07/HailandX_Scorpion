'use client';
import { useSyncExternalStore } from 'react';

/**
 * Panier : conservé dans le navigateur jusqu'à la commande (aucune table de panier en base, HAILANDX.md §14).
 * Phase de lancement (§49) : UNE seule boutique par panier, donc un seul colis.
 */
export interface CartLine {
  offerId: string;
  variantId: string | null;
  /** Libellé de la variante choisie (« M · Bleu ») ; vide pour une variante unique « Standard ». */
  variantLabel?: string | null;
  slug: string;
  name: string;
  priceGnf: number;
  shopSlug: string;
  shopName: string;
  photoUrl: string | null;
  qty: number;
}

const KEY = 'hx.cart';
const EVENT = 'hx-cart';
let cache: CartLine[] | null = null;

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    cache = Array.isArray(raw) ? raw.filter((l) => l && typeof l.offerId === 'string' && Number.isFinite(l.qty) && Number.isFinite(l.priceGnf)) : [];
  } catch { cache = []; }
  return cache!;
}

function write(lines: CartLine[]) {
  cache = lines;
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* stockage refusé : le panier reste en mémoire */ }
  window.dispatchEvent(new Event(EVENT));
}

const clampQty = (n: number) => Math.max(1, Math.min(99, Math.floor(n)));

/** Boutique du panier (une seule), ou `null` s'il est vide. */
export const cartShop = (lines: CartLine[]): { slug: string; name: string } | null => (lines[0] ? { slug: lines[0].shopSlug, name: lines[0].shopName } : null);

/**
 * Ajoute un article. Si le panier contient déjà les produits d'une AUTRE boutique : refusé (renvoie `false`),
 * sauf avec `replace`, qui vide le panier avant d'ajouter (le client a confirmé).
 */
export function addToCart(line: Omit<CartLine, 'qty'>, qty = 1, replace = false): boolean {
  const current = read();
  if (current.length && current.some((l) => l.shopSlug !== line.shopSlug)) {
    if (!replace) return false;
    write([{ ...line, qty: clampQty(qty) }]);
    return true;
  }
  const lines = [...current];
  const i = lines.findIndex((l) => l.offerId === line.offerId && l.variantId === line.variantId);
  if (i >= 0) lines[i] = { ...lines[i]!, qty: clampQty(lines[i]!.qty + qty) };
  else lines.push({ ...line, qty: clampQty(qty) });
  write(lines);
  return true;
}
export function setQty(offerId: string, variantId: string | null, qty: number) {
  write(read().map((l) => (l.offerId === offerId && l.variantId === variantId ? { ...l, qty: clampQty(qty) } : l)));
}
export function removeLine(offerId: string, variantId: string | null) {
  write(read().filter((l) => !(l.offerId === offerId && l.variantId === variantId)));
}
export const clearCart = () => write([]);
/** Met à jour les prix enregistrés quand le vendeur les a changés (le panier affiche toujours le prix du moment). */
export function syncPrices(prices: Map<string, number>) {
  const lines = read();
  if (!lines.some((l) => prices.has(l.offerId) && prices.get(l.offerId) !== l.priceGnf)) return;
  write(lines.map((l) => (prices.has(l.offerId) ? { ...l, priceGnf: prices.get(l.offerId)! } : l)));
}

const EMPTY: CartLine[] = [];
function subscribe(cb: () => void) {
  const on = () => { cache = null; cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', on);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', on); };
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty * l.priceGnf, 0);

/** Panier d'avant la règle « une boutique » : ne garder que les articles de la boutique choisie. */
export const keepShop = (shopSlug: string) => write(read().filter((l) => l.shopSlug === shopSlug));
