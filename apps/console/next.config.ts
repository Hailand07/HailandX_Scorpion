import type { NextConfig } from 'next';

// Déploiement de la phase 5 « Compte Hailand » (2026-10-16) : modification sans effet qui force la reconstruction (le déploiement du
// 2026-10-14 avait été refusé par la limite quotidienne de Vercel).
const config: NextConfig = {
  transpilePackages: ['@hailandx/ui', '@hailandx/commerce', '@hailandx/kit'],
  poweredByHeader: false,
  // Nom de l'application pour le Compte Hailand (passage de session, origine du compte).
  env: { NEXT_PUBLIC_HAILAND_APP: 'console' },
  // Outil interne : jamais indexé par les moteurs de recherche.
  async headers() { return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]; },
};
export default config;
