'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Wordmark } from '@hailandx/ui';
import { formatGnf, normalizeGnPhone, slugify } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { mediaUrl, uploadPhoto } from '@/lib/media';
import { SOURCES } from '@/lib/source';
import { VariantEditor } from '@/components/VariantEditor';
import { NAVIGATIONX_URL } from '@/lib/links';

interface Shop { whatsapp: string | null; id: string; slug: string; name: string; tagline: string | null; status: string; declaration_id: string | null; category_id: string | null; logo_path: string | null; cover_path: string | null }
interface Decl { id: string; declared_label: string | null; hailand_code: string | null; detected_level: number }
interface Section { id: string; name: string }
interface Offer { section_id: string | null; id: string; price_gnf: number; active: boolean; photo_paths: string[] | null; offer_variants: { id: string; label: string; stock: number }[] | null; catalog_products: { name: string; slug: string } | null }
interface Link { id: string; code: string; kind: string; source: string | null; clicks: number; offer_ids: string[] }
interface Cat { id: string; name: string }

const STEPS = [
  ['Connectez-vous', 'Votre numéro de téléphone suffit : un code vous est envoyé par SMS.'],
  ['Créez votre boutique', 'Un nom, une phrase, une catégorie. Ajoutez un logo quand vous voulez.'],
  ['Ajoutez vos produits', 'Nom, prix, stock et une photo. Vous pouvez préparer tout cela dès maintenant.'],
  ['Faites certifier votre adresse', 'La vente s’ouvre quand Hailand a certifié votre adresse (niveau 3) : c’est ce qui rassure vos clients.'],
] as const;

/** Les quatre étapes pour vendre, montrées avant et pendant la création de la boutique. */
function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-col gap-2" aria-label="Étapes pour vendre">
      {STEPS.map(([t, d], i) => (
        <li key={t} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${i === current ? 'border-blue bg-blue-soft' : 'border-line-soft bg-card'}`}>
          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${i < current ? 'bg-ok text-white' : i === current ? 'bg-blue text-white' : 'bg-sand text-muted'}`}>{i < current ? '✓' : i + 1}</span>
          <span className="flex flex-col"><span className="text-[14px] font-extrabold">{t}</span><span className="text-[12.5px] font-medium text-muted">{d}</span></span>
        </li>
      ))}
    </ol>
  );
}

const input = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-medium outline-none focus:border-blue';
const rand = () => Math.random().toString(36).slice(2, 6);

