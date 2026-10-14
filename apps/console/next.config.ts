import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@hailandx/ui', '@hailandx/commerce', '@hailandx/kit'],
  poweredByHeader: false,
  // Outil interne : jamais indexé par les moteurs de recherche.
  async headers() { return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]; },
};
export default config;
