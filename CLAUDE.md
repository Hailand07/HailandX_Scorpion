# CLAUDE.md — HailandX, Flotte Hailand et Scorpion (Hailand07/HailandX_Scorpion)

## Lire d'abord (économise la phase de compréhension)
Ne pas tout relire : suivre le **« Guide de lecture »** en tête de `ECOSYSTEME_HAILAND.md` et de `HAILANDX.md`, et ne lire que les sections utiles à la tâche.
1. [`ECOSYSTEME_HAILAND.md`](./ECOSYSTEME_HAILAND.md) — vision, applications (HailandMap / NavigationX / HailandX), **base Supabase partagée**, flux, règles de communication, plan (§18 pour HailandX).
2. [`HAILANDX.md`](./HAILANDX.md) — ce dépôt : HailandX (place du marché, liens sociaux), Flotte Hailand, Scorpion ; propositions, parcours, architecture, schéma proposé, design, plan de travail, décisions.

Dépôts frères : **`Hailand07/Lynx`** (NavigationX, où vit aujourd'hui le code de Scorpion) et **`Hailand07/HailandMap_EMC`** (atelier de relevé et de certification). Les trois applications partagent la même base Supabase : une modification de schéma, de statut, de code ou de règle touche les trois.

## Règle de maintenance de la documentation (obligatoire)
À **chaque** modification qui change le comportement, un flux, une table/colonne utilisée, une règle, un design, une dépendance ou l'état d'avancement :
1. mettre à jour **`HAILANDX.md`** (et son journal en bas) ;
2. mettre à jour **`ECOSYSTEME_HAILAND.md`** si cela touche à la base partagée, aux règles de communication, aux écarts ou au plan ;
3. si `ECOSYSTEME_HAILAND.md` a changé : **augmenter sa révision**, puis le recopier dans les dépôts Lynx et HailandMap_EMC (hors ligne « Fichiers liés ») ; si un dépôt n'est pas accessible dans la session, ajouter la ligne à reporter dans son **§13** ;
4. faire ces mises à jour **dans le même commit** que le code ;
5. **en fin de session**, mettre à jour `ECOSYSTEME_HAILAND.md` **§14** (fait / décidé / bloqué / prochaine étape).
Procédure complète pour une nouvelle fonctionnalité : `ECOSYSTEME_HAILAND.md` **§12**.
Utiliser la légende ✅ constaté / 📄 documenté / ⚠️ à vérifier / 💡 proposé ; ne jamais présenter une supposition comme un fait.

## Règles de sécurité
- Ne jamais écrire, afficher ni committer une clé ou un jeton. Variables d'environnement côté applications seulement (clé Supabase publique, jeton Mapbox public) ; aucune clé secrète dans le code ni dans la zone « variables d'environnement » de l'environnement cloud.
- **Pas d'écriture dans la base de production** (insert/update/delete, migrations) sans accord explicite du fondateur pour cette opération. La base n'a **aucune sauvegarde**.
- HailandX est **propriétaire de ses tables de commerce et de flotte** ; il **lit** `buildings`, `declarations`, `building_units` et ne les modifie jamais (contrat `ECOSYSTEME_HAILAND.md` §6.2). Il ne certifie rien : le niveau 3 est un acte de HailandMap.
- Argent, codes QR, statuts de commande et de livraison : **logique côté serveur uniquement** (fonctions de la base ou fonctions serveur), jamais décidée dans le navigateur.

## Conventions
- Langue : **français** (interface, commentaires, documentation, commits).
- Branche de travail courante : `claude/busy-cerf-cd22ke` ; ne pas créer de PR sans demande ; ne pas pousser sur `main` sans accord.
- Commits : messages clairs au format conventionnel (`feat:`, `fix:`, `docs:`, `refactor:`).
- Qualité visée (demande du fondateur) : application **très esthétique, épurée, fluide et simple**, digne d'une grande entreprise ; maquettes validées par le fondateur avant de coder un écran ; tests de bout en bout sur écran de téléphone.
- Commandes (à la racine, npm workspaces) : `npm run dev` (HailandX, port 3000), `npm run dev:flotte`, `npm run build`, `npm run lint`, `npm test` (règles métier + banc SQL sur Postgres embarqué). Lancer `lint` et `test` avant de pousser.
- Migrations SQL : écrites dans `supabase/migrations/` (une migration non encore appliquée porte la mention « PROPOSÉE »), **testées** par `supabase/tests/` (RLS comprise) ; appliquées au projet `sffowxfozwynmuaesvdk` seulement avec l'accord explicite du fondateur (la migration de commerce l'est depuis le 2026-10-13).
- **Tests dans le navigateur du bac à sable cloud** : le proxy remplace le jeton de l'utilisateur par une clé de service pour les requêtes du navigateur vers Supabase (les droits, la sécurité par ligne et `auth.uid()` ne sont alors PAS testés). Pour un test réel, faire passer les requêtes `*.supabase.co` par Node (`context.route` de Playwright + `fetch`), qui garde le vrai jeton. Les numéros de test ne sont jamais écrits dans un fichier : variables d'environnement du terminal seulement.
- **Le connecteur Supabase du bac à sable est lent sur `DELETE` et `DROP`** : l'appel dépasse le délai de 60 s côté client (« timed out ») **mais la requête s'exécute quand même** côté base. Ne pas relancer en boucle : attendre, puis vérifier l'état par un `select` avant de réessayer. Nettoyage des données de test : `supabase/tests/nettoyage-test.sql` (les images du stockage se suppriment par l'API Storage avec le compte propriétaire).
