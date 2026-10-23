/**
 * Chargement commun à tout l'écosystème Hailand (demande du fondateur, 2026-10-23) : au milieu de l'écran, les deux lettres
 * « HX » de HailandX se tracent l'une après l'autre (H blanc, X vert citron, sur le carré noir du logo), puis s'effacent, en boucle.
 * CSS seulement (classes `hx-chargement*` de tokens.css) : aucun JavaScript, visible dès le rendu serveur ; mouvement réduit
 * si le téléphone le demande. Calque fixe et transparent : l'en-tête de la page reste visible et utilisable.
 * Copie conforme dans NavigationX (Lynx) et HailandMap_EMC — modifier les trois ensemble.
 */
export function Chargement({ texte, enLigne = false }: { texte?: string; enLigne?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={enLigne ? 'hx-chargement hx-chargement-ligne' : 'hx-chargement'}>
      <svg className="hx-chargement-logo" viewBox="0 0 104 64" width="104" height="64" aria-hidden="true">
        <rect width="104" height="64" rx="20" fill="#12141c" />
        <g fill="none" strokeWidth="6.4" strokeLinecap="round">
          <path className="hx-trait" style={{ animationDelay: '0s' }} pathLength={1} d="M23 20v24" stroke="#ffffff" />
          <path className="hx-trait" style={{ animationDelay: '.12s' }} pathLength={1} d="M41 20v24" stroke="#ffffff" />
          <path className="hx-trait" style={{ animationDelay: '.24s' }} pathLength={1} d="M23 32h18" stroke="#ffffff" />
          <path className="hx-trait" style={{ animationDelay: '.42s' }} pathLength={1} d="M60.5 20.5 80.5 43.5" stroke="#c8f25a" />
          <path className="hx-trait" style={{ animationDelay: '.56s' }} pathLength={1} d="M80.5 20.5 60.5 43.5" stroke="#c8f25a" />
        </g>
      </svg>
      {texte ? <span className="hx-chargement-texte">{texte}</span> : <span className="sr-only">Chargement…</span>}
    </div>
  );
}
