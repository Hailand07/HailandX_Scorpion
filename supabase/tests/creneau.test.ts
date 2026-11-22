import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Créneau et zone de livraison de la Flotte (HAILANDX.md §64). Chaque `it` reprend l'état du précédent. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;

let offer: string; let kobaya: string; let horsZone: string;
const day = async (at: string) => (await one<{ d: string }>(`select private.delivery_date($1::timestamptz)::text d`, [at])).d;
const place = (decl: string) => as(db, U.acheteur, () => one<{ id: string }>('select fn_place_order($1::jsonb, $2, $3, $4) id', [JSON.stringify([{ offer_id: offer, qty: 1 }]), decl, '+224 620 00 00 00', 'livraison']));

beforeAll(async () => {
  db = await freshDb();
  await db.exec(`insert into communes (id, nom) values ('com-ratoma', 'Ratoma'), ('com-dixinn', 'Dixinn');
    insert into quartiers (id, nom, commune_id) values ('qtr-kobaya', 'Kobaya', 'com-ratoma')`);
  const decl = async (u: string, quartier: string, lat: number) => (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point(-13.65, $2), $3, 5) returning id`, [u, lat, quartier])).id;
  const d = await decl(U.vendeur, 'qtr-kobaya', 9.65);
  kobaya = await decl(U.acheteur, 'qtr-kobaya', 9.66);
  horsZone = await decl(U.acheteur, 'qtr-coleah', 9.53);
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${d}'`);
  const shop = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi', 'Kadi', $1, $2) returning id`, [U.vendeur, d]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shop]));
  const prod = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne', $1) returning id`, [U.vendeur]))).id;
  offer = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000) returning id`, [shop, prod]))).id;
}, 60000);

describe('créneau et zone de livraison (§64)', () => {
  it('jour promis : le jour même avant 13 h, sinon le prochain jour de livraison (pas le dimanche)', async () => {
    expect(await day('2026-11-23 10:00+00')).toBe('2026-11-23'); // lundi matin → lundi
    expect(await day('2026-11-23 13:00+00')).toBe('2026-11-24'); // lundi 13 h → mardi
    expect(await day('2026-11-28 15:00+00')).toBe('2026-11-30'); // samedi après-midi → lundi
    expect(await day('2026-11-29 09:00+00')).toBe('2026-11-30'); // dimanche → lundi
  });

  it('la commande garde le jour promis ; zone ouverte partout quand le réglage est vide', async () => {
    const o = (await place(horsZone)).id;
    const r = await one<{ delivery_date: string | null }>('select delivery_date::text from orders where id = $1', [o]);
    expect(r.delivery_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('zone limitée à Ratoma : Kobaya accepté, une adresse hors zone refusée avec les communes servies', async () => {
    await db.exec(`update settings set value = 'com-ratoma' where key = 'livraison_communes'`);
    expect((await place(kobaya)).id).toBeTruthy();
    expect(await refused(place(horsZone))).toMatch(/livre pour l'instant à Ratoma/);
  });

  it('fn_delivery_window : créneau pour tous, zone seulement pour le titulaire de l’adresse', async () => {
    const w = (await as(db, U.acheteur, () => one<{ w: Record<string, unknown> }>('select fn_delivery_window($1) w', [horsZone]))).w;
    expect(w).toMatchObject({ debut: '14:00', fin: '18:00', limite: '13:00', zone_ok: false, communes: ['Ratoma'], partout: false });
    expect((await as(db, U.acheteur, () => one<{ w: Record<string, unknown> }>('select fn_delivery_window($1) w', [kobaya]))).w).toMatchObject({ zone_ok: true, commune: 'Ratoma' });
    expect((await as(db, U.acheteur2, () => one<{ w: Record<string, unknown> }>('select fn_delivery_window($1) w', [kobaya]))).w.zone_ok).toBeNull();
    expect((await as(db, 'anon', () => one<{ w: Record<string, unknown> }>('select fn_delivery_window() w'))).w.jour).toBeTruthy();
  });

  it('Console : réglages vérifiés, réservés au fondateur', async () => {
    await db.exec(`insert into agents (id, full_name, role) values ('${U.admin}', 'Fondateur', 'admin') on conflict (id) do nothing; update agents set console_role = 'fondateur' where id = '${U.admin}'`);
    const set = (k: string, v: string) => as(db, U.admin, () => db.query('select fn_console_setting_update($1, $2, $3)', [k, v, 'essai']));
    expect(await refused(set('livraison_communes', 'com-inconnue'))).toMatch(/commune inconnue/);
    expect(await refused(set('livraison_debut', '25:00'))).toMatch(/heure illisible/);
    expect(await refused(set('livraison_jours', '0,8'))).toMatch(/jours/);
    await set('livraison_communes', 'com-ratoma,com-dixinn');
    await set('livraison_heure_limite', '12:30');
    expect(await day('2026-11-23 12:45+00')).toBe('2026-11-24');
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_console_setting_update('livraison_fin', '19:00', 'essai')`)))).toMatch(/fondateur/);
  });
});
