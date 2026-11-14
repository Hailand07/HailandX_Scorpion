'use client';
import { Icon } from '@hailandx/kit';
import { declLabel, type MyCert, type MyDecl, type MyShop } from '@/lib/useMyShop';
import { Btn } from '@/components/ui';
import { Open, Timeline } from './parts';

/**
 * Étape 3 de « Ouvrir ma boutique » : la certification de l'adresse, dans l'état où elle se trouve.
 * Circuit : le vendeur demande → l'équipe vérifie (Hailand Console) → la demande remonte à l'agent de terrain (HailandMap).
 */
export function Certification({ shop, decl, decls, cert, busy, onLocate, attach, ask, open, reload }: {
  shop: MyShop; decl: MyDecl | null; decls: MyDecl[]; cert: MyCert | null; busy: boolean;
  onLocate: () => void; attach: (id: string) => void; ask: () => void; open: () => void; reload: () => Promise<void>;
}) {
  const certified = Boolean(decl && decl.level === 3);
  const atHailandMap = decl?.certification_status === 'demandee';
  const pending = !atHailandMap && cert?.status === 'a_verifier';
  const refused = !atHailandMap && (cert?.status === 'refusee' || decl?.certification_status === 'refusee');
  return (
    <>
  {shop.status === 'suspendue' && (
    <Open n={3} title="Boutique suspendue" text="L’équipe Hailand a suspendu votre boutique. Écrivez-lui depuis Compte, « Aide et contact »." />
  )}
  {shop.status !== 'suspendue' && !decl && (
    <Open n={3} title="Rattachez une adresse" text="Votre boutique n’a pas d’adresse. Choisissez celle à certifier, ou repérez le bâtiment.">
      <button type="button" disabled={busy} onClick={() => onLocate()} className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-blue text-[14px] font-extrabold text-white"><Icon name="pin" size={17} />Localiser ma boutique</button>
      {decls.map((d) => <button key={d.id} type="button" disabled={busy} onClick={() => attach(d.id)} className="flex min-h-12 items-center justify-between rounded-[14px] border border-line px-3.5 text-[14px] font-bold"><span className="truncate">{declLabel(d)}</span><span className="text-[12px] text-muted">niveau {d.level}</span></button>)}
    </Open>
  )}
  {shop.status !== 'suspendue' && decl && !certified && !atHailandMap && !pending && (
    <Open n={3} title="Faites certifier votre adresse" text={refused ? 'Votre dernière demande a été refusée : repérez à nouveau le bâtiment (« Changer » sur votre adresse, plus haut), puis redemandez.' : 'L’équipe Hailand vérifie votre demande, puis un agent passe confirmer que votre boutique est bien dans ce bâtiment. Il vous appelle avant. C’est gratuit.'}>
      {refused && cert?.console_note && <p className="rounded-[14px] bg-[#fbeae5] px-3.5 py-3 text-[13px] font-semibold leading-snug text-danger"><span className="font-extrabold">Motif : </span>{cert.console_note}</p>}
      <button type="button" disabled={busy} onClick={ask} className="h-[54px] rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-50">Demander la certification</button>
    </Open>
  )}
  {shop.status !== 'suspendue' && decl && !certified && (atHailandMap || pending) && (
    <Open n={3} title="Certification en cours">
      <ol className="flex flex-col">
        <Timeline state="done" title="Demande envoyée" sub="Elle est prioritaire : votre boutique attend cette adresse." />
        <Timeline state={pending ? 'now' : 'done'} title="Vérification par l’équipe Hailand" sub={pending ? 'Généralement sous 24 h.' : 'Demande confirmée et transmise à l’agent.'} />
        <Timeline state={pending ? 'todo' : 'now'} title="Visite de l’agent" sub={pending ? undefined : 'Il vous appelle avant de passer.'} />
        <Timeline state="todo" title="Adresse certifiée, vente ouverte" last />
      </ol>
      <Btn variant="secondary" size="md" onClick={() => void reload()}>Actualiser</Btn>
      <p className="text-center text-[12px] font-semibold text-muted">Vous serez prévenu ici dès que l’adresse est certifiée.</p>
    </Open>
  )}
  {shop.status !== 'suspendue' && certified && (
    <section className="flex flex-col gap-3.5 rounded-[20px] bg-ink px-[18px] py-5 text-white">
      <div className="flex items-center gap-3">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="#c8f25a" aria-hidden="true"><path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1L2.7 15.5l1-3-1-3 2.8-1.6.9-3.1 3.2.3z" /><path d="m8.5 12 2.5 2.5 4.5-5" stroke="#12141c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="flex flex-col"><span className="font-display text-[20px] font-semibold">Adresse certifiée</span><span className="text-[13px] font-semibold text-white/70">Votre boutique peut vendre.</span></span>
      </div>
      <button type="button" disabled={busy} onClick={open} className="h-[54px] rounded-2xl bg-lime text-[16px] font-extrabold text-ink disabled:opacity-60">{busy ? 'Ouverture…' : 'Ouvrir la vente'}</button>
    </section>
  )}
    </>
  );
}
