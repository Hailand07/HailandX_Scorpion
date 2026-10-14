import { Notifications } from '@hailandx/kit';

/** Notifications de l'acheteur (celles de la boutique sont dans HailandX Vendeur). */
export default function NotificationsPage() {
  return <Notifications scope="acheteur" backHref="/compte" />;
}
