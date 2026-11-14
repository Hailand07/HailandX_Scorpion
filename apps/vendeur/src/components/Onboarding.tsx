'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { slugify } from '@hailandx/commerce';
import { BackHeader, browserClient, errText, Icon, Notice, Screen, uploadPhoto } from '@hailandx/kit';
import { AdresseBoutique } from './AdresseBoutique';
import { declLabel, type MyCert, type MyDecl, type MyShop } from '@/lib/useMyShop';
import { Brand } from './Brand';

import { Certification } from './onboarding/Certification';
import { Done, Locked, MapArt, Open } from './onboarding/parts';
import { nameTooShort, ShopForm, type Cat, type ShopDraft } from './onboarding/ShopForm';

/**
 * Ouvrir ma boutique (v2) : trois étapes sur un seul écran — adresse, boutique, certification.
 * Seule l'étape en cours est ouverte ; les étapes faites se replient ; aucun produit ici (ils s'ajoutent dans « Ma boutique »).
 * Ce fichier tient l'état et les écritures ; l'affichage de chaque étape est dans `onboarding/` (ShopForm, Certification, parts).
 */
export function Onboarding({ shop, decls, decl, cert, uid, reload, back, recue = null, depuis = null }: { shop: MyShop | null; decls: MyDecl[]; decl: MyDecl | null; cert: MyCert | null; uid: string; reload: () => Promise<void>; back?: string; recue?: string | null; depuis?: 'retour' | 'vente' | null }) {
  const router = useRouter();
  const sb = browserClient();
  const [cats, setCats] = useState<Cat[]>([]);
  // Adresse reçue (ancien lien NavigationX ou parcours sur place), si elle appartient bien à ce compte, sinon la plus récente.
  const initial = (recue && decls.some((d) => d.id === recue) ? recue : decls[0]?.id) ?? null;
  const [addr, setAddr] = useState<string | null>(initial);
  // Parcours d'adresse sur place (§49 étape 4) : plus de détour par NavigationX.
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => { sb?.from('categories').select('id,name').order('position').then(({ data }) => setCats((data as Cat[]) ?? [])); }, [sb]);
  useEffect(() => { if (!addr && decls[0]) setAddr(recue && decls.some((d) => d.id === recue) ? recue : decls[0].id); }, [decls, addr, recue]);

  const step = !decls.length ? 1 : !shop ? 2 : 3;
  const certified = Boolean(shop && decl && decl.level === 3);

  async function run(fn: () => Promise<string | void>) {
    setBusy(true); setMsg(null);
    try { const t = await fn(); if (t) setMsg({ tone: 'ok', text: t }); await reload(); }
    catch (e) { setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Une erreur est survenue.' }); }
    setBusy(false);
  }

  const createShop = ({ name, cat, logo }: ShopDraft) => run(async () => {
    if (nameTooShort(name)) throw new Error('Donnez un nom de boutique d’au moins 3 lettres.');
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
  const ask = () => run(async () => { const { error } = await sb!.rpc('fn_request_priority_certification', { p_shop: shop!.id }); if (error) throw new Error(errText(error)); return 'Demande envoyée : l’équipe Hailand la vérifie.'; });
  const open = () => run(async () => {
    const { error } = await sb!.rpc('fn_shop_open', { p_shop: shop!.id });
    if (error) throw new Error(errText(error));
    router.replace('/');
  });

  // Nouvelle adresse repérée : avant la boutique, elle devient l'adresse choisie ; après, elle est rattachée à la boutique.
  const located = (id: string) => { setLocating(false); setAddr(id); if (shop) void attach(id); else void reload(); };
  if (locating) return <AdresseBoutique kicker={shop ? 'NOUVELLE ADRESSE DE LA BOUTIQUE' : 'OUVRIR MA BOUTIQUE · ÉTAPE 1'} onDone={located} onClose={() => setLocating(false)} />;

  const bar = (on: boolean) => `h-1.5 rounded-full ${on ? 'bg-ink' : 'bg-[#e2ded3]'}`;
  const doneAll = certified && step === 3;

  return (
    <Screen className="gap-2.5">
      {back ? <BackHeader href={back} title="Ouvrir ma boutique" right={<span className="text-[13px] font-extrabold text-muted">{doneAll ? 'Prête' : `Étape ${step} sur 3`}</span>} />
        : <header className="flex flex-col gap-3 pt-1"><div className="flex items-center justify-between"><Brand /><Link href="/plus" className="flex h-11 items-center rounded-2xl border border-line bg-card px-3.5 text-[13px] font-extrabold">Mon compte</Link></div><div className="flex items-center justify-between"><h1 className="font-display text-[20px] font-semibold tracking-tight">Ouvrir ma boutique</h1><span className="text-[13px] font-extrabold text-muted">{doneAll ? 'Prête' : `Étape ${step} sur 3`}</span></div></header>}
      <div className="mb-1.5 grid grid-cols-3 gap-1.5" aria-hidden="true"><span className={bar(step > 1)} /><span className={bar(step > 2)} /><span className={bar(doneAll)} /></div>
      <Notice msg={msg} />

      {/* Étape 1 — adresse */}
      {step === 1 ? (
        <Open n={1} title="Où se trouve votre boutique ?" text="Les livreurs viennent y chercher les colis. On repère le bâtiment ici même : position GPS, vue satellite, vous confirmez.">
          <MapArt />
          <button type="button" onClick={() => setLocating(true)} className="flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-blue text-[15px] font-extrabold text-white"><Icon name="pin" size={18} />Localiser ma boutique</button>
          <p className="text-[12px] font-semibold text-muted">Placez-vous dans la boutique, près d’une fenêtre : 15 secondes de mesures GPS, puis vous confirmez le bâtiment.</p>
        </Open>
      ) : (
        <>
          {depuis && !shop && decls.some((d) => d.id === recue) && (
            <p role="status" className="flex items-center gap-2.5 rounded-[20px] bg-blue-soft px-4 py-3 text-[14px] font-extrabold text-blue-ink"><Icon name="pin" size={18} />{depuis === 'vente' ? 'Point de vente choisi dans NavigationX' : 'Adresse reçue : vous continuez ici.'}</p>
          )}
          <Done title="Votre adresse" sub={(() => { const d = decl ?? decls.find((x) => x.id === addr) ?? decls[0]!; return `${declLabel(d)} · niveau ${d.level}`; })()} onChange={() => setLocating(true)} />
        </>
      )}

      {/* Étape 2 — boutique */}
      {step < 2 && <Locked n={2} title="Votre boutique" />}
      {step === 2 && <ShopForm cats={cats} decls={decls} addr={addr} setAddr={setAddr} busy={busy} onCreate={createShop} />}
      {step > 2 && shop && <Done title={shop.name} sub={`${cats.find((c) => c.id === shop.category_id)?.name ?? 'Boutique'} · boutique créée`} href="/reglages" />}

      {/* Étape 3 — certification */}
      {step < 3 && <Locked n={3} title="La certification" />}
      {step === 3 && shop && <Certification shop={shop} decl={decl} decls={decls} cert={cert} busy={busy} onLocate={() => setLocating(true)} attach={attach} ask={ask} open={open} reload={reload} />}

      <p className="mx-1 mt-1.5 flex gap-2 text-[13px] font-semibold leading-snug text-muted"><Icon name="info" size={16} stroke={2} className="mt-px" />Vos produits s’ajoutent dans votre tableau de bord, dès que la vente est ouverte.</p>
    </Screen>
  );
}
