'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatSyli, normalizeGnPhone, phoneFromQr } from '@hailandx/commerce';
import { BackHeader, browserClient, Icon, Screen, useWallet } from '@hailandx/kit';
import { Chargement, QrScanner } from '@hailandx/ui';

/** Envoyer des Syli (maquette v8 A3) : numéro ou QR → nom masqué → montant → confirmation → envoyé. Sans frais, non annulable. */
function Send() {
  const to = useSearchParams().get('a') ?? '';
  const { wallet, reload } = useWallet();
  const [phone, setPhone] = useState(to);
  const [who, setWho] = useState<{ label: string; phone_masked: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!wallet) return <Screen><BackHeader href="/compte/hailandpay" title="Envoyer des Syli" /><Chargement /></Screen>;
  const n = Number(amount.replace(/\D/g, '')) || 0;
  const sb = browserClient()!;
  const clean = (m: string) => m.replace(/^.*?:\s*/, '');

  async function lookup(p = phone) {
    setErr(null); setWho(null);
    if (!normalizeGnPhone(p)) return setErr('Numéro guinéen invalide.');
    const { data, error } = await sb.rpc('fn_wallet_lookup', { p_phone: p });
    if (error) return setErr(clean(error.message));
    setWho((data as { label: string; phone_masked: string }[])[0] ?? null);
  }
  function next() {
    setErr(null);
    if (!who) return setErr('Vérifiez d’abord le numéro.');
    if (n <= 0) return setErr('Indiquez un montant.');
    if (n > wallet!.balance) return setErr(`Solde insuffisant : ${formatSyli(wallet!.balance)} disponibles.`);
    setStep(2);
  }
  async function confirm() {
    setBusy(true); setErr(null);
    const { error } = await sb.rpc('fn_wallet_transfer', { p_phone: phone, p_amount: n, p_note: note.trim() || null });
    setBusy(false);
    if (error) { setStep(1); return setErr(clean(error.message)); }
    await reload(); setStep(3);
  }

  return (
    <Screen className="gap-4">
      <BackHeader href="/compte/hailandpay" title="Envoyer des Syli" right={step < 3 ? <span className="text-[12px] font-extrabold text-muted">Étape {step} sur 2</span> : null} />
      {scan && <QrScanner title="Scanner le QR HailandPay" onClose={() => setScan(false)} onResult={(t) => { const p = phoneFromQr(t); setScan(false); if (!p) return setErr('Ce QR n’est pas un QR de réception HailandPay.'); setPhone(p); void lookup(p); }} />}
      {step === 1 && (
        <>
          <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Numéro du destinataire
            <span className="flex gap-2">
              <input value={phone} onChange={(e) => { setPhone(e.target.value); setWho(null); }} onBlur={() => phone && void lookup()} inputMode="tel" placeholder="6XX XX XX XX" className="h-[54px] min-w-0 flex-1 rounded-2xl border-2 border-blue bg-card px-4 text-[18px] font-bold outline-none" />
              <button type="button" onClick={() => setScan(true)} aria-label="Scanner un QR HailandPay" className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl border border-line bg-card"><Icon name="qr" size={22} /></button>
            </span>
          </label>
          {who && <p role="status" className="flex items-center gap-2.5 rounded-2xl bg-ok-soft px-4 py-3 text-[13.5px] font-extrabold text-ok"><Icon name="check" size={18} stroke={2.6} />Compte Hailand trouvé : {who.label} · {who.phone_masked}</p>}
          <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Montant
            <span className="flex h-[54px] items-center gap-2 rounded-2xl border border-line bg-card px-4"><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="250 000" className="min-w-0 flex-1 bg-transparent font-display text-[22px] font-semibold outline-none" /><span className="text-[14px] font-extrabold text-muted">Syli</span></span>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Message (facultatif)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Pour le tissu" className="h-12 rounded-2xl border border-line bg-card px-4 text-[15px] font-semibold outline-none focus:border-blue" />
          </label>
          <span className="text-[12px] font-bold text-muted">Disponible : {formatSyli(wallet.balance)}</span>
          {err && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13.5px] font-bold text-[#8a2a1c]">{err}</p>}
          <button type="button" onClick={next} className="mt-auto h-14 rounded-[18px] bg-ink text-[16px] font-extrabold text-white">Continuer</button>
        </>
      )}
      {step === 2 && who && (
        <>
          <section className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-[18px] text-[14px] font-bold">
            <span className="text-[13px] font-extrabold text-muted">Vous envoyez</span>
            <span className="font-display text-[32px] font-semibold">{formatSyli(n, false)} <span className="text-[15px] text-muted">Syli</span></span>
            <span className="flex justify-between"><span className="text-muted">À</span><span>{who.label} · {who.phone_masked}</span></span>
            {note.trim() && <span className="flex justify-between gap-3"><span className="text-muted">Message</span><span className="truncate">{note.trim()}</span></span>}
            <span className="flex justify-between"><span className="text-muted">Frais</span><span className="text-ok">0 Syli</span></span>
            <span className="flex justify-between"><span className="text-muted">Solde après</span><span>{formatSyli(wallet.balance - n)}</span></span>
          </section>
          <p className="text-[12.5px] font-bold leading-relaxed text-muted">Un envoi ne s’annule pas : vérifiez le nom. En cas d’erreur, l’équipe Hailand peut intervenir.</p>
          {err && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13.5px] font-bold text-[#8a2a1c]">{err}</p>}
          <div className="mt-auto flex flex-col gap-2">
            <button type="button" disabled={busy} onClick={confirm} className="h-14 rounded-[18px] bg-lime text-[16px] font-extrabold text-ink disabled:opacity-50">{busy ? 'Envoi…' : 'Confirmer l’envoi'}</button>
            <button type="button" onClick={() => setStep(1)} className="h-11 text-[14px] font-bold text-muted">Modifier</button>
          </div>
        </>
      )}
      {step === 3 && who && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-lime"><Icon name="check" size={38} stroke={2.8} /></span>
          <span className="font-display text-[24px] font-semibold">{formatSyli(n)} envoyés</span>
          <span className="text-[14px] font-bold text-muted">{who.label} est prévenu(e) dans HailandX.</span>
          <a href="/compte/hailandpay" className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-card text-[15px] font-extrabold">Retour au portefeuille</a>
        </div>
      )}
    </Screen>
  );
}

export default function SendPage() { return <Suspense><Send /></Suspense>; }
