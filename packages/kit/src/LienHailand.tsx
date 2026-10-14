'use client';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { browserClient } from './supabase';
import { adresseAvecSession, type AppHailand } from './passage';

/**
 * Lien vers une autre application Hailand : si un compte est connecté, la personne y arrive connectée (code de passage à usage
 * unique, 2 min) ; sinon le lien s'ouvre normalement. Le clic du milieu ou Ctrl+clic ouvrent l'adresse simple.
 */
export function LienHailand({ app, href, target, rel, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { app: AppHailand; href: string }) {
  async function go(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // Nouvel onglet : il est ouvert tout de suite (sinon le navigateur le bloque), puis dirigé une fois le code obtenu.
    const onglet = target === '_blank' ? window.open('about:blank', '_blank') : null;
    let url = href;
    try { url = await adresseAvecSession(browserClient(), app, href); } catch { /* adresse simple */ }
    if (onglet) { onglet.opener = null; onglet.location.href = url; }
    else if (target === '_blank') window.open(url, '_blank', 'noopener');
    else window.location.assign(url);
  }
  return <a href={href} target={target} rel={target === '_blank' ? 'noreferrer' : rel} onClick={go} {...rest} />;
}
