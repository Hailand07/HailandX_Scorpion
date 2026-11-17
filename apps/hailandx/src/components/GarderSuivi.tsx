'use client';
import { useState } from 'react';
import { HAILANDX_URL } from '@hailandx/kit';

/**
 * Le client n'a que le lien du produit : on l'aide à garder celui de la commande (§53) en le copiant (§57 : plus de bouton WhatsApp). En rouvrant n'importe quel lien HailandX sur ce téléphone, « Mes commandes »
 * apparaît aussi en haut de la page.
 */
export function GarderSuivi({ orderId }: { orderId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${HAILANDX_URL}/commandes/${orderId}`;
  return (
    <section aria-label="Garder le suivi" className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-card p-4">
      <h2 className="text-[15px] font-extrabold">Retrouver cette commande plus tard</h2>
      <p className="text-[13px] font-semibold leading-snug text-muted">Gardez ce lien : il ouvre directement cette commande. Rouvrir le lien du produit sur ce téléphone affiche aussi « Mes commandes » en haut de la page.</p>
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* copie refusée */ } }} className="flex h-11 items-center justify-center rounded-xl border border-line text-[13px] font-extrabold">{copied ? 'Lien copié ✓' : 'Copier le lien'}</button>
    </section>
  );
}
