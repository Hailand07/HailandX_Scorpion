// Synthétiseur de musique de fond pour les pubs HailandX (aucune licence nécessaire : tout est généré ici).
// 120 BPM : 1 temps = 0,5 s = 15 images à 30 i/s ; 1 mesure = 2 s = 60 images. Les sections suivent le montage vidéo.
// Usage : node synth.mjs <jordan|iphone> <sortie.wav>
import { writeFileSync } from 'node:fs';

const SR = 44100, BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4, DUR = 20;
const N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N); // envoi vers la réverbération
const duck = new Float32Array(N).fill(1); // compression déclenchée par la grosse caisse

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const add = (i, l, r, send = 0) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; if (send) { sendL[i] += l * send; sendR[i] += r * send; } } };
const pan = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

// ── Instruments ─────────────────────────────────────────────────────────────────────────────────────────
function kick(t, vel = 1) {
  const s = Math.floor(t * SR), len = Math.floor(0.42 * SR);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR, f = 46 + 110 * Math.exp(-x * 38);
    ph += 2 * Math.PI * f / SR;
    const env = Math.exp(-x * 7.5) * (x < 0.002 ? x / 0.002 : 1);
    const click = i < 220 ? rnd() * 0.25 * (1 - i / 220) : 0;
    const v = (Math.sin(ph) * env + click) * 0.95 * vel;
    add(s + i, v, v);
  }
  // compression : pads, basse et accords s'effacent un instant à chaque coup
  for (let i = 0; i < 0.3 * SR; i++) { const j = s + i; if (j < N) duck[j] = Math.min(duck[j], 0.35 + 0.65 * Math.min(1, i / (0.3 * SR)) ** 1.6); }
}
function clap(t, vel = 1, p = 0) {
  const s = Math.floor(t * SR), [gl, gr] = pan(p);
  let b0 = 0, b1 = 0; // passe-bande simple
  for (let i = 0; i < 0.22 * SR; i++) {
    const x = i / SR;
    const bursts = (x < 0.01 ? 1 : 0) + (x > 0.012 && x < 0.022 ? 0.8 : 0) + (x > 0.024 ? Math.exp(-(x - 0.024) * 28) : 0);
    const n = rnd(); b0 += 0.35 * (n - b0); b1 += 0.12 * (b0 - b1);
    const v = (b0 - b1) * bursts * 1.6 * vel;
    add(s + i, v * gl, v * gr, 0.35);
  }
}
function hat(t, vel = 1, open = false, p = 0.2) {
  const s = Math.floor(t * SR), len = Math.floor((open ? 0.22 : 0.045) * SR), [gl, gr] = pan(p);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const n = rnd(), hp = n - prev; prev = n; // passe-haut grossier
    const v = hp * Math.exp(-(i / SR) * (open ? 14 : 75)) * 0.22 * vel;
    add(s + i, v * gl, v * gr, open ? 0.2 : 0.05);
  }
}
function shaker(t, vel = 1) {
  const s = Math.floor(t * SR), len = Math.floor(0.07 * SR);
  let a = 0, prev = 0;
  for (let i = 0; i < len; i++) {
    const n = rnd(), hp = n - prev; prev = n; a += 0.5 * (hp - a);
    const x = i / SR, env = Math.min(1, x / 0.012) * Math.exp(-x * 45);
    const v = a * env * 0.16 * vel;
    add(s + i, v * 0.8, v * 1.1, 0.1);
  }
}
/** « Log drum » (amapiano) : basse percussive qui glisse vers le bas — signature afro des années 2020. */
function logdrum(t, note, vel = 1) {
  const s = Math.floor(t * SR), len = Math.floor(0.5 * SR), f0 = midi(note);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR, f = f0 * (1 + 0.6 * Math.exp(-x * 40));
    ph += 2 * Math.PI * f / SR;
    const env = Math.min(1, x / 0.003) * Math.exp(-x * 6);
    const v = Math.tanh((Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph)) * 1.4) * env * 0.42 * vel;
    add(s + i, v, v, 0.08);
  }
}
function bass(t, dur, note, vel = 1) {
  const s = Math.floor(t * SR), len = Math.floor(dur * SR), f = midi(note);
  let ph = 0, lp = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR; ph = (ph + f / SR) % 1;
    const saw = 2 * ph - 1, sub = Math.sin(2 * Math.PI * ph);
    const cut = 0.04 + 0.12 * Math.exp(-x * 9); lp += cut * (saw - lp);
    const env = Math.min(1, x / 0.005) * (x > dur - 0.03 ? Math.max(0, (dur - x) / 0.03) : 1);
    const v = (lp * 0.55 + sub * 0.5) * env * 0.38 * vel;
    add(s + i, v, v);
  }
}
/** Nappe d'accords : dents de scie désaccordées, filtrées, attaque lente ; `bright` ouvre le filtre. */
function pad(t, dur, notes, vel = 1, bright = 0.5) {
  const s = Math.floor(t * SR), len = Math.floor(dur * SR);
  const voices = notes.flatMap((n) => [-0.12, 0, 0.11].map((d) => ({ f: midi(n + d), ph: Math.abs(rnd()), p: rnd() * 0.8 })));
  let lpL = 0, lpR = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    let l = 0, r = 0;
    for (const v of voices) { v.ph = (v.ph + v.f / SR) % 1; const w = 2 * v.ph - 1, [gl, gr] = pan(v.p); l += w * gl; r += w * gr; }
    const c = 0.02 + 0.08 * bright; lpL += c * (l - lpL); lpR += c * (r - lpR);
    const env = Math.min(1, x / 0.25) * Math.min(1, (dur - x) / 0.3);
    const g = 0.1 * vel / Math.sqrt(voices.length) * Math.max(0, env);
    add(s + i, lpL * g, lpR * g, 0.5);
  }
}
/** Note pincée (arpège / mélodie), avec écho stéréo. */
function pluck(t, note, vel = 1, dur = 0.35, p = 0, tone = 'saw') {
  const s = Math.floor(t * SR), len = Math.floor(dur * SR), f = midi(note), [gl, gr] = pan(p);
  let ph = 0, lp = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR; ph = (ph + f / SR) % 1;
    const w = tone === 'saw' ? 2 * ph - 1 : tone === 'square' ? (ph < 0.5 ? 1 : -1) : Math.sin(2 * Math.PI * ph);
    lp += (0.05 + 0.5 * Math.exp(-x * 18)) * (w - lp);
    const env = Math.min(1, x / 0.002) * Math.exp(-x * 9);
    const v = lp * env * 0.24 * vel;
    add(s + i, v * gl, v * gr, 0.3);
    // échos : 3/8 de temps, alternés gauche/droite
    for (let e = 1; e <= 3; e++) { const d = Math.floor(e * BEAT * 0.75 * SR), a = 0.35 ** e; add(s + i + d, e % 2 ? 0 : v * a, e % 2 ? v * a : 0); }
  }
}
/** Montée (bruit qui s'ouvre + note qui monte) avant un temps fort. */
function riser(t, dur, vel = 1) {
  const s = Math.floor(t * SR), len = Math.floor(dur * SR);
  let prev = 0, ph = 0;
  for (let i = 0; i < len; i++) {
    const k = i / len, n = rnd(), hp = n - prev * (0.9 - 0.8 * k); prev = n;
    ph += 2 * Math.PI * (200 + 1400 * k * k) / SR;
    const v = (hp * 0.12 + Math.sin(ph) * 0.05) * k * k * vel;
    add(s + i, v * (1 - 0.3 * Math.sin(k * 20)), v * (1 + 0.3 * Math.sin(k * 20)), 0.4);
  }
}
/** Impact : boum grave + souffle, pour les grandes révélations (produit, prix, fin). */
function impact(t, vel = 1) {
  const s = Math.floor(t * SR), len = Math.floor(1.6 * SR);
  let ph = 0, nz = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR, f = 32 + 70 * Math.exp(-x * 9); ph += 2 * Math.PI * f / SR;
    nz += 0.08 * (rnd() - nz);
    const v = (Math.sin(ph) * Math.exp(-x * 2.6) * 0.8 + nz * Math.exp(-x * 3) * 0.9) * vel;
    add(s + i, v, v, 0.6);
  }
}

