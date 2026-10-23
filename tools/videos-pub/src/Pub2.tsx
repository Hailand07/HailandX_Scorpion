import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadSora } from '@remotion/google-fonts/Sora';
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope';

const { fontFamily: SORA } = loadSora('normal', { weights: ['600', '700', '800'], subsets: ['latin', 'latin-ext'] });
const { fontFamily: MANROPE } = loadManrope('normal', { weights: ['600', '700', '800'], subsets: ['latin', 'latin-ext'] });

/**
 * Pubs v2 (20 s, 1080×1920, 30 i/s), montées sur la musique de synth.mjs : 120 BPM → 1 temps = 15 images, 1 mesure = 60.
 * Scènes : accroche 0–60 · révélation 60–180 · atouts 180–300 · style 300–360 · choix 360–420 · prix 420–480 · fin 480–600.
 */
export const C = { ink: '#12141c', blue: '#3346f0', lime: '#c8f25a', white: '#ffffff' };
const T = 15; // un temps
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const k = (f: number, a: number, b: number, from = 0, to = 1, e = ease) => interpolate(f, [a, b], [from, to], { ...clamp, easing: e });
const gnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} GNF`;
/** Battement : 1 au coup de grosse caisse, retombe en 1/4 de temps. */
const pulse = (f: number) => Math.exp(-(f % T) / 3.5);

export interface Feature { title: string; sub: string; photo: string; zoom: number; x: number; y: number; big?: string }
export interface Pub2Props {
  music: string; accent: string; glow: string; bg: string;
  hook: string[]; // un mot ou une phrase courte par temps (4)
  outline: string; // grand mot en contour derrière le produit
  hero: string; heroAlt: string; name: string; tagline: string; chips: string[];
  features: Feature[]; // 4 atouts, un par mesure/2
  style: { title: string; words: string[] }; // 4 mots sur les temps
  choice: { title: string; options: string[]; notes: string[] };
  price: number; priceNotes: string[]; shop: string; urgency: string;
}

/** Texte qui « tombe » sur le temps : grand → taille normale, avec un léger flou de vitesse. */
const Slam: React.FC<{ f: number; at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ f, at, children, style }) => {
  const s = spring({ frame: f - at, fps: 30, config: { damping: 13, stiffness: 180, mass: 0.7 } });
  if (f < at) return null;
  return <div style={{ transform: `scale(${2.2 - 1.2 * s})`, opacity: Math.min(1, (f - at) / 3), filter: `blur(${(1 - s) * 10}px)`, ...style }}>{children}</div>;
};

/** Éclair blanc sur une coupe. */
const Flash: React.FC<{ f: number; at: number; color?: string }> = ({ f, at, color = '#fff' }) =>
  f >= at && f < at + 8 ? <AbsoluteFill style={{ background: color, opacity: k(f, at, at + 8, 0.85, 0) }} /> : null;

/** Tremblement de caméra après un impact. */
const shake = (f: number, at: number, amp = 26) => (f < at || f > at + 14 ? '' : `translate(${Math.sin((f - at) * 2.7) * amp * Math.exp(-(f - at) / 4)}px, ${Math.cos((f - at) * 3.3) * amp * Math.exp(-(f - at) / 4)}px)`);

const Mark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <rect width="64" height="64" rx="16" fill="#23263a" />
    <path d="M22.5 20.5 41.5 43.5M41.5 20.5 22.5 43.5" fill="none" stroke={C.lime} strokeWidth="6.4" strokeLinecap="round" />
  </svg>
);

export const Pub2: React.FC<Pub2Props> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const groove = (f >= 60 && f < 420) || (f >= 435 && f < 480);
  const beat = groove ? pulse(f) : 0;

  return (
    <AbsoluteFill style={{ background: p.bg, fontFamily: MANROPE, color: C.white, overflow: 'hidden' }}>
      <Audio src={staticFile(p.music)} />
      {/* Halo qui bat avec la musique. */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 1000, height: 1000, borderRadius: 500, background: p.glow, filter: 'blur(150px)', opacity: 0.35 + 0.35 * beat, transform: `translateY(-200px) scale(${1 + 0.08 * beat})` }} />
      </AbsoluteFill>

      {/* 1. ACCROCHE — un mot par temps, sur fond noir qui s'allume. */}
      <Sequence from={0} durationInFrames={62}>
        <AbsoluteFill style={{ background: '#07080c', alignItems: 'center', justifyContent: 'center', gap: 34, padding: 70 }}>
          {p.hook.map((w, i) => (
            <Slam key={w} f={f} at={i * T + 2} style={{ fontFamily: SORA, fontWeight: 800, fontSize: i === p.hook.length - 1 ? 150 : 120, letterSpacing: -4, lineHeight: 1, textAlign: 'center', color: i === p.hook.length - 1 ? p.accent : C.white }}>{w}</Slam>
          ))}
          <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${p.glow}, transparent 60%)`, opacity: k(f, 20, 58, 0, 0.7) }} />
        </AbsoluteFill>
      </Sequence>

      {/* 2. RÉVÉLATION — impact, le produit arrive de très près, grand mot en contour qui défile derrière. */}
      <Sequence from={60} durationInFrames={120}>
        <Reveal p={p} />
      </Sequence>

      {/* 3. ATOUTS — un atout tous les 2 temps : gros plan, titre qui tombe, détail. */}
      <Sequence from={180} durationInFrames={120}>
        <Features p={p} />
      </Sequence>

      {/* 4. STYLE — mots rythmés sur les temps, le produit bascule à chaque coup. */}
      <Sequence from={300} durationInFrames={60}>
        <Style p={p} />
      </Sequence>

      {/* 5. CHOIX — pointures / coloris qui apparaissent sur les demi-temps, garanties. */}
      <Sequence from={360} durationInFrames={60}>
        <Choice p={p} />
      </Sequence>

      {/* 6. PRIX — coupure d'un temps (silence), puis le prix tombe avec l'impact. */}
      <Sequence from={420} durationInFrames={60}>
        <Price p={p} />
      </Sequence>

      {/* 7. FIN — la transition HailandX (cercle qui s'ouvre), groove plus doux. */}
      <Sequence from={480} durationInFrames={120}>
        <End p={p} />
      </Sequence>

      <Flash f={f} at={60} /><Flash f={f} at={180} color={p.accent} /><Flash f={f} at={300} /><Flash f={f} at={435} />
      {/* Fines bandes cinéma en haut et en bas pendant le groove. */}
      {groove && f < 420 && <><div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 36, background: '#000' }} /><div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, background: '#000' }} /></>}
      <div style={{ position: 'absolute', top: 70, right: 70, opacity: f > 60 && f < 480 ? 0.9 : 0, display: 'flex', alignItems: 'center', gap: 14, fontFamily: SORA, fontWeight: 700, fontSize: 34 }}><Mark size={56} />Hailand<span style={{ color: C.lime, marginLeft: -14 }}>X</span></div>
      {fps && null}
    </AbsoluteFill>
  );
};

