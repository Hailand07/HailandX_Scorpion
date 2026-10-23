import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadSora } from '@remotion/google-fonts/Sora';
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope';

const { fontFamily: SORA } = loadSora('normal', { weights: ['600', '700'], subsets: ['latin', 'latin-ext'] });
const { fontFamily: MANROPE } = loadManrope('normal', { weights: ['600', '700', '800'], subsets: ['latin', 'latin-ext'] });

/** Charte Hailand (identique aux applications) : encre, bleu, citron, sable. */
const C = { ink: '#12141c', blue: '#3346f0', lime: '#c8f25a', sand: '#f6f4ef', muted: '#5f6372', white: '#ffffff' };
type Theme = 'nuit' | 'miel' | 'clair';
const THEMES: Record<Theme, { bg: string; glow: string; text: string; sub: string; card: string; accent: string }> = {
  nuit: { bg: 'radial-gradient(120% 80% at 50% 38%, #3a1016 0%, #12141c 62%)', glow: 'rgba(225, 40, 50, 0.55)', text: C.white, sub: 'rgba(255,255,255,0.7)', card: 'rgba(255,255,255,0.08)', accent: C.lime },
  miel: { bg: 'radial-gradient(120% 80% at 50% 30%, #f3b04b 0%, #c2410c 55%, #3b1606 100%)', glow: 'rgba(255, 200, 80, 0.6)', text: C.white, sub: 'rgba(255,255,255,0.8)', card: 'rgba(18,20,28,0.28)', accent: C.ink },
  clair: { bg: 'radial-gradient(120% 80% at 50% 35%, #ffffff 0%, #e8ebff 55%, #c9d0ff 100%)', glow: 'rgba(51, 70, 240, 0.35)', text: C.ink, sub: C.muted, card: 'rgba(255,255,255,0.75)', accent: C.blue },
};

export interface PubProps {
  theme: Theme; hook: [string, string]; photo: string; detoure: boolean;
  name: string; detail: string; category: string; price: number;
}

const gnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} GNF`;
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
/** Apparition : 0 → 1 entre `from` et `from + len` images. */
const appear = (f: number, from: number, len = 14) => interpolate(f, [from, from + len], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

/** Logo HailandX : carré encre arrondi, « X » citron (packages/ui/src/marks.ts). */
const Mark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <rect width="64" height="64" rx="16" fill="#23263a" />
    <path d="M22.5 20.5 41.5 43.5M41.5 20.5 22.5 43.5" fill="none" stroke={C.lime} strokeWidth="6.4" strokeLinecap="round" />
  </svg>
);

export const Pub: React.FC<PubProps> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = THEMES[p.theme];

  // ── Découpage (12 s) : accroche 0–1,6 s · produit 1,6–6,6 s · arguments 6,6–9,6 s · fin 9,6–12 s.
  const HOOK_END = 48; const ARGS = 198; const END = 288;
  const hookOut = interpolate(f, [HOOK_END - 8, HOOK_END], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pop = spring({ frame: f - HOOK_END + 6, fps, config: { damping: 14, mass: 0.9 } });
  const float = Math.sin(f / 22) * 14;
  const zoom = interpolate(f, [HOOK_END, END], [1, 1.12]);
  const priceShown = interpolate(f, [HOOK_END + 30, HOOK_END + 62], [0, p.price], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const productOut = interpolate(f, [END - 8, END + 4], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const endIn = spring({ frame: f - END, fps, config: { damping: 16 } });

  const args = ['Livré à votre porte, à votre adresse Hailand', 'Payez à la livraison, en espèces', 'Vendeur à adresse certifiée'];

  return (
    <AbsoluteFill style={{ background: t.bg, fontFamily: MANROPE, color: t.text, overflow: 'hidden' }}>
      {/* Halo lumineux qui respire derrière le produit. */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 900, height: 900, borderRadius: 450, background: t.glow, filter: 'blur(140px)', opacity: 0.55 + 0.25 * Math.sin(f / 18), transform: 'translateY(-180px)' }} />
      </AbsoluteFill>

      {/* 1. Accroche. */}
      {f < HOOK_END + 2 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 90, opacity: hookOut }}>
          {p.hook.map((line, i) => (
            <div key={line} style={{ fontFamily: SORA, fontWeight: 700, fontSize: 118, lineHeight: 1.05, letterSpacing: -3, textAlign: 'center',
              opacity: appear(f, 4 + i * 10), transform: `translateY(${(1 - appear(f, 4 + i * 10)) * 60}px)`, color: i === 1 ? t.accent : t.text }}>{line}</div>
          ))}
        </AbsoluteFill>
      )}

      {/* 2 et 3. Produit, prix, puis arguments. */}
      {f >= HOOK_END - 6 && f < END + 6 && (
        <AbsoluteFill style={{ opacity: productOut }}>
          <div style={{ position: 'absolute', top: 120, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <span style={{ padding: '14px 30px', borderRadius: 999, background: t.card, fontSize: 34, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', opacity: appear(f, HOOK_END) }}>{p.category}</span>
          </div>
          <div style={{ position: 'absolute', top: 250, left: 110, right: 110, height: 720, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `translateY(${float}px) scale(${pop * zoom})` }}>
            {p.detoure
              ? <Img src={staticFile(p.photo)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 60px 60px rgba(0,0,0,0.45))', WebkitMaskImage: 'linear-gradient(to bottom, black 82%, transparent 100%)' }} />
              : <Img src={staticFile(p.photo)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 56, boxShadow: '0 50px 90px rgba(0,0,0,0.45)' }} />}
          </div>
          <div style={{ position: 'absolute', left: 90, right: 90, top: 1010, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 76, lineHeight: 1.08, letterSpacing: -2, opacity: appear(f, HOOK_END + 14), transform: `translateX(${(1 - appear(f, HOOK_END + 14)) * -80}px)` }}>{p.name}</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: t.sub, opacity: appear(f, HOOK_END + 22) }}>{p.detail}</div>
            <div style={{ marginTop: 16, alignSelf: 'flex-start', padding: '18px 34px', borderRadius: 28, background: C.ink, color: C.lime, fontFamily: SORA, fontWeight: 700, fontSize: 84, letterSpacing: -1,
              opacity: appear(f, HOOK_END + 28), transform: `scale(${0.9 + 0.1 * appear(f, HOOK_END + 28)})` }}>{gnf(priceShown)}</div>
          </div>
          {/* Arguments : un par un, sur une carte. */}
          <div style={{ position: 'absolute', left: 70, right: 70, bottom: 120, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {args.map((a, i) => {
              const k = appear(f, ARGS + i * 18);
              return (
                <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '24px 30px', borderRadius: 30, background: t.card, backdropFilter: 'blur(10px)', fontSize: 38, fontWeight: 800,
                  opacity: k, transform: `translateY(${(1 - k) * 50}px)` }}>
                  <span style={{ width: 54, height: 54, borderRadius: 27, background: C.lime, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                  </span>{a}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* 4. Fin : marque et appel à l'action. */}
      {f >= END && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 46, padding: 90, background: C.ink, color: C.white,
          clipPath: `circle(${endIn * 150}% at 50% 50%)` }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * endIn}) rotate(${(1 - endIn) * -20}deg)` }}><Mark size={260} /></div>
          <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 104, letterSpacing: -3, opacity: appear(f, END + 6) }}>Hailand<span style={{ color: C.lime }}>X</span></div>
          <div style={{ fontSize: 46, fontWeight: 700, textAlign: 'center', color: 'rgba(255,255,255,0.75)', lineHeight: 1.3, opacity: appear(f, END + 12) }}>Acheter près de chez vous,<br />livré à votre porte</div>
          <div style={{ marginTop: 20, padding: '30px 56px', borderRadius: 999, background: C.lime, color: C.ink, fontSize: 50, fontWeight: 800,
            opacity: appear(f, END + 20), transform: `scale(${1 + 0.035 * Math.sin((f - END) / 4)})` }}>Commandez chez Djigo Shop</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'rgba(255,255,255,0.6)', opacity: appear(f, END + 26) }}>Lien dans la bio · hailandx</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