// ── Morceaux ──────────────────────────────────────────────────────────────────────────────────────────────
const at = (bar, beat = 0) => bar * BAR + beat * BEAT;
const style = process.argv[2] ?? 'jordan';

if (style === 'jordan') {
  // Afro-house en la mineur : Am – F – C – G. Montée sur la mesure 0, « drop » au moment où la chaussure apparaît (2 s).
  const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // accords
  const roots = [45, 41, 48, 43];
  const lead = [69, 72, 76, 74, 72, 69, 67, 69]; // mélodie d'appel (2 mesures)
  pad(0, BAR, prog[0], 0.8, 0.1); riser(0.5, 1.5, 1.1);
  for (let b = 0; b < 4; b++) hat(at(0, b + 0.5), 0.6);
  for (let bar = 1; bar < 10; bar++) {
    const c = (bar - 1) % 4, breakdown = bar === 7; // mesure 7 : coupure avant le prix
    if (bar < 8) pad(at(bar), BAR, prog[c], 1, bar >= 3 ? 0.7 : 0.45);
    if (breakdown) continue;
    if (bar >= 8) {
      pad(at(bar), BAR, prog[c], 0.9, 0.35);
      const k = bar === 8 ? 0.75 : 0.5; // fin : le groove continue, plus doux
      for (let b = 0; b < 4; b++) { if (b % 2 === 0) kick(at(bar, b), k); hat(at(bar, b + 0.5), 0.6 * k); for (let q = 0; q < 4; q++) shaker(at(bar, b + q / 4), (q % 2 ? 0.4 : 0.7) * k); }
      [[0, 0], [1.5, 7], [3.25, 12]].forEach(([b, o]) => logdrum(at(bar, b), roots[c] + o, 0.6 * k));
      continue;
    }
    for (let b = 0; b < 4; b++) {
      kick(at(bar, b));
      hat(at(bar, b + 0.5), 0.9, b === 3, 0.25);
      for (let q = 0; q < 4; q++) shaker(at(bar, b + q / 4 + (q % 2 ? 0.04 : 0)), q % 2 ? 0.6 : 1);
    }
    clap(at(bar, 1)); clap(at(bar, 3)); if (bar % 2 === 0) clap(at(bar, 3.75), 0.5, -0.3);
    // log drums syncopés + basse
    [[0, 0], [0.75, 0], [1.5, 7], [2.5, 0], [3.25, 12]].forEach(([b, o]) => logdrum(at(bar, b), roots[c] + o, 1));
    bass(at(bar, 0), BEAT * 0.9, roots[c] - 12, 0.9); bass(at(bar, 2), BEAT * 0.9, roots[c] - 12, 0.8);
    if (bar >= 3) lead.forEach((n, k) => { if (((bar - 3) * 8 + k) % 16 < 8 || bar >= 5) pluck(at(bar, k * 0.5), n + (bar % 2 ? 0 : -2), 0.9, 0.3, k % 2 ? 0.4 : -0.4); });
  }
  impact(at(1), 1); // la chaussure arrive
  riser(at(6, 2), BEAT * 2, 1.2); // vers la coupure
  impact(at(7, 1), 1.1); kick(at(7, 1), 1); clap(at(7, 1), 1.2); // prix révélé (temps 2 de la mesure 7)
  for (let b = 1.5; b < 4; b += 0.5) hat(at(7, b), 0.8); kick(at(7, 2)); kick(at(7, 3));
  riser(at(7, 2), BEAT * 2, 1); impact(at(8), 1.2); // transition de fin
  pluck(at(8), 69, 1, 1.2, 0, 'sine'); pluck(at(8, 0.5), 76, 0.8, 1.2, 0.3, 'sine'); pluck(at(8, 1), 81, 0.7, 1.4, -0.3, 'sine');
} else {
  // Électro lumineuse en ré mineur / fa : Dm – Bb – F – C, arpèges rapides « tech ».
  const prog = [[62, 65, 69], [58, 62, 65], [53, 57, 60], [60, 64, 67]];
  const roots = [38, 34, 41, 36];
  pad(0, BAR, prog[0], 0.9, 0.15); riser(0.5, 1.5, 1);
  for (let k = 0; k < 8; k++) pluck(at(0, k * 0.5), [74, 77, 81, 86][k % 4], 0.5 + k * 0.06, 0.25, k % 2 ? 0.5 : -0.5, 'square');
  for (let bar = 1; bar < 10; bar++) {
    const c = (bar - 1) % 4;
    if (bar === 7) { pad(at(bar), BAR, prog[c], 0.8, 0.2); continue; }
    if (bar >= 8) {
      pad(at(bar), BAR, prog[c], 0.9, 0.4);
      const k = bar === 8 ? 0.75 : 0.5;
      for (let b = 0; b < 4; b++) { if (b % 2 === 0) kick(at(bar, b), k); hat(at(bar, b + 0.5), 0.6 * k); }
      const ch = prog[c].map((n) => n + 12);
      for (let q = 0; q < 8; q++) pluck(at(bar, q / 2), ch[q % 3], 0.5 * k, 0.2, q % 2 ? 0.5 : -0.5, 'square');
      continue;
    }
    pad(at(bar), BAR, prog[c], 0.9, 0.6);
    for (let b = 0; b < 4; b++) {
      kick(at(bar, b), 0.95);
      hat(at(bar, b + 0.5), 0.8, false, 0.3); hat(at(bar, b + 0.25), 0.35, false, -0.3); hat(at(bar, b + 0.75), 0.35, false, -0.3);
    }
    clap(at(bar, 1), 0.9); clap(at(bar, 3), 0.9);
    for (let b = 0; b < 4; b += 0.5) bass(at(bar, b), BEAT * 0.42, roots[c], b % 1 ? 0.6 : 0.85);
    // arpège en doubles croches sur l'accord, une octave au-dessus
    const ch = prog[c].map((n) => n + 12);
    for (let k = 0; k < 16; k++) pluck(at(bar, k / 4), ch[k % 3] + (k % 6 === 5 ? 12 : 0), bar >= 3 ? 0.75 : 0.5, 0.18, (k % 4) / 2 - 0.75, 'square');
  }
  impact(at(1), 1);
  riser(at(6, 2), BEAT * 2, 1.1);
  impact(at(7, 1), 1.1); kick(at(7, 1)); kick(at(7, 2)); kick(at(7, 3)); clap(at(7, 3));
  riser(at(7, 2), BEAT * 2, 1); impact(at(8), 1.2);
  pluck(at(8), 74, 1, 1.4, 0, 'sine'); pluck(at(8, 0.5), 81, 0.8, 1.4, 0.3, 'sine'); pluck(at(8, 1), 86, 0.7, 1.6, -0.3, 'sine');
}

