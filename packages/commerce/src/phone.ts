/** Numéros guinéens : +224 suivi de 9 chiffres (6xx ou 6xx…). Accepte « 6 10 01 04 19 », « 00224… », « +224… ». */
export function normalizeGnPhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('224')) d = d.slice(3);
  else if (d.length !== 9) return null;
  return /^6\d{8}$/.test(d) ? `+224${d}` : null;
}

/** Affichage lisible : +224 610 01 04 19. */
export function formatGnPhone(e164: string): string {
  const m = /^\+224(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+224 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/** Identifiant de boutique lisible dans un lien : « Kadi Wax & Co » → « kadi-wax-co ». */
export function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
