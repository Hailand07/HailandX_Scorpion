import type { ExpressionSpecification, StyleSpecification } from 'mapbox-gl';

/**
 * Carte « Hailand Nuit » (maquettes v5, planche N, validée le 2026-10-20) — Hailand Flotte seulement.
 * Style écrit ici (versionné dans le dépôt) sur les données Mapbox Streets v8 : la ville s'efface, seul ce qui sert au livreur
 * ressort (itinéraire vert citron, repères, sa position). Aucun réglage dans Mapbox Studio n'est nécessaire.
 */
export const NUIT = {
  mer: '#070b16',
  sol: '#10172a',
  verdure: '#132a24',
  equipement: '#141c32',
  rue: '#1b2440',
  secondaire: '#222c4a',
  axe: '#2b3656',
  axeCentre: '#3a4670',
  bati: '#161e36',
  batiRelief: '#19213b',
  texte: '#7d87a8',
  texteQuartier: '#8a93b3',
  halo: '#0b1020',
  itineraire: '#c8f25a',
  parcouru: '#3a4462',
} as const;

const zoomed = (pairs: [number, number][]) => ['interpolate', ['exponential', 1.5], ['zoom'], ...pairs.flat()] as unknown as number;
const nom: ExpressionSpecification = ['coalesce', ['get', 'name_fr'], ['get', 'name']];
const POLICE = ['DIN Pro Medium', 'Arial Unicode MS Regular'];
const POLICE_GRASSE = ['DIN Pro Bold', 'Arial Unicode MS Bold'];

const MINEURES = ['street', 'street_limited', 'service', 'track', 'pedestrian', 'path'];
const SECONDAIRES = ['secondary', 'tertiary', 'secondary_link', 'tertiary_link'];
const AXES = ['motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link', 'primary_link'];

export const HAILAND_NUIT: StyleSpecification = {
  version: 8,
  name: 'Hailand Nuit',
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
  sources: { rues: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' } },
  layers: [
    { id: 'sol', type: 'background', paint: { 'background-color': NUIT.sol } },
    { id: 'verdure', type: 'fill', source: 'rues', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['park', 'grass', 'cemetery', 'pitch', 'wood', 'scrub'], true, false], paint: { 'fill-color': NUIT.verdure, 'fill-opacity': 0.9 } },
    { id: 'equipements', type: 'fill', source: 'rues', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['hospital', 'school', 'commercial_area', 'industrial', 'airport'], true, false], paint: { 'fill-color': NUIT.equipement } },
    { id: 'mer', type: 'fill', source: 'rues', 'source-layer': 'water', paint: { 'fill-color': NUIT.mer } },
    { id: 'cours-eau', type: 'line', source: 'rues', 'source-layer': 'waterway', paint: { 'line-color': NUIT.mer, 'line-width': zoomed([[12, 1], [18, 6]]) } },
    { id: 'bati', type: 'fill', source: 'rues', 'source-layer': 'building', minzoom: 14, maxzoom: 15.5, filter: ['!=', ['get', 'underground'], 'true'], paint: { 'fill-color': NUIT.bati, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.6, 1] } },
    { id: 'rues', type: 'line', source: 'rues', 'source-layer': 'road', filter: ['match', ['get', 'class'], MINEURES, true, false], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': NUIT.rue, 'line-width': zoomed([[12, 0.5], [14, 2], [17, 9], [19, 22]]) } },
    { id: 'secondaires', type: 'line', source: 'rues', 'source-layer': 'road', filter: ['match', ['get', 'class'], SECONDAIRES, true, false], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': NUIT.secondaire, 'line-width': zoomed([[10, 0.8], [14, 3.5], [17, 13], [19, 28]]) } },
    { id: 'axes', type: 'line', source: 'rues', 'source-layer': 'road', filter: ['match', ['get', 'class'], AXES, true, false], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': NUIT.axe, 'line-width': zoomed([[8, 1], [12, 3], [14, 5.5], [17, 18], [19, 36]]) } },
    { id: 'axes-centre', type: 'line', source: 'rues', 'source-layer': 'road', minzoom: 12, filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false], layout: { 'line-cap': 'round' }, paint: { 'line-color': NUIT.axeCentre, 'line-width': zoomed([[12, 0.5], [17, 1.5]]) } },
    // Relief sombre des bâtiments, visible quand la carte est inclinée (navigation).
    { id: 'bati-relief', type: 'fill-extrusion', source: 'rues', 'source-layer': 'building', minzoom: 15, filter: ['all', ['==', ['get', 'extrude'], 'true'], ['!=', ['get', 'underground'], 'true']], paint: { 'fill-extrusion-color': NUIT.batiRelief, 'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.6, ['coalesce', ['get', 'height'], 6]], 'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0], 'fill-extrusion-opacity': 0.8 } },
    { id: 'noms-rues', type: 'symbol', source: 'rues', 'source-layer': 'road', minzoom: 13.5, filter: ['match', ['get', 'class'], [...MINEURES, ...SECONDAIRES, ...AXES], true, false], layout: { 'symbol-placement': 'line', 'text-field': nom, 'text-font': POLICE, 'text-size': zoomed([[13, 10], [18, 13]]), 'text-max-angle': 30, 'text-padding': 4 }, paint: { 'text-color': NUIT.texte, 'text-halo-color': NUIT.halo, 'text-halo-width': 1.4 } },
    { id: 'noms-axes', type: 'symbol', source: 'rues', 'source-layer': 'road', minzoom: 11.5, filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false], layout: { 'symbol-placement': 'line', 'text-field': nom, 'text-font': POLICE_GRASSE, 'text-size': zoomed([[12, 10], [18, 14]]), 'text-transform': 'uppercase', 'text-letter-spacing': 0.08, 'text-max-angle': 30 }, paint: { 'text-color': NUIT.texte, 'text-halo-color': NUIT.halo, 'text-halo-width': 1.6 } },
    { id: 'lieux-utiles', type: 'symbol', source: 'rues', 'source-layer': 'poi_label', minzoom: 15.5, filter: ['match', ['get', 'class'], ['medical', 'food_and_drink_stores', 'commercial_services', 'religion', 'education', 'public_facilities'], true, false], layout: { 'text-field': nom, 'text-font': POLICE, 'text-size': 11, 'text-max-width': 8 }, paint: { 'text-color': '#5d6788', 'text-halo-color': NUIT.halo, 'text-halo-width': 1.2 } },
    { id: 'quartiers', type: 'symbol', source: 'rues', 'source-layer': 'place_label', minzoom: 11, maxzoom: 16.5, filter: ['==', ['get', 'class'], 'settlement_subdivision'], layout: { 'text-field': nom, 'text-font': POLICE_GRASSE, 'text-size': zoomed([[11, 10], [15, 14]]), 'text-transform': 'uppercase', 'text-letter-spacing': 0.18, 'text-max-width': 7 }, paint: { 'text-color': NUIT.texteQuartier, 'text-halo-color': NUIT.halo, 'text-halo-width': 1.4 } },
    { id: 'villes', type: 'symbol', source: 'rues', 'source-layer': 'place_label', maxzoom: 13, filter: ['==', ['get', 'class'], 'settlement'], layout: { 'text-field': nom, 'text-font': POLICE_GRASSE, 'text-size': zoomed([[8, 12], [12, 17]]) }, paint: { 'text-color': '#c9cede', 'text-halo-color': NUIT.halo, 'text-halo-width': 1.6 } },
  ],
};
