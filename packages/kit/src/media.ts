import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'hx-media';

/** Adresse publique d'une image du stockage. Une adresse web complète (`https://…`, ex. photos du catalogue de démonstration) est rendue telle quelle. */
export const mediaUrl = (path: string | null | undefined): string | null =>
  path?.startsWith('https://') ? path
  : path && process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` : null;

/** Réduit une photo (3G oblige) : côté le plus long ≤ 1280 px, JPEG qualité 0,8. Le résultat dépasse rarement 300 Ko. */
export async function shrinkImage(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choisissez une image (JPEG, PNG ou WebP).');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image illisible sur cet appareil.');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('Image illisible sur cet appareil.');
  return blob;
}

/** Envoie une photo dans le dossier du compte (`<compte>/<horodatage>-<hasard>.jpg`) et renvoie son chemin. */
export async function uploadPhoto(sb: SupabaseClient, uid: string, file: File): Promise<string> {
  const blob = await shrinkImage(file);
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw new Error('La photo n’a pas pu être envoyée. Réessayez.');
  return path;
}
