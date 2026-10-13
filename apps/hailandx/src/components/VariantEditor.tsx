'use client';
import { useState } from 'react';

export interface VariantRow { id: string; label: string; stock: number }
interface Row { key: number; id: string; label: string; stock: string }
const input = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-medium outline-none focus:border-blue';

/**
 * Variantes d'un produit (taille, couleur…) avec un stock chacune. Champs lus par le formulaire parent :
 * `vid` (vide pour une nouvelle variante), `vlabel`, `vstock`, et `vdel` (variantes retirées). Une seule ligne sans nom = « Standard ».
 */
export function VariantEditor({ initial = [] }: { initial?: VariantRow[] }) {
  const [rows, setRows] = useState<Row[]>(() => (initial.length ? initial.map((v, i) => ({ key: i, id: v.id, label: v.label, stock: String(v.stock) })) : [{ key: 0, id: '', label: '', stock: '1' }]));
  const [removed, setRemoved] = useState<string[]>([]);
  const [next, setNext] = useState(100);
  const set = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] font-bold">Variantes et stock</legend>
      {rows.map((r, i) => (
        <div key={r.key} className="flex items-center gap-2">
          <input type="hidden" name="vid" value={r.id} />
          <input name="vlabel" value={r.label} onChange={(e) => set(r.key, { label: e.target.value })} maxLength={40} placeholder={rows.length === 1 ? 'Standard (ou ex. M · Bleu)' : 'ex. L · Rouge'} aria-label={`Variante ${i + 1}`} className={input} />
          <input name="vstock" value={r.stock} onChange={(e) => set(r.key, { stock: e.target.value })} inputMode="numeric" placeholder="Stock" aria-label={`Stock de la variante ${i + 1}`} className={`${input} max-w-[96px]`} />
          {rows.length > 1 && <button type="button" aria-label={`Retirer la variante ${i + 1}`} onClick={() => { if (r.id) setRemoved((x) => [...x, r.id]); setRows((x) => x.filter((y) => y.key !== r.key)); }} className="flex h-12 w-10 shrink-0 items-center justify-center text-[18px] font-bold text-muted">×</button>}
        </div>
      ))}
      {removed.map((id) => <input key={id} type="hidden" name="vdel" value={id} />)}
      <button type="button" onClick={() => { setRows((r) => [...r, { key: next, id: '', label: '', stock: '1' }]); setNext((n) => n + 1); }} className="h-11 self-start rounded-full border border-line px-4 text-[13px] font-bold">+ Ajouter une variante (taille, couleur…)</button>
    </fieldset>
  );
}
