'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { BackHeader, HAILANDX_URL, Icon, Screen } from '@hailandx/kit';
import { SellerGate } from '@/components/SellerGate';
import { BRAND, downloadCanvas, roundRect, wrapText } from '@/lib/visual';

/** QR code de la boutique : une affiche à imprimer (vitrine, sacs, cartes de visite) qui ouvre la vitrine HailandX. */
export default function ShopQrPage() {
  return <SellerGate title="QR code de la boutique">{({ shop }) => <Poster name={shop.name} slug={shop.slug} />}</SellerGate>;
}

function Poster({ name, slug }: { name: string; slug: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const url = `${HAILANDX_URL}/b/${slug}`;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    void (async () => {
      const W = 1240; const H = 1754; // A5 à 150 points par pouce, proportions d'une feuille A4 / A5
      c.width = W; c.height = H;
      const ctx = c.getContext('2d')!;
      await document.fonts.ready;
      ctx.fillStyle = BRAND.bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = BRAND.ink; ctx.textAlign = 'center';
      ctx.font = '600 92px Sora, sans-serif';
      wrapText(ctx, name, W / 2, 230, W - 200, 104, 2);
      ctx.font = '700 46px Manrope, sans-serif'; ctx.fillStyle = BRAND.muted;
      ctx.fillText('Commandez en ligne, livré chez vous', W / 2, 470);
      const qr = document.createElement('canvas');
      await QRCode.toCanvas(qr, url, { margin: 1, width: 760, errorCorrectionLevel: 'M', color: { dark: BRAND.ink, light: '#ffffff' } });
      ctx.fillStyle = '#ffffff'; roundRect(ctx, (W - 860) / 2, 560, 860, 860, 48); ctx.fill();
      ctx.drawImage(qr, (W - 760) / 2, 610);
      ctx.fillStyle = BRAND.ink; roundRect(ctx, (W - 760) / 2, 1500, 760, 120, 60); ctx.fill();
      ctx.fillStyle = BRAND.lime; ctx.font = '800 48px Manrope, sans-serif';
      ctx.fillText('Scannez avec l’appareil photo', W / 2, 1576);
      ctx.fillStyle = BRAND.muted; ctx.font = '700 34px Manrope, sans-serif';
      ctx.fillText(url.replace(/^https?:\/\//, ''), W / 2, 1690);
      setReady(true);
    })();
  }, [name, url]);

  return (
    <Screen>
      <BackHeader href="/marketing" title="QR code de la boutique" />
      <p className="text-[13px] font-semibold leading-relaxed text-muted">Imprimez cette affiche pour votre vitrine, vos sacs ou vos cartes : le client scanne et arrive sur votre boutique HailandX.</p>
      <canvas ref={ref} role="img" aria-label={`Affiche QR de ${name}`} className="w-full rounded-[18px] border border-line-soft shadow-[0_12px_30px_rgba(18,20,28,.12)]" />
      <button type="button" disabled={!ready} onClick={() => ref.current && downloadCanvas(ref.current, `qr-${slug}.png`)} className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-50"><Icon name="download" size={19} />Enregistrer l’affiche</button>
    </Screen>
  );
}
