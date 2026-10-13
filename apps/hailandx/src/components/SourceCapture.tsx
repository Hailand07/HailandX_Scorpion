'use client';
import { useEffect } from 'react';
import { rememberSource } from '@/lib/source';

/** Lit `?src=` (posé par un lien suivi) et le garde pour la commande. N'affiche rien. */
export function SourceCapture() {
  useEffect(() => { rememberSource(new URLSearchParams(window.location.search).get('src')); }, []);
  return null;
}
