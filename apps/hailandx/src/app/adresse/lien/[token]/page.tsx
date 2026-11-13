'use client';
import { use, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Wordmark, Chargement } from '@hailandx/ui';
import { browserClient } from '@hailandx/kit';
import type { DeclarationRecord, SubmitInput } from '@hailandx/scorpion/parcours';

/** Parcours d'adresse, chargé seulement dans le navigateur (carte Mapbox). */
const Parcours = dynamic(() => import('@hailandx/scorpion/parcours').then((m) => m.AdresseSurPlace), { ssr: false });
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
type State = 'chargement' | 'ouverte' | 'faite' | 'expiree' | 'inconnue';

/**
 * Lien de localisation (refonte §51) : la personne qui recevra le colis ouvre ce lien SUR PLACE et repère son bâtiment,
 * sans compte. L'adresse est enregistrée pour celui qui a envoyé le lien (`fn_address_request_fulfil`). Rien d'autre ici :
 * ni menu, ni boutique.
 */
export default function LienAdressePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const sb = browserClient();
  const [state, setState] = useState<State>('chargement');
  const [label, setLabel] = useState('');
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!sb) return;
    void sb.rpc('fn_address_request_info', { p_token: token }).then(({ data, error }) => {
      const r = data as { state?: State; label?: string } | null;
      setLabel(r?.label ?? ''); setState(error || !r?.state ? 'inconnue' : r.state);
    });
  }, [sb, token]);

  async function submit(input: SubmitInput): Promise<DeclarationRecord> {
    const { data, error } = await sb!.rpc('fn_address_request_fulfil', {
      p_token: token, p_lng: input.gps[0], p_lat: input.gps[1], p_accuracy: input.accuracy,
      p_anchor_lng: input.anchor?.[0] ?? null, p_anchor_lat: input.anchor?.[1] ?? null,
      p_osm_id: input.osmPolygonId, p_polygon: input.polygon ? JSON.stringify(input.polygon) : null,
      p_certified: input.certifiedBuildingId ?? null, p_located_by: input.locatedBy ?? 'gps',
      p_landmark: input.declared.landmark ?? null, p_floor: input.declared.floor ?? null, p_door: input.declared.door ?? null,
    });
    if (error || !data) {
      const m = `${error?.message ?? ''} ${(error as { hint?: string } | null)?.hint ?? ''}`;
      if (m.includes('ADRESSE_ADMINISTRATIVE_INTROUVABLE')) throw new Error('Votre position est hors des zones connues : impossible d’enregistrer cette adresse.');
      if (/déjà servi|expiré|déjà enregistrée|sur place/.test(m)) throw new Error(m.replace(/^.*?(ce lien|cette adresse)/i, (_, w: string) => w[0]!.toUpperCase() + w.slice(1)).trim());
      throw new Error('L’enregistrement a échoué. Réessayez dans un instant.');
    }
    const r = data as { id: string; hailand_code: string; level: number; certified_building_id: string | null; located_by: 'gps' | 'hors_cercle' };
    return {
      id: r.id, level: r.level === 2 ? 2 : 1, gps: input.gps, accuracy: Math.round(input.accuracy), osmPolygonId: input.osmPolygonId, polygon: input.polygon,
      admin: {}, certifiedBuildingId: r.certified_building_id, locatedBy: r.located_by, hailandCode: r.hailand_code, declared: input.declared, createdAt: new Date().toISOString(),
    };
  }

  if (started && !finished && sb) {
    return (
      <Parcours sb={sb} token={TOKEN} usage="client" allowRemote={false} submit={submit}
        guide={{ kicker: 'LIVRAISON · VOTRE ADRESSE', title: 'Repérons votre bâtiment', intro: 'Le livreur viendra jusqu’à votre porte. Pour qu’il vous trouve du premier coup, suivez ces trois conseils.' }}
        done={{ cta: 'Terminer', note: <p className="rounded-2xl bg-card px-4 py-3 text-[13px] font-semibold leading-snug text-muted">Votre adresse est transmise. Vous n’avez plus rien à faire : le livreur sera guidé jusqu’à ce bâtiment.</p> }}
        onDone={() => { setFinished(true); setState('faite'); }}
        onClose={() => setStarted(false)} />
    );
  }

  const box = 'mx-auto flex min-h-dvh max-w-md flex-col gap-5 bg-bg px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-8 font-sans text-ink';
  return (
    <main className={box}>
      <Wordmark />
      {state === 'chargement' && <Chargement />}
      {state === 'ouverte' && (
        <>
          <div className="flex flex-1 flex-col justify-center gap-4">
            <span className="text-[11.5px] font-extrabold tracking-[0.08em] text-muted">LIVRAISON HAILANDX</span>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em]">Un colis va vous être livré{label && label !== 'Destinataire' ? `, ${label}` : ''}.</h1>
            <p className="text-[15px] font-medium leading-relaxed text-muted">Montrez au livreur où vous trouver : nous repérons votre bâtiment à partir de votre position. Cela prend une minute, sans compte ni mot de passe.</p>
            <p className="rounded-2xl bg-amber-soft px-4 py-3 text-[13.5px] font-bold leading-snug text-[#6b5317]">À faire là où le colis doit arriver : chez vous, à la porte ou à la fenêtre.</p>
          </div>
          <button type="button" onClick={() => setStarted(true)} className="flex h-[58px] w-full items-center justify-center rounded-[18px] bg-blue text-[16.5px] font-bold text-white">Je suis sur place, commencer</button>
        </>
      )}
      {state === 'faite' && (
        <div className="flex flex-1 flex-col justify-center gap-3">
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em]">{finished ? 'Merci, c’est fait.' : 'Cette adresse est déjà enregistrée.'}</h1>
          <p className="text-[15px] font-medium leading-relaxed text-muted">{finished ? 'Votre adresse est transmise. Le livreur sera guidé jusqu’à votre bâtiment et vous appellera en arrivant.' : 'Ce lien a déjà servi. Si l’adresse doit changer, demandez un nouveau lien à la personne qui vous l’a envoyé.'}</p>
        </div>
      )}
      {(state === 'expiree' || state === 'inconnue') && (
        <div className="flex flex-1 flex-col justify-center gap-3">
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em]">{state === 'expiree' ? 'Ce lien a expiré.' : 'Lien introuvable.'}</h1>
          <p className="text-[15px] font-medium leading-relaxed text-muted">Demandez un nouveau lien à la personne qui vous l’a envoyé.</p>
        </div>
      )}
    </main>
  );
}
