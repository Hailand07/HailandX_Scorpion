import type { MetadataRoute } from 'next';

/** Console installable (raccourci sur l'ordinateur ou le téléphone de l'équipe). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hailand Console',
    short_name: 'Console',
    description: 'Outil interne de l’équipe Hailand.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f4ef',
    theme_color: '#12141c',
    lang: 'fr',
    icons: [
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
