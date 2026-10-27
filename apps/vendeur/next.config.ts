import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@hailandx/ui', '@hailandx/commerce', '@hailandx/scorpion', '@hailandx/kit'],
  poweredByHeader: false,
  // Nom de l'application pour le Compte Hailand (passage de session, origine du compte).
  env: { NEXT_PUBLIC_HAILAND_APP: 'vendeur' },
};
export default config;
