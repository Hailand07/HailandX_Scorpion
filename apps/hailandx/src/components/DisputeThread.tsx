'use client';
import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';

interface Msg { id: string; author_role: string; body: string; created_at: string }
const ROLE: Record<string, string> = { acheteur: 'Acheteur', vendeur: 'Vendeur', livreur: 'Livreur', equipe: 'Équipe Hailand' };

/** Fil de messages d'un litige : acheteur, vendeur, livreur et équipe Hailand. Fermé aux non-membres par la base (règles de lecture). */
export function DisputeThread({ disputeId, open = true, mine }: { disputeId: string; open?: boolean; mine: string }) {
  const sb = browserClient();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from('dispute_messages').select('id,author_role,body,created_at').eq('dispute_id', disputeId).order('created_at');
    setMsgs((data as Msg[]) ?? []);
  }, [sb, disputeId]);
  useEffect(() => { void load(); const i = setInterval(load, 10_000); return () => clearInterval(i); }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!sb || !text.trim()) return;
    setBusy(true); setErr(null);
    const { error } = await sb.rpc('fn_dispute_post', { p_dispute: disputeId, p_body: text });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?:\s*/, ''));
    setText(''); await load();
  }
  return (
    <section aria-label="Échanges du litige" className="flex flex-col gap-2 rounded-2xl border border-line-soft bg-card p-3">
      <h3 className="text-[13px] font-extrabold">Échanges</h3>
      {msgs.length === 0 && <p className="text-[12.5px] font-medium text-muted">Aucun message pour l’instant.</p>}
      <ul className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
        {msgs.map((m) => (
          <li key={m.id} className={`flex max-w-[88%] flex-col rounded-2xl px-3 py-2 ${m.author_role === mine ? 'self-end bg-blue-soft' : 'self-start bg-sand'}`}>
            <span className="text-[11px] font-extrabold text-muted">{ROLE[m.author_role] ?? m.author_role} · {new Date(m.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="whitespace-pre-wrap text-[13.5px] font-medium">{m.body}</span>
          </li>
        ))}
      </ul>
      {open ? (
        <form onSubmit={send} className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Votre message" aria-label="Votre message" className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-card px-3.5 text-[16px] outline-none focus:border-blue" />
          <button type="submit" disabled={busy || !text.trim()} className="h-11 rounded-2xl bg-ink px-4 text-[13.5px] font-extrabold text-white disabled:opacity-40">Envoyer</button>
        </form>
      ) : <p className="text-[12px] font-semibold text-muted">Litige tranché : les échanges sont fermés.</p>}
      {err && <p role="alert" className="text-[12.5px] font-semibold text-[#8a2a1c]">{err}</p>}
    </section>
  );
}
