import { describe, expect, it } from 'vitest';
import { announcements, arrivalClock, arrived, bearing, directionsUrl, haversine, inPolygon, isOffRoute, meters, minutes, prepare, profileOf, progress, splitAt, followZoom, speedKmh, turnOf, type LngLat, type Route } from './nav';

// Itinéraire en L près de Matam : 333 m vers le nord, puis 220 m vers l'est (≈ 0,003° de latitude, 0,002° de longitude).
const A: LngLat = [-13.66, 9.54], B: LngLat = [-13.66, 9.543], C: LngLat = [-13.658, 9.543];
const route: Route = {
  distance: 553, duration: 120,
  geometry: { type: 'LineString', coordinates: [A, [-13.66, 9.5415], B, C] },
  legs: [{ distance: 553, duration: 120, steps: [
    { distance: 333, duration: 70, name: 'Route du Niger', maneuver: { type: 'depart', instruction: 'Roulez vers le nord sur la route du Niger', location: A } },
    { distance: 220, duration: 50, name: 'Rue MA.12', maneuver: { type: 'turn', modifier: 'right', instruction: 'Tournez à droite sur la rue MA.12', location: B },
      voiceInstructions: [{ distanceAlongGeometry: 100, announcement: 'Dans 100 mètres, vous arrivez à destination' }] },
    { distance: 0, duration: 0, maneuver: { type: 'arrive', instruction: 'Vous êtes arrivé', location: C } },
  ] }],
};

describe('géométrie', () => {
  it('distance et cap', () => {
    expect(Math.round(haversine(A, B))).toBe(334);
    expect(Math.round(bearing(A, B))).toBe(0);
    expect(Math.round(bearing(B, C))).toBe(90);
  });
  it('point dans un contour', () => {
    const sq = { type: 'Polygon', coordinates: [[[-13.6601, 9.5399], [-13.6599, 9.5399], [-13.6599, 9.5401], [-13.6601, 9.5401], [-13.6601, 9.5399]]] };
    expect(inPolygon(A, sq)).toBe(true);
    expect(inPolygon(B, sq)).toBe(false);
    expect(inPolygon(A, null)).toBe(false);
  });
});

describe('progression sur l’itinéraire', () => {
  const p = prepare(route);
  it('au départ : première étape, prochaine manœuvre « à droite » à ≈ 333 m', () => {
    const g = progress(p, A);
    expect(g.step).toBe(0);
    expect(g.next?.modifier).toBe('right');
    expect(Math.round(g.toManeuver / 10) * 10).toBe(330);
    expect(Math.round(g.remaining)).toBeGreaterThan(540);
    expect(g.then?.maneuver.type).toBe('arrive');
  });
  it('à mi-chemin, légèrement décalé de la rue : sur l’itinéraire', () => {
    const g = progress(p, [-13.6601, 9.5415]);
    expect(Math.round(g.toManeuver / 10) * 10).toBe(170);
    expect(g.offRoute).toBeLessThan(15);
    expect(isOffRoute(g.offRoute, 8)).toBe(false);
    expect(g.remainingSeconds).toBeGreaterThan(75);
    expect(g.remainingSeconds).toBeLessThan(90); // 387 m restants sur 553 m, 120 s au total
  });
  it('après le virage : étape suivante, arrivée annoncée', () => {
    const g = progress(p, [-13.659, 9.543]);
    expect(g.step).toBe(1);
    expect(g.next?.type).toBe('arrive');
  });
  it('à 100 m de la route : hors route (recalcul)', () => {
    const g = progress(p, [-13.6609, 9.5415]);
    expect(isOffRoute(g.offRoute, 10)).toBe(true);
    expect(isOffRoute(30, 40)).toBe(false); // GPS imprécis : on tolère davantage
  });
  it('annonces vocales : seuils par défaut puis ceux de Mapbox, chacune une seule fois', () => {
    expect(announcements(p, 0, 10)).toEqual([]);
    expect(announcements(p, 150, 200)).toEqual(['Dans 150 mètres, tournez à droite sur la rue MA.12']);
    expect(announcements(p, 290, 320)).toEqual(['Tournez à droite sur la rue MA.12']);
    expect(announcements(p, 400, 460)).toEqual(['Dans 100 mètres, vous arrivez à destination']);
    expect(announcements(p, 460, 400)).toEqual([]);
  });
});

