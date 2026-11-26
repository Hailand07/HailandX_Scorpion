/**
 * Diagnostic de la géolocalisation : pourquoi la position n'arrive pas, et quoi faire (surtout sur iPhone).
 * Causes fréquentes sur iPhone : navigateur intégré à une application (WhatsApp, Facebook, Instagram… : la localisation y est bloquée ou muette),
 * réglage « Position » du site refusé dans Safari, « Services de localisation » coupés, délai trop court en intérieur.
 */

export type GeoProblem = 'refuse' | 'signal' | 'delai' | 'indisponible';

export interface GeoHelp {
  problem: GeoProblem;
  title: string;
  message: string;
  /** Gestes à faire, dans l'ordre. */
  steps: string[];
  /** Navigateur intégré à une application : la solution est d'ouvrir le lien dans Safari / Chrome. */
  inAppBrowser: boolean;
}

export const isIOS = (ua: string = navigator.userAgent, platform: string = navigator.platform, touchPoints: number = navigator.maxTouchPoints): boolean =>
  /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1);

/**
 * Navigateur intégré à une application (WhatsApp, Facebook, Instagram, TikTok…). Sur iPhone, une vue web intégrée n'envoie pas le jeton
 * « Safari/ » et n'est pas une application installée sur l'écran d'accueil.
 */
export function isInAppBrowser(ua: string = navigator.userAgent, standalone: boolean = !!(navigator as unknown as { standalone?: boolean }).standalone): boolean {
  if (/FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|Snapchat|TikTok|musical_ly|LinkedInApp|Twitter|WhatsApp|GSA\/|Line\//i.test(ua)) return true;
  if (/iPhone|iPad|iPod/.test(ua) && !standalone && !/Safari\//.test(ua)) return true;
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return true; // vue web Android (WhatsApp, etc.)
  return false;
}

export function describeGeoError(code: number, ua: string = navigator.userAgent, standalone?: boolean): GeoHelp {
  const inApp = isInAppBrowser(ua, standalone);
  const ios = isIOS(ua, /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : '', /iPhone|iPad|iPod/.test(ua) ? 5 : 0);
  const openElsewhere = inApp ? [ios ? 'Ouvrez ce lien dans Safari (menu « ⋯ » ou l’icône boussole, puis « Ouvrir dans Safari »).' : 'Ouvrez ce lien dans Chrome (menu « ⋮ », puis « Ouvrir dans le navigateur »).'] : [];

  if (code === 1) {
    return {
      problem: 'refuse',
      inAppBrowser: inApp,
      title: 'La localisation est refusée',
      message: inApp ? 'Cette page est ouverte dans une application (WhatsApp, Facebook…), qui bloque la localisation.' : 'Le navigateur n’a pas l’autorisation de lire votre position.',
      steps: [
        ...openElsewhere,
        ...(ios
          ? [
              'Réglages > Confidentialité et sécurité > Service de localisation : activé.',
              'Dans la même liste, « Safari – Sites web » : choisissez « Lors de l’utilisation de l’app » et activez « Position précise ».',
              'Dans Safari, touchez « aA » à gauche de l’adresse > « Réglages du site web » > Position > « Autoriser ».',
              'Revenez ici et touchez « J’ai autorisé, réessayer » : la page se recharge (sur iPhone, Safari garde le refus tant que la page n’est pas rechargée) et la recherche de position reprend.',
            ]
          : ['Dans les réglages du site (cadenas à côté de l’adresse), autorisez « Position ».', 'Vérifiez que la localisation de l’appareil est activée.', 'Revenez ici et touchez « J’ai autorisé, réessayer » : la page se recharge et la recherche reprend.']),
      ],
    };
  }
  if (code === 2) {
    return {
      problem: 'signal',
      inAppBrowser: inApp,
      title: 'Aucun signal de position',
      message: 'L’appareil ne trouve pas votre position pour le moment.',
      steps: [
        ...openElsewhere,
        'Vérifiez que « Service de localisation » est activé dans les réglages du téléphone.',
        'Activez le Wi-Fi (il aide à se situer), puis rapprochez-vous d’une fenêtre ou sortez un instant.',
        'Touchez « Réessayer ».',
      ],
    };
  }
  return {
    problem: 'delai',
    inAppBrowser: inApp,
    title: 'La position met trop de temps',
    message: 'Le signal est faible à l’intérieur. Nous réessayons avec une précision moindre.',
    steps: [...openElsewhere, 'Rapprochez-vous d’une fenêtre ou sortez un instant, puis touchez « Réessayer ».'],
  };
}

/** Options à essayer dans l'ordre : précision maximale (délai large), puis précision réduite (réseau, Wi-Fi), position récente acceptée. */
export const GEO_ATTEMPTS: PositionOptions[] = [
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 },
];

/** Position en une fois, avec repli automatique en précision réduite si la haute précision n'arrive pas. Rejette avec l'erreur du dernier essai. */
export function getPositionWithFallback(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 2, message: 'Géolocalisation indisponible' });
      return;
    }
    const attempt = (i: number) =>
      navigator.geolocation.getCurrentPosition(resolve, (err) => {
        // Un refus ne se règle pas par un nouvel essai ; le reste (délai, signal) oui.
        if (err.code === 1 || i >= GEO_ATTEMPTS.length - 1) reject(err);
        else attempt(i + 1);
      }, GEO_ATTEMPTS[i]);
    attempt(0);
  });
}

/**
 * Mesures reçues mais très imprécises (au-delà de 200 m) : le GPS n'est pas transmis au navigateur — sur iPhone, « Position exacte »
 * coupée ; sur Android, « Précision de la localisation Google » ou « position exacte » coupée pour Chrome (2026-11-26).
 */
export function describeImprecise(accuracyM: number, ua: string = navigator.userAgent): GeoHelp {
  const ios = /iPhone|iPad|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp = isInAppBrowser(ua);
  const dist = accuracyM >= 1000 ? `${(accuracyM / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : `${Math.round(accuracyM)} m`;
  return {
    problem: 'signal',
    inAppBrowser: inApp,
    title: `Position approximative (± ${dist})`,
    message: 'Le téléphone ne donne pas sa position GPS précise au navigateur : on ne peut pas trouver votre bâtiment ainsi.',
    steps: [
      ...(inApp ? ['Ouvrez ce lien dans Safari ou Chrome, pas dans WhatsApp ou Facebook.'] : []),
      ...(ios
        ? ['Réglages > Confidentialité et sécurité > Service de localisation > Safari – Sites web (ou Chrome) : « Lors de l’utilisation de l’app » et activez « Position exacte ».']
        : android
          ? ['Paramètres > Localisation : activée, puis « Services de localisation » > « Précision de la localisation Google » : activée.', 'Paramètres > Applications > Chrome > Autorisations > Position : autorisée, avec « Utiliser la position exacte ».']
          : ['Utilisez un téléphone : un ordinateur n’a pas de GPS.']),
      'Revenez ici, sortez à découvert un instant et touchez « Réessayer ».',
    ],
  };
}
