'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cleanAttributes, FICHE_LIMITS, ficheCompleteness, ficheOf, formatGnf, readAttributes, slugify, type FicheField } from '@hailandx/commerce';
import { BackHeader, browserClient, errText, HAILANDX_URL, Icon, mediaUrl, Notice, Screen, Switch, uploadPhoto } from '@hailandx/kit';
import type { MyShop } from '@/lib/useMyShop';
import { ShareSheet } from './ShareSheet';

interface Variant { key: number; id: string; label: string; stock: number }
interface Section { id: string; name: string }
interface Cat { id: string; name: string }
interface Existing { id: string; price_gnf: number; compare_at_gnf: number | null; section_id: string | null; active: boolean; photo_paths: string[] | null; description: string | null; condition: 'neuf' | 'occasion'; offer_variants: { id: string; label: string; stock: number }[] | null; catalog_products: { id: string; name: string; slug: string; category_id: string | null; description: string | null; attributes: Record<string, unknown> | null; created_by: string | null } | null }
interface Linked { id: string; name: string; category_id: string | null; description: string | null; attributes: Record<string, unknown> | null }

const MAX_PHOTOS = 5;
const rand = () => Math.random().toString(36).slice(2, 6);

/**
 * Ajouter ou modifier un produit (v2), en plein écran : photos, nom (fiche commune si le produit existe déjà), prix,
 * variantes et stock, rayon. Seulement boutique ouverte (la base l'impose aussi : déclencheur offers_require_open_shop).
 */
