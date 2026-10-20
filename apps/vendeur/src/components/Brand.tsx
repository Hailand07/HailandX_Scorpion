import { AppMark, Wordmark } from '@hailandx/ui';

/** Marque de l'application vendeur : logo (devanture), HailandX + « Vendeur ». */
export const Brand = () => (
  <span className="inline-flex items-center gap-2.5"><AppMark app="vendeur" size={34} /><Wordmark /><span className="rounded-full bg-lime px-2 py-0.5 text-[11.5px] font-extrabold text-ink">Vendeur</span></span>
);