const Reveal: React.FC<{ p: Pub2Props }> = ({ p }) => {
  const f = useCurrentFrame(); // 0–120
  const fly = spring({ frame: f, fps: 30, config: { damping: 15, stiffness: 120 } });
  const b = pulse(f);
  return (
    <AbsoluteFill style={{ transform: shake(f, 0, 30) }}>
      {/* grand mot en contour, deux lignes qui défilent en sens contraire */}
      {[0, 1].map((r) => (
        <div key={r} style={{ position: 'absolute', top: 360 + r * 330, left: 0, whiteSpace: 'nowrap', fontFamily: SORA, fontWeight: 800, fontSize: 330, letterSpacing: -10,
          color: 'transparent', WebkitTextStroke: `3px ${r ? 'rgba(255,255,255,0.18)' : p.accent}`, opacity: r ? 1 : 0.55, transform: `translateX(${(r ? -1400 : -200) + (r ? 1 : -1) * f * 9}px)` }}>
          {`${p.outline} ${p.outline} ${p.outline}`}
        </div>
      ))}
      <div style={{ position: 'absolute', top: 260, left: 60, right: 60, height: 980, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${(3.4 - 2.15 * fly) * (1 + 0.025 * b)}) rotate(${(1 - fly) * -14 + Math.sin(f / 20) * 2}deg) translateY(${Math.sin(f / 16) * 12}px)` }}>
        <Img src={staticFile(p.hero)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 70px 70px rgba(0,0,0,0.6))' }} />
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 220, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6, textTransform: 'uppercase', color: p.accent, opacity: k(f, 30, 40) }}>{p.tagline}</div>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 100, lineHeight: 0.98, letterSpacing: -3, clipPath: `inset(0 ${100 - k(f, 34, 54) * 100}% 0 0)` }}>{p.name}</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {p.chips.map((c, i) => (
            <span key={c} style={{ padding: '14px 26px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.25)', fontSize: 34, fontWeight: 800,
              opacity: k(f, 60 + i * 7.5, 66 + i * 7.5), transform: `translateY(${(1 - k(f, 60 + i * 7.5, 70 + i * 7.5)) * 40}px)` }}>{c}</span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Features: React.FC<{ p: Pub2Props }> = ({ p }) => {
  const f = useCurrentFrame(); // 0–120, 30 images par atout
  const i = Math.min(3, Math.floor(f / 30)), local = f - i * 30, ft = p.features[i]!;
  const z = interpolate(local, [0, 30], [ft.zoom * 1.12, ft.zoom], { ...clamp, easing: Easing.out(Easing.cubic) });
  const b = pulse(f);
  return (
    <AbsoluteFill>
      {/* gros plan sur le produit, cadré sur le détail (x, y en % de l'image) */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', transform: shake(local, 0, 14) }}>
        <Img src={staticFile(ft.photo)} style={{ position: 'absolute', width: 1080, height: 1080, left: 0, top: 150, objectFit: 'contain',
          transformOrigin: `${ft.x}% ${ft.y}%`, transform: `scale(${z * (1 + 0.015 * b)})`, filter: 'drop-shadow(0 50px 60px rgba(0,0,0,0.55))' }} />
      </div>
      {/* dégradé sous le texte : le gros plan ne gêne jamais la lecture */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 960, background: `linear-gradient(to bottom, transparent 0%, ${p.bg} 52%)` }} />
      {/* compteur 01 → 04 */}
      <div style={{ position: 'absolute', top: 190, left: 80, display: 'flex', gap: 12 }}>
        {[0, 1, 2, 3].map((j) => <span key={j} style={{ width: j === i ? 90 : 34, height: 10, borderRadius: 5, background: j <= i ? p.accent : 'rgba(255,255,255,0.25)' }} />)}
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 200, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ft.big && <Slam f={local} at={0} style={{ fontFamily: SORA, fontWeight: 800, fontSize: 210, lineHeight: 0.9, letterSpacing: -8, color: p.accent, transformOrigin: 'left bottom' }}>{ft.big}</Slam>}
        <Slam f={local} at={ft.big ? 4 : 0} style={{ fontFamily: SORA, fontWeight: 800, fontSize: 92, lineHeight: 1, letterSpacing: -3, transformOrigin: 'left center' }}>{ft.title}</Slam>
        <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1.25, color: 'rgba(255,255,255,0.78)', opacity: k(local, 8, 16), transform: `translateY(${(1 - k(local, 8, 18)) * 30}px)` }}>{ft.sub}</div>
      </div>
    </AbsoluteFill>
  );
};

const Style: React.FC<{ p: Pub2Props }> = ({ p }) => {
  const f = useCurrentFrame(); // 0–60
  const i = Math.min(3, Math.floor(f / T));
  const flip = i % 2 ? -1 : 1;
  return (
    <AbsoluteFill style={{ background: i % 2 ? p.accent : 'transparent', transition: 'none' }}>
      <div style={{ position: 'absolute', top: 210, left: 80, fontSize: 36, fontWeight: 800, letterSpacing: 6, textTransform: 'uppercase', color: i % 2 ? C.ink : p.accent }}>{p.style.title}</div>
      <div style={{ position: 'absolute', top: 360, left: 120, right: 120, height: 820, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scaleX(${flip}) rotate(${(i % 2 ? -1 : 1) * 8}deg) scale(${1 + 0.06 * pulse(f)})` }}>
        <Img src={staticFile(i % 2 ? p.heroAlt : p.hero)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 50px 60px rgba(0,0,0,0.5))' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 220, display: 'flex', justifyContent: 'center' }}>
        <Slam key={i} f={f} at={i * T} style={{ fontFamily: SORA, fontWeight: 800, fontSize: 150, letterSpacing: -5, color: i % 2 ? C.ink : C.white }}>{p.style.words[i]}</Slam>
      </div>
    </AbsoluteFill>
  );
};

