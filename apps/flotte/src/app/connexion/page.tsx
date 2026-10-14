import { PhoneLogin } from '@hailandx/kit';

/** Connexion du livreur : le même Compte Hailand que partout ailleurs (numéro + code), en thème de nuit. */
export default function Page() {
  return (
    <PhoneLogin defaultNext="/" tone="nuit" brand={
      <span className="font-display text-2xl font-bold tracking-[-0.03em]">Hailand <span className="text-lime">Flotte</span></span>
    } />
  );
}
