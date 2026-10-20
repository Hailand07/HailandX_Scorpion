/**
 * Génère les icônes des 4 applications à partir de la source unique `packages/ui/src/marks.ts`.
 * Lancer après toute modification d'un logo :  node --experimental-strip-types scripts/icones.ts
 * Produit, pour chaque application : src/app/icon.svg (onglet), src/app/apple-icon.png (iPhone, 180 px),
 * public/icone-192.png, public/icone-512.png, public/icone-maskable-512.png (installation Android).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { markSvg, type HailandApp } from '../packages/ui/src/marks.ts';

const require = createRequire(import.meta.url);
const sharp = require('sharp') as typeof import('sharp');

const APPS: Record<HailandApp, string> = { hailandx: 'apps/hailandx', vendeur: 'apps/vendeur', flotte: 'apps/flotte', console: 'apps/console' };

const png = (svg: string, size: number) => sharp(Buffer.from(svg), { density: Math.ceil((72 * size) / 64) }).resize(size, size).png().toBuffer();

for (const [app, dir] of Object.entries(APPS) as [HailandApp, string][]) {
  mkdirSync(`${dir}/public`, { recursive: true });
  writeFileSync(`${dir}/src/app/icon.svg`, markSvg(app));
  writeFileSync(`${dir}/src/app/apple-icon.png`, await png(markSvg(app, { plein: true, marge: 6 }), 180));
  writeFileSync(`${dir}/public/icone-192.png`, await png(markSvg(app), 192));
  writeFileSync(`${dir}/public/icone-512.png`, await png(markSvg(app), 512));
  writeFileSync(`${dir}/public/icone-maskable-512.png`, await png(markSvg(app, { plein: true, marge: 10 }), 512));
  console.log(`✓ ${app}`);
}
