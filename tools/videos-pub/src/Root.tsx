import React from 'react';
import { Composition } from 'remotion';
import { Pub, type PubProps } from './Pub';
import { Pub2, type Pub2Props } from './Pub2';

/** Prototypes v1 (12 s, sans son). */
export const PUBS: Record<string, PubProps> = {
  jordan: { theme: 'nuit', hook: ['Les Jordan 1', 'sont arrivées.'], photo: 'jordan.webp', detoure: true, name: 'Nike Air Jordan 1 Mid', detail: 'Rouge et noir · toutes tailles', category: 'Mode', price: 1250000 },
  miel: { theme: 'miel', hook: ['Le vrai miel', 'du Fouta.'], photo: 'miel.jpg', detoure: false, name: 'Miel naturel du Fouta', detail: 'Pot de 1 kg · récolté en Guinée', category: 'Alimentation', price: 120000 },
  iphone: { theme: 'clair', hook: ['iPhone 13 Pro.', 'Livré chez vous.'], photo: 'iphone.webp', detoure: true, name: 'iPhone 13 Pro 256 Go', detail: 'Bleu alpin · garanti par le vendeur', category: 'Téléphones', price: 7900000 },
};

/**
 * v2 (20 s, avec musique). Tous les arguments viennent de la fiche et de l'offre réelles de Djigo Shop
 * (catalog_products.description / attributes, offers.description, offer_variants) : rien n'est inventé.
 */
export const PUBS2: Record<string, Pub2Props> = {
  jordan2: {
    music: 'jordan.wav', accent: '#ff3b3b', glow: 'rgba(225, 40, 50, 0.6)', bg: '#0b0b10',
    hook: ['UNE', 'ICÔNE', 'NÉE EN', '1985.'], outline: 'JORDAN',
    hero: 'jordan.webp', heroAlt: 'jordan3.webp', name: 'Air Jordan 1 Mid', tagline: 'Nike · rouge, noir et blanc', chips: ['Neuf', 'Cuir', 'Amorti Air'],
    features: [
      { title: 'Tige en cuir', sub: 'Cuir et synthétique : solide, facile à entretenir.', photo: 'jordan.webp', zoom: 1.9, x: 30, y: 62 },
      { title: 'Amorti Air au talon', sub: 'Un confort qui tient toute la journée.', photo: 'jordan3.webp', zoom: 2.0, x: 50, y: 66 },
      { title: 'Col rembourré', sub: 'Coupe montante qui tient la cheville.', photo: 'jordan.webp', zoom: 2.3, x: 62, y: 36 },
      { big: '100 %', title: 'Authentique', sub: 'Livrée dans sa boîte d’origine.', photo: 'jordan.webp', zoom: 1.05, x: 50, y: 50 },
    ],
    style: { title: 'Avec tout', words: ['Jean.', 'Jogging.', 'Short.', 'Partout.'] },
    choice: { title: 'Pointures 40 à 44', options: ['40', '41', '42', '43', '44'], notes: ['Prenez votre pointure habituelle', 'Échange de pointure sous 3 jours'] },
    price: 1250000, priceNotes: ['Payez à la livraison', 'Livrée à votre porte par Hailand'], shop: 'Djigo Shop', urgency: 'Plus que 11 paires en stock',
  },
  iphone2: {
    music: 'iphone.wav', accent: '#8fa0ff', glow: 'rgba(51, 70, 240, 0.75)', bg: '#070a1a',
    hook: ['PLUS FLUIDE.', 'PLUS NET.', 'PLUS RAPIDE.', 'PRO.'], outline: 'PRO',
    hero: 'iphone2.webp', heroAlt: 'iphone.webp', name: 'iPhone 13 Pro', tagline: 'Apple · 256 Go · neuf', chips: ['Débloqué', '5G', 'Double SIM'],
    features: [
      { big: '120 Hz', title: 'Écran ProMotion', sub: '6,1 pouces Super Retina XDR : tout défile en douceur.', photo: 'iphone2.webp', zoom: 1.25, x: 50, y: 40 },
      { big: '×3', title: 'Triple caméra 12 Mpx', sub: 'Grand-angle, ultra grand-angle, téléobjectif. Mode nuit.', photo: 'iphone.webp', zoom: 2.0, x: 32, y: 18 },
      { big: 'A15', title: 'Puce A15 Bionic', sub: 'Les jeux et applis les plus lourds, sans effort.', photo: 'iphone3.webp', zoom: 1.1, x: 50, y: 50 },
      { big: '1 jour', title: 'D’autonomie', sub: 'Une batterie qui tient une journée complète.', photo: 'iphone2.webp', zoom: 1.0, x: 50, y: 50 },
    ],
    style: { title: 'Fait pour', words: ['Photos.', 'Vidéos.', 'Jeux.', 'Business.'] },
    choice: { title: 'Deux coloris', options: ['Bleu alpin', 'Graphite'], notes: ['Garantie boutique 1 an', 'Contacts et WhatsApp transférés, offert'] },
    price: 7900000, priceNotes: ['Payez à la livraison', 'Livré à votre porte par Hailand'], shop: 'Djigo Shop', urgency: 'Plus que 5 en stock',
  },
};

export const Root: React.FC = () => (
  <>
    {Object.entries(PUBS).map(([id, props]) => <Composition key={id} id={id} component={Pub} durationInFrames={360} fps={30} width={1080} height={1920} defaultProps={props} />)}
    {Object.entries(PUBS2).map(([id, props]) => <Composition key={id} id={id} component={Pub2} durationInFrames={600} fps={30} width={1080} height={1920} defaultProps={props} />)}
  </>
);
