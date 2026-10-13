import { describe, expect, it } from 'vitest';
import {
  buildFeed, buyerStep, canDeliverTo, canSell, canTransition, checkHandoverCode, deliveryFeeGnf, doorPrecision, formatGnf, isFinal, MAX_HANDOVER_ATTEMPTS,
  newHandoverCode, normalizeGnPhone, formatGnPhone, slugify, parseParcelQr, rankOffers, shopState, trustScore, withinHandoverRange, badgesFor, type FeedCandidate, type Offer,
} from './index';

describe('montants', () => {
  it('formate les GNF avec espaces fines', () => {
    expect(formatGnf(185000)).toBe('185 000 GNF');
    expect(formatGnf(999, false)).toBe('999');
    expect(formatGnf(-1500)).toBe('-1 500 GNF');
  });
  it('frais de livraison : base + km, arrondi à 500, minimum 8 000', () => {
    expect(deliveryFeeGnf(4.2)).toBe(15000);
    expect(deliveryFeeGnf(0)).toBe(8000);
    expect(deliveryFeeGnf(10)).toBe(27000);
    expect(deliveryFeeGnf(Number.NaN)).toBe(8000);
  });
});

describe('colis', () => {
  it('suit le cycle de vie autorisé', () => {
    expect(canTransition('attente_vendeur', 'prepare')).toBe(true);
    expect(canTransition('prepare', 'mission_proposee')).toBe(true);
    expect(canTransition('accepte', 'retire')).toBe(true);
    expect(canTransition('retire', 'remis')).toBe(true);
  });
  it('refuse les sauts et les retours', () => {
    expect(canTransition('prepare', 'remis')).toBe(false);
    expect(canTransition('retire', 'prepare')).toBe(false);
    expect(canTransition('annule', 'prepare')).toBe(false);
    expect(canTransition('remis', 'annule')).toBe(false);
  });
  it('un livreur peut se désister : la mission est reproposée', () => {
    expect(canTransition('accepte', 'mission_proposee')).toBe(true);
  });
  it('états finaux et étapes vues par l’acheteur', () => {
    expect(isFinal('remis')).toBe(true);
    expect(isFinal('retire')).toBe(false);
    expect(buyerStep('accepte')).toBe('preparee');
    expect(buyerStep('retire')).toBe('en_route');
    expect(buyerStep('remis')).toBe('remise');
  });
});

describe('remise', () => {
  it('code de remise à 4 chiffres, avec zéros de tête', () => {
    expect(newHandoverCode(() => 0)).toBe('0000');
    expect(newHandoverCode(() => 0.4827)).toBe('4827');
    expect(newHandoverCode(() => 0.99999)).toBe('9999');
  });
  it('accepte le bon code, refuse les autres', () => {
    expect(checkHandoverCode('4827', '4827', 0).ok).toBe(true);
    expect(checkHandoverCode('4827', '4828', 0).ok).toBe(false);
    expect(checkHandoverCode('4827', '48', 0).ok).toBe(false);
    expect(checkHandoverCode('4827', 'abcd', 0).ok).toBe(false);
  });
  it('verrouille après 5 échecs, même avec le bon code', () => {
    expect(checkHandoverCode('4827', '0000', 3).attemptsLeft).toBe(1);
    expect(checkHandoverCode('4827', '0000', 4).attemptsLeft).toBe(0);
    expect(checkHandoverCode('4827', '4827', MAX_HANDOVER_ATTEMPTS)).toEqual({ ok: false, attemptsLeft: 0 });
  });
  it('contrôle de proximité tenant compte de la précision de l’adresse', () => {
    expect(withinHandoverRange(120)).toBe(true);
    expect(withinHandoverRange(200)).toBe(false);
    expect(withinHandoverRange(200, 60)).toBe(true);
  });
  it('lit un QR de colis bien formé et refuse le reste', () => {
    const ok = parseParcelQr('hx1.PCL_8f3a2c91.n0nc3abc123.sig_0123456789abcdef0123');
    expect(ok?.parcelId).toBe('PCL_8f3a2c91');
    expect(parseParcelQr('https://exemple.com')).toBeNull();
    expect(parseParcelQr('hx1.a.b.c')).toBeNull();
  });
});

describe('règles de niveau', () => {
  it('le vendeur doit être au niveau 3 pour vendre', () => {
    expect(canSell(3)).toBe(true);
    expect(canSell(2)).toBe(false);
    expect(canSell(1)).toBe(false);
    expect(canSell(null)).toBe(false);
  });
  it('l’acheteur doit avoir au moins le niveau 1', () => {
    expect(canDeliverTo(1)).toBe(true);
    expect(canDeliverTo(3)).toBe(true);
    expect(canDeliverTo(undefined)).toBe(false);
  });
  it('état de la boutique : préparation, bientôt disponible, ouverte, suspendue', () => {
    expect(shopState(null, false)).toBe('preparation');
    expect(shopState(2, true)).toBe('bientot');
    expect(shopState(3, true)).toBe('ouverte');
    expect(shopState(3, true, true)).toBe('suspendue');
  });
  it('précision de la porte selon le niveau', () => {
    expect(doorPrecision(3)).toBe('portail');
    expect(doorPrecision(2)).toBe('batiment');
    expect(doorPrecision(1)).toBe('zone');
  });
});

