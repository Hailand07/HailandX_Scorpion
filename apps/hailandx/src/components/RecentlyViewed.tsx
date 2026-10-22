'use client';

import { useEffect, useState } from 'react';
import { ProductCard, type GridItem } from './ProductGrid';

/**
 * « Vus récemment » (HAILANDX.md §35) : gardés sur ce téléphone seulement (stockage du navigateur), jamais envoyés au serveur.
 * 20 produits au plus, le dernier vu en premier.
 */
const KEY = 'hx-vus-v1';
const MAX = 20;

const read = (): GridItem[] => {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};

/** À placer sur la page d'un produit : l'ajoute en tête de la liste. */
export function RecordView({ item }: { item: GridItem }) {
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify([item, ...read().filter((x) => x.key !== item.key)].slice(0, MAX))); } catch { /* navigation privée : ignoré */ }
  }, [item]);
  return null;
}

/** Rangée de l'accueil ; `known` = produits encore en vente (un produit retiré n'est plus proposé). */
export function RecentlyViewed({ known, title = 'Vus récemment' }: { known?: string[]; title?: string }) {
  const [items, setItems] = useState<GridItem[]>([]);
  useEffect(() => { const ok = known ? new Set(known) : null; setItems(read().filter((x) => !ok || ok.has(x.key))); }, [known]);
  if (!items.length) return null;
  const clear = () => { try { localStorage.removeItem(KEY); } catch { /* ignoré */ } setItems([]); };
  return (
    <section aria-label="Vus récemment" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between px-5">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        <button type="button" onClick={clear} className="text-[12.5px] font-extrabold text-muted">Effacer</button>
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">{items.map((p) => <ProductCard key={p.key} p={p} />)}</div>
    </section>
  );
}
