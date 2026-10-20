import { PhoneLogin } from '@hailandx/kit';
import { AppMark } from '@hailandx/ui';

/** Connexion du livreur : le même Compte Hailand que partout ailleurs (numéro + code), en thème de nuit. */
export default function Page() {
  return (
    <PhoneLogin defaultNext="/" tone="nuit" brand={
      <span className="flex items-center gap-2.5"><AppMark app="flotte" size={34} /><span className="font-display text-2xl font-bold tracking-[-0.03em]">Hailand <span className="text-lime">Flotte</span></span></span>
    } />
  );
}
