'use client';
import { useEffect, useMemo, useState } from 'react';
import { PageHead, Panel, useConsole } from '@/components/ConsoleShell';
import { journalTag, journalText, roleText, when, type JournalEntry } from '@/lib/format';

const TAGS = ['Tout', 'Paramètre', 'Certification', 'Boutique', 'Livreur', 'Litige', 'Avis', 'Argent', 'Équipe'];

/** Journal des actions de l'équipe : inscrit par la base elle-même, ni modifiable ni effaçable. */
export default function JournalPage() {
  const { sb } = useConsole();
  const [rows, setRows] = useState<JournalEntry[] | null>(null);
  const [tag, setTag] = useState('Tout');
  useEffect(() => { void sb.rpc('fn_console_journal', { p_limit: 500 }).then(({ data }) => setRows((data as JournalEntry[]) ?? [])); }, [sb]);
  const list = useMemo(() => (rows ?? []).filter((e) => tag === 'Tout' || journalTag(e) === tag), [rows, tag]);

  return (
    <>
      <PageHead title="Journal des actions" right={<span className="text-[12.5px] font-bold text-muted">Ne peut être ni modifié ni effacé · 500 dernières actions</span>} />
      <div className="flex gap-2 overflow-x-auto">
        {TAGS.map((t) => <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(t)} className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-extrabold ${tag === t ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{t}</button>)}
      </div>
      <Panel label="Actions" className="px-[18px] py-2">
        {rows && list.length === 0 && <p className="py-4 text-[14px] font-semibold text-muted">Aucune action dans cette catégorie.</p>}
        <ul>
          {list.map((e, i) => (
            <li key={e.id} className={`grid gap-1 py-2.5 sm:grid-cols-[110px_1fr] sm:gap-3 ${i ? 'border-t border-[#f0ede6]' : ''}`}>
              <span className="text-[12px] font-bold text-muted">{when(e.created_at)}</span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[13.5px] font-bold leading-snug">{journalText(e)}{e.motif ? <span className="font-semibold text-muted"> · motif : {e.motif}</span> : null}</span>
                <span className="text-[12px] font-bold text-muted">{e.actor_name}{e.actor_role ? ` (${roleText(e.actor_role)})` : ''} · <span className={journalTag(e) === 'Paramètre' ? 'text-blue' : ''}>{journalTag(e)}</span></span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
