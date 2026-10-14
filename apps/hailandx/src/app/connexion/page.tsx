import { PhoneLogin } from '@hailandx/kit';

/** Connexion par téléphone (HailandX, acheteurs). */
export default function ConnexionPage() {
  return <PhoneLogin defaultNext="/compte" />;
}
