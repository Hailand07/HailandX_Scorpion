import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type ICONS } from '@hailandx/kit';

/**
 * Composants d'interface de HailandX Vendeur (refonte du design, HAILANDX.md §52). Une seule échelle :
 *  - boutons : 54 px (action principale), 48 px (action secondaire), 40 px (action dans une ligne) ; arrondi 16 px ;
 *  - cartes : arrondi 20 px, bordure fine ; textes : 12 (légende), 13, 14 (texte), 15 (titre de ligne), 20 (titre de bloc), 26 (titre de page).
 * Les pages n'écrivent plus leurs propres styles de bouton : elles passent par ici.
 */
type Variant = 'primary' | 'secondary' | 'lime' | 'danger' | 'quiet';
type Size = 'lg' | 'md' | 'sm';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-white',
  secondary: 'border border-line bg-card text-ink',
  lime: 'bg-lime text-ink',
  danger: 'bg-danger text-white',
  quiet: 'text-blue-ink',
};
const SIZE: Record<Size, string> = { lg: 'h-[54px] rounded-2xl px-5 text-[15px]', md: 'h-12 rounded-2xl px-4 text-[14px]', sm: 'h-10 rounded-full px-3.5 text-[13px]' };
export const btn = (variant: Variant = 'primary', size: Size = 'lg', block = true) =>
  `${block ? 'flex w-full' : 'inline-flex'} items-center justify-center gap-2 font-extrabold transition active:opacity-80 disabled:opacity-40 ${SIZE[size]} ${VARIANT[variant]}`;

export function Btn({ variant, size, block, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }) {
  return <button type="button" {...rest} className={`${btn(variant, size, block)} ${className}`} />;
}
export function BtnLink({ href, variant, size, block, className = '', children }: { href: string; variant?: Variant; size?: Size; block?: boolean; className?: string; children: ReactNode }) {
  return <Link href={href} className={`${btn(variant, size, block)} ${className}`}>{children}</Link>;
}

/** Titre d'un onglet de la barre du bas (pas de flèche de retour), avec une action éventuelle à droite. */
export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <header className="flex min-h-11 items-center justify-between gap-3"><h1 className="font-display text-[26px] font-semibold tracking-tight">{children}</h1>{right}</header>;
}

/** Écran ou bloc vide : une icône, une phrase, et l'action qui fait avancer (jamais un simple cadre pointillé). */
export function EmptyState({ icon, title, text, action }: { icon: keyof typeof ICONS; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-[20px] border border-line-soft bg-card px-5 py-7 text-center">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sand text-muted"><Icon name={icon} size={22} /></span>
      <p className="text-[15px] font-extrabold">{title}</p>
      {text && <p className="max-w-[280px] text-[13px] font-semibold leading-snug text-muted">{text}</p>}
      {action && <div className="mt-1 w-full">{action}</div>}
    </div>
  );
}

/**
 * Barre d'action collée en bas, sous le pouce : l'action principale d'un écran est toujours ici.
 * `nav` : la barre d'onglets est visible dessous (la barre d'action se place au-dessus).
 */
export function ActionBar({ children, nav = false }: { children: ReactNode; nav?: boolean }) {
  return (
    <>
      <div aria-hidden="true" className="h-[86px]" />
      <div className={`fixed inset-x-0 z-30 mx-auto flex max-w-md flex-col gap-2 border-t border-line-soft bg-bg/95 px-5 pt-3 backdrop-blur ${nav ? 'bottom-[76px] pb-3' : 'bottom-0 pb-[max(16px,env(safe-area-inset-bottom))]'}`}>{children}</div>
    </>
  );
}
