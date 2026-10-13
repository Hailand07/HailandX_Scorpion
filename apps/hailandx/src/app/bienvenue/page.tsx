import type { Metadata } from 'next';
import { WelcomeScreen } from '@/components/WelcomeScreen';

export const metadata: Metadata = { title: 'Bienvenue' };

/** Écran d'ouverture, toujours accessible (lien « À propos » ou partage). */
export default function WelcomePage() {
  return <WelcomeScreen />;
}
