'use client';
import { useEffect, useMemo, useState } from 'react';
import { slugify } from '@hailandx/commerce';
import { Icon } from '@hailandx/kit';
import { declLabel, type MyDecl } from '@/lib/useMyShop';
import { Open } from './parts';

export interface Cat { id: string; name: string }
export interface ShopDraft { name: string; cat: string | null; logo: File | null }
/** Un nom de boutique utilisable : trois lettres au moins, et une adresse de page (slug) d'au moins trois caractères. */
export const nameTooShort = (name: string) => name.trim().length < 3 || slugify(name).length < 3;

/** Étape 2 de « Ouvrir ma boutique » : nom, ce qu'on vend, adresse (s'il y en a plusieurs), logo facultatif. */
export function ShopForm({ cats, decls, addr, setAddr, busy, onCreate }: { cats: Cat[]; decls: MyDecl[]; addr: string | null; setAddr: (id: string) => void; busy: boolean; onCreate: (d: ShopDraft) => void }) {
  const [name, setName] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => () => { if (logoUrl) URL.revokeObjectURL(logoUrl); }, [logoUrl]);
  const short = nameTooShort(name);
  return (
    <Open n={2} title="Votre boutique">
    <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Nom de la boutique
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. Kadi Wax" className="h-[54px] rounded-[14px] border border-line px-3.5 text-[16px] font-bold outline-none focus:border-blue" />
    </label>
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-extrabold">Ce que vous vendez</legend>
      <div className="flex flex-wrap gap-2">{cats.map((c) => <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)} className={`h-10 rounded-full px-3.5 text-[13px] font-bold ${cat === c.id ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{c.name}</button>)}</div>
    </fieldset>
    {decls.length > 1 && (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-extrabold">Adresse de la boutique</legend>
        {decls.map((d) => (
          <label key={d.id} className={`flex min-h-12 items-center gap-3 rounded-[14px] border px-3.5 text-[14px] font-bold ${addr === d.id ? 'border-ink' : 'border-line'}`}>
            <input type="radio" name="addr" checked={addr === d.id} onChange={() => setAddr(d.id)} className="h-4 w-4" />
            <span className="flex-1 truncate">{declLabel(d)}</span><span className="text-[12px] font-bold text-muted">niveau {d.level}</span>
          </label>
        ))}
      </fieldset>
    )}
    <label className="flex cursor-pointer items-center gap-3">
      <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-line text-muted">
        {logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : <Icon name="plus" size={22} />}
      </span>
      <span className="flex flex-col"><span className="text-[14px] font-extrabold">Logo</span><span className="text-[12px] font-semibold text-muted">Facultatif, modifiable plus tard</span></span>
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
    </label>
    <button type="button" disabled={short || busy} onClick={() => onCreate({ name, cat, logo })} className="h-[54px] rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:bg-sand disabled:text-faint">{busy ? 'Création…' : 'Créer ma boutique'}</button>
    </Open>
  );
}
