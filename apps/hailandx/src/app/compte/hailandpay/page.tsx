'use client';
import Link from 'next/link';
import { formatSyli } from '@hailandx/commerce';
import { BackHeader, Icon, MovementList, Screen, TestBand, useWallet, WalletCard, type ICONS } from '@hailandx/kit';
import { Chargement } from '@hailandx/ui';

/** HailandPay (maquette v8 A1) : solde en Syli (argent de test), actions, historique. */
export default function HailandPayPage() {
  const { wallet } = useWallet();
  if (wallet === undefined) return <Screen><BackHeader href="/compte" title="HailandPay" /><Chargement /></Screen>;
  if (wallet === null) return <Screen><BackHeader href="/compte" title="HailandPay" /><Link href="/connexion?next=/compte/hailandpay" className="font-bold text-blue-ink">Se connecter</Link></Screen>;
  const actions: [keyof typeof ICONS, string, string][] = [['plus', 'Recharger', '/compte/hailandpay/recharger'], ['send', 'Envoyer', '/compte/hailandpay/envoyer'], ['qr', 'Recevoir', '/compte/hailandpay/recevoir'], ['bank', 'Retirer', '/compte/hailandpay/retirer']];
  return (
    <Screen className="gap-4">
      <BackHeader href="/compte" title="Mon portefeuille" />
      <WalletCard label="Solde disponible" balance={wallet.balance} sub={wallet.held > 0 ? `+ ${formatSyli(wallet.held)} bloqués (commandes en cours de livraison)` : null} />
      <nav aria-label="Actions HailandPay" className="grid grid-cols-4 gap-2">
        {actions.map(([icon, label, href]) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1.5 text-[12px] font-extrabold">
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-line-soft bg-card"><Icon name={icon} size={22} stroke={2} /></span>{label}
          </Link>
        ))}
      </nav>
      <TestBand />
      <h2 className="text-[15px] font-extrabold">Historique</h2>
      <MovementList walletId={wallet.wallet_id} empty="Aucun mouvement. Commencez par une recharge de test." />
    </Screen>
  );
}