describe('arrivée et affichage', () => {
  it('« Je suis arrivé » à moins de 50 m, ou dans le contour du bâtiment', () => {
    expect(arrived([-13.6603, 9.5402], A)).toBe(true);   // ≈ 40 m
    expect(arrived([-13.6606, 9.5404], A)).toBe(false);  // ≈ 80 m
    const big = { type: 'Polygon', coordinates: [[[-13.661, 9.539], [-13.659, 9.539], [-13.659, 9.541], [-13.661, 9.541], [-13.661, 9.539]]] };
    expect(arrived([-13.6606, 9.5404], A, big)).toBe(true);
  });
  it('distances, durées, heure d’arrivée, pictogrammes', () => {
    expect(meters(193)).toBe('200 m');
    expect(meters(36)).toBe('40 m');
    expect(meters(1234)).toBe('1,2 km');
    expect(minutes(290)).toBe('5 min');
    expect(minutes(3900)).toBe('1 h 05');
    expect(arrivalClock(new Date(2026, 9, 14, 14, 27), 300)).toBe('14 h 32');
    expect(turnOf({ type: 'turn', modifier: 'slight left' })).toBe('slight-left');
    expect(turnOf({ type: 'roundabout', modifier: 'right' })).toBe('roundabout');
    expect(turnOf({ type: 'arrive' })).toBe('arrive');
  });
  it('profil et adresse de l’API Directions (français, consignes vocales)', () => {
    expect(profileOf('moto')).toBe('driving');
    expect(profileOf('pied')).toBe('walking');
    const u = directionsUrl([A, C], 'driving', 'pk.test');
    expect(u).toContain('/mapbox/driving/-13.660000,9.540000;-13.658000,9.543000?');
    expect(u).toContain('language=fr');
    expect(u).toContain('voice_instructions=true');
  });
});

describe('trajet parcouru', () => {
  const p = prepare(route);
  it('coupe l’itinéraire au point atteint, sans perdre de tracé', () => {
    const { done, rest } = splitAt(p, 400);
    expect(done[0]).toEqual(A);
    expect(rest.at(-1)).toEqual(C);
    expect(done.at(-1)).toEqual(rest[0]); // même point de coupure
    expect(Math.round(haversine(B, rest[0]!))).toBeGreaterThan(55); // ≈ 66 m après le virage
    expect(rest[0]![1]).toBeCloseTo(9.543, 5);
  });
  it('rien de parcouru au départ, tout à l’arrivée', () => {
    expect(splitAt(p, 0)).toEqual({ done: [], rest: p.coords });
    expect(splitAt(p, 10_000)).toEqual({ done: p.coords, rest: [] });
  });
});

describe('navigation avancée', () => {
  it('zoom de la caméra selon la vitesse', () => {
    expect(followZoom(null)).toBe(17.3);
    expect(followZoom(0)).toBe(17.8); // à l'arrêt : au plus près
    expect(followZoom(10 / 3.6)).toBe(17.8);
    expect(followZoom(30 / 3.6)).toBe(17); // à mi-chemin
    expect(followZoom(80 / 3.6)).toBe(16.2); // plafonné
  });
  it('vitesse affichée', () => {
    expect(speedKmh(null)).toBeNull();
    expect(speedKmh(-1)).toBeNull();
    expect(speedKmh(8.9)).toBe(32);
  });
  it('rue suivante et progression dans le bandeau', () => {
    const p = prepare(route);
    const g = progress(p, [-13.66, 9.542]);
    expect(g.nextName).toBe('Rue MA.12');
    expect(g.fraction).toBeGreaterThan(0.3);
    expect(g.fraction).toBeLessThan(0.7);
    expect(progress(p, C).fraction).toBe(1);
  });
});
