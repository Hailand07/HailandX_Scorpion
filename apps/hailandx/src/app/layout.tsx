import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'HailandX — la place du marché adressée', template: '%s · HailandX' },
  description: 'Achetez auprès de vendeurs certifiés, livrés à votre porte par la Flotte Hailand.',
  manifest: '/manifest.webmanifest',
  applicationName: 'HailandX',
};

export const viewport: Viewport = { themeColor: '#f6f4ef', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* ⚠️ Polices chargées depuis Google Fonts ; à héberger soi-même avant la mise en production (vitesse en 3G, vie privée). */}
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
