import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hailand Flotte',
    short_name: 'Flotte',
    description: 'Missions de livraison de la Flotte Hailand.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f1424',
    theme_color: '#0f1424',
    lang: 'fr',
    icons: [
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
