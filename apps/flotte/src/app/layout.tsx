import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Ouverture } from '@hailandx/ui';

export const metadata: Metadata = {
  title: { default: 'Hailand Flotte', template: '%s · Hailand Flotte' },
  description: 'Missions de livraison de la Flotte Hailand.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Hailand Flotte',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0f1424', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh bg-night font-sans text-night-text"><Ouverture app="flotte" />{children}</body>
    </html>
  );
}
