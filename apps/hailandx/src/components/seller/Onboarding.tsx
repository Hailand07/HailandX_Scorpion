'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { slugify } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { uploadPhoto } from '@/lib/media';
import { NAVIGATIONX_URL } from '@/lib/links';
import { declLabel, type MyDecl, type MyShop } from '@/lib/useMyShop';
import { BackHeader, errText, Icon, Notice, Screen } from '../Screen';

interface Cat { id: string; name: string }
const RETOUR = '/vendeur/ouvrir';

/**
 * Ouvrir ma boutique (v2) : trois étapes sur un seul écran — adresse, boutique, certification.
 * Seule l'étape en cours est ouverte ; les étapes faites se replient ; aucun produit ici (ils s'ajoutent dans « Ma boutique »).
 */
export function Onboarding({ shop, decls, decl, uid, reload, back }: { shop: MyShop | null; decls: MyDecl[]; decl: MyDecl | null; uid: string; reload: () => Promise<void>; back?: string }) {
  const router = useRouter();
  const sb = browserClient();
  const [cats, setCats] = useState<Cat[]>([]);
  const [name, setName] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [addr, setAddr] = useState<string | null>(decls[0]?.id ?? null);
  const [logo, setLogo] = useState<File | null>(null);
  const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => () => { if (logoUrl) URL.revokeObjectURL(logoUrl); }, [logoUrl]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => { sb?.from('categories').select('id,name').order('position').then(({ data }) => setCats((data as Cat[]) ?? [])); }, [sb]);
  useEffect(() => { if (!addr && decls[0]) setAddr(decls[0].id); }, [decls, addr]);

  const step = !decls.length ? 1 : !shop ? 2 : 3;
  const certified = Boolean(shop && decl && decl.level === 3);
  const short = name.trim().length < 3 || slugify(name).length < 3;

  async function run(fn: () => Promise<string | void>) {
    setBusy(true); setMsg(null);
    try { const t = await fn(); if (t) setMsg({ tone: 'ok', text: t }); await reload(); }
    catch (e) { setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Une erreur est survenue.' }); }
    setBusy(false);
  }

  const createShop = () => run(async () => {
    if (short) throw new Error('Donnez un nom de boutique d’au moins 3 lettres.');
    if (!addr) throw new Error('Choisissez l’adresse de votre boutique.');
    const { data, error } = await sb!.from('shops').insert({ slug: slugify(name), name: name.trim(), category_id: cat, owner_id: uid, declaration_id: addr, status: 'preparation' }).select('id').single();
    if (error?.code === '23505') throw new Error('Ce nom de boutique est déjà pris, essayez-en un autre.');
    if (error) throw new Error(errText(error));
    if (logo) {
      try { const path = await uploadPhoto(sb!, uid, logo); await sb!.from('shops').update({ logo_path: path }).eq('id', (data as { id: string }).id); }
      catch { return 'Boutique créée. Le logo n’a pas pu être envoyé : ajoutez-le plus tard dans les réglages.'; }
    }
  });

  const attach = (id: string) => run(async () => { const { error } = await sb!.from('shops').update({ declaration_id: id }).eq('id', shop!.id); if (error) throw new Error(errText(error)); });
  const ask = () => run(async () => { const { error } = await sb!.rpc('fn_request_priority_certification', { p_shop: shop!.id }); if (error) throw new Error(errText(error)); return 'Demande envoyée à Hailand, en priorité.'; });
  const open = () => run(async () => {
    const { error } = await sb!.rpc('fn_shop_open', { p_shop: shop!.id });
    if (error) throw new Error(errText(error));
    router.replace('/vendeur');
  });

  const bar = (on: boolean) => `h-1.5 rounded-full ${on ? 'bg-ink' : 'bg-[#e2ded3]'}`;
  const doneAll = certified && step === 3;

  return (
    <Screen className="gap-2.5">
      {back ? <BackHeader href={back} title="Ouvrir ma boutique" right={<span className="text-[12.5px] font-extrabold text-muted">{doneAll ? 'Prête' : `Étape ${step} sur 3`}</span>} />
        : <header className="flex items-center justify-between pt-2"><h1 className="font-display text-[20px] font-semibold tracking-tight">Ouvrir ma boutique</h1><span className="text-[12.5px] font-extrabold text-muted">{doneAll ? 'Prête' : `Étape ${step} sur 3`}</span></header>}
      <div className="mb-1.5 grid grid-cols-3 gap-1.5" aria-hidden="true"><span className={bar(step > 1)} /><span className={bar(step > 2)} /><span className={bar(doneAll)} /></div>
      <Notice msg={msg} />

      {/* Étape 1 — adresse */}
      {step === 1 ? (
        <Open n={1} title="Où se trouve votre boutique ?" text="Hailand certifie ce bâtiment. C’est ce qui rassure vos clients et guide le livreur.">
          <MapArt />
          <a href={NAVIGATIONX_URL} className="flex h-[52px] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white">Repérer mon bâtiment avec NavigationX</a>
          <Link href={`/adresse?next=${RETOUR}`} className="flex h-12 items-center justify-center rounded-2xl border border-line bg-card text-[14px] font-extrabold">Le repérer ici, sur la carte</Link>
          <p className="text-[12px] font-semibold text-muted">Revenez ensuite sur cet écran : votre adresse y apparaît.</p>
        </Open>
      ) : (
        <Done title="Votre adresse" sub={(() => { const d = decl ?? decls.find((x) => x.id === addr) ?? decls[0]!; return `${declLabel(d)} · niveau ${d.level}`; })()} href={`/adresse?next=${RETOUR}`} />
      )}

      {/* Étape 2 — boutique */}
      {step < 2 && <Locked n={2} title="Votre boutique" />}
      {step === 2 && (
        <Open n={2} title="Votre boutique">
          <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Nom de la boutique
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. Kadi Wax" className="h-[50px] rounded-[14px] border border-line px-3.5 text-[16px] font-bold outline-none focus:border-blue" />
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
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] border border-dashed border-[#c9c4b6] text-muted">
              {logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : <Icon name="plus" size={22} />}
            </span>
            <span className="flex flex-col"><span className="text-[13.5px] font-extrabold">Logo</span><span className="text-[12px] font-semibold text-muted">Facultatif, modifiable plus tard</span></span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" disabled={short || busy} onClick={createShop} className="h-[52px] rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:bg-[#ebe8e0] disabled:text-[#8a8d9c]">{busy ? 'Création…' : 'Créer ma boutique'}</button>
        </Open>
      )}
      {step > 2 && shop && <Done title={shop.name} sub={`${cats.find((c) => c.id === shop.category_id)?.name ?? 'Boutique'} · boutique créée`} href="/vendeur/reglages" />}

      {/* Étape 3 — certification */}
      {step < 3 && <Locked n={3} title="La certification" />}
      {step === 3 && shop && shop.status === 'suspendue' && (
        <Open n={3} title="Boutique suspendue" text="L’équipe Hailand a suspendu votre boutique. Écrivez-lui depuis Compte, « Aide et contact »." />
      )}
      {step === 3 && shop && shop.status !== 'suspendue' && !decl && (
        <Open n={3} title="Rattachez une adresse" text="Votre boutique n’a pas d’adresse. Choisissez celle à certifier.">
          {decls.map((d) => <button key={d.id} type="button" disabled={busy} onClick={() => attach(d.id)} className="flex min-h-12 items-center justify-between rounded-[14px] border border-line px-3.5 text-[14px] font-bold"><span className="truncate">{declLabel(d)}</span><span className="text-[12px] text-muted">niveau {d.level}</span></button>)}
        </Open>
      )}
      {step === 3 && shop && shop.status !== 'suspendue' && decl && !certified && decl.certification_status !== 'demandee' && (
        <Open n={3} title="Faites certifier votre adresse" text={decl.certification_status === 'refusee' ? 'Votre dernière demande a été refusée : corrigez votre adresse dans NavigationX, puis redemandez.' : 'Un agent Hailand vérifie que votre boutique est bien dans ce bâtiment. Il vous appelle avant de passer. C’est gratuit.'}>
          <button type="button" disabled={busy} onClick={ask} className="h-[52px] rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-50">Demander la certification</button>
        </Open>
      )}
      {step === 3 && shop && shop.status !== 'suspendue' && decl && !certified && decl.certification_status === 'demandee' && (
        <Open n={3} title="Certification en cours">
          <ol className="flex flex-col">
            <Timeline state="done" title="Demande envoyée en priorité" sub="L’équipe Hailand l’a reçue." />
            <Timeline state="now" title="Visite de l’agent" sub="Il vous appelle avant de passer." />
            <Timeline state="todo" title="Adresse certifiée, vente ouverte" last />
          </ol>
          <Link href={`/b/${shop.slug}`} className="flex h-[46px] items-center justify-center rounded-[14px] border border-line text-[13.5px] font-extrabold">Voir ma boutique comme un client</Link>
          <button type="button" onClick={() => void reload()} className="h-10 text-[13px] font-bold text-muted">Actualiser</button>
        </Open>
      )}
      {step === 3 && shop && shop.status !== 'suspendue' && certified && (
        <section className="flex flex-col gap-3.5 rounded-[22px] bg-ink px-[18px] py-5 text-white">
          <div className="flex items-center gap-3">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#c8f25a" aria-hidden="true"><path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1L2.7 15.5l1-3-1-3 2.8-1.6.9-3.1 3.2.3z" /><path d="m8.5 12 2.5 2.5 4.5-5" stroke="#12141c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="flex flex-col"><span className="font-display text-[19px] font-semibold">Adresse certifiée</span><span className="text-[12.5px] font-semibold text-white/70">Votre boutique peut vendre.</span></span>
          </div>
          <button type="button" disabled={busy} onClick={open} className="h-[54px] rounded-2xl bg-lime text-[15.5px] font-extrabold text-ink disabled:opacity-60">{busy ? 'Ouverture…' : 'Ouvrir la vente'}</button>
        </section>
      )}

      <p className="mx-1 mt-1.5 flex gap-2 text-[12.5px] font-semibold leading-snug text-muted"><Icon name="info" size={16} stroke={2} className="mt-px" />Vos produits s’ajoutent dans « Ma boutique », dès que la vente est ouverte.</p>
    </Screen>
  );
}

function Open({ n, title, text, children }: { n: number; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <section aria-current="step" className="flex flex-col gap-3.5 rounded-[22px] border-2 border-ink bg-card p-[18px]">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-extrabold text-blue">Étape {n}</span>
        <h2 className="font-display text-[19px] font-semibold">{title}</h2>
        {text && <p className="text-[13.5px] font-semibold leading-snug text-muted">{text}</p>}
      </div>
      {children}
    </section>
  );
}

function Done({ title, sub, href }: { title: string; sub: string; href: string }) {
  return (
    <section className="flex items-center gap-3 rounded-[20px] border border-line-soft bg-card px-4 py-3.5">
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#0f7a5c] text-white"><Icon name="check" size={15} stroke={3} /></span>
      <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[14.5px] font-extrabold">{title}</span><span className="truncate text-[12.5px] font-semibold text-muted">{sub}</span></span>
      <Link href={href} className="flex h-10 items-center px-2 text-[13px] font-extrabold text-blue">Modifier</Link>
    </section>
  );
}

const Locked = ({ n, title }: { n: number; title: string }) => (
  <section className="flex items-center gap-3 rounded-[20px] border border-dashed border-[#d6d1c4] px-4 py-3.5 text-[#8a8d9c]">
    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#ebe8e0] text-[13px] font-extrabold">{n}</span>
    <span className="text-[14.5px] font-extrabold">{title}</span>
  </section>
);

function Timeline({ state, title, sub, last }: { state: 'done' | 'now' | 'todo'; title: string; sub?: string; last?: boolean }) {
  return (
    <li className={`flex items-start gap-3 ${last ? '' : 'pb-3.5'}`}>
      {state === 'done' && <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#0f7a5c] text-white"><Icon name="check" size={12} stroke={3.4} /></span>}
      {state === 'now' && <span className="h-[22px] w-[22px] shrink-0 rounded-full border-[6px] border-blue" />}
      {state === 'todo' && <span className="h-[22px] w-[22px] shrink-0 rounded-full bg-[#ebe8e0]" />}
      <span className="flex flex-col"><span className={`text-[14px] font-extrabold ${state === 'todo' ? 'text-[#8a8d9c]' : ''}`}>{title}</span>{sub && <span className="text-[12px] font-semibold text-muted">{sub}</span>}</span>
    </li>
  );
}

/** Illustration d'un plan de quartier (décor), le bâtiment repéré en bleu. */
const MapArt = () => (
  <div aria-hidden="true" className="relative h-32 overflow-hidden rounded-2xl bg-[#e9efe4]">
    <span className="absolute -inset-x-2 top-[58px] h-3.5 bg-white" />
    <span className="absolute -inset-y-2 left-[42%] w-3 bg-white" />
    <span className="absolute left-[9%] top-4 h-[34px] w-[70px] rounded bg-[#d6dccd]" />
    <span className="absolute left-[50%] top-3.5 h-9 w-[84px] rounded bg-blue opacity-85" />
    <span className="absolute left-[9%] top-[82px] h-8 w-24 rounded bg-[#d6dccd]" />
    <span className="absolute left-[50%] top-[82px] h-8 w-[60px] rounded bg-[#d6dccd]" />
    <span className="absolute left-[calc(50%+32px)] top-[22px] h-5 w-5 rounded-full border-4 border-ink bg-white" />
  </div>
);
