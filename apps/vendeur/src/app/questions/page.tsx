'use client';
import { useCallback, useEffect, useState } from 'react';
import { BackHeader, browserClient, errText, HAILANDX_URL, LienHailand, Notice, Screen } from '@hailandx/kit';
import { ago } from '@hailandx/commerce';
import { SellerGate } from '@/components/SellerGate';

interface Q { id: string; product_slug: string; product_name: string; question: string; answer: string | null; answered_by_me: boolean | null; answered_at: string | null; created_at: string }

/** Questions des clients (HAILANDX.md §35) : sur les produits que vend la boutique ; la réponse est publique sur la fiche du produit. */
export default function QuestionsPage() {
  return <SellerGate title="Questions des clients">{({ shop }) => <Questions shopId={shop.id} />}</SellerGate>;
}

function Questions({ shopId }: { shopId: string }) {
  const [list, setList] = useState<Q[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const load = useCallback(async () => {
    const sb = browserClient(); if (!sb) return;
    const { data, error } = await sb.rpc('fn_shop_questions', { p_shop: shopId });
    if (error) setMsg({ tone: 'err', text: errText(error) });
    setList((data as Q[]) ?? []);
  }, [shopId]);
  useEffect(() => { void load(); }, [load]);

  async function answer(id: string) {
    setBusy(true);
    const { error } = await browserClient()!.rpc('fn_answer_question', { p_question: id, p_answer: text.trim() });
    setBusy(false);
    setMsg(error ? { tone: 'err', text: errText(error) } : { tone: 'ok', text: 'Réponse publiée sur la fiche du produit. Le client est prévenu.' });
    if (!error) { setEditing(null); setText(''); await load(); }
  }

  const waiting = (list ?? []).filter((q) => !q.answer).length;
  return (
    <Screen>
      <BackHeader href="/plus" title="Questions des clients" label="Retour" />
      <p className="text-[13px] font-semibold leading-relaxed text-muted">Les acheteurs posent leurs questions sur la fiche de vos produits. Votre réponse s’affiche pour tout le monde : une réponse rapide et précise fait vendre.</p>
      {list && list.length > 0 && <p className="text-[13px] font-extrabold">{waiting > 0 ? `${waiting} question${waiting > 1 ? 's' : ''} sans réponse` : 'Toutes les questions ont une réponse.'}</p>}
      <Notice msg={msg} />
      {list === null && <p className="text-[14px] font-semibold text-muted">Chargement…</p>}
      {list?.length === 0 && <p className="rounded-[20px] border border-dashed border-line px-4 py-6 text-center text-[13.5px] font-semibold text-muted">Aucune question pour l’instant.</p>}
      {list?.map((q) => (
        <article key={q.id} className="flex flex-col gap-2 rounded-[20px] border border-line-soft bg-card px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <LienHailand app="hailandx" href={`${HAILANDX_URL}/p/${q.product_slug}`} target="_blank" className="truncate text-[12.5px] font-extrabold text-blue-ink">{q.product_name} ↗</LienHailand>
            <span className="shrink-0 text-[11.5px] font-bold text-muted">{ago(q.created_at)}</span>
          </div>
          <p className="text-[14.5px] font-bold leading-snug">{q.question}</p>
          {q.answer && editing !== q.id && (
            <>
              <p className="whitespace-pre-line rounded-2xl bg-bg px-3 py-2.5 text-[13.5px] font-medium leading-relaxed">{q.answer}</p>
              {q.answered_by_me ? <button type="button" onClick={() => { setEditing(q.id); setText(q.answer ?? ''); setMsg(null); }} className="h-9 self-start text-[12.5px] font-extrabold text-muted underline">Modifier ma réponse</button>
                : <span className="text-[11.5px] font-bold text-muted">Réponse d’une autre boutique qui vend ce produit</span>}
            </>
          )}
          {!q.answer && editing !== q.id && <button type="button" onClick={() => { setEditing(q.id); setText(''); setMsg(null); }} className="h-11 rounded-xl bg-ink text-[13.5px] font-extrabold text-white">Répondre</button>}
          {editing === q.id && (
            <div className="flex flex-col gap-2">
              <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} aria-label="Votre réponse" placeholder="Répondez précisément : taille, compatibilité, garantie, délai…" className="rounded-xl border border-line px-3 py-2.5 text-[15px] leading-relaxed" />
              <div className="flex gap-2">
                <button type="button" disabled={busy || text.trim().length < 2} onClick={() => void answer(q.id)} className="h-11 flex-1 rounded-xl bg-ink text-[13.5px] font-extrabold text-white disabled:opacity-40">{busy ? 'Envoi…' : 'Publier la réponse'}</button>
                <button type="button" onClick={() => setEditing(null)} className="h-11 rounded-xl border border-line bg-card px-4 text-[13.5px] font-bold">Annuler</button>
              </div>
            </div>
          )}
        </article>
      ))}
    </Screen>
  );
}
