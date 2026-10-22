'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserClient, errText, useSession } from '@hailandx/kit';

/** Poser une question publique au vendeur (HAILANDX.md §35) : compte connecté, 5 questions par jour au plus. */
export function AskQuestion({ productId, next }: { productId: string; next: string }) {
  const session = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (session === null) {
    return <Link href={`/connexion?next=${encodeURIComponent(next)}`} className="flex h-11 items-center justify-center rounded-2xl border border-line text-[13.5px] font-extrabold">Se connecter pour poser une question</Link>;
  }
  if (!open) {
    return (
      <>
        {msg && <p role="status" className={`rounded-xl px-3 py-2 text-[12.5px] font-bold ${msg.ok ? 'bg-ok-soft text-ok' : 'bg-[#fdecec] text-[#b42318]'}`}>{msg.text}</p>}
        <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="h-11 rounded-2xl border border-line text-[13.5px] font-extrabold">Poser une question au vendeur</button>
      </>
    );
  }
  async function send() {
    const sb = browserClient(); if (!sb) return;
    setBusy(true);
    const { error } = await sb.rpc('fn_ask_question', { p_product: productId, p_question: text.trim() });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: errText(error) }); return; }
    setText(''); setOpen(false);
    setMsg({ ok: true, text: 'Question envoyée. Vous serez prévenu dès que le vendeur répond.' });
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Votre question
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} placeholder="Ex. Est-ce que la taille est grande ? Le chargeur est-il fourni ?" className="rounded-xl border border-line px-3 py-2.5 text-[14.5px] font-medium leading-relaxed outline-none focus:border-blue" />
      </label>
      <p className="text-[11.5px] font-semibold text-muted">Votre question sera visible par tous, sans votre nom ni votre numéro.</p>
      {msg && !msg.ok && <p role="alert" className="rounded-xl bg-[#fdecec] px-3 py-2 text-[12.5px] font-bold text-[#b42318]">{msg.text}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy || text.trim().length < 5} onClick={() => void send()} className="h-11 flex-1 rounded-2xl bg-ink text-[14px] font-extrabold text-white disabled:opacity-40">{busy ? 'Envoi…' : 'Envoyer'}</button>
        <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-2xl px-3 text-[13px] font-extrabold text-muted">Annuler</button>
      </div>
    </div>
  );
}
