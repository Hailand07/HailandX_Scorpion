/**
 * Scorpion — la localisation et l'adresse de l'écosystème Hailand (nom donné par le fondateur le 2026-10-12).
 * Ce paquet reprend, SANS changement de logique, les modules purs déjà éprouvés dans NavigationX (Hailand07/Lynx) :
 *  - `gpsAcquisition` : mesures GPS multiples, moyenne pondérée, précision, confiance ;
 *  - `buildingDetection` : bâtiment certifié / OSM / le plus proche, bâtiment sous le doigt ;
 *  - `levels` : niveaux d'adresse 1, 2, 3 ;
 *  - `geoDiagnostic` : pourquoi la localisation échoue et quoi faire (iPhone, navigateur intégré à WhatsApp).
 * Restent à extraire de NavigationX (voir HAILANDX.md §6) : `ownBuilding`, `certifiedBuildings`, `osmDetection`, les écrans d'enregistrement.
 * ⚠️ Tant que NavigationX garde sa copie, les tests de ce paquet sont la référence : toute correction se fait des deux côtés.
 */
export * from './levels';
export * from './gpsAcquisition';
export * from './buildingDetection';
export * from './geoDiagnostic';
