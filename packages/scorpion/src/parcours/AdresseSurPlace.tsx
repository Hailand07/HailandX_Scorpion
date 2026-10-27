'use client';
import React, { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pointOnFeature } from '@turf/turf';
import type { Detection } from '../buildingDetection';
import type { GpsSummary } from '../gpsAcquisition';
import { RegistrationGuide } from './RegistrationGuide';
import { GpsAcquisitionView } from './GpsAcquisitionView';
import { BuildingScan, type PickedBuilding } from './BuildingScan';
import { useGpsAcquisition } from './useGpsAcquisition';
import { DeclarationError, effectiveLevelOf, myDeclarations, resolveAdminAddress, submitDeclaration, type AdminAddress, type DeclarationRecord, type DeclaredLevel } from './declarations';
import { Ico, LevelBadge } from './ui';

type Step = 'guide' | 'acquire' | 'detect' | 'info' | 'done';

export interface AdresseSurPlaceProps {
  sb: SupabaseClient;
  /** Jeton public Mapbox (`NEXT_PUBLIC_MAPBOX_TOKEN`). */
  token: string;
  /** « client » : adresse de livraison (Domicile, Travail…) ; « boutique » : emplacement de la boutique (type Commerce). */
  usage: 'client' | 'boutique';
  guide: { kicker?: string; title: string; intro: string; aside?: React.ReactNode; startLabel?: string };
  /** Écran final : note propre à l'application et bouton de retour (« Revenir à ma commande »). */
  done: { note?: React.ReactNode; cta: string };
  /** Adresse enregistrée (ou déjà au compte) : l'application reprend la main avec son identifiant. */
  onDone: (d: DeclarationRecord) => void;
  onClose: () => void;
}

const BUILDING_TYPES = [
  { code: 'R', label: 'Maison' },
  { code: 'M', label: 'Immeuble' },
  { code: 'C', label: 'Commerce' },
];
const LABELS = ['Domicile', 'Travail', 'Autre'];
const adminLine = (a: AdminAddress) => [a.quartier_nom, a.commune_nom, a.prefecture_nom].filter(Boolean).join(' · ') || 'Adresse administrative en cours…';
const field = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-semibold outline-none focus:border-blue';
const chip = (on: boolean) => `flex h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-[14px] font-bold ${on ? 'border-blue bg-blue-soft text-blue-ink' : 'border-line bg-card'}`;

/**
 * Parcours « adresse sur place » recopié de NavigationX (`RegistrationFlow`, maquettes v9 AdrGuide → AdrPrete, HAILANDX.md §49) :
 * guide → plusieurs mesures GPS → bâtiment sur la vue satellite (certifié Hailand, sinon contour OSM, sinon zone) → infos
 * facultatives → adresse prête. Écrit une ligne de `declarations` (niveau 1 ou 2, ou rattachement à un bâtiment certifié) ;
 * ne certifie jamais rien et n'écrit jamais dans `buildings`.
 */