// ── Réverbération (Schroeder) sur l'envoi, compression, mastering ────────────────────────────────────────
function reverb(inp) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d, buf: new Float32Array(d), i: 0, lp: 0 }));
  const aps = [225, 556].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  for (let n = 0; n < N; n++) {
    let y = 0;
    for (const c of combs) { const o = c.buf[c.i]; c.lp += 0.3 * (o - c.lp); c.buf[c.i] = inp[n] + c.lp * 0.82; c.i = (c.i + 1) % c.d; y += o; }
    y *= 0.25;
    for (const a of aps) { const o = a.buf[a.i]; const v = y + o * 0.5; a.buf[a.i] = v; a.i = (a.i + 1) % a.d; y = o - v * 0.5; }
    out[n] = y;
  }
  return out;
}
const rvL = reverb(sendL), rvR = reverb(sendR);
// La compression s'applique à tout sauf à la grosse caisse : approximation — on atténue le mélange hors attaque du kick.
let peak = 0;
for (let i = 0; i < N; i++) {
  const d = 0.6 + 0.4 * duck[i];
  L[i] = Math.tanh((L[i] * d + rvL[i] * 0.35) * 1.1);
  R[i] = Math.tanh((R[i] * d + rvR[i] * 0.35) * 1.1);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = 0.89 / peak; // crête à −1 dBFS
const fadeIn = 0.02 * SR, fadeOut = 1.2 * SR;
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const f = Math.min(1, i / fadeIn, (N - i) / fadeOut);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain * f)) * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain * f)) * 32767), 46 + i * 4);
}
writeFileSync(process.argv[3] ?? `${style}.wav`, pcm);
console.log(`${style} : ${DUR} s, crête ${(20 * Math.log10(peak)).toFixed(1)} dB avant normalisation`);
