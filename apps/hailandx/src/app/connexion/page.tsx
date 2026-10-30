import { PhoneLogin } from '@hailandx/kit';

/** Connexion par téléphone (HailandX, acheteurs) : sans lien vers l'accueil, le client reste dans sa commande (§49). */
export default function ConnexionPage() {
  return <PhoneLogin defaultNext="/commandes" homeHref={null} />;
}
