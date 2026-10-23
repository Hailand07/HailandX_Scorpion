'use client';
import { useCallback, useEffect, useState } from 'react';
import { BackHeader, browserClient, errText, Icon, Notice, Screen } from '@hailandx/kit';
import { SellerGate } from '@/components/SellerGate';

interface Member { user_id: string; role: 'proprietaire' | 'employe'; phone_masked: string; me: boolean }
const RIGHTS: [string, boolean][] = [
  ['Préparer les commandes, afficher le QR', true],
  ['Ajouter et modifier des produits, les promotions', true],
  ['Répondre aux questions, voir les clients et les statistiques', true],
  ['Voir l’argent et les versements', false],
  ['Modifier la boutique (horaires, vacances, réglages) et l’équipe', false],
];

/** Équipe (maquette v6 C4) : le propriétaire ajoute jusqu'à 5 employés par numéro de téléphone (compte Hailand existant). */
export default function TeamPage() {
  return <SellerGate title="Équipe" ownerOnly>{({ shop }) => <Team shopId={shop.id} />}</SellerGate>;
}

function Team({ shopId }: { shopId: string }) {
  const sb = browserClient();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb!.rpc('fn_shop_members', { p_shop: shopId });
    setMembers((data as Member[]) ?? []);
  }, [sb, shopId]);
  useEffect(() => { void load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setBusy(true);
    const { error } = await sb!.rpc('fn_shop_member_add', { p_shop: shopId, p_phone: phone });
    setBusy(false);
    if (error) return setMsg({ tone: 'err', text: errText(error) });
    setPhone(''); setMsg({ tone: 'ok', text: 'Employé ajouté : il est prévenu et retrouve la boutique en ouvrant HailandX Vendeur avec son numéro.' });
    await load();
  }
  async function remove(id: string) {
    const { error } = await sb!.rpc('fn_shop_member_remove', { p_shop: shopId, p_user: id });
    setConfirm(null);
    setMsg(error ? { tone: 'err', text: errText(error) } : { tone: 'ok', text: 'Employé retiré : il n’a plus accès à la boutique.' });
    await load();
  }
  const employees = (members ?? []).filter((m) => m.role === 'employe').length;

  return (
    <Screen>
      <BackHeader href="/plus" title="Équipe" />
      <Notice msg={msg} />
      <section className="overflow-hidden rounded-[22px] border border-line-soft bg-card">
        {members === null && <p className="p-4 text-[14px] font-semibold text-muted">Chargement…</p>}
        {members?.map((m, i) => (
          <div key={m.user_id} className={`flex items-center gap-3 px-4 py-3 ${i < members.length - 1 ? 'border-b border-[#f0ede6]' : ''}`}>
            <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${m.role === 'proprietaire' ? 'bg-[#f6d8bd]' : 'bg-blue-soft text-blue'}`}><Icon name="user" size={19} /></span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[14.5px] font-extrabold">{m.phone_masked}{m.me ? ' (vous)' : ''}</span>
              <span className="text-[12px] font-semibold text-muted">{m.role === 'proprietaire' ? 'Propriétaire · tous les droits' : 'Employé · commandes, produits, marketing'}</span>
            </span>
            {m.role === 'employe' && (confirm === m.user_id
              ? <span className="flex gap-1.5"><button type="button" onClick={() => setConfirm(null)} className="h-9 rounded-full border border-line px-3 text-[12px] font-extrabold">Non</button><button type="button" onClick={() => void remove(m.user_id)} className="h-9 rounded-full bg-[#a3321f] px-3 text-[12px] font-extrabold text-white">Retirer</button></span>
              : <button type="button" onClick={() => setConfirm(m.user_id)} className="h-9 shrink-0 rounded-full border border-line px-3 text-[12px] font-extrabold">Retirer</button>)}
          </div>
        ))}
      </section>

      <form onSubmit={add} className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
        <h2 className="text-[14.5px] font-extrabold">Ajouter un employé</h2>
        <p className="-mt-1 text-[12px] font-semibold text-muted">Son numéro doit déjà avoir un compte Hailand : demandez-lui de se connecter une fois à HailandX Vendeur. {5 - employees} place{5 - employees > 1 ? 's' : ''} restante{5 - employees > 1 ? 's' : ''}.</p>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" placeholder="620 00 00 00" aria-label="Numéro de l’employé" className="h-12 rounded-xl bg-bg px-3.5 text-[16px] font-bold outline-none focus:ring-2 focus:ring-blue" />
        <button type="submit" disabled={busy || phone.replace(/\D/g, '').length < 9 || employees >= 5} className="h-12 rounded-2xl bg-ink text-[14.5px] font-extrabold text-white disabled:opacity-40">{busy ? 'Ajout…' : 'Ajouter à l’équipe'}</button>
      </form>

      <section className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
        <h2 className="text-[14.5px] font-extrabold">Ce qu’un employé peut faire</h2>
        {RIGHTS.map(([t, ok]) => (
          <span key={t} className="flex items-center gap-2.5 text-[13px] font-bold">
            <span aria-hidden="true" className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] ${ok ? 'bg-blue text-white' : 'border-2 border-[#c9c4b6]'}`}>{ok && <Icon name="check" size={13} stroke={3} />}</span>
            <span className={ok ? '' : 'text-muted'}>{t}</span>
          </span>
        ))}
      </section>
    </Screen>
  );
}
