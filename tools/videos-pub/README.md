# Vidéos publicitaires de produits — prototype (HAILANDX.md §38)

Prototype validé par le fondateur le 2026-10-23, **mis en attente** : l'intégration à HailandX Vendeur se fera plus tard.

- `src/Pub2.tsx` : modèle v2 (20 s, 1080×1920, 30 i/s) en 7 scènes calées sur la musique (120 BPM, 1 temps = 15 images) :
  accroche, révélation, 4 atouts, style, choix (tailles / coloris), prix, fin HailandX.
- `src/Root.tsx` : données des deux exemples (Djigo Shop), tirées de la fiche et de l'offre réelles.
- `synth.mjs` : musique de fond **composée par le code** (aucun droit à payer) — `jordan` (afro-house), `iphone` (électro).
- `src/Pub.tsx` : prototype v1 (12 s, sans son), gardé pour mémoire.

## Rendu
```sh
npm install
npm run photos && npm run musique
npx remotion render src/index.ts jordan2 out/jordan2.mp4 --browser-executable=<chrome-headless-shell>
```
