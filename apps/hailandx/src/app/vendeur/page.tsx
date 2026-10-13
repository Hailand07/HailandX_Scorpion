'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Wordmark } from '@hailandx/ui';
import { formatGnf, slugify } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Shop { id: string; slug: string; name: string; tagline: string | null; status: string; declaration_id: string | null; category_id: string | null }
interface Decl { id: string; declared_label: string | null; hailand_code: string | null; detected_level: number }
interface Offer { id: string; price_gnf: number; active: boolean; catalog_products: { name: string; slug: string } | null }
interface Cat { id: string; name: string }

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
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sb || !uid) return;
    const [c, s, d] = await Promise.all([
      sb.from('categories').select('id,name').order('position'),
      sb.from('shops').select('id,slug,name,tagline,status,declaration_id,category_id').eq('owner_id', uid).limit(1).maybeSingle(),
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
      const o = await sb.from('offers').select('id,price_gnf,active,catalog_products(name,slug)').eq('shop_id', (s.data as Shop).id).order('created_at', { ascending: false });
      setOffers((o.data as unknown as Offer[]) ?? []);
    }
    setLoading(false);
  }, [sb, uid]);

  useEffect(() => { if (session === null) setLoading(false); else if (uid) void load(); }, [session, uid, load]);

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

  async function addProduct(f: FormData) {
    const name = String(f.get('pname') ?? '').trim();
    const price = Number(String(f.get('price') ?? '').replace(/\s/g, ''));
    const stock = Math.max(0, Math.floor(Number(f.get('stock') ?? 0)));
    if (name.length < 2) throw new Error('Donnez un nom au produit.');
    if (!Number.isFinite(price) || price < 500) throw new Error('Indiquez un prix en GNF (500 au minimum).');
    const { data: prod, error: e1 } = await sb!.from('catalog_products').insert({ slug: `${slugify(name) || 'produit'}-${rand()}`, name, category_id: String(f.get('pcat') ?? '') || shop?.category_id || null, created_by: uid }).select('id').single();
    fail(e1);
    const { data: off, error: e2 } = await sb!.from('offers').insert({ shop_id: shop!.id, product_id: (prod as { id: string }).id, price_gnf: Math.round(price) }).select('id').single();
    fail(e2);
    const { error: e3 } = await sb!.from('offer_variants').insert({ offer_id: (off as { id: string }).id, label: 'Standard', stock });
    fail(e3);
    return 'Produit ajouté.';
  }

  if (session === undefined || loading) return <Shell><p className="text-[14px] font-semibold text-muted">Chargement…</p></Shell>;
  if (!sb) return <Shell><p className="text-[14px] font-semibold text-muted">La base n’est pas configurée.</p></Shell>;
  if (!session) {
    return (
      <Shell>
        <h1 className="font-display text-[26px] font-semibold tracking-tight">Vendre sur HailandX</h1>
        <p className="text-[14px] font-medium text-muted">Connectez-vous avec votre téléphone pour ouvrir votre boutique.</p>
        <Link href="/connexion?next=/vendeur" className="inline-flex h-[54px] items-center justify-center rounded-2xl bg-ink px-7 text-[15px] font-extrabold text-white">Se connecter</Link>
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
        <h1 className="font-display text-[26px] font-semibold tracking-tight">Mon espace vendeur</h1>
        <button onClick={() => sb.auth.signOut()} className="h-11 px-2 text-[13px] font-bold text-muted">Déconnexion</button>
      </div>
      {msg && <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${msg.tone === 'err' ? 'bg-[#fde8e4] text-[#8a2a1c]' : 'bg-ok-soft text-ok'}`}>{msg.text}</p>}

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
          {!decls.length && <p className="text-[12.5px] font-medium text-muted">Enregistrez d’abord votre adresse dans NavigationX : c’est elle que Hailand certifiera pour ouvrir la vente.</p>}
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
            <div className="flex flex-wrap gap-2">
              <ShareButtons url={`${origin}/b/${shop.slug}`} text={`Ma boutique ${shop.name} sur HailandX`} />
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Ajouter un produit</h2>
            <form action={(f) => run(() => addProduct(f))} className="flex flex-col gap-3">
              <input name="pname" required placeholder="Nom du produit" className={input} />
              <div className="grid grid-cols-2 gap-3">
                <input name="price" required inputMode="numeric" placeholder="Prix (GNF)" className={input} />
                <input name="stock" required inputMode="numeric" defaultValue="1" placeholder="Stock" className={input} />
              </div>
              <select name="pcat" className={input} defaultValue={shop.category_id ?? ''}><option value="">Catégorie</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <Button type="submit" disabled={busy}>Ajouter</Button>
            </form>
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="font-display text-lg font-semibold">Mes produits ({offers.length})</h2>
            {offers.length === 0 && <p className="text-[13.5px] font-medium text-muted">Aucun produit pour l’instant.</p>}
            {offers.map((o) => (
              <div key={o.id} className="flex flex-col gap-2 rounded-2xl border border-line-soft bg-card px-4 py-3">
                <div className="flex items-baseline justify-between gap-3"><span className="truncate text-[14px] font-bold">{o.catalog_products?.name}</span><span className="shrink-0 font-display text-[14px] font-semibold">{formatGnf(o.price_gnf)}</span></div>
                {o.catalog_products && <ShareButtons url={`${origin}/p/${o.catalog_products.slug}`} text={`${o.catalog_products.name} — ${formatGnf(o.price_gnf)}`} />}
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
