import { browserClient, signOutHailand } from '@hailandx/kit';

/** Client navigateur : le même que dans les autres applications Hailand (Compte Hailand commun). */
export { browserClient };

/** Déconnexion réelle (comme dans les autres applications Hailand) : révocation côté serveur, puis appareil vidé. */
export async function signOutFlotte(): Promise<void> {
  await signOutHailand(browserClient());
  window.location.replace('/connexion');
}
