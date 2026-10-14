import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@hailandx/ui', '@hailandx/commerce', '@hailandx/kit'],
  poweredByHeader: false,
  // Nom de l'application pour le Compte Hailand (passage de session, origine du compte).
  env: { NEXT_PUBLIC_HAILAND_APP: 'console' },
  // Outil interne : jamais indexé par les moteurs de recherche.
  async headers() { return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]; },
};
export default config;
