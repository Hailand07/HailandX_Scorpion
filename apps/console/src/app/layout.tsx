import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Ouverture } from '@hailandx/ui';
import { ConsoleShell } from '@/components/ConsoleShell';

export const metadata: Metadata = {
  title: { default: 'Hailand Console', template: '%s · Hailand Console' },
  description: 'Outil interne de l’équipe Hailand : certifications, boutiques, livreurs, litiges, argent, paramètres.',
  applicationName: 'Hailand Console',
  manifest: '/manifest.webmanifest',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#12141c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink"><Ouverture app="console" /><ConsoleShell>{children}</ConsoleShell></body>
    </html>
  );
}
