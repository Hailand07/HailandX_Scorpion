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
  };
}