export function ProductEditor({ shop, uid, offerId }: { shop: MyShop; uid: string; offerId?: string }) {
  const router = useRouter();
  const sb = browserClient();
  const editing = Boolean(offerId);
  const [existing, setExisting] = useState<Existing | null | undefined>(editing ? undefined : null);
  const [sections, setSections] = useState<Section[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [name, setName] = useState('');
  const [linked, setLinked] = useState<Linked | null>(null);
  const [sugg, setSugg] = useState<Linked[]>([]);
  // Fiche détaillée (HAILANDX.md §33) : description, points forts, caractéristiques de la catégorie ; état et mot du vendeur (offre).
  const [desc, setDesc] = useState('');
  const [points, setPoints] = useState<string[]>(['', '', '']);
  const [values, setValues] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState<'neuf' | 'occasion'>('neuf');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState('');
  const [compareAt, setCompareAt] = useState('');
  const [variants, setVariants] = useState<Variant[]>([{ key: 0, id: '', label: '', stock: 1 }]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [section, setSection] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(shop.category_id);
  const [active, setActive] = useState(true);
  const [kept, setKept] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [published, setPublished] = useState<{ slug: string; name: string; offerId?: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [nextKey, setNextKey] = useState(1);

  useEffect(() => {
    if (!sb) return;
    sb.from('shop_sections').select('id,name').eq('shop_id', shop.id).order('position').order('name').then(({ data }) => setSections((data as Section[]) ?? []));
    sb.from('categories').select('id,name').order('position').then(({ data }) => setCats((data as Cat[]) ?? []));
    if (!offerId) return;
    sb.from('offers').select('id,price_gnf,compare_at_gnf,section_id,active,photo_paths,description,condition,offer_variants(id,label,stock),catalog_products(id,name,slug,category_id,description,attributes,created_by)').eq('id', offerId).eq('shop_id', shop.id).maybeSingle().then(({ data }) => {
      const o = (data as unknown as Existing | null) ?? null;
      setExisting(o);
      if (!o) return;
      setPrice(String(o.price_gnf)); setCompareAt(o.compare_at_gnf ? String(o.compare_at_gnf) : ''); setSection(o.section_id); setActive(o.active); setKept(o.photo_paths ?? []);
      setCondition(o.condition ?? 'neuf'); setNote(o.description ?? '');
      const cp = o.catalog_products;
      if (cp) { setCat(cp.category_id); setDesc(cp.description ?? ''); const d = readAttributes(cp.attributes); setValues(d.values); setPoints([...d.points, '', '', ''].slice(0, Math.max(3, d.points.length))); }
      const vs = (o.offer_variants ?? []).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
      if (vs.length) { setVariants(vs.map((v, i) => ({ key: i, id: v.id, label: v.label === 'Standard' && vs.length === 1 ? '' : v.label, stock: v.stock }))); setNextKey(vs.length); }
    });
  }, [sb, shop.id, offerId]);

  // Fiche commune : si quelqu'un vend déjà ce produit, on y ajoute son offre (même fiche, plusieurs vendeurs).
  useEffect(() => {
    const term = name.trim().replace(/[%_,()]/g, ' ').trim();
    if (!sb || editing || linked || term.length < 3) { setSugg([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb.from('catalog_products').select('id,name,category_id,description,attributes').ilike('name', `%${term}%`).eq('status', 'actif').limit(4);
      setSugg((data as Linked[]) ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [name, linked, editing, sb]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const setVar = (key: number, patch: Partial<Variant>) => setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const priceN = Number(price.replace(/\s/g, ''));
  const compareN = Number(compareAt.replace(/\s/g, '')) || null;

  // Fiche modifiable : nouvelle fiche, ou fiche que ce vendeur a créée ; sinon on n'ajoute que son offre (état, mot du vendeur).
  const ownFiche = editing ? existing?.catalog_products?.created_by === uid : !linked;
  const fiche = ficheOf(linked ? linked.category_id : cat);
  const attrs = cleanAttributes(linked ? linked.category_id : cat, { values, points });
  const shared = linked ?? (editing && !ownFiche ? existing?.catalog_products ?? null : null);

  async function save() {
    setMsg(null);
    const rows = variants.map((v) => ({ ...v, label: v.label.trim() || (variants.length === 1 ? 'Standard' : '') }));
    try {
      if (!editing && name.trim().length < 2) throw new Error('Donnez un nom au produit.');
      if (!Number.isFinite(priceN) || priceN < 500) throw new Error('Indiquez un prix en GNF (500 au minimum).');
      if (compareN && compareN <= priceN) throw new Error('Le prix barré doit être plus élevé que le prix de vente (ou laissez-le vide).');
      if (rows.some((r) => !r.label)) throw new Error('Donnez un nom à chaque variante (ex. M · Bleu).');
      if (new Set(rows.map((r) => r.label.toLowerCase())).size !== rows.length) throw new Error('Deux variantes portent le même nom.');
      if (desc.length > FICHE_LIMITS.description) throw new Error(`Description trop longue (${FICHE_LIMITS.description} caractères au plus).`);
      if (note.length > 1000) throw new Error('Le mot du vendeur dépasse 1 000 caractères.');
      setBusy(true);
      const uploaded: string[] = [];
      for (const f of files) uploaded.push(await uploadPhoto(sb!, uid, f));
      const photos = [...kept, ...uploaded].slice(0, MAX_PHOTOS);

      if (!editing) {
        let productId = linked?.id;
        let slug = '';
        if (!productId) {
          slug = `${slugify(name) || 'produit'}-${rand()}`;
          const { data, error } = await sb!.from('catalog_products').insert({ slug, name: name.trim(), category_id: cat, created_by: uid, description: desc.trim() || null, attributes: attrs }).select('id').single();
          if (error) throw new Error(errText(error));
          productId = (data as { id: string }).id;
        } else {
          const { data } = await sb!.from('catalog_products').select('slug').eq('id', productId).maybeSingle();
          slug = (data as { slug: string } | null)?.slug ?? '';
        }
        const { data: off, error: e2 } = await sb!.from('offers').insert({ shop_id: shop.id, product_id: productId, section_id: section, price_gnf: Math.round(priceN), compare_at_gnf: compareN ? Math.round(compareN) : null, photo_paths: photos, condition, description: note.trim() || null }).select('id').single();
        if (e2?.code === '23505') throw new Error('Vous proposez déjà ce produit : modifiez-le dans la liste.');
        if (e2) throw new Error(errText(e2));
        const { error: e3 } = await sb!.from('offer_variants').insert(rows.map((v) => ({ offer_id: (off as { id: string }).id, label: v.label, stock: v.stock })));
        if (e3) throw new Error(errText(e3));
        setPublished({ slug, name: linked?.name ?? name.trim(), offerId: (off as { id: string }).id });
      } else {
        const { error } = await sb!.from('offers').update({ price_gnf: Math.round(priceN), compare_at_gnf: compareN ? Math.round(compareN) : null, section_id: section, active, photo_paths: photos, condition, description: note.trim() || null }).eq('id', offerId!);
        if (error) throw new Error(errText(error));
        // Fiche commune : seul son créateur la complète (la base le vérifie aussi).
        if (ownFiche && existing?.catalog_products) {
          const r = await sb!.rpc('fn_product_update_details', { p_product: existing.catalog_products.id, p_description: desc.trim(), p_attributes: attrs });
          if (r.error) throw new Error(errText(r.error));
        }
        for (const id of removed) {
          const r = await sb!.from('offer_variants').delete().eq('id', id);
          if (r.error?.code === '23503') throw new Error('Une variante déjà commandée ne se supprime pas : mettez plutôt son stock à 0.');
          if (r.error) throw new Error(errText(r.error));
        }
        for (const v of rows.filter((x) => x.id)) { const r = await sb!.from('offer_variants').update({ label: v.label, stock: v.stock }).eq('id', v.id); if (r.error) throw new Error(r.error.code === '23505' ? 'Deux variantes portent le même nom.' : errText(r.error)); }
        const fresh = rows.filter((x) => !x.id);
        if (fresh.length) { const r = await sb!.from('offer_variants').insert(fresh.map((v) => ({ offer_id: offerId, label: v.label, stock: v.stock }))); if (r.error) throw new Error(r.error.code === '23505' ? 'Deux variantes portent le même nom.' : errText(r.error)); }
        router.push('/produits');
        return;
      }
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Une erreur est survenue.' });
    }
    setBusy(false);
  }

  if (published) {
    const url = typeof window !== 'undefined' ? `${HAILANDX_URL}/p/${published.slug}?b=${shop.slug}` : '';
    return (
      <Screen className="items-center justify-center gap-3.5 px-7 pb-20 text-center">
        <span role="status" className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-lime"><Icon name="check" size={30} stroke={2.4} /></span>
        <h1 className="font-display text-[22px] font-semibold">Produit en vente</h1>
        <p className="text-[14.5px] font-semibold leading-relaxed text-muted">Il apparaît dans votre boutique. Partagez-le pour vos premières ventes.</p>
        <button type="button" onClick={() => setSharing(true)} className="flex h-[50px] w-full items-center justify-center rounded-2xl bg-ink text-[14.5px] font-extrabold text-white">Partager le lien du produit</button>
        <p className="w-full truncate rounded-xl bg-bg px-3 py-2 text-[12px] font-semibold text-muted">{url.replace(/^https?:\/\//, '')}</p>
        {sharing && published.offerId && <ShareSheet target={{ shopId: shop.id, shopSlug: shop.slug, shopName: shop.name, offerId: published.offerId, productSlug: published.slug, name: published.name, priceGnf: Math.round(priceN) }} onClose={() => setSharing(false)} />}
        <button type="button" onClick={() => { setPublished(null); setName(''); setLinked(null); setPrice(''); setVariants([{ key: nextKey, id: '', label: '', stock: 1 }]); setNextKey((k) => k + 1); setFiles([]); setKept([]); setDesc(''); setPoints(['', '', '']); setValues({}); setNote(''); setCondition('neuf'); setBusy(false); }} className="flex h-12 w-full items-center justify-center rounded-2xl border border-line text-[14px] font-extrabold">Ajouter un autre produit</button>
        <Link href="/produits" className="flex h-11 items-center text-[14px] font-extrabold">Retour aux produits</Link>
      </Screen>
    );
  }
  if (existing === undefined) return <Screen><BackHeader icon="close" href="/produits" title="Modifier le produit" label="Fermer" /><p className="text-[14px] font-semibold text-muted">Chargement…</p></Screen>;
  if (editing && existing === null) return <Screen><BackHeader icon="close" href="/produits" title="Produit introuvable" label="Fermer" /><p className="text-[14px] font-semibold text-muted">Ce produit n’existe plus dans votre boutique.</p></Screen>;

  const nPhotos = kept.length + files.length;
  const completeness = ficheCompleteness(cat, desc, attrs, nPhotos);
  const pill = (on: boolean) => `h-10 rounded-full px-3.5 text-[13px] font-bold ${on ? 'bg-ink text-white' : 'border border-line bg-card'}`;
  return (
    <Screen className="gap-3 pb-32">
      <BackHeader icon="close" href="/produits" label="Fermer sans enregistrer" title={editing ? 'Modifier le produit' : 'Nouveau produit'}
        right={editing && existing?.active && existing.catalog_products ? <button type="button" onClick={() => setSharing(true)} className="h-10 rounded-full border border-line px-3.5 text-[12.5px] font-extrabold">Partager</button> : null} />
      {sharing && editing && existing?.catalog_products && <ShareSheet target={{ shopId: shop.id, shopSlug: shop.slug, shopName: shop.name, offerId: existing.id, productSlug: existing.catalog_products.slug, name: existing.catalog_products.name, priceGnf: existing.price_gnf }} onClose={() => setSharing(false)} />}
      <Notice msg={msg} />

      <section aria-label="Photos" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
        {nPhotos < MAX_PHOTOS && (
          <label className="flex h-[92px] w-[92px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[18px] bg-ink text-[11.5px] font-extrabold text-white">
            <Icon name="camera" size={22} stroke={1.8} />Photo
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { const list = Array.from(e.target.files ?? []); setFiles((f) => [...f, ...list].slice(0, MAX_PHOTOS - kept.length)); e.target.value = ''; }} />
          </label>
        )}
        {kept.map((p) => <Thumb key={p} src={mediaUrl(p)} onRemove={() => setKept((k) => k.filter((x) => x !== p))} />)}
        {previews.map((u, i) => <Thumb key={u} src={u} onRemove={() => setFiles((f) => f.filter((_, j) => j !== i))} />)}
        {nPhotos === 0 && <span className="self-center pl-1 text-[11.5px] font-bold leading-snug text-muted">Jusqu’à 5 photos réelles :<br />elles font vendre.</span>}
      </section>

      <section className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-card p-3.5">
        {editing ? (
          <div className="flex flex-col gap-0.5"><span className="text-[13px] font-extrabold">Nom du produit</span><span className="text-[15px] font-bold">{existing?.catalog_products?.name}</span><span className="text-[11.5px] font-semibold text-muted">Le nom vient de la fiche commune du produit.</span></div>
        ) : (
          <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Nom du produit
            <input value={name} onChange={(e) => { setName(e.target.value); setLinked(null); }} autoComplete="off" maxLength={120} placeholder="Ex. Pagne wax 6 yards" className="h-[50px] rounded-[14px] border border-line px-3.5 text-[16px] font-bold outline-none focus:border-blue" />
          </label>
        )}
        {!editing && !linked && sugg.map((s) => (
          <button key={s.id} type="button" onClick={() => { setLinked(s); setName(s.name); setSugg([]); }} className="rounded-[14px] bg-blue-soft px-3 py-2.5 text-left text-[12.5px] font-bold leading-snug text-blue-ink">Déjà vendu sur HailandX : « {s.name} ». Toucher pour y ajouter votre offre.</button>
        ))}
        {linked && <p className="flex items-center justify-between gap-2 rounded-[14px] bg-ok-soft px-3 py-2.5 text-[12.5px] font-extrabold text-ok">Votre offre s’ajoute à la fiche existante.<button type="button" onClick={() => setLinked(null)} className="underline">Annuler</button></p>}
        <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Prix
          <span className="flex h-[50px] items-center gap-2 rounded-[14px] border border-line px-3.5 focus-within:border-blue">
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="185 000" className="min-w-0 flex-1 bg-transparent text-[16px] font-bold outline-none" />
            <span className="text-[13px] font-extrabold text-muted">GNF</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Prix avant promotion <span className="-mt-1 text-[11.5px] font-semibold text-muted">Facultatif : affiché barré, avec le pourcentage de baisse.</span>
          <span className="flex h-[50px] items-center gap-2 rounded-[14px] border border-line px-3.5 focus-within:border-blue">
            <input value={compareAt} onChange={(e) => setCompareAt(e.target.value)} inputMode="numeric" placeholder="210 000" className="min-w-0 flex-1 bg-transparent text-[16px] font-bold outline-none" />
            <span className="text-[13px] font-extrabold text-muted">GNF</span>
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-card p-3.5">
        <div className="flex items-baseline justify-between"><h2 className="text-[14px] font-extrabold">Variantes et stock</h2><span className="text-[12px] font-bold text-muted">Taille, couleur…</span></div>
        {variants.map((v, i) => (
          <div key={v.key} className="flex items-center gap-2">
            <input value={v.label} onChange={(e) => setVar(v.key, { label: e.target.value })} maxLength={40} placeholder={variants.length === 1 ? 'Standard (ou ex. Bleu)' : 'ex. L · Rouge'} aria-label={`Nom de la variante ${i + 1}`} className="h-11 min-w-0 flex-1 rounded-xl bg-bg px-3 text-[15px] font-bold outline-none focus:ring-2 focus:ring-blue" />
            <span className="flex h-11 items-center rounded-xl border border-line">
              <button type="button" aria-label={`Retirer une unité, variante ${i + 1}`} onClick={() => setVar(v.key, { stock: Math.max(0, v.stock - 1) })} className="h-[42px] w-9 text-[18px] font-extrabold">−</button>
              <input value={v.stock} onChange={(e) => setVar(v.key, { stock: Math.max(0, Math.min(9999, Math.floor(Number(e.target.value.replace(/\D/g, '')) || 0))) })} inputMode="numeric" aria-label={`Stock de la variante ${i + 1}`} className="w-9 bg-transparent text-center text-[15px] font-extrabold outline-none" />
              <button type="button" aria-label={`Ajouter une unité, variante ${i + 1}`} onClick={() => setVar(v.key, { stock: v.stock + 1 })} className="h-[42px] w-9 text-[18px] font-extrabold">+</button>
            </span>
            {variants.length > 1 && <button type="button" aria-label={`Supprimer la variante ${i + 1}`} onClick={() => { if (v.id) setRemoved((r) => [...r, v.id]); setVariants((vs) => vs.filter((x) => x.key !== v.key)); }} className="flex h-11 w-8 items-center justify-center text-muted"><Icon name="close" size={16} stroke={2.2} /></button>}
          </div>
        ))}
        <button type="button" onClick={() => { setVariants((vs) => [...vs, { key: nextKey, id: '', label: '', stock: 1 }]); setNextKey((k) => k + 1); }} className="h-11 rounded-xl border border-dashed border-[#c9c4b6] text-[13px] font-extrabold">+ Ajouter une variante</button>
      </section>

      <section className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-card p-3.5">
        <h2 className="text-[14px] font-extrabold">État</h2>
        <div className="flex gap-2">{(['neuf', 'occasion'] as const).map((c) => <button key={c} type="button" aria-pressed={condition === c} onClick={() => setCondition(c)} className={pill(condition === c)}>{c === 'neuf' ? 'Neuf' : 'Occasion'}</button>)}</div>
      </section>

      {!editing && !linked && (
        <section className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-card p-3.5">
          <h2 className="text-[14px] font-extrabold">Catégorie</h2>
          <div className="flex flex-wrap gap-2">{cats.map((c) => <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className={pill(cat === c.id)}>{c.name}</button>)}</div>
        </section>
      )}

      {shared ? (
        <section className="flex flex-col gap-1.5 rounded-[20px] border border-line-soft bg-card p-3.5">
          <h2 className="text-[14px] font-extrabold">Fiche du produit</h2>
          <p className="text-[12.5px] font-semibold leading-relaxed text-muted">Cette fiche est partagée avec un autre vendeur qui l’a créée : sa description et ses caractéristiques s’affichent pour tous. Ajoutez ce qui vous est propre dans « Le mot du vendeur ».</p>
          {shared.description && <p className="line-clamp-4 whitespace-pre-line text-[13px] font-medium">{shared.description}</p>}
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-card p-3.5">
            <div className="flex items-baseline justify-between gap-2"><h2 className="text-[14px] font-extrabold">Fiche détaillée</h2><span className="text-[12px] font-extrabold text-ok">Complète à {completeness} %</span></div>
            <span className="h-1.5 overflow-hidden rounded-full bg-bg"><span className="block h-1.5 rounded-full bg-ok" style={{ width: `${completeness}%` }} /></span>
            <p className="text-[12px] font-semibold leading-relaxed text-muted">{fiche.hint} Une fiche complète inspire confiance et fait vendre.</p>
            <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Description
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={FICHE_LIMITS.description} rows={5} placeholder="Décrivez le produit comme si le client l’avait en main : à quoi il sert, sa qualité, ses dimensions, ce qui le rend différent." className="rounded-[14px] border border-line px-3.5 py-3 text-[15px] font-medium leading-relaxed outline-none focus:border-blue" />
              <span className="self-end text-[11px] font-bold text-muted">{desc.length} / {FICHE_LIMITS.description}</span>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-extrabold">Points forts <span className="font-semibold text-muted">· 3 à 5 phrases courtes</span></span>
              {points.map((pt, i) => (
                <input key={i} value={pt} onChange={(e) => setPoints((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))} maxLength={FICHE_LIMITS.point} aria-label={`Point fort ${i + 1}`} placeholder={['Ex. Tissu épais qui ne déteint pas', 'Ex. Livré avec chargeur rapide', 'Ex. Fabriqué à Conakry'][i] ?? 'Autre point fort'} className="h-11 rounded-xl bg-bg px-3 text-[14.5px] font-semibold outline-none focus:ring-2 focus:ring-blue" />
              ))}
              {points.length < FICHE_LIMITS.points && <button type="button" onClick={() => setPoints((ps) => [...ps, ''])} className="h-10 self-start rounded-xl px-1 text-[13px] font-extrabold text-blue-ink">+ Ajouter un point fort</button>}
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-card p-3.5">
            <h2 className="text-[14px] font-extrabold">Caractéristiques</h2>
            {fiche.fields.map((f) => <FieldInput key={f.key} f={f} value={values[f.key] ?? ''} onChange={(v) => setValues((x) => ({ ...x, [f.key]: v }))} />)}
            <p className="text-[11.5px] font-semibold text-muted">Laissez vide ce qui ne s’applique pas : seuls les champs remplis s’affichent.</p>
          </section>
        </>
      )}

      <section className="flex flex-col gap-2 rounded-[20px] border border-line-soft bg-card p-3.5">
        <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Le mot du vendeur <span className="font-semibold text-muted">· facultatif, propre à votre boutique</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="Ex. Garantie boutique 1 mois, échange possible si la taille ne va pas, retrait en boutique possible." className="rounded-[14px] border border-line px-3.5 py-3 text-[14.5px] font-medium leading-relaxed outline-none focus:border-blue" />
        </label>
      </section>

      <section className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-card p-3.5">
        <h2 className="text-[14px] font-extrabold">Rayon</h2>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => <button key={s.id} type="button" aria-pressed={section === s.id} onClick={() => setSection(s.id)} className={pill(section === s.id)}>{s.name}</button>)}
          <button type="button" aria-pressed={section === null} onClick={() => setSection(null)} className={pill(section === null)}>Sans rayon</button>
        </div>
        {sections.length === 0 && <p className="text-[12px] font-semibold text-muted">Créez vos rayons depuis la liste des produits (« + Rayon »).</p>}
      </section>

      {editing && (
        <section className="flex items-center justify-between gap-3 rounded-[20px] border border-line-soft bg-card px-3.5 py-3">
          <span className="flex flex-col"><span className="text-[14px] font-extrabold">Visible dans la boutique</span><span className="text-[12px] font-semibold text-muted">Masqué, il reste dans votre liste.</span></span>
          <Switch on={active} onChange={setActive} label="Visible dans la boutique" />
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-b from-transparent to-bg to-30% px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        <button type="button" disabled={busy} onClick={save} className="h-14 w-full rounded-[18px] bg-ink text-[16px] font-extrabold text-white disabled:opacity-60">{busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Publier le produit'}</button>
      </div>
    </Screen>
  );
}

function Thumb({ src, onRemove }: { src: string | null; onRemove: () => void }) {
  return (
    <span className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[18px] bg-sand">
      {src && /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="" className="h-full w-full object-cover" />}
      <button type="button" aria-label="Retirer cette photo" onClick={onRemove} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90"><Icon name="close" size={14} stroke={2.4} /></button>
    </span>
  );
}

/** Un champ de la fiche type : texte, choix (liste proposée, saisie libre possible), nombre avec unité, oui / non, texte long. */
function FieldInput({ f, value, onChange }: { f: FicheField; value: string; onChange: (v: string) => void }) {
  const id = `fiche-${f.key}`;
  const box = 'h-11 min-w-0 flex-1 rounded-xl bg-bg px-3 text-[14.5px] font-semibold outline-none focus:ring-2 focus:ring-blue';
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">{f.label}
      {f.kind === 'long' ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={2} maxLength={FICHE_LIMITS.longValue} placeholder={f.placeholder} className="rounded-xl bg-bg px-3 py-2.5 text-[14.5px] font-medium leading-relaxed outline-none focus:ring-2 focus:ring-blue" />
      ) : f.kind === 'oui_non' ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={box}><option value="">Non précisé</option><option value="oui">Oui</option><option value="non">Non</option></select>
      ) : f.kind === 'nombre' ? (
        <span className="flex items-center gap-2"><input id={id} value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder={f.placeholder} className={box} />{f.unit && <span className="w-14 shrink-0 text-[12.5px] font-extrabold text-muted">{f.unit}</span>}</span>
      ) : (
        <>
          <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={FICHE_LIMITS.value} placeholder={f.placeholder ?? (f.options ? 'Choisir ou écrire' : '')} list={f.options ? `${id}-liste` : undefined} className={box} />
          {f.options && <datalist id={`${id}-liste`}>{f.options.map((o) => <option key={o} value={o} />)}</datalist>}
        </>
      )}
    </label>
  );
}
