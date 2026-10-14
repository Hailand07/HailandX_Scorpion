import { DeleteAccount } from '@hailandx/kit';

/** Supprimer mon compte (depuis « Plus »). */
export default function DeleteAccountPage() {
  return <DeleteAccount backHref="/plus" doneHref="/" />;
}
