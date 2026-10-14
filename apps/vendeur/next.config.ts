import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@hailandx/ui', '@hailandx/commerce', '@hailandx/kit'],
  poweredByHeader: false,
};
export default config;
