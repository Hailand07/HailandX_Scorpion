import { AppMark } from './AppMark';
import { APP_INFO, type HailandApp } from './marks';

/**
 * Écran d'ouverture commun (maquettes v5 O1–O4) : logo, nom, phrase, barre de chargement.
 * - Rendu par le serveur et animé en CSS seulement : visible dès le premier affichage, il s'efface tout seul (≈ 1,2 s)
 *   pendant que l'application se charge derrière — il n'ajoute aucune attente et ne bloque jamais l'écran (aucun JavaScript requis).
 * - Une fois par onglet : le petit script marque l'onglet ; aux chargements suivants (retour d'une autre application,
 *   rechargement) l'écran est masqué d'emblée. Animation raccourcie si le téléphone demande moins de mouvement.
 * À placer en premier dans <body> ; la balise <html> doit porter `suppressHydrationWarning` (classe posée avant React).
 */
export function Ouverture({ app }: { app: HailandApp }) {
  const info = APP_INFO[app];
  const marque = `hx.ouverture.${app}`;
  return (
    <>
      <script
        // Contenu fixe : masque l'écran si l'onglet l'a déjà montré (stockage indisponible : on le montre, sans gêne).
        dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem('${marque}'))document.documentElement.classList.add('hx-sans-ouverture');sessionStorage.setItem('${marque}','1')}catch(e){}` }}
      />
      <div
        aria-hidden="true"
        className={`hx-ouverture fixed inset-0 z-[1000] flex flex-col items-center justify-center ${info.nuit ? 'bg-night text-night-text' : 'bg-bg text-ink'}`}
      >
        {info.nuit && <span className="absolute left-1/2 top-1/2 -ml-[170px] -mt-[200px] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(200,242,90,.18),rgba(200,242,90,0)_68%)]" />}
        <span className="hx-ouverture-logo relative flex flex-col items-center gap-[22px]">
          <AppMark app={app} size={96} className={info.nuit ? 'rounded-[28px] shadow-[0_0_0_1px_#2a3150_inset,0_9px_32px_rgba(200,242,90,.22)]' : ''} />
          <span className="flex flex-col items-center gap-2 px-6 text-center">
            <span className="font-display text-[28px] font-semibold tracking-[-0.02em]">
              {app === 'hailandx' ? <>Hailand<span className="text-blue">X</span></> : info.nom}
            </span>
            <span className={`text-[14px] font-semibold ${info.nuit ? 'text-night-muted' : 'text-muted'}`}>{info.phrase}</span>
          </span>
        </span>
        <span className={`absolute bottom-[120px] left-1/2 -ml-[60px] h-1 w-[120px] overflow-hidden rounded-sm ${info.nuit ? 'bg-[#232a44]' : 'bg-line'}`}>
          <span className={`hx-ouverture-barre block h-1 rounded-sm ${info.nuit ? 'bg-lime' : 'bg-ink'}`} />
        </span>
        <span className={`absolute inset-x-0 bottom-12 text-center text-[12px] font-bold tracking-[0.04em] ${info.nuit ? 'text-night-muted' : 'text-muted'}`}>Avec votre Compte Hailand</span>
      </div>
    </>
  );
}
