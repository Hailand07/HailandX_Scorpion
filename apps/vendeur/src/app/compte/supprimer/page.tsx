import { DeleteAccount } from '@hailandx/kit';

/** Supprimer mon compte (depuis « Menu »). */
export default function DeleteAccountPage() {
  return <DeleteAccount backHref="/plus" doneHref="/" />;
}
