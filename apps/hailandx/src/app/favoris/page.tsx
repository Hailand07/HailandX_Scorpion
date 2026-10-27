import { redirect } from 'next/navigation';

/** Retiré pendant la phase de lancement (HAILANDX.md §49) : pas de vitrine commune, le client arrive par le lien d'un vendeur. */
export default function Retire() { redirect('/'); }
