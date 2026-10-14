import { PhoneLogin } from '@hailandx/kit';
import { Brand } from '@/components/Brand';

/** Connexion du vendeur : même numéro, même compte Hailand que partout ailleurs. */
export default function ConnexionPage() {
  return <PhoneLogin defaultNext="/" brand={<Brand />} />;
}
