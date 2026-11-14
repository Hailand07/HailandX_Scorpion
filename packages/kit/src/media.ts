import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'hx-media';

/** Adresse publique d'une image du stockage. Une adresse web complète (`https://…`, ex. photos du catalogue de démonstration) est rendue telle quelle. */
export const mediaUrl = (path: string | null | undefined): string | null =>
  path?.startsWith('https://') ? path
  : path && process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` : null;

/** Décode une image : `createImageBitmap` d'abord, sinon un élément <img> (anciens navigateurs, certains formats d'appareil photo). */
async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(file);
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = url; });
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch { URL.revokeObjectURL(url); throw new Error('Cette photo ne peut pas être lue sur ce téléphone. Prenez-la à nouveau, ou choisissez-en une autre.'); }
  }
}

/**
 * Réduit une photo (3G oblige) : côté le plus long ≤ 1280 px, JPEG qualité 0,8. Le résultat dépasse rarement 300 Ko.
 * Si la réduction est impossible (mémoire d'un petit téléphone, format exotique), la photo d'origine est gardée quand elle
 * pèse moins de 8 Mo : mieux vaut une photo lourde que pas de photo.
 */
export async function shrinkImage(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  if (file.type && !file.type.startsWith('image/')) throw new Error('Choisissez une image (JPEG, PNG ou WebP).');
  try {
    const img = await decode(file);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img.source, 0, 0, w, h);
    img.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('canvas');
    return blob;
  } catch (e) {
    if (file.size > 0 && file.size < 8_000_000 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    throw e instanceof Error && e.message !== 'canvas' ? e : new Error('Cette photo ne peut pas être lue sur ce téléphone. Prenez-la à nouveau, ou choisissez-en une autre.');
  }
}

/** Envoie une photo dans le dossier du compte (`<compte>/<horodatage>-<hasard>.jpg`) et renvoie son chemin. */
export async function uploadPhoto(sb: SupabaseClient, uid: string, file: File): Promise<string> {
  const blob = await shrinkImage(file);
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const type = blob.type && blob.type !== 'image/jpeg' ? blob.type : 'image/jpeg';
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: '31536000' });
  if (error) throw new Error(/Payload too large|exceeded|size/i.test(error.message) ? 'Photo trop lourde. Choisissez-en une autre.' : 'La photo n’a pas pu être envoyée (réseau ?). Réessayez.');
  return path;
}