const base = { rating: 4.9, reviewCount: 400, reliability: 0.99, sales: 1200, ageDays: 700, quality: 0.9, priceScore: 0.8 };
describe('indice de confiance', () => {
  it('reste entre 0 et 100 et monte avec la qualité', () => {
    const top = trustScore(base);
    expect(top).toBeGreaterThan(85);
    expect(top).toBeLessThanOrEqual(100);
    expect(trustScore({ ...base, rating: 2, reliability: 0.5 })).toBeLessThan(top);
    expect(trustScore({ rating: 0, reviewCount: 0, reliability: 0, sales: 0, ageDays: 0, quality: 0, priceScore: 0 })).toBeGreaterThanOrEqual(0);
  });
  it('un nouveau vendeur avec 2 avis parfaits ne dépasse pas un vendeur établi', () => {
    const newcomer = trustScore({ ...base, rating: 5, reviewCount: 2, sales: 3, ageDays: 10 });
    expect(newcomer).toBeLessThan(trustScore(base));
  });
  it('badges : top vendeur, taux de livraison, rapidité, nouveau vendeur', () => {
    const b = badgesFor({ ...base, prepMinutes: 20 });
    expect(b).toContain('Top vendeur');
    expect(b).toContain('99 % livrés');
    expect(b).toContain('Prépare en 20 min');
    expect(badgesFor({ ...base, sales: 5, ageDays: 10, reviewCount: 1, prepMinutes: 60 })).toContain('Nouveau vendeur');
  });
});

const c = (id: string, shopId: string, category: string, score: number, shopTrust = 80, extra: Partial<FeedCandidate> = {}): FeedCandidate => ({ id, shopId, category, score, shopTrust, ...extra });
describe('fil « la rue »', () => {
  const items = [
    c('a1', 'A', 'mode', 0.9), c('a2', 'A', 'mode', 0.8), c('a3', 'A', 'beaute', 0.7),
    c('b1', 'B', 'mode', 0.6), c('b2', 'B', 'tech', 0.9), c('c1', 'C', 'mode', 0.5, 60),
  ];
  it('un seul échantillon par boutique et par catégorie', () => {
    const feed = buildFeed(items);
    const keys = feed.map((f) => `${f.shopId}|${f.category}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(feed).toHaveLength(5);
  });
  it('l’échantillon tourne avec la rotation', () => {
    const r0 = buildFeed(items, { rotation: 0 }).find((f) => f.shopId === 'A' && f.category === 'mode')!.id;
    const r1 = buildFeed(items, { rotation: 1 }).find((f) => f.shopId === 'A' && f.category === 'mode')!.id;
    expect(r0).not.toBe(r1);
  });
  it('évite deux échantillons de la même boutique à la suite quand c’est possible', () => {
    const feed = buildFeed(items);
    for (let i = 1; i < feed.length; i++) expect(feed[i].shopId === feed[i - 1].shopId).toBe(false);
  });
  it('filtre par catégorie et limite le nombre', () => {
    expect(buildFeed(items, { category: 'mode' }).every((f) => f.category === 'mode')).toBe(true);
    expect(buildFeed(items, { limit: 2 })).toHaveLength(2);
  });
  it('une nouvelle boutique reçoit un coup de pouce temporaire', () => {
    const without = buildFeed([c('x', 'X', 'mode', 0.4, 60), c('y', 'Y', 'mode', 0.45, 60)]);
    expect(without[0].id).toBe('y');
    const withBoost = buildFeed([c('x', 'X', 'mode', 0.4, 60, { shopIsNew: true }), c('y', 'Y', 'mode', 0.45, 60)]);
    expect(withBoost[0].id).toBe('x');
  });
});

describe('offres d’une fiche commune', () => {
  const o = (id: string, price: number, trust: number, eta: number, inStock = true): Offer => ({ id, shopId: id, priceGnf: price, shopTrust: trust, etaMinutes: eta, inStock });
  it('recommande la confiance avant le prix', () => {
    const ranked = rankOffers([o('moins-cher', 100000, 40, 90), o('fiable', 110000, 92, 45)]);
    expect(ranked[0].id).toBe('fiable');
  });
  it('relègue les offres en rupture en fin de liste', () => {
    const ranked = rankOffers([o('rupture', 90000, 99, 20, false), o('ok', 120000, 70, 60)]);
    expect(ranked.map((x) => x.id)).toEqual(['ok', 'rupture']);
  });
  it('à confiance égale, le prix et le délai départagent', () => {
    const ranked = rankOffers([o('cher', 130000, 80, 60), o('bon', 110000, 80, 45)]);
    expect(ranked[0].id).toBe('bon');
  });
});

describe('téléphone et identifiants', () => {
  it('normalise les numéros guinéens', () => {
    expect(normalizeGnPhone('610 01 04 19')).toBe('+224610010419');
    expect(normalizeGnPhone('+224 610010419')).toBe('+224610010419');
    expect(normalizeGnPhone('00224610010419')).toBe('+224610010419');
    expect(normalizeGnPhone('224610010419')).toBe('+224610010419');
  });
  it('refuse les numéros invalides', () => {
    expect(normalizeGnPhone('')).toBeNull();
    expect(normalizeGnPhone('12345')).toBeNull();
    expect(normalizeGnPhone('510010419')).toBeNull();
    expect(normalizeGnPhone('+33612345678')).toBeNull();
  });
  it('affiche un numéro lisible', () => {
    expect(formatGnPhone('+224610010419')).toBe('+224 610 01 04 19');
  });
  it('fabrique un identifiant de lien', () => {
    expect(slugify('Kadi Wax & Co')).toBe('kadi-wax-co');
    expect(slugify('  Beauté Nafi  ')).toBe('beaute-nafi');
    expect(slugify('é')).toBe('e');
  });
});