const Choice: React.FC<{ p: Pub2Props }> = ({ p }) => {
  const f = useCurrentFrame(); // 0–60
  return (
    <AbsoluteFill style={{ padding: '0 80px', justifyContent: 'center', gap: 40 }}>
      <Slam f={f} at={0} style={{ fontFamily: SORA, fontWeight: 800, fontSize: 96, letterSpacing: -3, lineHeight: 1, transformOrigin: 'left center' }}>{p.choice.title}</Slam>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22 }}>
        {p.choice.options.map((o, i) => {
          const s = spring({ frame: f - 8 - i * 7.5, fps: 30, config: { damping: 11, stiffness: 200 } });
          return <span key={o} style={{ minWidth: 150, padding: '30px 40px', borderRadius: 32, background: C.white, color: C.ink, fontFamily: SORA, fontWeight: 800, fontSize: 64, textAlign: 'center',
            transform: `scale(${s})`, opacity: f > 8 + i * 7.5 ? 1 : 0 }}>{o}</span>;
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 10 }}>
        {p.choice.notes.map((n, i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 44, fontWeight: 800, opacity: k(f, 30 + i * 7.5, 36 + i * 7.5), transform: `translateX(${(1 - k(f, 30 + i * 7.5, 40 + i * 7.5)) * -60}px)` }}>
            <span style={{ width: 58, height: 58, borderRadius: 29, background: p.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
            </span>{n}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Price: React.FC<{ p: Pub2Props }> = ({ p }) => {
  const f = useCurrentFrame(); // 0–60 ; silence musical de 0 à 15, impact à 15
  const s = spring({ frame: f - 15, fps: 30, config: { damping: 10, stiffness: 160 } });
  const count = interpolate(f, [15, 27], [p.price * 0.6, p.price], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: f < 15 ? '#050507' : 'transparent', alignItems: 'center', justifyContent: 'center', gap: 34, padding: 70 }}>
      {f < 15 && <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 64, color: 'rgba(255,255,255,0.6)', opacity: k(f, 0, 6) }}>Et le prix ?</div>}
      {f >= 15 && (
        <>
          <div style={{ transform: `${shake(f, 15, 34)} scale(${2 - s})`, padding: '34px 50px', borderRadius: 44, background: C.ink, border: `4px solid ${p.accent}`, boxShadow: `0 0 120px ${p.glow}` }}>
            <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 118, letterSpacing: -4, color: C.lime, whiteSpace: 'nowrap' }}>{gnf(count)}</div>
          </div>
          {p.priceNotes.map((n, i) => (
            <div key={n} style={{ fontSize: 50, fontWeight: 800, textAlign: 'center', opacity: k(f, 30 + i * 8, 36 + i * 8), transform: `translateY(${(1 - k(f, 30 + i * 8, 40 + i * 8)) * 40}px)` }}>{n}</div>
          ))}
        </>
      )}
    </AbsoluteFill>
  );
};

