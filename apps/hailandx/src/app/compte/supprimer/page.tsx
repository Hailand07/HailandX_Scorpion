import { DeleteAccount } from '@hailandx/kit';

/** Supprimer mon compte (depuis Compte). */
export default function DeleteAccountPage() {
  return <DeleteAccount backHref="/compte" doneHref="/?compte=supprime" />;
}
