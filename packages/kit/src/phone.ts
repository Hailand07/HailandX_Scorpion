/** Saisie lisible du numéro : « 621 00 00 00 » (les chiffres seuls sont gardés ; l'indicatif éventuel est laissé tel quel). */
export function groupPhone(raw: string): string {
  const d = raw.replace(/[^0-9+]/g, '');
  if (d.startsWith('+') || d.startsWith('00') || d.startsWith('224')) return d.slice(0, 15);
  const n = d.slice(0, 9);
  return [n.slice(0, 3), n.slice(3, 5), n.slice(5, 7), n.slice(7, 9)].filter(Boolean).join(' ');
}
