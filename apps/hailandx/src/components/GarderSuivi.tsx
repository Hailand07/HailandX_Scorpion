'use client';
import { useState } from 'react';
import { HAILANDX_URL } from '@hailandx/kit';

/**
 * Le client n'a que le lien du produit : on l'aide à garder celui du suivi (§53). Il peut se l'envoyer sur WhatsApp (dans la
 * discussion « Moi » ou à un proche) ou le copier. En rouvrant n'importe quel lien HailandX sur ce téléphone, « Mes commandes »
 * apparaît aussi en haut de la page.
 */
export function GarderSuivi({ orderId }: { orderId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${HAILANDX_URL}/commandes/${orderId}`;
  const text = `Suivi de ma commande HailandX : ${url}`;
  return (
    <section aria-label="Garder le suivi" className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-card p-4">
      <h2 className="text-[15px] font-extrabold">Retrouver cette commande plus tard</h2>
      <p className="text-[13px] font-semibold leading-snug text-muted">Gardez ce lien : il ouvre directement cette commande. Rouvrir le lien du produit sur ce téléphone affiche aussi « Mes commandes » en haut de la page.</p>
      <div className="grid grid-cols-2 gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center rounded-xl bg-ok text-[13px] font-extrabold text-white">M’envoyer sur WhatsApp</a>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* copie refusée */ } }} className="flex h-11 items-center justify-center rounded-xl border border-line text-[13px] font-extrabold">{copied ? 'Lien copié ✓' : 'Copier le lien'}</button>
      </div>
    </section>
  );
}
