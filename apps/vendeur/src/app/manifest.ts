import type { MetadataRoute } from 'next';

/** Application installable depuis le navigateur (écran d'accueil du téléphone du vendeur). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HailandX Vendeur',
    short_name: 'HX Vendeur',
    description: 'Votre boutique HailandX : commandes, produits, argent.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f4ef',
    theme_color: '#f6f4ef',
    lang: 'fr',
  };
}
