import { Icon, PhoneLogin } from '@hailandx/kit';

/** Connexion à la console : même numéro, même compte Hailand ; l'accès n'est ouvert qu'aux membres de l'équipe. */
export default function ConnexionPage() {
  return (
    <PhoneLogin defaultNext="/" brand={
      <span className="flex items-center gap-2.5">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-ink text-lime"><Icon name="shield" size={18} stroke={2.2} /></span>
        <span className="font-display text-[17px] font-semibold">Hailand Console</span>
      </span>
    } />
  );
}
