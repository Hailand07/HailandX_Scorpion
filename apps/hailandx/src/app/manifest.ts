import type { MetadataRoute } from 'next';

/** Application installable depuis le navigateur (écran d'accueil du téléphone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HailandX',
    short_name: 'HailandX',
    description: 'La place du marché adressée de Guinée.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f4ef',
    theme_color: '#f6f4ef',
    lang: 'fr',
    icons: [
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
