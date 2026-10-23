'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatGnf, isPromoCode, normalizePromoCode, type PromoKind, promoLabel } from '@hailandx/commerce';
import { BackHeader, browserClient, errText, Notice, Screen, Switch } from '@hailandx/kit';
import { SellerGate } from '@/components/SellerGate';
import { Chargement } from '@hailandx/ui';

interface Code { id: string; code: string; kind: PromoKind; value: number; min_subtotal_gnf: number; max_uses: number | null; once_per_buyer: boolean; ends_at: string | null; active: boolean; promo_uses: { discount_gnf: number }[] }
const field = 'h-12 w-full min-w-0 rounded-xl bg-bg px-3 text-[15px] font-bold outline-none focus:ring-2 focus:ring-blue';
const num = (s: string) => Number(s.replace(/\s/g, '')) || 0;

/** Codes promo (maquette v6 B2) : créer un code, voir combien il a servi, le couper. La réduction est prise sur la part du vendeur. */
export default function PromoCodesPage() {
  return <SellerGate title="Codes promo">{({ shop }) => <Codes shopId={shop.id} shopName={shop.name} />}</SellerGate>;
}

function Codes({ shopId, shopName }: { shopId: string; shopName: string }) {
  const sb = browserClient();
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [form, setForm] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from('promo_codes').select('id,code,kind,value,min_subtotal_gnf,max_uses,once_per_buyer,ends_at,active,promo_uses(discount_gnf)').eq('shop_id', shopId).order('created_at', { ascending: false });
    setCodes((data as unknown as Code[]) ?? []);
  }, [sb, shopId]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(c: Code, on: boolean) {
    const { error } = await sb!.from('promo_codes').update({ active: on }).eq('id', c.id);
    setMsg(error ? { tone: 'err', text: errText(error) } : null);
    await load();
  }

  return (
    <Screen>
      <BackHeader href="/marketing" title="Codes promo" />
      <Notice msg={msg} />
      {!form && <button type="button" onClick={() => setForm(true)} className="h-[52px] rounded-2xl bg-ink text-[15px] font-extrabold text-white">+ Nouveau code promo</button>}
      {form && <NewCode shopId={shopId} shopName={shopName} onCancel={() => setForm(false)} onSaved={async (code) => { setForm(false); setMsg({ tone: 'ok', text: `Code ${code} créé : donnez-le à vos clients (statut WhatsApp, bio TikTok…).` }); await load(); }} />}
      {codes === null && <Chargement />}
      {codes?.length === 0 && !form && <p className="rounded-[20px] border border-dashed border-line px-4 py-6 text-center text-[13.5px] font-bold text-muted">Aucun code pour l’instant. Un code comme « BIENVENUE » aide un nouveau client à passer sa première commande.</p>}
      {codes?.map((c) => {
        const expired = c.ends_at !== null && new Date(c.ends_at) <= new Date();
        const given = c.promo_uses.reduce((a, u) => a + u.discount_gnf, 0);
        return (
          <article key={c.id} className={`flex flex-col gap-2 rounded-[20px] border border-line-soft bg-card p-4 ${c.active && !expired ? '' : 'opacity-70'}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-[10px] bg-ink px-2.5 py-1.5 font-display text-[15px] font-bold tracking-[0.06em] text-lime">{c.code}</span>
              <Switch on={c.active} onChange={(v) => void toggle(c, v)} label={`Code ${c.code} actif`} />
            </div>
            <span className="text-[14px] font-extrabold">{promoLabel(c)}</span>
            <span className="text-[12.5px] font-semibold text-muted">
              Utilisé {c.promo_uses.length} fois{c.max_uses ? ` sur ${c.max_uses}` : ''}{given ? ` · ${formatGnf(given)} offerts` : ''}
              {c.once_per_buyer ? ' · une fois par client' : ''}
              {c.ends_at ? ` · ${expired ? 'expiré le' : 'jusqu’au'} ${new Date(c.ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}
            </span>
          </article>
        );
      })}
    </Screen>
  );
}

function NewCode({ shopId, shopName, onCancel, onSaved }: { shopId: string; shopName: string; onCancel: () => void; onSaved: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<PromoKind>('pourcentage');
  const [value, setValue] = useState('10');
  const [min, setMin] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [end, setEnd] = useState('');
  const [once, setOnce] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rule = { kind, value: num(value), min_subtotal_gnf: num(min) };

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!isPromoCode(code)) return setErr('Le code doit faire 3 à 20 lettres ou chiffres (ex. KADI10).');
    if (kind === 'pourcentage' && (rule.value < 1 || rule.value > 90)) return setErr('Pourcentage entre 1 et 90.');
    if (kind === 'montant' && rule.value < 500) return setErr('Montant de 500 GNF au minimum.');
    setBusy(true);
    const { error } = await browserClient()!.from('promo_codes').insert({
      shop_id: shopId, code, kind, value: rule.value, min_subtotal_gnf: rule.min_subtotal_gnf, max_uses: num(maxUses) || null, once_per_buyer: once,
      ends_at: end ? new Date(`${end}T23:59:59`).toISOString() : null,
    });
    setBusy(false);
    if (error) return setErr(error.code === '23505' ? 'Ce code existe déjà dans votre boutique.' : errText(error));
    onSaved(code);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-4">
      <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Code (ce que le client tape)
        <input value={code} onChange={(e) => setCode(normalizePromoCode(e.target.value))} placeholder="KADI10" autoCapitalize="characters" className={`${field} font-display tracking-[0.06em]`} />
      </label>
      <div role="radiogroup" aria-label="Type de réduction" className="grid grid-cols-2 gap-2">
        {(['pourcentage', 'montant'] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setValue(k === 'pourcentage' ? '10' : '20000'); }} className={`h-11 rounded-xl text-[13.5px] font-extrabold ${kind === k ? 'bg-ink text-white' : 'border border-line'}`}>{k === 'pourcentage' ? 'Pourcentage' : 'Montant fixe'}</button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Valeur
        <span className="flex items-center gap-2 rounded-xl bg-bg pr-3"><input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" className={field} /><span className="text-[12.5px] text-muted">{kind === 'pourcentage' ? '%' : 'GNF'}</span></span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1.5 text-[12.5px] font-extrabold">Achat minimum<input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder="aucun" className={field} /></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-[12.5px] font-extrabold">Fin (facultatif)<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={field} /></label>
      </div>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Utilisations au plus<input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" placeholder="sans limite" className={field} /></label>
      <label className="flex min-h-[44px] items-center gap-3 text-[13.5px] font-bold"><input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} className="h-5 w-5" />Une seule fois par client</label>
      <div className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-[#b9b3a4] bg-[#fffdf6] p-3.5">
        <span className="text-[12px] font-extrabold text-muted">Ce que voit le client au paiement</span>
        <span className="flex flex-wrap items-center gap-2"><span className="rounded-[10px] bg-ink px-2.5 py-1 font-display text-[14px] font-bold tracking-[0.06em] text-lime">{code || 'CODE'}</span><span className="text-[13.5px] font-extrabold">{promoLabel(rule)} · {shopName}</span></span>
        <span className="text-[11.5px] font-semibold text-muted">La réduction est prise sur votre part ; la commission Hailand se calcule après réduction.</span>
      </div>
      {err && <p role="alert" className="text-[13px] font-bold text-[#a3321f]">{err}</p>}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button type="button" onClick={onCancel} className="h-12 rounded-2xl border border-line px-4 text-[14px] font-extrabold">Annuler</button>
        <button type="submit" disabled={busy} className="h-12 rounded-2xl bg-ink text-[14.5px] font-extrabold text-white disabled:opacity-50">{busy ? 'Création…' : 'Créer le code'}</button>
      </div>
    </form>
  );
}