export const AdresseSurPlace: React.FC<AdresseSurPlaceProps> = ({ sb, token, usage, guide, done, onDone, onClose }) => {
  const [homes, setHomes] = useState<DeclarationRecord[]>([]);
  useEffect(() => { void myDeclarations(sb).then(setHomes); }, [sb]);
  const [step, setStep] = useState<Step>('guide');
  const [attempt, setAttempt] = useState(0);
  const [gps, setGps] = useState<{ lngLat: [number, number]; accuracy: number } | null>(null);
  const [polygon, setPolygon] = useState<GeoJSON.Polygon | null>(null);
  const [osmId, setOsmId] = useState<string | null>(null);
  const [tapPoint, setTapPoint] = useState<[number, number] | null>(null);
  const [certifiedId, setCertifiedId] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminAddress>({});
  const [level, setLevel] = useState<DeclaredLevel>(1);
  const [label, setLabel] = useState(usage === 'boutique' ? 'Boutique' : 'Domicile');
  const [buildingType, setBuildingType] = useState(usage === 'boutique' ? 'C' : 'R');
  const [floor, setFloor] = useState('');
  const [door, setDoor] = useState('');
  const [landmark, setLandmark] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [record, setRecord] = useState<DeclarationRecord | null>(null);

  const acq = useGpsAcquisition(step === 'acquire', attempt);
  const startDetection = (s: GpsSummary) => {
    setGps({ lngLat: s.position, accuracy: Math.round(s.accuracy) });
    setPolygon(null); setOsmId(null); setTapPoint(null); setCertifiedId(null); setAdmin({});
    setStep('detect');
  };
  const anchorOf = (g: GeoJSON.Polygon) => pointOnFeature({ type: 'Feature', properties: {}, geometry: g }).geometry.coordinates as [number, number];
  // Même règle que NavigationX : bâtiment certifié → rattachement demandé à la base ; contour OSM → niveau 2 ; sinon niveau 1.
  const applyDetection = (d: Detection) => {
    if (!gps) return;
    const osmInside = d.examined.filter((c) => c.source === 'osm' && c.contains).sort((x, y) => x.area - y.area)[0];
    const osm = d.chosen?.source === 'osm' ? d.chosen : d.method === 'hailand' ? osmInside : undefined;
    setTapPoint(null);
    setCertifiedId(d.chosen?.source === 'hailand' ? d.chosen.id : null);
    setPolygon(osm?.polygon ?? null);
    setOsmId(osm && !osm.id.startsWith('osm-') ? osm.id : null);
    setLevel(osm ? 2 : 1);
    const a = d.chosen ? anchorOf(d.chosen.polygon) : gps.lngLat;
    void resolveAdminAddress(sb, a[0], a[1]).then(setAdmin);
  };
  const applyPicked = (p: PickedBuilding) => {
    setPolygon(p.polygon); setOsmId(p.osmId); setLevel(p.polygon ? 2 : 1); setTapPoint(p.point); setCertifiedId(p.certifiedId);
    const a = p.polygon ? anchorOf(p.polygon) : p.point;
    void resolveAdminAddress(sb, a[0], a[1]).then(setAdmin);
    setStep('info');
  };
  const retry = useCallback(() => { setAttempt((n) => n + 1); setStep('acquire'); }, []);

  const submit = async (withDetails: boolean) => {
    if (!gps) return;
    setSaving(true); setSaveError('');
    try {
      const rec = await submitDeclaration(sb, {
        gps: gps.lngLat,
        accuracy: gps.accuracy,
        osmPolygonId: level === 2 ? osmId : null,
        polygon: level === 2 ? polygon : null,
        anchor: tapPoint,
        certifiedBuildingId: certifiedId,
        declared: withDetails ? { label, buildingType, floor: floor.trim(), door: door.trim(), landmark: landmark.trim() } : { label },
      });
      setRecord(rec); setAdmin(rec.admin); setStep('done');
    } catch (e) {
      setSaveError(e instanceof DeclarationError ? e.message : 'L’enregistrement a échoué. Réessayez dans un instant.');
    } finally { setSaving(false); }
  };

  if (step === 'guide') return <RegistrationGuide {...guide} onStart={() => setStep('acquire')} onClose={onClose} />;
  if (step === 'acquire') return <GpsAcquisitionView acq={acq} onContinue={startDetection} onRetry={retry} onClose={onClose} />;
  if (step === 'detect' && gps) {
    return <BuildingScan sb={sb} token={token} position={gps.lngLat} accuracy={gps.accuracy} adminLine={adminLine(admin)} homes={homes}
      onDetected={applyDetection} onConfirm={() => setStep('info')} onPicked={applyPicked} onRetry={retry} onClose={onClose} onUseExisting={onDone} />;
  }

  const head = (n: number) => (
    <div className="flex items-center gap-3.5 px-5 pt-5">
      <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)]"><Ico name="x" /></button>
      <div className="flex flex-1 gap-1.5" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <div key={i} className={`h-[5px] flex-1 rounded-full ${i <= n ? 'bg-blue' : 'bg-line'}`} />)}</div>
      <span className="text-[12.5px] font-bold text-muted">Adresse · {n} sur 5</span>
    </div>
  );

  if (step === 'info') {
    return (
      <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col bg-bg font-sans text-ink">
        {head(4)}
        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-[25px] font-semibold leading-tight tracking-[-0.02em]">{usage === 'boutique' ? 'Aidez les livreurs' : 'Aidez le livreur'}</h1>
            <span className="shrink-0 rounded-md bg-amber-soft px-2 py-1 text-[11px] font-extrabold tracking-wide text-[#7a5500]">FACULTATIF</span>
          </div>
          <p className="mt-2 text-[14px] font-medium leading-relaxed text-muted">Ces informations <b className="text-ink">ne changent pas votre niveau</b>. Elles aident à trouver la bonne porte.</p>
          <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-muted"><LevelBadge level={certifiedId ? 3 : level} />{adminLine(admin)}</p>
          {usage === 'client' && (
            <>
              <div className="mt-5 text-[12px] font-bold tracking-[0.09em] text-muted">NOM DE L’ADRESSE</div>
              <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Nom de l’adresse">
                {LABELS.map((l) => <button key={l} type="button" role="radio" aria-checked={label === l} onClick={() => setLabel(l)} className={chip(label === l)}>{label === l && <Ico name="check" size={15} stroke={3} />}{l}</button>)}
              </div>
            </>
          )}
          <div className="mt-5 text-[12px] font-bold tracking-[0.09em] text-muted">TYPE DE BÂTIMENT</div>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Type de bâtiment">
            {BUILDING_TYPES.map((t) => <button key={t.code} type="button" role="radio" aria-checked={buildingType === t.code} onClick={() => setBuildingType(t.code)} className={`flex-1 justify-center ${chip(buildingType === t.code)}`}>{t.label}</button>)}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">Étage<input value={floor} onChange={(e) => setFloor(e.target.value.slice(0, 20))} placeholder="Ex. 2e" className={field} /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">Porte<input value={door} onChange={(e) => setDoor(e.target.value.slice(0, 20))} placeholder="Ex. B" className={field} /></label>
          </div>
          <label className="mt-2.5 flex flex-col gap-1.5 text-[13px] font-bold text-muted">Repère<input value={landmark} onChange={(e) => setLandmark(e.target.value.slice(0, 120))} placeholder="Ex. portail bleu, en face de la pharmacie" className={field} /></label>
        </div>
        {saveError && <p role="alert" className="px-6 pb-3 text-center text-[14px] font-bold text-[#a3321f]">{saveError}</p>}
        <div className="flex gap-2.5 px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => submit(false)} disabled={saving} className="flex h-[56px] w-[100px] shrink-0 items-center justify-center text-[15px] font-bold text-muted">Passer</button>
          <button type="button" onClick={() => submit(true)} disabled={saving} className="flex h-[56px] flex-1 items-center justify-center rounded-[18px] bg-blue text-[16px] font-bold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer l’adresse'}</button>
        </div>
      </div>
    );
  }

  // Adresse prête : code Hailand attribué par la base, niveau, hiérarchie administrative.
  const lv = record ? effectiveLevelOf(record) : level;
  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col bg-bg font-sans text-ink">
      {head(5)}
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pb-4 pt-8 text-center">
        <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-ok-soft text-ok"><Ico name="check" size={36} stroke={3} /></span>
        <h1 className="mt-4 font-display text-[25px] font-semibold tracking-[-0.02em]">{usage === 'boutique' ? 'L’adresse de la boutique est prête' : 'Votre adresse est prête'}</h1>
        <span className="mt-4 text-[11.5px] font-extrabold tracking-[0.08em] text-muted">CODE HAILAND</span>
        <span className="mt-1.5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink px-3.5 font-mono text-[16px] font-bold tracking-wide text-white"><span className="text-lime">#</span>{record?.hailandCode}</span>
        <p className="mt-2.5 text-[14px] font-semibold text-muted">{[admin.quartier_nom, admin.commune_nom, admin.prefecture_nom].filter(Boolean).join(' · ')}</p>
        <div className="mt-2"><LevelBadge level={lv} text={lv === 3 ? 'Niveau 3 · bâtiment certifié' : lv === 2 ? 'Niveau 2 · bâtiment repéré' : 'Niveau 1 · zone'} /></div>
        {done.note && <div className="mt-5 w-full text-left">{done.note}</div>}
      </div>
      <div className="px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => record && onDone(record)} className="flex h-[58px] w-full items-center justify-center rounded-[18px] bg-blue text-[16.5px] font-bold text-white">{done.cta}</button>
      </div>
    </div>
  );
};
