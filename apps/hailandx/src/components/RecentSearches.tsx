'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'hx.recherches';
const read = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : []; } catch { return []; } };

/** Retient la recherche en cours (6 dernières, dans ce navigateur seulement). */
export function RememberSearch({ q }: { q: string }) {
  useEffect(() => {
    const t = q.trim(); if (t.length < 2) return;
    try { localStorage.setItem(KEY, JSON.stringify([t, ...read().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6))); } catch { /* stockage refusé */ }
  }, [q]);
  return null;
}

/** Recherches récentes, en puces. Rien ne s'affiche s'il n'y en a pas. */
export function RecentSearches() {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => setList(read()), []);
  if (!list.length) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-extrabold text-muted">Recherches récentes</h2>
        <button type="button" onClick={() => { try { localStorage.removeItem(KEY); } catch { /* ignoré */ } setList([]); }} className="h-9 px-1 text-[12.5px] font-bold text-muted">Effacer</button>
      </div>
      <div className="flex flex-wrap gap-2">{list.map((r) => <Link key={r} href={`/recherche?q=${encodeURIComponent(r)}`} className="flex h-[38px] items-center rounded-full border border-line bg-card px-3.5 text-[13px] font-bold">{r}</Link>)}</div>
    </section>
  );
}
