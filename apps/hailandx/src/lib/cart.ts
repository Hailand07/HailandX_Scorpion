'use client';
import { useSyncExternalStore } from 'react';

/** Panier : conservé dans le navigateur jusqu'à la commande (aucune table de panier en base, HAILANDX.md §14). */
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

export function addToCart(line: Omit<CartLine, 'qty'>, qty = 1) {
  const lines = [...read()];
  const i = lines.findIndex((l) => l.offerId === line.offerId && l.variantId === line.variantId);
  if (i >= 0) lines[i] = { ...lines[i]!, qty: clampQty(lines[i]!.qty + qty) };
  else lines.push({ ...line, qty: clampQty(qty) });
  write(lines);
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

/** « Mis de côté » : des articles retirés du panier pour plus tard (comme Amazon), sur ce téléphone seulement. */
const LATER = 'hx.later';
function readLater(): CartLine[] { try { const v = JSON.parse(localStorage.getItem(LATER) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function writeLater(lines: CartLine[]) { try { localStorage.setItem(LATER, JSON.stringify(lines.slice(0, 30))); } catch { /* ignoré */ } window.dispatchEvent(new Event(EVENT)); }
export function saveForLater(offerId: string, variantId: string | null) {
  const line = read().find((l) => l.offerId === offerId && l.variantId === variantId);
  if (!line) return;
  writeLater([line, ...readLater().filter((l) => !(l.offerId === offerId && l.variantId === variantId))]);
  removeLine(offerId, variantId);
}
export function moveToCart(offerId: string, variantId: string | null) {
  const line = readLater().find((l) => l.offerId === offerId && l.variantId === variantId);
  if (!line) return;
  writeLater(readLater().filter((l) => l !== line));
  const { qty, ...rest } = line; addToCart(rest, qty);
}
export function removeLater(offerId: string, variantId: string | null) { writeLater(readLater().filter((l) => !(l.offerId === offerId && l.variantId === variantId))); }
let laterCache: { raw: string | null; lines: CartLine[] } = { raw: null, lines: [] };
function laterSnapshot(): CartLine[] {
  let raw: string | null = null; try { raw = localStorage.getItem(LATER); } catch { /* ignoré */ }
  if (raw !== laterCache.raw) laterCache = { raw, lines: readLater() };
  return laterCache.lines;
}
export function useLater(): CartLine[] {
  return useSyncExternalStore(subscribe, laterSnapshot, () => EMPTY);
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
