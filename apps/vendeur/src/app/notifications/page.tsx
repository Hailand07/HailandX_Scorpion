import { Notifications } from '@hailandx/kit';

/** Notifications de la boutique (nouvelles commandes, avis, litiges). */
export default function NotificationsPage() {
  return <Notifications scope="vendeur" backHref="/plus" />;
}
