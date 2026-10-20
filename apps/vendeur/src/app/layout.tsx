import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Ouverture } from '@hailandx/ui';
import { VendeurNav } from '@/components/VendeurNav';

export const metadata: Metadata = {
  title: { default: 'HailandX Vendeur — votre boutique', template: '%s · HailandX Vendeur' },
  description: 'Ouvrez et gérez votre boutique HailandX : commandes, produits, argent, statistiques.',
  manifest: '/manifest.webmanifest',
  applicationName: 'HailandX Vendeur',
};

export const viewport: Viewport = { themeColor: '#f6f4ef', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink"><Ouverture app="vendeur" />{children}<VendeurNav /></body>
    </html>
  );
}
