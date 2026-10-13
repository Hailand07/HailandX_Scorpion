import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'hx-preuves';

/** Réduit une photo (3G oblige) : côté le plus long ≤ 1280 px, JPEG qualité 0,75. */
export async function shrinkImage(file: File, maxSide = 1280, quality = 0.75): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Prenez une photo (JPEG, PNG ou WebP).');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale)); canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image illisible sur cet appareil.');
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('Image illisible sur cet appareil.');
  return blob;
}

/** Envoie la photo de remise dans le stockage privé : `<livreur>/<colis>/<horodatage>.jpg` (seul le livreur du colis retiré peut y écrire). */
export async function uploadProof(sb: SupabaseClient, courierId: string, parcelId: string, file: File): Promise<string> {
  const blob = await shrinkImage(file);
  const path = `${courierId}/${parcelId}/${Date.now()}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600' });
  if (error) throw new Error('La photo n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.');
  return path;
}
