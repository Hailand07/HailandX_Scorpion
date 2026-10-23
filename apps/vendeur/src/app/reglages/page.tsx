'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatGnPhone, normalizeGnPhone } from '@hailandx/commerce';
import { BackHeader, browserClient, errText, GroupTitle, HAILANDX_URL, Icon, LienHailand, lienEnregistrement, mediaUrl, Notice, Screen, uploadPhoto } from '@hailandx/kit';
import { declLabel } from '@/lib/useMyShop';
import { SellerGate, type SellerCtx } from '@/components/SellerGate';

interface Cat { id: string; name: string }
type Field = 'name' | 'tagline' | 'category' | 'whatsapp' | 'address' | null;

/** Réglages de la boutique (v2) : vitrine (bandeau, logo, nom, présentation, catégorie), contact WhatsApp, adresse. */
export default function SettingsPage() {
  return <SellerGate title="Réglages de la boutique" allowClosed ownerOnly>{(ctx) => <Settings {...ctx} />}</SellerGate>;
}

function Settings({ shop, decls, decl, uid, reload }: SellerCtx) {
  const sb = browserClient();
  const [cats, setCats] = useState<Cat[]>([]);
  const [open, setOpen] = useState<Field>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  useEffect(() => { sb?.from('categories').select('id,name').order('position').then(({ data }) => setCats((data as Cat[]) ?? [])); }, [sb]);

  const edit = (f: Field, v: string) => { setOpen(open === f ? null : f); setValue(v); setMsg(null); };

  async function save(patch: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null);
    const { error } = await sb!.from('shops').update(patch).eq('id', shop.id);
    setBusy(false);
    if (error) return setMsg({ tone: 'err', text: errText(error) });
    setOpen(null); setMsg({ tone: 'ok', text: ok }); await reload();
  }
  async function image(kind: 'logo' | 'cover', file: File | undefined) {
    if (!file) return;
    setBusy(true); setMsg(null);
    try { const path = await uploadPhoto(sb!, uid, file); await save(kind === 'logo' ? { logo_path: path } : { cover_path: path }, kind === 'logo' ? 'Logo mis à jour.' : 'Bandeau mis à jour.'); }
    catch (e) { setBusy(false); setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Image refusée.' }); }
  }
  function saveWhatsapp() {
    const raw = value.trim(); const n = raw ? normalizeGnPhone(raw) : null;
    if (raw && !n) return setMsg({ tone: 'err', text: 'Entrez un numéro guinéen valide, par exemple 6xx xx xx xx.' });
    void save({ whatsapp: n }, n ? 'Numéro WhatsApp enregistré : vos clients peuvent vous écrire depuis la boutique.' : 'Numéro WhatsApp retiré.');
  }
  function changeAddress(id: string) {
    if (shop.status === 'ouverte' && !confirm('Changer d’adresse referme la vente jusqu’à la certification de la nouvelle adresse. Continuer ?')) return;
    void save({ declaration_id: id }, 'Adresse changée. Demandez sa certification depuis l’onglet Vendre.');
  }

  const logo = mediaUrl(shop.logo_path); const cover = mediaUrl(shop.cover_path);
  const initials = shop.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const input = 'h-12 w-full rounded-[14px] border border-line bg-card px-3.5 text-[16px] font-semibold outline-none focus:border-blue';
  const actions = (onSave: () => void) => (
    <div className="flex gap-2"><button type="button" disabled={busy} onClick={onSave} className="h-11 flex-1 rounded-xl bg-ink text-[13.5px] font-extrabold text-white disabled:opacity-50">Enregistrer</button><button type="button" onClick={() => setOpen(null)} className="h-11 rounded-xl border border-line px-4 text-[13.5px] font-bold">Annuler</button></div>
  );

  return (
    <Screen className="gap-4">
      <BackHeader href="/plus" title="Réglages de la boutique" label="Retour" />
      <Notice msg={msg} />

      <section aria-label="Vitrine" className="overflow-hidden rounded-[22px] border border-line-soft bg-card">
        <div className="relative h-[104px] bg-[#f1cfae]">
          {cover && /* eslint-disable-next-line @next/next/no-img-element */ <img src={cover} alt="" className="h-full w-full object-cover" />}
          <label className="absolute right-2.5 top-2.5 flex h-[34px] cursor-pointer items-center rounded-xl bg-white/[0.92] px-3 text-[12px] font-extrabold">Changer le bandeau<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => image('cover', e.target.files?.[0])} /></label>
          <span className="absolute -bottom-7 left-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] border-4 border-card bg-[#f6d8bd] font-display text-[18px] font-bold">
            {logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="" className="h-full w-full object-cover" /> : initials}
          </span>
        </div>
        <div className="flex justify-end px-4 pb-1 pt-2.5">
          <label className="flex h-9 cursor-pointer items-center text-[12.5px] font-extrabold text-blue">Changer le logo<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => image('logo', e.target.files?.[0])} /></label>
        </div>
        <Row label="Nom" value={shop.name} onClick={() => edit('name', shop.name)} />
        {open === 'name' && <Panel><input value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} aria-label="Nom de la boutique" className={input} /><p className="text-[12px] font-semibold text-muted">L’adresse de votre boutique (/b/{shop.slug}) ne change pas.</p>{actions(() => value.trim().length >= 2 ? void save({ name: value.trim() }, 'Nom enregistré.') : setMsg({ tone: 'err', text: 'Au moins 2 lettres.' }))}</Panel>}
        <Row label="Présentation" value={shop.tagline || 'Ajouter une phrase'} muted={!shop.tagline} onClick={() => edit('tagline', shop.tagline ?? '')} />
        {open === 'tagline' && <Panel><input value={value} onChange={(e) => setValue(e.target.value)} maxLength={90} placeholder="Ex. Pagnes wax et bazin, choisis à Madina" aria-label="Présentation" className={input} />{actions(() => void save({ tagline: value.trim() || null }, 'Présentation enregistrée.'))}</Panel>}
        <Row label="Catégorie" value={cats.find((c) => c.id === shop.category_id)?.name ?? 'Choisir'} muted={!shop.category_id} onClick={() => edit('category', shop.category_id ?? '')} />
        {open === 'category' && <Panel><div className="flex flex-wrap gap-2">{cats.map((c) => <button key={c.id} type="button" disabled={busy} onClick={() => void save({ category_id: c.id }, 'Catégorie enregistrée.')} className={`h-10 rounded-full px-3.5 text-[13px] font-bold ${shop.category_id === c.id ? 'bg-ink text-white' : 'border border-line'}`}>{c.name}</button>)}</div></Panel>}
      </section>

      <section aria-label="Contact" className="flex flex-col gap-2">
        <GroupTitle>Contact</GroupTitle>
        <div className="overflow-hidden rounded-[20px] border border-line-soft bg-card">
          <Row label="WhatsApp de la boutique" value={shop.whatsapp ? formatGnPhone(shop.whatsapp) : 'Ajouter un numéro'} muted={!shop.whatsapp} onClick={() => edit('whatsapp', shop.whatsapp ? shop.whatsapp.replace(/^\+?224/, '') : '')} first />
          {open === 'whatsapp' && <Panel><input value={value} onChange={(e) => setValue(e.target.value)} inputMode="tel" placeholder="6xx xx xx xx" aria-label="Numéro WhatsApp" className={input} /><p className="text-[12px] font-semibold text-muted">Laissez vide pour retirer le bouton WhatsApp de la boutique.</p>{actions(saveWhatsapp)}</Panel>}
        </div>
      </section>

      <section aria-label="Adresse" className="flex flex-col gap-2">
        <GroupTitle>Adresse</GroupTitle>
        <div className="flex items-center gap-3 rounded-[20px] border border-line-soft bg-card px-4 py-3.5">
          {decl?.level === 3
            ? <svg width="28" height="28" viewBox="0 0 24 24" fill="#3346f0" aria-hidden="true"><path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1L2.7 15.5l1-3-1-3 2.8-1.6.9-3.1 3.2.3z" /><path d="m8.5 12 2.5 2.5 4.5-5" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            : <Icon name="pin" size={26} className="text-muted" />}
          <span className="flex min-w-0 flex-1 flex-col"><span className="text-[14.5px] font-extrabold">{decl?.level === 3 ? 'Certifiée par Hailand' : decl ? 'Pas encore certifiée' : 'Aucune adresse'}</span><span className="truncate text-[12px] font-semibold text-muted">{decl ? `${declLabel(decl)} · niveau ${decl.level}` : 'Rattachez une adresse depuis l’onglet Vendre'}</span></span>
          {decls.length > 1 && <button type="button" onClick={() => edit('address', '')} className="h-10 shrink-0 px-1 text-[13px] font-extrabold text-blue">Changer</button>}
        </div>
        {open === 'address' && (
          <div className="flex flex-col gap-2">
            {decls.filter((x) => x.id !== decl?.id).map((x) => <button key={x.id} type="button" disabled={busy} onClick={() => changeAddress(x.id)} className="flex min-h-12 items-center justify-between rounded-[14px] border border-line bg-card px-3.5 text-[14px] font-bold"><span className="truncate">{declLabel(x)}</span><span className="text-[12px] text-muted">niveau {x.level}</span></button>)}
          </div>
        )}
        <p className="mx-1 text-[12px] font-semibold leading-snug text-muted">Vous déménagez ? Repérez le nouveau bâtiment avec <LienHailand app="navigationx" href={lienEnregistrement('vendeur', '/reglages')} className="font-extrabold text-blue-ink">NavigationX</LienHailand>, puis demandez sa certification. Changer d’adresse referme la vente jusqu’à la nouvelle certification.</p>
      </section>

      <LienHailand app="hailandx" href={`${HAILANDX_URL}/b/${shop.slug}`} target="_blank" className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-line bg-card text-[14.5px] font-extrabold"><Icon name="eye" size={18} />Voir ma boutique sur HailandX</LienHailand>
    </Screen>
  );
}

function Row({ label, value, onClick, muted, first }: { label: string; value: string; onClick: () => void; muted?: boolean; first?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-[58px] w-full items-center gap-3 px-4 py-2 text-left ${first ? '' : 'border-t border-[#f0ede6]'}`}>
      <span className="flex min-w-0 flex-1 flex-col"><span className="text-[12px] font-bold text-muted">{label}</span><span className={`truncate text-[15px] font-extrabold ${muted ? 'text-blue-ink' : ''}`}>{value}</span></span>
      <Icon name="chevron" size={16} stroke={2} className="text-[#9a9db0]" />
    </button>
  );
}

const Panel = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-2.5 border-t border-[#f0ede6] bg-bg px-4 py-3">{children}</div>;
