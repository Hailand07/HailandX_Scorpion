import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@hailandx/ui', '@hailandx/commerce', '@hailandx/scorpion', '@hailandx/kit'],
  poweredByHeader: false,
  // Nom de l'application pour le Compte Hailand (passage de session, origine du compte).
  env: { NEXT_PUBLIC_HAILAND_APP: 'hailandx' },
  // L'espace vendeur est une application à part (HailandX Vendeur) : les anciennes adresses y renvoient.
  async redirects() {
    const vendeur = process.env.NEXT_PUBLIC_VENDEUR_URL ?? 'https://hailandx-vendeur-gn.vercel.app';
    return [
      { source: '/vendeur', destination: vendeur, permanent: false },
      { source: '/vendeur/:path*', destination: `${vendeur}/:path*`, permanent: false },
    ];
  },
};
export default config;
