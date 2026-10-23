/**
 * Images prêtes à publier, dessinées dans le navigateur (aucun envoi au serveur) : visuel produit (statut WhatsApp, carré)
 * et affiche QR de la boutique. Couleurs et polices de la marque (Sora, Manrope ; repli sans empattement).
 */
export const BRAND = { bg: '#f6f4ef', ink: '#12141c', blue: '#3346f0', lime: '#c8f25a', muted: '#5f6372', orange: '#c2410c' };

/** Charge une image pour le dessin ; null si elle est inaccessible (réseau, autorisation d'origine). */
export function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** Dessine l'image en la recadrant pour remplir la zone (comme `object-fit: cover`). */
export function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s; const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Texte sur plusieurs lignes (au plus `max`), coupé aux espaces ; renvoie la hauteur utilisée. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineH: number, max = 2): number {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > width && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, max);
  if (lines.length > max) shown[max - 1] = `${shown[max - 1]!.replace(/\s+\S*$/, '')}…`;
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return shown.length * lineH;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export const gnf = (n: number) => `${n.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} GNF`;

/** Enregistre le dessin sur l'appareil (PNG). */
export function downloadCanvas(canvas: HTMLCanvasElement, name: string) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = name;
  a.click();
}

/** Fichier PNG du dessin, pour le partage natif (WhatsApp, TikTok…). */
export const canvasFile = (canvas: HTMLCanvasElement, name: string): Promise<File | null> =>
  new Promise((res) => canvas.toBlob((b) => res(b ? new File([b], name, { type: 'image/png' }) : null), 'image/png'));
