'use client';
import { useEffect, useState } from 'react';
import { browserClient, errText, HAILANDX_URL } from '@hailandx/kit';

/**
 * « Envoyer un lien au destinataire » (refonte §51) : le client qui commande pour quelqu'un d'autre (ou qui n'est pas sur
 * place) envoie un lien ; le destinataire repère son bâtiment ; l'adresse arrive ici toute seule et la commande continue.
 */
export function LienAdresse({ onDone, onClose }: { onDone: (declarationId: string) => void; onClose: () => void }) {
  const sb = browserClient();
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = token ? `${HAILANDX_URL}/adresse/lien/${token}` : '';
  const text = `Bonjour${name.trim() ? ` ${name.trim()}` : ''}, je vous envoie un colis avec HailandX. Ouvrez ce lien là où il doit être livré, pour montrer votre bâtiment au livreur : ${url}`;

  // L'adresse arrive dès que le destinataire a terminé : on regarde toutes les 5 secondes.
  useEffect(() => {
    if (!sb || !token) return;
    const t = setInterval(async () => {
      const { data } = await sb.from('address_requests').select('declaration_id').eq('token', token).maybeSingle();
      const id = (data as { declaration_id: string | null } | null)?.declaration_id;
      if (id) { clearInterval(t); onDone(id); }
    }, 5000);
    return () => clearInterval(t);
  }, [sb, token, onDone]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(null); setBusy(true);
    const { data, error: err } = await sb!.rpc('fn_address_request_create', { p_label: name.trim() || 'Destinataire' });
    setBusy(false);
    if (err || typeof data !== 'string') return setError(err && !/fn_address_request_create/.test(err.message) ? errText(err) : 'Cette fonction n’est pas encore ouverte. Réessayez plus tard.');
    setToken(data);
  }

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col gap-4 bg-bg px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 font-sans text-ink">
      <button type="button" onClick={onClose} className="self-start text-[14px] font-extrabold text-blue-ink">← Retour</button>
      <h1 className="font-display text-[24px] font-semibold leading-tight tracking-[-0.02em]">Envoyer un lien au destinataire</h1>
      {!token ? (
        <form onSubmit={create} className="flex flex-1 flex-col gap-3">
          <p className="text-[14px] font-medium leading-relaxed text-muted">La personne qui recevra le colis ouvre le lien chez elle et montre son bâtiment, sans compte. Son adresse arrive ici et vous terminez la commande.</p>
          <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Pour qui ?
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ex. Maman, Ibrahima" className="h-12 rounded-2xl border border-line bg-card px-4 text-[16px] font-semibold outline-none focus:border-blue" />
          </label>
          {error && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13px] font-bold text-[#a3321f]">{error}</p>}
          <button type="submit" disabled={busy} className="mt-auto flex h-[56px] items-center justify-center rounded-[18px] bg-blue text-[16px] font-bold text-white disabled:opacity-60">{busy ? 'Création…' : 'Créer le lien'}</button>
        </form>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <p className="break-all rounded-2xl bg-card px-4 py-3 font-mono text-[13px] font-semibold">{url}</p>
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="flex h-[54px] items-center justify-center rounded-[18px] bg-ok text-[15.5px] font-bold text-white">Envoyer par WhatsApp</a>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* copie refusée : le lien reste affiché */ } }} className="flex h-[50px] items-center justify-center rounded-[18px] border border-line bg-card text-[14.5px] font-extrabold">{copied ? 'Lien copié ✓' : 'Copier le lien'}</button>
          <p className="mt-2 flex items-center gap-2.5 rounded-2xl bg-blue-soft px-4 py-3 text-[13px] font-bold leading-snug text-blue-ink"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-blue" />En attente de {name.trim() || 'votre destinataire'}… Gardez cette page ouverte : l’adresse arrive ici dès que c’est fait. Le lien est valable 72 heures et ne sert qu’une fois.</p>
        </div>
      )}
    </div>
  );
}
