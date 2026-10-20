import { markSvg, type HailandApp } from './marks';

/** Logo d'une application Hailand (même dessin que l'icône d'installation et l'écran d'ouverture). */
export function AppMark({ app, size = 40, className = '' }: { app: HailandApp; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 [&>svg]:h-full [&>svg]:w-full ${className}`}
      style={{ width: size, height: size }}
      // Contenu fixe, défini dans ce dépôt (aucune donnée extérieure).
      dangerouslySetInnerHTML={{ __html: markSvg(app) }}
    />
  );
}
