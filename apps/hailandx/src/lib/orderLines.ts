/**
 * Lignes d'une commande pour l'affichage (§56) : un même produit (même offre, même variante) n'apparaît qu'une fois,
 * avec la quantité additionnée — jamais de ligne en double.
 */
export interface RawItem { offer_id?: string | null; name_snapshot: string; variant_label?: string | null; quantity: number; price_gnf_snapshot?: number; photo?: string | null }
export interface OrderLine { key: string; name: string; variant: string | null; quantity: number; unitGnf: number; totalGnf: number; photo: string | null }

export function groupLines(items: RawItem[]): OrderLine[] {
  const out = new Map<string, OrderLine>();
  for (const i of items) {
    const unit = i.price_gnf_snapshot ?? 0;
    const key = `${i.offer_id ?? i.name_snapshot}|${i.variant_label ?? ''}|${unit}`;
    const cur = out.get(key);
    if (cur) { cur.quantity += i.quantity; cur.totalGnf += i.quantity * unit; cur.photo ??= i.photo ?? null; }
    else out.set(key, { key, name: i.name_snapshot, variant: i.variant_label ?? null, quantity: i.quantity, unitGnf: unit, totalGnf: i.quantity * unit, photo: i.photo ?? null });
  }
  return [...out.values()];
}
