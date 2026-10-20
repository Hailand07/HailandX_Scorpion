import type { ReactNode } from 'react';
import type { Turn } from '@/lib/nav';

const svg = (d: ReactNode, size = 20, stroke = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

export const Ico = {
  back: (s = 20) => svg(<path d="m15 6-6 6 6 6" />, s, 2.2),
  phone: (s = 20) => svg(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />, s),
  sound: (s = 20) => svg(<><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a3.5 3.5 0 0 1 0 6M18.5 6.5a7 7 0 0 1 0 11" /></>, s),
  mute: (s = 20) => svg(<><path d="M4 9v6h4l5 4V5L8 9z" /><path d="m17 9 5 6M22 9l-5 6" /></>, s),
  locate: (s = 20) => svg(<><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>, s),
  nav: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 21 12 16 4 21z" fill="currentColor" /></svg>,
  scan: (s = 20) => svg(<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M7 12h10" /></>, s),
  check: (s = 20) => svg(<path d="m5 12 5 5 9-10" />, s, 2.6),
  menu: (s = 20) => svg(<path d="M4 7h16M4 12h16M4 17h10" />, s, 2.2),
  close: (s = 20) => svg(<path d="M6 6l12 12M18 6 6 18" />, s, 2.2),
  bolt: (s = 20) => svg(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />, s, 2.1),
  wallet: (s = 20) => svg(<><path d="M3 7h18v12H3z" /><path d="M3 11h18" /><path d="M7 15h3" /></>, s),
  route: (s = 20) => svg(<><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7" /></>, s),
  help: (s = 20) => svg(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14" /><path d="M12 17.5h.01" /></>, s),
  logout: (s = 20) => svg(<><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>, s),
  chevron: (s = 20) => svg(<path d="m9 6 6 6-6 6" />, s),
  qr: (s = 20) => svg(<><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" /><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2" /></>, s),
  camera: (s = 20) => svg(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>, s),
};

/** Pictogramme de la prochaine manœuvre (bandeau de guidage). */
export function TurnIcon({ turn, size = 40 }: { turn: Turn; size?: number }) {
  const p = (d: ReactNode) => svg(d, size, 2.6);
  switch (turn) {
    case 'right': return p(<path d="M7 20V11a3 3 0 0 1 3-3h8m-4-4 4 4-4 4" />);
    case 'left': return p(<path d="M17 20V11a3 3 0 0 0-3-3H6m4-4L6 8l4 4" />);
    case 'slight-right': return p(<path d="M8 20v-6l8-8m-5 0h5v5" />);
    case 'slight-left': return p(<path d="M16 20v-6L8 6m5 0H8v5" />);
    case 'sharp-right': return p(<path d="M7 4v9a3 3 0 0 0 3 3h7m-3 4 3-4-3-4" />);
    case 'sharp-left': return p(<path d="M17 4v9a3 3 0 0 1-3 3H7m3 4-3-4 3-4" />);
    case 'uturn': return p(<path d="M8 20V9a4 4 0 0 1 8 0v6m-3-3 3 3 3-3" />);
    case 'roundabout': return p(<><circle cx="12" cy="10" r="4" /><path d="M12 14v7M16 10h4m-3-3 3 3-3 3" /></>);
    case 'arrive': return p(<><path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></>);
    default: return p(<path d="M12 20V4m-5 5 5-5 5 5" />);
  }
}
