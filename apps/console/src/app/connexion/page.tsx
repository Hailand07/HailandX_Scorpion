import { PhoneLogin } from '@hailandx/kit';
import { AppMark } from '@hailandx/ui';

/** Connexion à la console : même numéro, même compte Hailand ; l'accès n'est ouvert qu'aux membres de l'équipe. */
export default function ConnexionPage() {
  return (
    <PhoneLogin defaultNext="/" brand={
      <span className="flex items-center gap-2.5">
        <AppMark app="console" size={34} />
        <span className="font-display text-[17px] font-semibold">Hailand Console</span>
      </span>
    } />
  );
}