/** Espace vendeur : créer sa boutique, y rattacher son adresse (niveau 3 pour vendre), ajouter ses produits, partager ses liens. */
export default function SellerPage() {
  const session = useSession();
  const sb = browserClient();
  const uid = session?.user.id;
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [decls, setDecls] = useState<Decl[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [offers, setOffers] = useState<Offer[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [pname, setPname] = useState('');
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const [sugg, setSugg] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sb || !uid) return;
    const [c, s, d] = await Promise.all([
      sb.from('categories').select('id,name').order('position'),
      sb.from('shops').select('id,slug,name,tagline,status,declaration_id,category_id,logo_path,cover_path,whatsapp').eq('owner_id', uid).limit(1).maybeSingle(),
      sb.from('declarations').select('id,declared_label,hailand_code,detected_level').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);
    setCats((c.data as Cat[]) ?? []);
    setShop((s.data as Shop | null) ?? null);
    const list = (d.data as Decl[]) ?? [];
    setDecls(list);
    const lv: Record<string, number> = {};
    await Promise.all(list.map(async (x) => { const r = await sb.rpc('fn_declaration_level', { p_declaration: x.id }); lv[x.id] = typeof r.data === 'number' ? r.data : x.detected_level; }));
    setLevels(lv);
    if (s.data) {
      const o = await sb.from('offers').select('id,section_id,price_gnf,active,photo_paths,offer_variants(id,label,stock),catalog_products(name,slug)').eq('shop_id', (s.data as Shop).id).order('created_at', { ascending: false });
      setOffers((o.data as unknown as Offer[]) ?? []);
      const sc = await sb.from('shop_sections').select('id,name').eq('shop_id', (s.data as Shop).id).order('position').order('name');
      setSections((sc.data as Section[]) ?? []);
      const l = await sb.from('share_links').select('id,code,kind,source,clicks,offer_ids').eq('shop_id', (s.data as Shop).id).order('created_at', { ascending: false });
      setLinks((l.data as Link[]) ?? []);
    }
    setLoading(false);
  }, [sb, uid]);

  useEffect(() => { if (session === null) setLoading(false); else if (uid) void load(); }, [session, uid, load]);

  // Fiches existantes : si quelqu'un vend déjà ce produit, on y ajoute son offre (même fiche, plusieurs vendeurs).
  useEffect(() => {
    const term = pname.trim().replace(/[%_,()]/g, ' ').trim();
    if (!sb || chosen || term.length < 3) { setSugg([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb.from('catalog_products').select('id,name').ilike('name', `%${term}%`).eq('status', 'actif').limit(5);
      setSugg((data as { id: string; name: string }[]) ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [pname, chosen, sb]);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true); setMsg(null);
    try { const ok = await fn(); if (ok) setMsg({ tone: 'ok', text: ok }); await load(); }
    catch (e) { setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Une erreur est survenue.' }); }
    setBusy(false);
  };
  const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message.replace(/^.*boutique : /, '')); };

  async function createShop(f: FormData) {
    const name = String(f.get('name') ?? '').trim();
    const slug = slugify(name);
    if (name.length < 2 || slug.length < 3) throw new Error('Donnez un nom de boutique d’au moins 3 lettres.');
    const { error } = await sb!.from('shops').insert({ slug, name, tagline: String(f.get('tagline') ?? '').trim() || null, category_id: String(f.get('category') ?? '') || null, owner_id: uid, declaration_id: String(f.get('declaration') ?? '') || null, status: 'preparation' });
    if (error?.code === '23505') throw new Error('Ce nom de boutique est déjà pris, essayez-en un autre.');
    fail(error);
    return 'Boutique créée. Ajoutez vos produits.';
  }

  /** Lit les lignes du formulaire de variantes : une seule ligne sans nom devient « Standard ». */
  function readVariants(f: FormData) {
    const ids = f.getAll('vid').map(String); const labels = f.getAll('vlabel').map((x) => String(x).trim()); const stocks = f.getAll('vstock').map((x) => Math.max(0, Math.floor(Number(String(x).replace(/\s/g, '')) || 0)));
    const rows = ids.map((id, i) => ({ id, label: labels[i] || (ids.length === 1 ? 'Standard' : ''), stock: stocks[i] ?? 0 }));
    if (rows.some((r) => !r.label)) throw new Error('Donnez un nom à chaque variante (ex. M · Bleu).');
    if (new Set(rows.map((r) => r.label.toLowerCase())).size !== rows.length) throw new Error('Deux variantes portent le même nom.');
    return { rows, removed: f.getAll('vdel').map(String) };
  }

  async function addProduct(f: FormData) {
    const name = String(f.get('pname') ?? '').trim();
    const price = Number(String(f.get('price') ?? '').replace(/\s/g, ''));
    const { rows: variants } = readVariants(f);
    if (name.length < 2) throw new Error('Donnez un nom au produit.');
    if (!Number.isFinite(price) || price < 500) throw new Error('Indiquez un prix en GNF (500 au minimum).');
    const photo = f.get('photo');
    const photoPath = photo instanceof File && photo.size > 0 ? await uploadPhoto(sb!, uid!, photo) : null;
    let productId = chosen?.id;
    if (!productId) {
      const { data: prod, error: e1 } = await sb!.from('catalog_products').insert({ slug: `${slugify(name) || 'produit'}-${rand()}`, name, category_id: String(f.get('pcat') ?? '') || shop?.category_id || null, created_by: uid }).select('id').single();
      fail(e1);
      productId = (prod as { id: string }).id;
    }
    const { data: off, error: e2 } = await sb!.from('offers').insert({ shop_id: shop!.id, product_id: productId, section_id: String(f.get('section') ?? '') || null, price_gnf: Math.round(price), photo_paths: photoPath ? [photoPath] : [] }).select('id').single();
    if (e2?.code === '23505') throw new Error('Vous proposez déjà ce produit : modifiez-le dans « Mes produits ».');
    fail(e2);
    const { error: e3 } = await sb!.from('offer_variants').insert(variants.map((v) => ({ offer_id: (off as { id: string }).id, label: v.label, stock: v.stock })));
    fail(e3);
    setPname(''); setChosen(null); setFormKey((k) => k + 1);
    return chosen ? 'Votre offre est ajoutée à la fiche existante.' : 'Produit ajouté.';
  }

  async function setShopImage(kind: 'logo' | 'cover', f: FormData) {
    const file = f.get('file');
    if (!(file instanceof File) || file.size === 0) throw new Error('Choisissez une image.');
    const path = await uploadPhoto(sb!, uid!, file);
    const { error } = await sb!.from('shops').update(kind === 'logo' ? { logo_path: path } : { cover_path: path }).eq('id', shop!.id);
    fail(error);
    return kind === 'logo' ? 'Logo mis à jour.' : 'Bandeau mis à jour.';
  }

  async function saveOffer(o: Offer, f: FormData) {
    const price = Number(String(f.get('price') ?? '').replace(/\s/g, ''));
    if (!Number.isFinite(price) || price < 500) throw new Error('Indiquez un prix en GNF (500 au minimum).');
    const photo = f.get('photo');
    const photoPath = photo instanceof File && photo.size > 0 ? await uploadPhoto(sb!, uid!, photo) : null;
    const { error } = await sb!.from('offers').update({ price_gnf: Math.round(price), section_id: String(f.get('section') ?? '') || null, active: f.get('active') === 'on', ...(photoPath ? { photo_paths: [photoPath, ...(o.photo_paths ?? [])].slice(0, 5) } : {}) }).eq('id', o.id);
    fail(error);
    const { rows, removed } = readVariants(f);
    for (const id of removed) {
      const r = await sb!.from('offer_variants').delete().eq('id', id);
      if (r.error?.code === '23503') throw new Error('Une variante déjà commandée ne se supprime pas : mettez plutôt son stock à 0.');
      fail(r.error);
    }
    for (const v of rows.filter((x) => x.id)) { const r = await sb!.from('offer_variants').update({ label: v.label, stock: v.stock }).eq('id', v.id); if (r.error?.code === '23505') throw new Error('Deux variantes portent le même nom.'); fail(r.error); }
    const fresh = rows.filter((x) => !x.id);
    if (fresh.length) { const r = await sb!.from('offer_variants').insert(fresh.map((v) => ({ offer_id: o.id, label: v.label, stock: v.stock }))); if (r.error?.code === '23505') throw new Error('Deux variantes portent le même nom.'); fail(r.error); }
    setEditing(null);
    return 'Produit mis à jour.';
  }

  async function saveWhatsapp(f: FormData) {
    const raw = String(f.get('whatsapp') ?? '').trim();
    const n = raw ? normalizeGnPhone(raw) : null;
    if (raw && !n) throw new Error('Entrez un numéro guinéen valide, par exemple 6xx xx xx xx.');
    const { error } = await sb!.from('shops').update({ whatsapp: n }).eq('id', shop!.id);
    fail(error);
    return n ? 'Numéro WhatsApp enregistré : vos clients pourront vous écrire depuis la boutique.' : 'Numéro WhatsApp retiré.';
  }

  async function addSection(f: FormData) {
    const name = String(f.get('sname') ?? '').trim();
    if (name.length < 2) throw new Error('Donnez un nom au rayon (2 lettres au minimum).');
    const { error } = await sb!.from('shop_sections').insert({ shop_id: shop!.id, name, position: sections.length });
    if (error?.code === '23505') throw new Error('Ce rayon existe déjà.');
    fail(error);
    return 'Rayon ajouté.';
  }

  async function addLink(f: FormData) {
    const source = String(f.get('source') ?? 'autre');
    const offer = String(f.get('offer') ?? '');
    const code = `${source.slice(0, 2)}${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await sb!.from('share_links').insert({ code, shop_id: shop!.id, kind: offer ? 'produit' : 'boutique', offer_ids: offer ? [offer] : [], source });
    fail(error);
    return 'Lien créé.';
  }

  if (session === undefined || loading) return <Shell><p className="text-[14px] font-semibold text-muted">Chargement…</p></Shell>;
  if (!sb) return <Shell><p className="text-[14px] font-semibold text-muted">La base n’est pas configurée.</p></Shell>;
  if (!session) {
    return (
      <Shell>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Vendez sur HailandX</h1>
          <p className="text-[14.5px] font-medium text-muted">Ouvrez votre boutique en ligne, partagez-la sur vos réseaux, et laissez la Flotte Hailand livrer vos clients.</p>
        </div>
        <Steps current={0} />
        <Link href="/connexion?next=/vendeur" className="inline-flex h-[56px] items-center justify-center rounded-2xl bg-ink px-7 text-[16px] font-extrabold text-white">Commencer : me connecter</Link>
      </Shell>
    );
  }
  const decl = decls.find((d) => d.id === shop?.declaration_id);
  const level = decl ? levels[decl.id] ?? decl.detected_level : 0;
  const prepare = shop !== null && shop.status !== 'ouverte' && shop.status !== 'suspendue' && level !== 3;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[22px] font-semibold tracking-tight">Mon espace vendeur</h1>
        <button onClick={() => sb.auth.signOut()} className="h-11 px-2 text-[13px] font-bold text-muted">Déconnexion</button>
      </div>
      {msg && <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${msg.tone === 'err' ? 'bg-[#fde8e4] text-[#8a2a1c]' : 'bg-ok-soft text-ok'}`}>{msg.text}</p>}

      {!shop && <Steps current={1} />}
      {shop && level !== 3 && shop.status !== 'ouverte' && shop.status !== 'suspendue' && <Steps current={offers.length ? 3 : 2} />}
      {!shop ? (
        <form action={(f) => run(() => createShop(f))} className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Créer ma boutique</h2>
          <input name="name" required minLength={2} maxLength={60} placeholder="Nom de la boutique" className={input} />
          <input name="tagline" maxLength={90} placeholder="Une phrase pour vous présenter (facultatif)" className={input} />
          <select name="category" className={input} defaultValue=""><option value="">Catégorie principale</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select name="declaration" className={input} defaultValue={decls[0]?.id ?? ''}>
            <option value="">{decls.length ? 'Adresse de la boutique' : 'Aucune adresse enregistrée'}</option>
            {decls.map((d) => <option key={d.id} value={d.id}>{d.declared_label || d.hailand_code || 'Adresse'} — niveau {levels[d.id] ?? d.detected_level}</option>)}
          </select>
          {!decls.length && <p className="text-[12.5px] font-medium text-muted">Vous pouvez créer la boutique maintenant. Pour vendre, enregistrez votre adresse dans <a href={NAVIGATIONX_URL} className="font-bold text-blue-ink underline">NavigationX</a> : c’est elle que Hailand certifiera.</p>}
          <Button type="submit" disabled={busy}>Créer ma boutique</Button>
        </form>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-display text-lg font-semibold">{shop.name}</h2><p className="text-[12.5px] font-semibold text-muted">/b/{shop.slug}</p></div>
              <Badge tone={shop.status === 'ouverte' ? 'ok' : 'sand'}>{shop.status === 'ouverte' ? 'Ouverte' : shop.status === 'suspendue' ? 'Suspendue' : 'En préparation'}</Badge>
            </div>
            {prepare && <p className="rounded-2xl bg-amber-soft px-4 py-3 text-[13px] font-semibold">Vous pouvez préparer votre boutique. La vente s’ouvre quand votre adresse est certifiée par Hailand (niveau 3){decl ? ` — actuellement niveau ${level}` : ' — aucune adresse rattachée'}.</p>}
            {!decl && decls.length > 0 && (
              <form action={(f) => run(async () => { const { error } = await sb.from('shops').update({ declaration_id: String(f.get('declaration')) }).eq('id', shop.id); fail(error); return 'Adresse rattachée.'; })} className="flex gap-2">
                <select name="declaration" className={input} defaultValue={decls[0]!.id}>{decls.map((d) => <option key={d.id} value={d.id}>{d.declared_label || d.hailand_code || 'Adresse'} — niveau {levels[d.id] ?? d.detected_level}</option>)}</select>
                <Button type="submit" variant="secondary" className="h-12 px-4">Rattacher</Button>
              </form>
            )}
            {shop.status !== 'ouverte' && shop.status !== 'suspendue' && level === 3 && (
              <Button disabled={busy} variant="lime" onClick={() => run(async () => { const { error } = await sb.rpc('fn_shop_open', { p_shop: shop.id }); fail(error); return 'Votre boutique est ouverte à la vente.'; })}>Ouvrir la vente</Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(['logo', 'cover'] as const).map((k) => (
                <form key={k} action={(f) => run(() => setShopImage(k, f))} className="flex flex-col gap-1.5 rounded-2xl border border-line-soft p-2.5">
                  <span className="text-[12px] font-extrabold">{k === 'logo' ? 'Logo' : 'Bandeau'}</span>
                  {mediaUrl(k === 'logo' ? shop.logo_path : shop.cover_path) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(k === 'logo' ? shop.logo_path : shop.cover_path)!} alt="" className={`w-full rounded-xl object-cover ${k === 'logo' ? 'h-14' : 'h-14'}`} />}
                  <input name="file" type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-[12px] font-medium file:mr-2 file:h-9 file:rounded-xl file:border-0 file:bg-sand file:px-3 file:text-[12px] file:font-bold" />
                  <button type="submit" disabled={busy} className="h-10 rounded-xl border border-line text-[12.5px] font-bold">Envoyer</button>
                </form>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <ShareButtons url={`${origin}/b/${shop.slug}`} text={`Ma boutique ${shop.name} sur HailandX`} />
            </div>
            <form action={(f) => run(() => saveWhatsapp(f))} className="flex gap-2">
              <input name="whatsapp" inputMode="tel" defaultValue={shop.whatsapp ? shop.whatsapp.replace(/^\+?224/, '') : ''} placeholder="WhatsApp de la boutique : 6xx xx xx xx" aria-label="Numéro WhatsApp de la boutique" className={input} />
              <Button type="submit" variant="secondary" disabled={busy} className="h-12 px-4">Enregistrer</Button>
            </form>
          </section>

          <div className="grid grid-cols-2 gap-2.5"><Link href="/vendeur/commandes" className="flex h-[54px] items-center justify-center rounded-2xl border border-line bg-card text-[15px] font-extrabold">Mes commandes</Link><Link href="/vendeur/solde" className="flex h-[54px] items-center justify-center rounded-2xl border border-line bg-card text-[15px] font-extrabold">Mon solde</Link></div>

          <section className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Mes rayons</h2>
            <p className="text-[12.5px] font-medium text-muted">Regroupez vos produits (Boubous, Chaussures…) : vos clients les retrouvent en un geste dans la boutique.</p>
            {sections.length > 0 && <div className="flex flex-wrap gap-2">{sections.map((x) => (
              <span key={x.id} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-sand pl-3.5 pr-1.5 text-[13px] font-bold">{x.name}
                <button type="button" aria-label={`Supprimer le rayon ${x.name}`} disabled={busy} onClick={() => run(async () => { const { error } = await sb.from('shop_sections').delete().eq('id', x.id); fail(error); return 'Rayon supprimé : ses produits restent en vente.'; })} className="flex h-8 w-8 items-center justify-center rounded-full text-muted">×</button></span>
            ))}</div>}
            <form action={(f) => run(() => addSection(f))} className="flex gap-2">
              <input name="sname" maxLength={40} placeholder="Nouveau rayon" aria-label="Nom du rayon" className={input} />
              <Button type="submit" variant="secondary" disabled={busy} className="h-12 px-4">Ajouter</Button>
            </form>
          </section>
          <section className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Ajouter un produit</h2>
            <form key={formKey} action={(f) => run(() => addProduct(f))} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <input name="pname" required placeholder="Nom du produit" value={pname} onChange={(e) => { setPname(e.target.value); setChosen(null); }} autoComplete="off" className={input} />
                {chosen && <p className="flex items-center justify-between rounded-2xl bg-ok-soft px-3.5 py-2.5 text-[12.5px] font-bold text-ok"><span>Fiche existante : vous ajoutez votre offre.</span><button type="button" onClick={() => setChosen(null)} className="underline">Créer une nouvelle fiche</button></p>}
                {!chosen && sugg.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-2xl border border-line-soft bg-card p-1.5" role="listbox" aria-label="Fiches existantes">
                    <span className="px-2 pt-1 text-[11.5px] font-bold text-muted">Ce produit est déjà vendu ? Ajoutez votre offre :</span>
                    {sugg.map((s) => <button key={s.id} type="button" role="option" aria-selected="false" onClick={() => { setChosen(s); setPname(s.name); setSugg([]); }} className="h-11 rounded-xl px-3 text-left text-[14px] font-bold hover:bg-sand">{s.name}</button>)}
                  </div>
                )}
              </div>
              <input name="price" required inputMode="numeric" placeholder="Prix (GNF)" className={input} />
              <VariantEditor />
              <label className="flex flex-col gap-1.5 text-[13px] font-bold">Photo (facultatif)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-[14px] font-medium file:mr-3 file:h-11 file:rounded-2xl file:border-0 file:bg-sand file:px-4 file:text-[13px] file:font-bold" /></label>
              {sections.length > 0 && <select name="section" className={input} defaultValue="" aria-label="Rayon"><option value="">Rayon (facultatif)</option>{sections.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
              <select name="pcat" className={input} defaultValue={shop.category_id ?? ''}><option value="">Catégorie</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <Button type="submit" disabled={busy}>Ajouter</Button>
            </form>
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="font-display text-lg font-semibold">Mes produits ({offers.length})</h2>
            {offers.length === 0 && <p className="text-[13.5px] font-medium text-muted">Aucun produit pour l’instant.</p>}
            {offers.map((o) => (
              <div key={o.id} className={`flex flex-col gap-2 rounded-2xl border border-line-soft bg-card px-4 py-3 ${o.active ? '' : 'opacity-60'}`}>
                <div className="flex items-center gap-3">{mediaUrl(o.photo_paths?.[0]) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(o.photo_paths?.[0])!} alt="" className="h-12 w-12 rounded-xl object-cover" />}<div className="flex min-w-0 flex-1 items-baseline justify-between gap-3"><span className="truncate text-[14px] font-bold">{o.catalog_products?.name}{o.active ? '' : ' (masqué)'}</span><span className="shrink-0 font-display text-[14px] font-semibold">{formatGnf(o.price_gnf)}</span></div></div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-muted">Stock : {o.offer_variants?.length ? o.offer_variants.map((v) => (o.offer_variants!.length > 1 ? `${v.label} ${v.stock}` : String(v.stock))).join(' · ') : '—'}</span>
                  <button type="button" onClick={() => setEditing(editing === o.id ? null : o.id)} className="h-10 rounded-full border border-line px-3.5 text-[12.5px] font-bold">{editing === o.id ? 'Fermer' : 'Modifier'}</button>
                </div>
                {editing === o.id && (
                  <form action={(f) => run(() => saveOffer(o, f))} className="flex flex-col gap-2.5 rounded-2xl bg-sand p-3">
                    <input name="price" required inputMode="numeric" defaultValue={o.price_gnf} aria-label="Prix (GNF)" className={input} />
                    <VariantEditor initial={o.offer_variants ?? []} />
                    {sections.length > 0 && <select name="section" className={input} defaultValue={o.section_id ?? ''} aria-label="Rayon"><option value="">Sans rayon</option>{sections.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
                    <label className="flex items-center gap-2 text-[13.5px] font-bold"><input name="active" type="checkbox" defaultChecked={o.active} className="h-5 w-5" /> Visible dans la boutique</label>
                    <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Nouvelle photo" className="text-[13px] font-medium file:mr-2 file:h-10 file:rounded-xl file:border-0 file:bg-card file:px-3 file:text-[12.5px] file:font-bold" />
                    <Button type="submit" disabled={busy} className="h-12">Enregistrer</Button>
                  </form>
                )}
                {o.catalog_products && <ShareButtons url={`${origin}/p/${o.catalog_products.slug}`} text={`${o.catalog_products.name} — ${formatGnf(o.price_gnf)}`} />}
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Liens suivis</h2>
            <p className="text-[12.5px] font-medium text-muted">Un lien par réseau : vous voyez combien de personnes cliquent, et d’où viennent vos commandes.</p>
            <form action={(f) => run(() => addLink(f))} className="flex flex-col gap-2.5">
              <select name="source" className={input} defaultValue="tiktok" aria-label="Réseau">{SOURCES.map((s) => <option key={s} value={s}>{s === 'tiktok' ? 'TikTok' : s === 'whatsapp' ? 'WhatsApp' : s === 'facebook' ? 'Facebook' : 'Autre'}</option>)}</select>
              <select name="offer" className={input} defaultValue="" aria-label="Page visée"><option value="">Toute la boutique</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.catalog_products?.name}</option>)}</select>
              <Button type="submit" variant="secondary" disabled={busy}>Créer un lien</Button>
            </form>
            {links.map((l) => (
              <div key={l.id} className="flex flex-col gap-1.5 rounded-2xl border border-line-soft px-3.5 py-3">
                <div className="flex items-center justify-between"><span className="text-[13px] font-bold">{l.source === 'tiktok' ? 'TikTok' : l.source === 'whatsapp' ? 'WhatsApp' : l.source === 'facebook' ? 'Facebook' : 'Autre'} · {l.kind === 'produit' ? 'produit' : 'boutique'}</span><Badge>{l.clicks} clic{l.clicks > 1 ? 's' : ''}</Badge></div>
                <ShareButtons url={`${origin}/s/${l.code}`} text={shop.name} />
              </div>
            ))}
          </section>
        </>
      )}
    </Shell>
  );
}

function ShareButtons({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <button type="button" className="h-10 rounded-full border border-line px-3.5 text-[12.5px] font-bold" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* copie refusée */ } }}>{copied ? 'Lien copié ✓' : 'Copier le lien'}</button>
      <a className="inline-flex h-10 items-center rounded-full bg-ink px-3.5 text-[12.5px] font-bold text-white" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}>WhatsApp</a>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-16 pt-6">
      <Link href="/" aria-label="Accueil"><Wordmark /></Link>
      {children}
    </main>
  );
}
