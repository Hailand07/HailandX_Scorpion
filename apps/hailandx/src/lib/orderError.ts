/**
 * Message d'erreur de la commande rendu lisible : la base nomme l'offre par son identifiant (« stock insuffisant pour
 * <offre> (<variante>) ») ; on le remplace par le nom du produit tel qu'il est dans le panier.
 */
export function explainOrderError(message: string, lines: { offerId: string; name: string; variantLabel?: string | null; shopName?: string }[]): string {
  const m = /stock insuffisant pour ([0-9a-f-]{36})(?:\s*\(([^)]*)\))?/i.exec(message);
  if (!m) return message;
  const line = lines.find((l) => l.offerId === m[1]);
  const what = line ? `« ${line.name}${m[2] && m[2] !== 'Standard' ? ` (${m[2]})` : ''} »${line.shopName ? ` chez ${line.shopName}` : ''}` : 'Un article de votre panier';
  return `${what} n’est plus en stock en quantité suffisante. Réduisez la quantité ou retirez-le du panier, puis recommandez.`;
}