const End: React.FC<{ p: Pub2Props }> = ({ p }) => {
  const f = useCurrentFrame(); // 0–120
  const endIn = spring({ frame: f, fps: 30, config: { damping: 16 } });
  const b = f < 60 ? pulse(f) * 0.6 : 0;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 44, padding: 90, background: C.ink, clipPath: `circle(${endIn * 150}% at 50% 50%)` }}>
      <div style={{ transform: `scale(${(0.6 + 0.4 * endIn) * (1 + 0.04 * b)}) rotate(${(1 - endIn) * -20}deg)` }}><Mark size={260} /></div>
      <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 108, letterSpacing: -3, opacity: k(f, 6, 18) }}>Hailand<span style={{ color: C.lime }}>X</span></div>
      <div style={{ fontSize: 46, fontWeight: 700, textAlign: 'center', color: 'rgba(255,255,255,0.75)', lineHeight: 1.3, opacity: k(f, 12, 24) }}>Acheter près de chez vous,<br />livré à votre porte</div>
      <div style={{ marginTop: 16, padding: '32px 58px', borderRadius: 999, background: C.lime, color: C.ink, fontSize: 50, fontWeight: 800, opacity: k(f, 20, 30), transform: `scale(${1 + 0.035 * Math.sin(f / 4)})` }}>Commandez chez {p.shop}</div>
      <div style={{ fontSize: 40, fontWeight: 800, color: p.accent === C.lime ? C.lime : '#9aa6ff', opacity: k(f, 30, 40) }}>{p.urgency}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color: 'rgba(255,255,255,0.55)', opacity: k(f, 36, 46) }}>Lien dans la bio · HailandX</div>
    </AbsoluteFill>
  );
};
