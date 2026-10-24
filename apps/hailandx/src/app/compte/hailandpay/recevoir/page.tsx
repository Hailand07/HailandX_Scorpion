'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { formatGnPhone, receiveQr } from '@hailandx/commerce';
import { BackHeader, Icon, Screen, useSession } from '@hailandx/kit';
import { Chargement } from '@hailandx/ui';

/** Recevoir des Syli (maquette v8 A4) : QR « hailandpay:<numéro> » et numéro à partager. */
export default function ReceivePage() {
  const session = useSession();
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const phone = session?.user.phone ?? '';
  useEffect(() => { if (phone) void QRCode.toDataURL(receiveQr(phone), { margin: 1, width: 460, errorCorrectionLevel: 'M' }).then(setQr); }, [phone]);
  if (!session) return <Screen><BackHeader href="/compte/hailandpay" title="Recevoir des Syli" /><Chargement /></Screen>;
  const shown = formatGnPhone(phone.startsWith('+') ? phone : `+${phone}`);
  async function share() {
    const text = `Envoie-moi des Syli (argent de test HailandPay) : ${shown}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setMsg('Message copié.'); } } catch { /* partage annulé */ }
  }
  async function copy() { try { await navigator.clipboard.writeText(shown); setMsg('Numéro copié.'); } catch { setMsg(shown); } }
  return (
    <Screen className="gap-4">
      <BackHeader href="/compte/hailandpay" title="Recevoir des Syli" />
      <section className="flex flex-col items-center gap-3.5 rounded-[26px] border border-line-soft bg-card p-6">
        <span className="font-display text-[18px] font-semibold tracking-tight">Hailand<span className="text-blue">Pay</span></span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt="QR de réception HailandPay" width={230} height={230} className="h-[230px] w-[230px]" /> : <span className="h-[230px] w-[230px] rounded-2xl bg-bg" />}
        <span className="font-display text-[20px] font-semibold">{shown}</span>
      </section>
      <p className="text-center text-[13px] font-bold leading-relaxed text-muted">Faites scanner ce code dans « Envoyer » ou donnez votre numéro : l’envoi arrive tout de suite dans votre portefeuille.</p>
      <div className="flex gap-2">
        <button type="button" onClick={share} className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-ink text-[14.5px] font-extrabold text-white"><Icon name="share" size={18} />Partager</button>
        <button type="button" onClick={copy} className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-[14.5px] font-extrabold"><Icon name="copy" size={18} />Copier le numéro</button>
      </div>
      {msg && <p role="status" className="text-center text-[13px] font-bold text-ok">{msg}</p>}
    </Screen>
  );
}
