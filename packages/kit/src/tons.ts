/** Couleurs des écrans de connexion : clair (HailandX, Vendeur, Console) ou nuit (Flotte). */
export type Tone = 'clair' | 'nuit';
export const TONS = {
  clair: {
    muted: 'text-muted', field: 'border-line bg-card', cta: 'bg-ink text-white', link: 'text-blue-ink', card: 'border-line-soft bg-card',
    chip: 'border-line bg-card', soft: 'bg-ok-soft text-ok', err: 'bg-[#fde8e4] text-[#8a2a1c]', info: 'bg-blue-soft text-blue-ink',
    tabs: 'bg-sand', tabOn: 'bg-card shadow-sm', bar: 'bg-line', barOn: ['bg-[#c0392b]', 'bg-amber', 'bg-ok', 'bg-ok'],
  },
  nuit: {
    muted: 'text-night-muted', field: 'border-night-line bg-night-card', cta: 'bg-lime text-ink', link: 'text-lime', card: 'border-night-line bg-night-card',
    chip: 'border-night-line bg-night-card', soft: 'bg-[#16301f] text-lime', err: 'bg-[#3a1a1a] text-[#ffb4a8]', info: 'bg-night-card text-lime',
    tabs: 'bg-night-card', tabOn: 'bg-night-line', bar: 'bg-night-line', barOn: ['bg-[#ff8a7a]', 'bg-amber', 'bg-lime', 'bg-lime'],
  },
} as const;
