'use client';
import { Notifications } from '@hailandx/kit';

/** Notifications de l'équipe : litiges à trancher, messages de litige, avis signalés (liens « /console/… »). */
export default function ConsoleNotificationsPage() {
  return <Notifications scope="console" backHref="/" />;
}
