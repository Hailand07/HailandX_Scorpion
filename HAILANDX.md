# HAILANDX.md — HailandX, Flotte Hailand et Scorpion (Hailand07/HailandX_Scorpion)

> Fiche du projet HailandX. À lire avec [`ECOSYSTEME_HAILAND.md`](./ECOSYSTEME_HAILAND.md) (vision, base partagée, règles) et [`CLAUDE.md`](./CLAUDE.md) (règles de travail).
> **État (2026-10-12) : maquettes validées par le fondateur ; phase 1 (fondations) commencée — squelette du dépôt, paquets partagés et migration SQL de commerce **appliquée à la production le 2026-10-13 après tests en local, NON appliquée**. Aucune table de commerce n'existe en base (§14).**
> Légende : ✅ constaté · 📄 demandé ou décidé par le fondateur · ⚠️ à vérifier · 💡 proposé (pas encore décidé).

## Guide de lecture

| Vous devez… | Lisez |
|---|---|
| Comprendre HailandX en 2 minutes | §1 |
| Savoir exactement ce que le fondateur a demandé | §2 |
| Voir ce qui est proposé en plus ou autrement, et pourquoi | §3 |
| Suivre un parcours (acheteur, lien social, vendeur, livreur, équipe) | §4 |
| Savoir où vit la flotte et ce qu'est Scorpion | §5, §6 |
| Coder | §7 (architecture), §8 (données), §9 (design), §10 (plan) |
| Trancher | §11 |

---

## 1. HailandX en une phrase

**La place du marché guinéenne où chaque vendeur et chaque acheteur a une adresse vérifiée, et où chaque commande est livrée à la bonne porte par la Flotte Hailand.**

Quatre piliers, qui ensemble font la différence avec les autres applications de vente du pays :

| Pilier | Ce que c'est | Pourquoi c'est unique |
|---|---|---|
| **Vitrine partout, achat dans HailandX** | On voit les produits partout (TikTok, Facebook, WhatsApp) grâce à des liens ; on achète dans HailandX. Modèle **Shopify** : chaque vendeur a sa propre boutique en ligne et ses liens, qu'il diffuse sur ses réseaux ; HailandX est la plateforme qui encaisse et livre. | Le vendeur garde ses réseaux ; HailandX devient sa caisse et sa logistique. |
| **La rue commerçante** | Un fil global où chaque boutique expose des échantillons, comme les étals devant les boutiques d'une rue ; on entre dans une boutique pour tout voir. | On découvre des vendeurs, pas seulement des produits. |
| **Flotte Hailand** | Toute commande devient une mission de livraison, avec un code QR remis au retrait et un contrôle à la remise. | Fiabilité et traçabilité de bout en bout ; avis impossibles à truquer. |
| **Scorpion** (adressage numérique) | La fonction de localisation de NavigationX, commune à tout l'écosystème : vendeur certifié niveau 3, acheteur au minimum niveau 1. | Plus jamais « vous êtes où exactement ? ». |

---

## 2. Ce que le fondateur a demandé 📄 (2026-10-12, résumé fidèle)

### 2.1 L'application HailandX = une vitrine globale
- Parcourir et faire défiler les produits comme sur une application de vente classique (type Amazon) : en général, par catégorie ou selon une recherche.
- Le fil montre des **échantillons** : pour chaque vendeur, **un échantillon par catégorie**.
- Chaque produit est rattaché à son vendeur ; on peut **entrer dans la boutique** du vendeur (tous ses produits) ou **rester dans la vue globale** (« la rue avec les étals »).
- **Plusieurs vendeurs peuvent vendre le même produit** : l'acheteur les compare. Ce qui départage : confiance, crédibilité, qualité, prix, expérience, note. **Les vendeurs les mieux notés et qui remplissent le plus de critères sont les plus mis en avant.**
- Toutes les fonctions de base : commander, panier, description et détails des produits, etc.

### 2.2 La vitrine d'accès rapide depuis les réseaux sociaux
- Le vendeur fait la publicité d'un ou plusieurs produits (vidéo TikTok, Facebook, statut WhatsApp) et met un **lien** (dans la description) qui mène à la vitrine pour voir le détail et **payer directement**.
- **Lien vers un produit** (celui de la publicité) ou **vers quelques produits** : le ou les produits ciblés sont mis en avant, mais **tous les autres produits du vendeur restent visibles**.
- **Lien vers la boutique** entière.

### 2.3 La Flotte Hailand
- **Tout le flux des commandes passe par la flotte.** Chaque commande est envoyée à un livreur sous forme de **mission** (lieu de retrait, destination, détails), qu'il choisit d'accepter.
- Pour éviter les conflits : un **code unique de livraison**, idéalement un **QR**.
  - **Au retrait**, le livreur scanne le code : l'acheteur est prévenu que sa commande est en route.
  - **À l'arrivée**, l'acheteur scanne le code pour confirmer la réception et, en paiement numérique, **débloquer la transaction**.

### 2.4 L'adressage numérique : « Scorpion »
- La fonction mère du projet : vendeurs et acheteurs définissent leur emplacement avec le système déjà mis en place dans NavigationX.
- **Le vendeur doit obligatoirement être au niveau 3** (emplacement certifié par Hailand).
- **L'acheteur doit au minimum être au niveau 1**, que ce soit depuis la vitrine d'un lien social ou dans l'application, pour que la livraison soit possible.
- La récupération et l'identification de l'emplacement sont **les mêmes que dans NavigationX**, pour tout l'écosystème. **Cette fonction s'appelle désormais « Scorpion ».**

### 2.5 Question ouverte
- La flotte doit-elle avoir **sa propre application** ou être **intégrée à NavigationX** ? → réponse proposée au §5.

### 2.6 Exigence de qualité
- Application **très esthétique, épurée, très fluide et simple d'utilisation**, même si elle est complexe à l'intérieur ; **remarquable et démarquable, digne d'une très grande entreprise**.

---

## 3. Ce que je propose de préciser, d'améliorer ou d'ajouter 💡

Chaque point garde l'intention du fondateur ; il précise la règle ou corrige un risque.

### 3.1 Une fiche produit, plusieurs offres (« le même produit chez plusieurs vendeurs »)
- **Problème** : si chaque vendeur crée sa propre fiche pour le même produit (ex. un modèle de téléphone), le fil se remplit de doublons et la comparaison est impossible.
- **Proposition** : séparer **le produit** (fiche commune : nom, photos de référence, caractéristiques) et **l'offre** (prix, stock, état, délai, photos réelles du vendeur). Sur la fiche produit : « **Proposé par 4 vendeurs** », l'offre recommandée en tête (meilleur équilibre confiance / prix / délai de livraison), les autres en dessous, triables.
- **Mise en place progressive** :
  - au départ, à la création, le vendeur choisit une fiche existante ou en crée une nouvelle (recherche par nom) ;
  - l'équipe fusionne les doublons ;
  - plus tard, regroupement assisté (noms et photos proches).
- Pour les produits uniques (vêtement fait main, plat cuisiné), la fiche n'a qu'une offre : rien ne change pour le vendeur.

### 3.2 Le fil « la rue commerçante » : la règle des échantillons
> ⚠️ **Remplacée le 2026-10-22 par décision du fondateur (§34)** : tous les produits sont en ligne, rangés par catégorie (comme Amazon) ; les règles de classement ci-dessous (diversité, découverte, proximité, confiance) restent appliquées à l'ordre des produits.
- **Règle de base** (ancienne, celle du fondateur jusqu'au 2026-10-22) : pour chaque vendeur, **un échantillon par catégorie**. L'échantillon est le meilleur produit de la catégorie (ventes, avis, nouveauté) et **tourne** régulièrement pour que le fil vive.
- **Ajouts proposés** :
  - **diversité** : jamais deux échantillons du même vendeur à la suite ; on alterne les catégories dans le fil général ;
  - **découverte** : un nouveau vendeur reçoit une mise en avant temporaire. Sinon, les anciens prennent toute la place et personne ne peut démarrer ;
  - **proximité** : « livrable en ~40 min » en avant. On peut le calculer car **tous les vendeurs sont localisés au niveau 3** — c'est un argument que personne d'autre n'a ;
  - **personnalisation** plus tard (catégories consultées, boutiques suivies).
- **Classement** : pertinence × **indice de confiance** (§3.3) × fraîcheur × proximité, avec la règle de diversité.

### 3.3 L'indice de confiance Hailand (ce qui décide de la mise en avant)
- **Avis vérifiés par la flotte** : seule une personne dont la commande a été **remise et confirmée par le contrôle de livraison** peut noter. Les faux avis deviennent impossibles : c'est un argument fort, à afficher (« Avis vérifiés Hailand »).
- **Composition proposée** (à ajuster avec les données réelles) :
  - avis vérifiés (note et nombre) : 35 % ;
  - fiabilité (commandes préparées à temps, remises sans litige, annulations) : 30 % ;
  - expérience (ancienneté, nombre de ventes) : 15 % ;
  - qualité de la boutique (photos réelles, descriptions complètes, réponses rapides) : 10 % ;
  - prix par rapport aux autres offres du même produit : 10 %.
- **Affichage** : pas un chiffre obscur, mais des **badges** compréhensibles. Par exemple : « Vendeur certifié Hailand » (tous, puisque niveau 3), « Top vendeur », « Prépare en moins de 30 min », « 98 % de livraisons réussies ».
- **Transparence pour le vendeur** : son tableau de bord explique comment monter.

### 3.4 Les liens partagés (réseaux sociaux)
- **Trois liens**, tous courts et lisibles (domaine à choisir, ex. `hx.gn`) :
  - produit `…/p/<code>` : le produit en grand, puis « Autres produits de la boutique » ;
  - sélection `…/s/<code>` : 2 à 10 produits choisis pour une publicité, puis le reste de la boutique ;
  - boutique `…/b/<nom-boutique>`.
- **Aperçu riche** dans WhatsApp, Facebook et TikTok (photo, nom, prix, nom de la boutique) : indispensable pour qu'on clique. Cela exige des pages **rendues côté serveur** (§7).
- **Sans application et sans compte** jusqu'au paiement : on regarde, on remplit son panier, et on ne donne son téléphone et son adresse qu'au moment de commander.
- **Suivi de la source** : chaque lien porte sa provenance (TikTok, WhatsApp, Facebook…). Le vendeur voit « 12 ventes viennent de TikTok cette semaine », ce qui l'incite à partager.
- **Génération en un geste** dans l'espace vendeur : « Partager ce produit » → choix du réseau → lien prêt, avec image et texte.
- ⚠️ **Constat du 2026-10-12** : un lien ouvert depuis WhatsApp s'ouvre dans le navigateur intégré de WhatsApp, où **la localisation ne fonctionne pas**. La commande doit donc toujours pouvoir aboutir **sans géolocalisation** (§3.7).

### 3.5 Les codes QR de la flotte : un code par colis, deux preuves
- **Précision** : un code **par colis** (ce qu'un vendeur remet pour une commande), pas par produit. Un panier de 3 produits du même vendeur = 1 colis = 1 code.
- **Au retrait**, le livreur scanne le **QR du colis**, affiché sur le téléphone du vendeur et, idéalement, imprimé et collé sur le colis.
  - Effet : statut « en route » et notification à l'acheteur.
  - Proposé : une **photo du colis** prise au retrait, en cas de litige.
- **À la remise** : ce qui doit prouver la remise, c'est quelque chose que **seul l'acheteur possède**. Si l'acheteur se contente de scanner le QR collé sur le colis, quelqu'un pourrait le faire à sa place à partir d'une photo. Proposition :
  - l'acheteur scanne le QR du colis **depuis son compte**. Le serveur vérifie que c'est bien l'acheteur de cette commande, que le colis a été retiré, et que le livreur est à proximité de l'adresse ;
  - **repli** si l'acheteur n'a pas de données ou pas de caméra : il donne au livreur un **code de remise à 4 chiffres**, reçu par SMS ou affiché dans son suivi. Le livreur le saisit ;
  - l'un ou l'autre confirme la remise, **libère le paiement** (s'il est numérique) et **ouvre l'avis vérifié**.
- Les codes sont **signés par le serveur** (impossibles à fabriquer), à usage unique, et chaque scan est **journalisé** (qui, quand, où).

### 3.6 Le paiement
- **Au lancement** : paiement **à la livraison** et Orange Money (décision du 2026-10-05).
- **Paiement numérique « bloqué jusqu'à la remise »** (séquestre) : l'argent est payé à la commande, gardé, puis versé au vendeur moins la commission quand la remise est confirmée.
  - C'est la promesse forte de la flotte.
  - ⚠️ Détenir l'argent des clients pour le compte des vendeurs peut demander un **agrément** (BCRG) ou un **partenaire de paiement agréé**. À vérifier avant de coder. En attendant : paiement à la livraison, ou Orange Money versé directement au vendeur.
- **Paiement à la livraison = argent liquide chez le livreur** : il faut une **réconciliation quotidienne**. Le livreur reverse au vendeur ou à Hailand, par Orange Money par exemple. Un **plafond d'argent en main** ou une **caution** par livreur limite le risque. C'est une des parties les plus délicates de l'exploitation.

### 3.7 Scorpion dans un lien social (WhatsApp)
- Dans le navigateur intégré de WhatsApp, le GPS est bloqué. Pour ne pas perdre la vente, à l'étape « Où livrer ? » on propose :
  1. **J'ai déjà une adresse Hailand** : connexion par téléphone, puis l'adresse est retrouvée ;
  2. **Me localiser** (Scorpion complet) : fonctionne dans Safari ou Chrome. Dans WhatsApp, on affiche l'avertissement « ouvrir dans Safari » déjà en place dans NavigationX ;
  3. **Toucher ma maison sur la carte** (vue satellite, comme l'étape « montrer mon bâtiment » de Scorpion) : niveau 1 ou 2 selon le bâtiment touché, avec un repère écrit obligatoire.
- L'adresse créée est une **déclaration** (même table que NavigationX). Elle apparaît donc aussi dans NavigationX (même compte).

### 3.8 Vendeur au niveau 3 sans bloquer l'élan
- Le niveau 3 exige le passage d'un agent : c'est long. Pour ne pas perdre les vendeurs inscrits avant le lancement :
  - le vendeur **crée et remplit sa boutique tout de suite**. Son emplacement est saisi avec Scorpion (niveau 1 ou 2) ;
  - une **demande de certification « vendeur » prioritaire** part automatiquement vers HailandMap (Revue → Demandes) ;
  - la boutique est **visible « bientôt disponible »** (on peut la suivre) ; **la vente s'ouvre à la certification**.
- Ainsi la règle « vendeur = niveau 3 » est respectée **pour vendre**, sans frein pour préparer.

### 3.9 Panier avec plusieurs vendeurs
- Un panier peut contenir des produits de plusieurs boutiques. À la validation, il devient **une commande** avec **un colis par vendeur**. Chaque colis = une mission, avec son code et ses **frais de livraison calculés selon la distance** (les deux adresses sont connues). Les frais sont affichés **avant** de payer.

### 3.10 Autres fonctions proposées (par priorité)
| Priorité | Fonction | Pourquoi |
|---|---|---|
| Lancement | **Suivi de commande en direct** (étapes, livreur sur la carte, heure estimée) | Ce qui rassure le plus l'acheteur ; vitrine de la flotte |
| Lancement | **Variantes et stock** (taille, couleur ; rupture automatique) | Indispensable pour vêtements et chaussures |
| Lancement | **Contacter le vendeur sur WhatsApp** depuis la fiche (message pré-rempli avec le produit) | Habitude locale ; la conversation reste sur WhatsApp, la vente sur HailandX |
| Lancement | **Notifications** (commande, retrait, remise) par SMS ou WhatsApp, et dans l'application | Sans notification, pas de confiance |
| Lancement | **Mode données légères** (images compressées, chargement progressif) | Forfaits limités, réseaux lents |
| Peu après | **Suivre une boutique** et **favoris** | Fidélisation |
| Peu après | **Litiges** (colis abîmé, non conforme) avec photos du retrait | Indispensable dès qu'il y a de l'argent en jeu |
| Peu après | **Avis avec photo** | Crédibilité |
| Plus tard | **Codes promo, ventes flash** | Animation commerciale |
| Plus tard | **Mise en avant payante** (clairement signalée « sponsorisé ») | Revenu, sans tromper le classement |
| Plus tard | **Retrait en boutique** (sans livreur) | Option moins chère pour l'acheteur proche |
| Plus tard | **Langues locales** (pular, malinké, soussou) et lecture vocale | Accès au plus grand nombre |

---

## 4. Les parcours 💡

### 4.1 Acheteur, dans l'application
1. **Accueil** : recherche en haut, catégories en bandeau, fil « la rue » (échantillons, badges, délai de livraison).
2. **Fiche produit** :
   - photos en grand, prix, offre recommandée, « Proposé par N vendeurs » ;
   - badges du vendeur, avis vérifiés, délai estimé ;
   - boutons « Ajouter au panier » et « Acheter ».
3. **Boutique** : en-tête (nom, badges, note, quartier, « Suivre »), produits par catégorie, recherche dans la boutique.
4. **Panier**, regroupé par vendeur avec les frais de livraison de chacun.
5. **Commande** :
   - téléphone vérifié par code ;
   - adresse : Scorpion, ou adresse Hailand existante ;
   - paiement : à la livraison ou Orange Money ;
   - récapitulatif, puis « Commander ».
6. **Suivi** : préparation → retrait (scan) → en route (carte) → remise (scan ou code) → avis.

### 4.2 Acheteur, depuis un lien social (TikTok, Facebook, WhatsApp)
1. Il touche le lien. La page s'ouvre **sans installation**, avec le produit de la publicité en grand et l'aperçu riche déjà vu dans le réseau.
2. En dessous : « Autres produits de la boutique ». En haut : un accès discret à HailandX (« Voir d'autres vendeurs »).
3. « Acheter » → **même commande que dans l'application** (§4.1, étape 5), avec la localisation adaptée au navigateur (§3.7).
4. Après la commande : proposition d'**installer HailandX** (application installable depuis le navigateur) pour suivre sa commande, sans obligation.

### 4.3 Vendeur
1. **Inscription** : téléphone, puis Scorpion pour l'emplacement, puis nom de boutique, catégorie, photo.
2. **Certification** : la demande prioritaire part vers HailandMap. En attendant, la boutique est « bientôt disponible » (§3.8).
3. **Produits** :
   - photos (prise directe, recadrage automatique) ;
   - choix ou création de la fiche commune (§3.1) ;
   - prix, variantes, stock.
4. **Partager** : lien produit, sélection ou boutique, prêt pour TikTok, Facebook ou WhatsApp.
5. **Commandes** : nouvelle commande (alerte) → « Accepter » et préparer → le QR du colis s'affiche pour le livreur → suivi jusqu'à la remise.
6. **Tableau de bord** : ventes, sources des ventes, indice de confiance et comment le faire monter, argent à recevoir.

### 4.4 Livreur (Flotte Hailand)
1. **Inscription** : téléphone, pièce d'identité, moyen de transport, photo, puis **validation par l'équipe**.
2. **Disponible / indisponible** (un interrupteur).
3. **Missions proposées** à proximité : retrait, destination, distance, **gain affiché avant d'accepter**. Le premier qui accepte l'obtient ; la mission est verrouillée pour les autres.
4. **Guidage jusqu'au retrait** (Hailand-Code du vendeur) → **scan du QR du colis** (+ photo).
5. **Guidage jusqu'à la porte** de l'acheteur. Le guidage jusqu'au portail est celui de NavigationX. Si l'acheteur n'est qu'au niveau 1, le cercle d'incertitude et les repères écrits sont affichés.
6. **Remise** : l'acheteur scanne, ou bien le livreur saisit le code de remise. En paiement à la livraison : encaissement, puis le montant à reverser s'ajoute à son solde.
7. **Gains et reversements** du jour.

### 4.5 Équipe Hailand (administration)
- Valider les livreurs, certifier les vendeurs (dans HailandMap), traiter les litiges, retirer les produits interdits, fusionner les fiches produits, suivre les reversements d'argent liquide.
- 💡 Une **console d'administration** réservée aux administrateurs (table `agents`, rôle `admin`), dans HailandX, pour tout ce qui est commerce et flotte. La certification des lieux reste dans HailandMap.

---

## 5. Où mettre la flotte ? 💡 — recommandation

| Option | Pour | Contre |
|---|---|---|
| **A. Intégrée à NavigationX** (« mode livreur ») | Réutilise directement le guidage et Scorpion ; une seule application à installer | Mélange deux publics (résidents et professionnels), complique NavigationX, et le livreur a besoin d'outils de travail (missions, scan, argent, gains) qui n'ont rien à faire chez un résident |
| **B. Application séparée « Hailand Flotte »**, dans le même dépôt que HailandX | Outil de travail simple et rapide, centré sur les missions ; partage le code de HailandX (commandes, QR) et de Scorpion ; s'installe depuis le navigateur | Une application de plus à faire connaître (mais seulement aux livreurs, recrutés un par un) |
| **C. Application native** (Android) | Position en arrière-plan, notifications fiables | Coût et délai élevés ; prématuré |

**Recommandation : B, puis C plus tard si nécessaire.**
- La flotte est un **outil professionnel** : elle mérite sa propre application, épurée et rapide.
- Elle vit dans le **même dépôt** que HailandX, car tout son travail est fait de commandes.
- Elle **réutilise** Scorpion et le moteur de guidage de NavigationX : pas de duplication.
- NavigationX garde son rôle grand public. Plus tard, NavigationX pourra afficher au résident « votre colis arrive », puisque le compte est unique.
- Si le suivi en arrière-plan devient indispensable (navigateur fermé), on passera à une application Android native pour les livreurs seulement.

---

## 6. Scorpion : la fonction commune de l'écosystème 📄💡

- **Définition** : récupération de la position par mesures GPS multiples, identification du bâtiment sur la vue satellite (bâtiment certifié Hailand, contour OSM, le plus proche), confirmation visuelle ou désignation au doigt, puis niveau 1, 2 ou 3. Rattachement officiel dans un bâtiment certifié.
- **Où est le code aujourd'hui** ✅ : dans NavigationX (`src/lib/gpsAcquisition.ts`, `buildingDetection.ts`, `ownBuilding.ts`, `certifiedBuildings.ts`, `osmDetection.ts`, `geoDiagnostic.ts`, `src/components/registration/…`) ; la base enregistre le résultat dans `declarations`.
- **Proposition** :
  - extraire Scorpion en **module partagé** (`packages/scorpion` dans ce dépôt), utilisé par HailandX, la Flotte et, à terme, NavigationX ;
  - **une seule source de vérité** pour les adresses des personnes : `declarations` ;
  - une adresse créée dans HailandX est la même que dans NavigationX.
- **Partage avec NavigationX** (à décider, §11) : soit publier le module comme paquet (GitHub Packages), soit regrouper NavigationX dans ce dépôt plus tard. En attendant, NavigationX garde son code. Les tests de Scorpion vérifient que les deux copies ne divergent pas.

---

## 7. Architecture proposée 💡

- **Un dépôt, plusieurs applications** (monorepo) :
  - `apps/hailandx` : place du marché, espace vendeur, console d'administration ;
  - `apps/flotte` : application des livreurs ;
  - `packages/scorpion` : localisation et adresse ;
  - `packages/ui` : système de design commun ;
  - `packages/commerce` : types, prix, statuts, règles partagées.
- **Next.js pour `apps/hailandx`** (et non Vite comme NavigationX).
  - Les liens partagés doivent montrer un **aperçu riche** dans WhatsApp, TikTok et Facebook. Or ces réseaux ne lisent pas les pages construites dans le navigateur : il faut des pages **rendues par le serveur**.
  - Le rendu serveur donne aussi un **premier affichage très rapide** sur un téléphone d'entrée de gamme en 3G.
  - C'est toujours React et Tailwind : le savoir-faire des autres applications se réutilise.
- **Flotte** : Next.js ou Vite, application installable (PWA), caméra pour le scan.
- **Base** : la **même base Supabase**. HailandX est **propriétaire de ses tables** (§8) et **lit** `buildings`, `declarations`, `building_units` sans jamais les modifier (contrat §6.2 de `ECOSYSTEME_HAILAND.md`).
- **Comptes** : `auth.users` partagé (compte unique), connexion par téléphone.
  - ⚠️ Il faut un **vrai fournisseur de SMS** : aujourd'hui, seuls des codes de test configurés fonctionnent.
- **Images** : stockage Supabase (aucun espace de stockage n'existe encore), avec redimensionnement et compression à la volée.
- **Logique sensible côté serveur** : codes QR signés, changements de statut, calcul des frais, indice de confiance, paiements. Elle vit dans des fonctions de la base ou des fonctions serveur, **jamais dans le navigateur**.
- **Hébergement** : Vercel (comme les autres applications).

---

## 7 bis. Connexion par téléphone : fournisseur de SMS ✅ comparé le 2026-10-12 (⚠️ prix à confirmer par devis)

Constat : aujourd'hui, seuls les **codes de test** configurés dans Supabase fonctionnent (administrateurs). Des vendeurs et acheteurs réels ont besoin de **vrais SMS**.

**Options techniques dans Supabase**
- **Fournisseurs intégrés** : Twilio, MessageBird, Vonage, TextLocal (communautaire) — [documentation](https://supabase.com/docs/guides/auth/phone-login).
- **Hook « Send SMS »** : Supabase appelle une fonction à nous pour envoyer le code, ce qui permet d'utiliser **n'importe quel fournisseur régional**, un autre canal comme **WhatsApp**, ou un **repli** si le premier échoue — [documentation](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook). Disponible sur les offres Free et Pro (annoncé en bêta sur la page des fonctionnalités).

**Prix indicatifs pour la Guinée** (relevés sur les sites des fournisseurs ; devises et dates variables, **à confirmer par devis**) :
| Fournisseur | Prix indiqué | Remarque |
|---|---|---|
| [Orange (API SMS Guinée)](https://developer.orange.com/apis/sms-gn/pricing) | forfaits ≈ 100 à 200 GNF par SMS | opérateur direct ; page ancienne (≈ 2 ans) ; achat limité à 100 000 GNF par jour et par carte SIM ; envoie depuis le réseau Orange |
| [Ikoddi](https://ikoddi.com/) | dès **12 FCFA** par SMS | couvre les codes de vérification en Guinée ; plateforme régionale (SMS, WhatsApp) |
| [Edoking](https://www.edoking.com/guinee.html) | 15 à 20 FCFA par SMS (envois en masse) | ne mentionne pas explicitement les codes de vérification |
| [SendSMSGate](https://www.sendsmsgate.com/fr/sms-gateway/gn/guinea/) | Orange 0,062 · MTN 0,027 · Telecel 0,012 (devise non précisée) | prix par opérateur |
| [Unimatrix](https://www.unimtx.com/sms/gn) | 0,1745 USD par message | prix unique Orange et MTN |
| [SMSBOX](https://www.smsbox.net/fr/tarifs-envoi-sms-gn) | tarifs publiés | à consulter |
| Twilio, Africa's Talking, Infobip | **non trouvés** | à demander sur leurs grilles officielles |

**Lecture** : de ≈ 12 FCFA à ≈ 0,17 USD le SMS selon le fournisseur ; à 15 000 connexions par mois, de quelques milliers à plusieurs centaines de milliers de GNF, **négligeable face à l'abonnement boutique (10 000 GNF par mois)**. La qualité d'acheminement (arrivée du code chez Orange, MTN, Telecel) compte plus que le prix.

**Recommandation** 💡
1. Brancher un **fournisseur régional** par le **hook « Send SMS »** (candidats : Ikoddi, Orange API, un agrégateur), avec **WhatsApp en repli** (canal très utilisé en Guinée) et un second fournisseur en secours.
2. Demander des **devis** à 2 ou 3 fournisseurs en indiquant : volume attendu, codes de vérification uniquement, Orange + MTN + Telecel, identifiant d'expéditeur « Hailand ».
3. Garder les **codes de test** pour les administrateurs, mais jamais pour le public ; limiter le nombre de codes par numéro et par heure (protection contre les abus et les coûts).
4. Décision attendue du fondateur : choix du fournisseur après devis (phase 1, avant d'ouvrir l'inscription publique).

---

## 8. Données : schéma proposé 💡 (noms provisoires, **rien n'est créé**)

| Table | Rôle |
|---|---|
| `shops` | Boutique : nom, lien court, catégorie, photo, **déclaration ou bâtiment du vendeur** (niveau 3 requis pour vendre), statut (en préparation, ouverte, suspendue) |
| `shop_members` | Qui gère la boutique (propriétaire, employés) |
| `catalog_products` | Fiche produit commune (§3.1) : nom, catégorie, caractéristiques, photos de référence |
| `offers` | Offre d'un vendeur sur une fiche : prix, état, photos réelles, actif |
| `offer_variants` | Variantes (taille, couleur) et stock |
| `categories` | Arbre des catégories |
| `share_links` | Liens courts (produit, sélection, boutique), source, compteurs |
| `carts`, `cart_items` | Panier (y compris pour un visiteur sans compte) |
| `orders` | Commande de l'acheteur : adresse de livraison (déclaration), téléphone, total, paiement |
| `parcels` | **Colis** : un par vendeur et par commande ; QR signé, code de remise, statut |
| `order_items` | Lignes de commande (offre, variante, quantité, prix au moment de l'achat) |
| `couriers` | Livreurs : identité vérifiée, véhicule, statut, solde d'argent liquide |
| `deliveries` ✅ (existe déjà) | Mission : à relier à `parcels` (colonne à ajouter), livreur, trajets, statuts |
| `delivery_events` | Journal des scans et des étapes (qui, quand, où, photo) |
| `payments`, `payouts`, `cash_settlements` | Paiements, reversements aux vendeurs, réconciliation de l'argent liquide |
| `reviews` | Avis, **seulement après une remise confirmée** |
| `shop_scores` | Indice de confiance calculé (§3.3) et badges |
| `disputes` | Litiges |

**Règles de sécurité** (RLS) :
- vitrine publique ;
- un vendeur ne voit que ses commandes et ses colis ;
- un livreur ne voit que les missions proposées ou les siennes ;
- l'adresse précise et le téléphone de l'acheteur ne sont visibles que du livreur de la mission, et seulement pendant la mission ;
- les changements de statut passent par des fonctions qui vérifient les droits.

Ce schéma sera livré en **migration SQL relue, appliquée seulement après accord explicite du fondateur** (la base n'a aucune sauvegarde).

---

## 9. Design : les principes 💡

- **Le produit d'abord** : grandes photos, beaucoup d'espace, une seule couleur d'action, une typographie nette. Rien qui ne serve pas à choisir ou à acheter.
- **Cinq onglets** en bas : Accueil, Rechercher, Panier, Commandes, Profil (l'espace vendeur se trouve dans Profil).
- **Fluidité** :
  - squelettes de chargement plutôt que des écrans vides ;
  - transitions courtes ;
  - images progressives ;
  - le panier et le suivi gardés hors connexion ;
  - objectif : premier affichage en moins de 2 s en 3G.
- **Confiance visible** : badges, avis vérifiés, délai estimé, prix de livraison connu avant de payer.
- **Cohérence Hailand** : même famille visuelle que NavigationX (couleurs, icônes, ton), pour qu'on reconnaisse l'écosystème.
- **Accessible** : textes lisibles au soleil, gros boutons, mode sombre.
- **Méthode** :
  - maquettes haute fidélité **validées par le fondateur avant de coder**, comme pour NavigationX v5 ;
  - puis tests de bout en bout sur écran de téléphone, comme pour HailandMap.

---

## 10. Plan de travail 💡

Chaque phase se termine par une **validation du fondateur** avant la suivante.

| Phase | Contenu | Livrables | Condition |
|---|---|---|---|
| **0. Cadrage et design** | Ce document ; maquettes des écrans clés : accueil, fiche produit avec offres, boutique, page de lien social, commande avec Scorpion, suivi, espace vendeur, mission livreur et scan | Maquettes validées, décisions du §11 tranchées | — |
| **1. Fondations** | Monorepo, système de design, connexion par téléphone (fournisseur SMS), extraction de Scorpion, migration des tables du §8, stockage des images | Application vide mais déployée, connexion réelle, tests | **Accord** pour la migration ; choix du fournisseur SMS |
| **2. Vendeur** | Inscription, Scorpion, demande de certification prioritaire (HailandMap), boutique, produits, fiches communes, variantes, liens partagés avec aperçu riche | Un vendeur réel crée sa boutique et partage un lien sur WhatsApp | Phase 1 |
| **3. Acheteur** | Fil « la rue », recherche, catégories, boutique, fiche produit et offres, panier multi-vendeurs, commande (paiement à la livraison), suivi | Une vraie commande de bout en bout (sans livreur réel) | Phase 2 |
| **4. Flotte** | Application livreur, validation par l'équipe, missions, QR et code de remise, guidage, encaissement et réconciliation | Une vraie livraison dans la zone pilote | Phase 3 ; 3 à 5 livreurs recrutés |
| **5. Confiance** | Avis vérifiés, indice de confiance, badges, classement du fil, litiges, console d'administration | Classement du fil réglé sur les données réelles | Phase 4 |
| **6. Paiement numérique** | Orange Money, puis paiement bloqué jusqu'à la remise | Paiement en ligne réel | ⚠️ Contrat marchand et cadre légal |
| **7. Croissance** | Abonnement boutique, mise en avant payante, promotions, langues locales, API Hailand pour d'autres plateformes | — | — |

**Pilote** (lien avec la stratégie du §17 d'`ECOSYSTEME_HAILAND.md`) :
- une **zone dense**, 10 à 20 vendeurs, 3 à 5 livreurs, avant toute ouverture large ;
- mesure clé : **% de commandes remises sans appel téléphonique** et délai moyen.

---

## 11. Décisions du fondateur ✅ (2026-10-12)

| # | Sujet | Décision |
|---|---|---|
| 1 | Nom et domaine | **Laissé à Claude** → application **HailandX**, application des livreurs **Hailand Flotte**, localisation **Scorpion** ; liens courts proposés **`hx.gn/p/…`** (produit), **`hx.gn/s/…`** (sélection), **`hx.gn/b/…`** (boutique). ⚠️ Disponibilité de `hx.gn` à vérifier ; repli : `hailandx.com`. |
| 2 | Fiche produit commune + offres (§3.1) | **D'accord** |
| 3 | Remise : scan par l'acheteur, repli par code à 4 chiffres (§3.5) | **D'accord** |
| 4 | Vendeur : boutique préparée avant la certification, vente ouverte au niveau 3 (§3.8) | **D'accord** |
| 5 | Flotte = application séparée dans ce dépôt (§5) | **D'accord** |
| 6 | Next.js pour HailandX (§7) | **D'accord** |
| 7 | Fournisseur de SMS : comparaison des options et des coûts | **D'accord** (à faire avant la phase 1) |
| 8 | Paiement bloqué jusqu'à la remise : se renseigner (Orange Guinée, BCRG, partenaire agréé) | À faire avant la phase 6 |
| 9 | Zone pilote, premiers vendeurs et livreurs | **Plus tard** |
| 10 | Partage de Scorpion avec NavigationX (§6) | À trancher en phase 1 |

**Demande du fondateur (2026-10-12)** : voir **toute l'architecture, les interfaces, le flux et le design** dans des artefacts qu'il peut consulter, modifier et valider **avant toute exécution**.

### 11.1 Phase 0 — maquettes à valider 📄 (2026-10-12)
Canevas « HailandX — Maquettes » : https://claude.ai/artifact/FdwUuRZqPT8h3jubhEEo7S (privé ; le fondateur peut le partager depuis le menu « Partager »). Contenu :
- **Acheteur, application** (7 écrans) : 1 Accueil « la rue commerçante » (adresse de livraison, recherche, catégories, boutiques à proximité, échantillons avec badge et délai) · 2 Recherche (filtres, résultats « proposé par N vendeurs ») · 3 Fiche produit et offres (offre recommandée, badges, avis vérifiés par la Flotte) · 4 Boutique (indicateurs de confiance, Suivre, WhatsApp, rayons) · 5 Panier (un colis par vendeur, frais de livraison par colis) · 6 Commande (adresse Scorpion niveau 3, téléphone vérifié, paiement à la livraison ou Orange Money bloqué) · 7 Suivi (carte, étapes, scan du QR ou code de remise à 4 chiffres).
- **Acheteur, depuis un lien social** (2 écrans) : 8 page d'un lien TikTok/WhatsApp (avertissement « ouvrir dans Safari », produit mis en avant, reste de la boutique, « Acheter maintenant ») · 9 « Où livrer ? » avec Scorpion (adresse Hailand existante, me localiser, toucher ma maison sur la carte).
- **Vendeur** (3 écrans) : 10 tableau de bord (état de certification — réglage « en attente / certifié », colis à préparer, ventes, indice de confiance, sources des ventes) · 11 ajouter un produit (rejoindre une fiche existante ou en créer une, prix, stock, variantes) · 12 colis à préparer (QR du colis, étiquette, liens à partager).
- **Flotte** (2 écrans, thème sombre) : 13 missions (disponibilité, gains, espèces à reverser, missions avec niveau d'adresse) · 14 retrait et remise (réglage « retrait / remise » : viseur QR et photo ; code de remise à 4 chiffres et montant à encaisser).
- **Pages** : A Architecture (applications, modules partagés, serveur, base) · B Flux d'une commande (8 étapes, règles de la Flotte) · C Système de design (couleurs, polices, composants, principes, nom et liens).
- **Identité visuelle proposée** : même famille que NavigationX (Sora pour les titres et les prix, encre `#12141C`, fond `#F6F4EF`, bleu Hailand `#3346F0`), texte en Manrope, accent citron `#C8F25A` réservé aux moments forts et à la Flotte (fond nuit `#0F1424`).
- Les produits, prix, boutiques et délais affichés sont **des exemples** ; les photos sont des emplacements.
- **Prochaine étape** : le fondateur commente ou modifie le canevas ; Claude reprend les commentaires, puis passe à la phase 1 après validation.

---

## 12. Risques principaux
- **Argent liquide** chez les livreurs (perte, retard de reversement) → plafond, caution, réconciliation quotidienne.
- **Fraude à la livraison** (faux scan, colis échangé) → codes signés, contrôle de proximité, photos, journal.
- **Navigateur intégré de WhatsApp** (GPS bloqué) → commande sans géolocalisation (§3.7).
- **SMS** : coût et fiabilité ; sans eux, ni connexion ni notifications.
- **Cadre légal** du paiement en ligne et de la détention de fonds.
- **Lenteur de la certification niveau 3** des vendeurs → préparation avant certification, campagnes par quartier (§17 de l'écosystème).
- **Qualité des fiches** (doublons, photos volées) → modération et fusion par l'équipe.

---

## 20. Écran d'ouverture, navigation et parcours vendeur (retour du fondateur après test en ligne)

Constat du fondateur : pas d'interface d'ouverture soignée, et aucun moyen visible de créer une boutique ou d'ajouter des produits. Cause (✅ constaté) : la page `/vendeur` existait mais **aucun lien ne menait vers elle** depuis l'accueil.

- **Écran d'ouverture** (`WelcomeScreen`, affiché à la première visite par `WelcomeGate`, mémorisé dans le navigateur ; toujours accessible sur `/bienvenue`) : thème nuit, halos bleu et citron, trois promesses (vendeurs certifiés, livré à la porte, payé à la remise) et trois actions : *Explorer la rue*, *Ouvrir ma boutique*, *Je veux livrer* (lien vers Flotte).
- **Barre de navigation du bas** (`BottomNav`) : Accueil, Chercher, **Vendre** (mise en avant), Commandes. Masquée sur la fiche produit, la commande, la connexion, l'écran d'ouverture et la console équipe.
- **Accueil** : bandeau « Vous vendez ? Ouvrez votre boutique » ; quand seules des boutiques d'exemple existent, un encart l'explique et propose d'ouvrir la première boutique.
- **`/vendeur`** : avant connexion, présentation et **4 étapes** (se connecter, créer la boutique, ajouter les produits, faire certifier l'adresse) ; l'étape en cours est surlignée pendant la préparation. Sans adresse enregistrée, un lien renvoie vers NavigationX.
- Adresses des autres applications : `NEXT_PUBLIC_FLOTTE_URL` et `NEXT_PUBLIC_NAVIGATIONX_URL` (facultatives, valeurs par défaut dans `src/lib/links.ts`).
- 💡 À faire plus tard : héberger les polices soi-même, ajouter une vraie page « Mon compte », illustrations propres à HailandX.

## 21. Audit des maquettes validées et du plan (2026-10-13) — état après les blocs 1 à 6

Comparaison écran par écran avec le canevas du §11.1 et avec le plan du §10. ✅ fait et testé · 🟡 fait en partie · ❌ pas fait. Mis à jour après la reprise des écarts (blocs 1 à 6, §22).

| Écran / fonction demandée | État | Détail |
|---|---|---|
| 1 Accueil « la rue » | ✅ | Échantillon par boutique et catégorie, badges, délais, adresse de livraison en en-tête, **boutiques triées par distance** (§23) |
| 2 Recherche | ✅ | « Proposé par N vendeurs », **filtres** (catégorie, prix, délai, confiance élevée) et **tri** |
| 3 Fiche produit, offres classées, avis vérifiés | ✅ | **Variantes** (taille, couleur) choisies sur la fiche |
| 4 Boutique | ✅ | Indice, avis, **Suivre**, **WhatsApp**, **rayons** |
| 5 Panier (un colis par vendeur) | ✅ | La variante choisie est rappelée |
| 6 Commande | ✅ | **« Où livrer ? »** : adresse créée dans HailandX (position GPS moyennée par Scorpion, repère ajustable sur la carte) ; niveau 1 ; niveau 3 via NavigationX |
| 7 Suivi | ✅ | Étapes, code à 4 chiffres, scan du QR, **carte de suivi** (boutique, adresse, livreur après retrait) |
| 8 Page d'un lien social | ✅ | Lien suivi, source mémorisée, aperçu riche, **avertissement « ouvrir dans Safari / Chrome »** |
| 9 « Où livrer ? » avec Scorpion | ✅ | Position, carte, **détection du bâtiment** (certifié Hailand → niveau 3 vérifié par la base ; contour OSM → niveau 2 ; sinon zone) avec confirmation de l'utilisateur (§24) |
| 10 Tableau de bord vendeur | ✅ | Statut, commandes, solde, produits, liens, **ventes par jour et par source** |
| 11 Ajouter un produit | ✅ | Fiche existante ou nouvelle, **variantes avec stock par variante**, rayon |
| 12 Colis à préparer | ✅ | QR du colis, **étiquette imprimable (A6)**, liens |
| 13 Flotte : missions, gains, espèces | ✅ | **Guidage dans l'application** : itinéraire sur la carte, distance, durée, consigne suivante (§23) |
| 14 Flotte : retrait et remise | ✅ | **Photo de remise exigée** (stockage privé, preuve visible de l'acheteur, du vendeur et de l'équipe) (§24) |
| Écran d'ouverture, navigation, parcours vendeur | ✅ | §20 |
| Connexion par téléphone | 🟡 | Numéros de test seulement : **fournisseur de SMS réel** ❌ (décision du fondateur) |
| Paiement Orange Money réel | ❌ | Séquestre et comptabilité ✅ (simulation) ; contrat marchand requis (§19) |
| Notifications | 🟡 | **Centre de notifications dans l'application** ✅ (§23) ; envoi **SMS / WhatsApp / notification hors application** ❌ : fournisseur à choisir |
| Phase 7 : abonnement, mise en avant payante, promotions, langues locales, API | ❌ | Prévue après le pilote |

Autres ❌ : domaine `hx.gn`, polices hébergées par nous, notifications hors application (push navigateur hors page ouverte, SMS, WhatsApp), écrans d'enregistrement complets de NavigationX (`ownBuilding`, création d'un nouveau bâtiment) non repris dans HailandX.

## 22. Reprise des écarts (blocs 1 à 6, 2026-10-13) ✅ code, base et tests ; ⚠️ parcours en ligne à essayer par le fondateur

- **Bloc 1, « Où livrer ? »** (`/adresse`, `AddressPicker`, `lib/address.ts`) : « Me localiser » recueille plusieurs mesures GPS pendant 15 s au plus et en tire une position et une précision (`summarize` / `shouldStop` de Scorpion, mêmes règles que NavigationX) ; on ajuste le repère en touchant la carte (Mapbox satellite) ou en le faisant glisser ; nom (Domicile, Travail, Autre), étage, porte, repère. Insertion dans `declarations` au **niveau 1** ; le code Hailand et la chaîne administrative sont attribués par le serveur ; vérifié par un essai annulé sur la base (code `GN-CKY-…` attribué). La commande renvoie vers `/adresse?next=/commande`. Variable publique `NEXT_PUBLIC_MAPBOX_TOKEN` (jeton public déjà utilisé par NavigationX) posée dans Vercel, jamais dans le dépôt. Navigateur intégré à WhatsApp : l'avertissement s'affiche et la carte permet de poser le repère à la main.
- **Bloc 2, boutique** (migration `2026-10-16_hailandx_boutique.sql`, appliquée) : table `shop_sections` (rayons) et `offers.section_id` (le rayon doit appartenir à la même boutique) ; table `shop_follows` écrite par `fn_follow_shop` (abonnés comptés par `fn_shop_followers`, lisible par les visiteurs) ; format du numéro WhatsApp contrôlé. Interface : bouton **Suivre**, bouton **WhatsApp** (`wa.me`), rayons filtrables sur la boutique, gestion des rayons et du numéro dans l'espace vendeur, « Boutiques suivies » dans Commandes. 10 tests SQL.
- **Bloc 3, recherche** : filtres catégorie, prix min et max, délai, vendeurs à confiance élevée (indice 70 et plus), tri (confiance, prix, délai). ⚠️ Le filtre « certifié » des maquettes n'a pas de sens tant que toute boutique ouverte est certifiée au niveau 3 : il est remplacé par « confiance élevée ». Le délai affiché est désormais une estimation (préparation habituelle de la boutique + ≈ 20 min, arrondie à 5 min) au lieu d'un 40 min fixe.
- **Bloc 4, liens sociaux** : `InAppBrowserNotice` détecte le navigateur intégré (WhatsApp, TikTok, Facebook…) sur la boutique, le produit, le panier, la commande et l'adresse ; consignes iPhone / Android et bouton « Copier le lien ». Testé avec les agents utilisateurs WhatsApp et Safari.
- **Bloc 5, variantes** (migration `2026-10-16_hailandx_variantes.sql`, appliquée) : plusieurs variantes par offre avec stock chacune, un libellé par offre (insensible à la casse), `order_items.variant_label` (le libellé acheté est figé dans la commande). Interface : éditeur de variantes (ajout, retrait, stock) chez le vendeur, sélecteur sur la fiche produit (une variante épuisée est grisée), rappel dans le panier, les commandes et l'étiquette. Une variante déjà commandée ne se supprime pas (mettre le stock à 0). 5 tests SQL.
- **Bloc 6, suivi et ventes** (migration `2026-10-16_hailandx_suivi_ventes.sql`, appliquée) : `fn_parcel_tracking` (réservée à l'acheteur de la commande ; la position du livreur n'apparaît que colis retiré et si elle date de moins de 10 min), `fn_shop_sales` et `fn_shop_sources` (réservées aux membres de la boutique et à l'équipe). Interface : **carte de suivi** dans la commande, **étiquette imprimable** (`/vendeur/commandes/etiquette?colis=…`), page **Mes ventes** (`/vendeur/ventes` : 7, 30 ou 90 jours, histogramme, meilleures sources), **adresse de livraison en en-tête** de l'accueil. 6 tests SQL.
- **Vérifié** : `npm test` (voir §13), lint, build ; essais navigateur du sélecteur d'adresse (position simulée, ajustement sur la carte), des variantes, de l'avertissement et des filtres. ⚠️ Non rejoué en ligne avec un vrai compte : création d'adresse, suivre une boutique, variantes, étiquette, ventes (pas de code de connexion de test disponible dans cette session) — à essayer par le fondateur.

## 23. Compléments au plan (2026-10-13) ✅ code, base et tests ; ⚠️ parcours en ligne à essayer par le fondateur

Migration `2026-10-17_hailandx_complements.sql` (**appliquée**, 11 tests SQL) et interface :
- **Certification prioritaire** : `fn_request_priority_certification(boutique)` (membre de la boutique, adresse à elle, pas déjà de niveau 3) met la demande de certification de l'adresse à « demandée » et inscrit une ligne dans `certification_priorities` (table séparée : on ne peut pas s'accorder la priorité soi-même). HailandMap (Revue → Demandes, `loadDeclarations` + `DemandesPanel`) lit cette table (agents seulement) : les demandes prioritaires passent en tête avec le badge « PRIORITAIRE · boutique … ». Côté vendeur : bouton « Demander la certification en priorité » dans l'espace vendeur ; l'état de la demande y est rappelé.
- **Favoris** : table `product_favorites` écrite par `fn_toggle_favorite` ; cœur sur la fiche produit ; page `/favoris` (meilleur prix actuel de chaque produit).
- **Modération des avis** : `reviews.hidden` ; le vendeur signale (`fn_report_review`, une fois par avis) depuis `/vendeur/avis` ; l'équipe masque ou maintient (`fn_moderate_review`, console `/admin`, section « Avis signalés ») ; un avis masqué disparaît de la lecture publique (le vendeur et l'auteur le voient encore) et **sort de l'indice de confiance** (`fn_refresh_shop_score` ne compte que les avis non masqués).
- **Messages de litige** : table `dispute_messages` écrite par `fn_dispute_post` (acheteur, vendeur, livreur du colis, équipe ; fermé aux autres, et fermé aux parties une fois le litige tranché). Fil de discussion (`DisputeThread`) dans le suivi de l'acheteur, dans les commandes du vendeur et dans la console équipe.
- **Notifications** : table `notifications` alimentée par des déclencheurs (nouvelle commande, colis accepté / retiré / remis / annulé, avis reçu, litige ouvert / message / tranché, avis signalé ou jugé) ; cloche avec compteur (accueil, compte), page `/notifications` (tout marquer lu) et **alertes du navigateur tant que la page est ouverte**. ⚠️ Pas d'envoi hors application : une notification **push** hors page ouverte demande une clé VAPID et un service worker (non faits), **SMS / WhatsApp** demandent le fournisseur (§7 bis).
- **Compte** : nouvelle page `/compte` (commandes, favoris, adresses, notifications, espace vendeur, déconnexion) ; l'onglet « Commandes » de la barre du bas devient « Compte ».
- **Guidage dans Flotte** : `GuideMap` calcule l'itinéraire (Mapbox Directions) du livreur vers la boutique puis vers l'acheteur, l'affiche sur la carte avec distance, durée, consigne suivante et liste des étapes, recalculé quand le livreur se déplace de plus de 100 m ; le lien vers l'application de cartes reste en secours. Variable publique `NEXT_PUBLIC_MAPBOX_TOKEN` posée sur le projet Vercel de Flotte.
- **Boutiques proches** : `fn_shops_nearby(lat, lng)` (distance arrondie à 0,1 km, jamais les coordonnées ; ouverte aux visiteurs) ; « La rue » trie les boutiques par distance depuis l'adresse enregistrée, ou depuis la position du téléphone (bouton « Boutiques autour de moi »).
- **Vérifié** : `npm test` : 155 vérifications (dont 11 nouvelles), lint, builds HailandX et Flotte ; pages ouvertes sans erreur dans un navigateur. Deux erreurs trouvées par les tests puis corrigées (variable `id` ambiguë dans deux fonctions). ⚠️ Non rejoué en ligne avec un vrai compte.

## 24. Détection du bâtiment et photo de remise (2026-10-13) ✅ code, base et tests ; ⚠️ parcours en ligne à essayer

- **Détection du bâtiment dans « Où livrer ? »** : `packages/scorpion` reçoit `osmDetection` (contours OSM lus sur la carte), `certifiedBuildings` (bâtiments certifiés autour d'un point) et `addressDecision` (proposition faite à l'utilisateur), repris de NavigationX sans changer la logique de `detectBuilding` / `detectAtTap`. Après « Me localiser » ou une touche sur la carte, l'écran cherche le bâtiment (certifié Hailand d'abord, sinon contour OSM, sinon zone), le dessine et demande **« C'est le vôtre ? »**. Rien n'est enregistré sans confirmation. Enregistrement : contour OSM confirmé → `osm_polygon_id` + `osm_polygon_geom`, `detected_level` 2 ; bâtiment certifié confirmé → `certified_building_id` envoyé, **la base vérifie** (certifié, actif, validé, à moins de max(100 m, précision) du GPS) et rattache (`link_method = 'resident'`) : niveau 3 ; sinon niveau 1. Le niveau effectif lu en base est affiché après l'enregistrement et dans la liste des adresses. La position GPS mesurée reste dans `gps_point`, le repère posé dans `anchor_point`. Le rattachement automatique par la base (position dans un bâtiment certifié) continue de s'appliquer.
- **Limites** : ⚠️ la lecture des contours OSM et des bâtiments certifiés n'a pu être essayée que sur des polygones simulés (tests unitaires, 10 nouveaux) : le bac à sable n'atteint ni les tuiles Mapbox ni la base depuis un navigateur ; seul le repli « zone, niveau 1 » a été vu dans un navigateur. À essayer sur place par le fondateur (avec une adresse certifiée, par exemple celle d'une boutique). Les écrans d'enregistrement de **nouveaux** bâtiments restent dans NavigationX / HailandMap. NavigationX garde sa propre copie de ces modules : ⚠️ toute correction se fait des deux côtés.
- **Photo de remise exigée** (migrations `2026-10-18_hailandx_preuves.sql` et `…_preuves_stockage.sql`, appliquées ; 6 tests SQL) : `fn_parcel_handover_proof(colis, méthode, valeur, photo)` remplace l'appel direct de `fn_parcel_handover` (retiré aux comptes connectés). **Par code (livreur)** : la photo est obligatoire et son chemin doit être `<livreur>/<colis>/<fichier>` ; sans elle, la remise est refusée **et le code n'est pas consommé**. **Par scan (acheteur)** : sans photo (l'acheteur confirme lui-même). La photo est rattachée à l'événement « remis » (`delivery_events.photo_path`). Stockage privé `hx-preuves` (3 Mo, JPEG / PNG / WebP) : écriture par le livreur du colis, colis retiré, dans son dossier ; lecture par le livreur, l'acheteur, le vendeur et l'équipe (liens temporaires de 10 min). Flotte : appareil photo (`capture`), aperçu, photo réduite à 1280 px, bouton « Confirmer la remise » inactif tant que la photo manque. HailandX : « Preuve de remise » dans le suivi de l'acheteur, les commandes du vendeur et chaque litige de la console équipe.
- ✅ **Retrait de l'ancienne fonction appliqué en production (2026-10-13)** après le déploiement du nouveau code (PR #17, déploiements HailandX et Flotte prêts) : `fn_parcel_handover(uuid, text, text)` n'est plus exécutable par les comptes connectés ni par les visiteurs (vérifié dans la base) ; seule `fn_parcel_handover_proof` l'est. La remise par code sans photo est donc impossible, y compris par appel direct à l'API.

## 25. Parcours vendeur recentré et suppression de compte (2026-10-13) ✅ code et tests ; ⚠️ fonction de suppression à exécuter par le fondateur

Retour du fondateur après avoir essayé la création de boutique avec son numéro : (1) on pouvait déjà ajouter des produits pendant la création de la boutique, il ne le veut pas ; (2) impossible de recommencer de zéro avec un numéro déjà inscrit : il faut une suppression de compte.

- **Parcours vendeur** (`/vendeur`) en quatre étapes : 1. compte et **identification du bâtiment** (NavigationX, ou « Où livrer ? ») ; 2. **création de la boutique** (nom, catégorie, phrase ; logo et WhatsApp facultatifs) ; 3. **certification** de la boutique (adresse de niveau 3 par Hailand, demande prioritaire possible) ; 4. **tableau de bord**. Pas de boutique sans adresse : tant qu'aucune adresse n'est enregistrée, la page propose de l'identifier d'abord. **Produits, rayons, commandes, ventes, avis et liens à partager n'apparaissent que dans le tableau de bord, boutique ouverte** ; avant, un encart « Tableau de bord » explique qu'il s'ouvre avec la vente.
- **Règle appliquée par la base** (migration `2026-10-19_hailandx_compte.sql`, **appliquée**) : un vendeur ne peut plus ajouter de produit si sa boutique n'est pas « ouverte » (déclencheur `offers_require_open_shop` ; l'équipe n'est pas concernée). Ce n'est donc pas qu'un masquage d'écran.
- **Suppression de compte** (`/parametres`, lien dans « Mon compte »). **Avant** toute confirmation, la page affiche ce qui empêche la suppression (`fn_account_delete_check`) : commande en cours ; achats livrés ou en litige ; boutique ayant des commandes de clients ; livraisons comme livreur ; espèces à reverser ; mouvements d'argent ; dernier administrateur. Ces cas engagent d'autres personnes ou de l'argent : la suppression passe alors par l'équipe Hailand (💡 anonymisation à prévoir). **Sinon**, après avoir tapé SUPPRIMER, `fn_delete_my_account` supprime le compte et toutes ses données : adresses, boutique (produits, variantes, rayons, liens, abonnés, indice), favoris, abonnements, notifications, commandes sans livraison, profil de livreur, droits d'équipe éventuels, profil, puis la ligne d'authentification elle-même. Les images du compte (logo, photos) sont retirées du stockage par la page. **Le numéro redevient libre** : on peut se réinscrire de zéro. Une fiche produit utilisée par une autre boutique est gardée, sans lien avec le compte supprimé. Le compte étant commun, tout l'écosystème (HailandX, Flotte, NavigationX, HailandMap) est concerné.
- 9 tests SQL (`comptes.test.ts`) : produits refusés boutique non ouverte, vérifications, purge complète sans toucher aux autres comptes, protection du dernier administrateur.
- ⚠️ **À exécuter par le fondateur** : le connecteur du bac à sable ne sait pas enregistrer une fonction contenant des `DELETE` (délai dépassé, rien d'enregistré). La fonction `fn_delete_my_account` est dans `supabase/migrations/2026-10-19_hailandx_compte_suppression.sql` : à coller et exécuter dans l'éditeur SQL de Supabase (idempotent). Tant que ce n'est pas fait, le bouton de la page répond que la suppression n'est pas encore activée. Non essayée sur la vraie base : la suppression de la ligne `auth.users` depuis une fonction doit être confirmée à la première utilisation.
- ⚠️ Le compte de test du fondateur (numéro de test) est aussi **administrateur** : le supprimer retire ces droits (un autre compte administrateur existe, le test de blocage « dernier administrateur » l'exige).

## 13. Journal des mises à jour

| Date | Changement |
|---|---|
| 2026-10-12 | Maquettes validées par le fondateur. Phase 1 : squelette du dépôt (monorepo, HailandX, Flotte, paquets ui / commerce / scorpion), comparaison des fournisseurs de SMS (§7 bis), migration SQL de commerce proposée et testée en local (non appliquée), état au §14. |
| 2026-10-12 | Décisions du fondateur (§11) : tout accepté ; nom et domaine laissés à Claude (HailandX, Hailand Flotte, Scorpion, liens `hx.gn`) ; zone pilote plus tard. Phase 0 : canevas de maquettes (14 écrans téléphone + architecture, flux, design) à valider avant d'exécuter (§11.1). |
| 2026-10-12 | Rectification du fondateur : le modèle de référence est **Shopify** (boutique en ligne propre à chaque vendeur, diffusée sur ses réseaux), et non Spotify. |
| 2026-10-12 | Création : vision détaillée du fondateur (vitrine globale « la rue », liens sociaux, Flotte Hailand avec QR, Scorpion, niveaux requis), propositions (fiche commune et offres, indice de confiance, avis vérifiés par la flotte, double preuve de remise, paiement bloqué, panier multi-vendeurs), parcours, place de la flotte, architecture, schéma proposé, design, plan en 8 phases, décisions à prendre. Rien n'est codé. |
| 2026-10-13 | Migration de commerce et de Flotte **appliquée à la base de production** (14 tables, 14 fonctions, sécurité par ligne vérifiée) ; fichier déplacé dans `supabase/migrations/` ; deux correctifs (chemin de recherche `extensions`, droits des déclencheurs). |
| 2026-10-13 | Phase 2 commencée : vitrine lue dans la base (repli sur exemples), connexion par téléphone, espace vendeur, 10 catégories de départ créées en production. |
| 2026-10-13 | Photos (bucket `hx-media`, réduction côté navigateur) ; phase 3 acheteur (panier, commande, suivi, code de remise, avis) et commandes vendeur avec QR ; 3 migrations (téléphone masqué, vitrine visiteurs, bucket) ; défaut de lecture visiteur corrigé. |
| 2026-10-13 | Phase 4 : application Flotte (candidature, missions, scan du QR, remise par code, espèces), indice de confiance calculé par la base, logo et bandeau, modification de produit, liens suivis, console équipe ; parcours réel vérifié avec le numéro de test. |
| 2026-10-14 | Phase 5 : offres de plusieurs vendeurs sur une même fiche (classées), recherche, catégories, litiges (signalement, décision de l'équipe, effet sur l'indice), chiffres clés de la console ; . |
| 2026-10-15 | Phase 6 : paiement numérique (séquestre, règlement à la remise, remboursements, grand livre, reversements, soldes, route de notification signée) ; Orange Money réel non branché (compte marchand à ouvrir). |
| 2026-10-13 | Déploiement Vercel : le build échouait à l'étape TypeScript (Vercel installe depuis la racine de l'application, `typescript` et `@types/*` n'étaient déclarés qu'à la racine). Ajout de `typescript`, `@types/node`, `@types/react`, `@types/react-dom` dans `devDependencies` de chaque application. |
| 2026-10-13 | Déploiement Vercel (suite) : Vercel installe depuis le dossier de l'application, sans les dépendances de développement de la racine (`vitest`) ; `next build` vérifiait le test `orange.test.ts` et échouait (`module_not_found`). Les fichiers `*.test.ts` sont exclus du `tsconfig` de HailandX (ils restent exécutés par `npm test`). Reproduit puis vérifié en local avec une installation depuis `apps/*` : les deux applications se construisent. |
| 2026-10-13 | Déploiement Vercel terminé : projets `hailandx-boutiques` (`apps/hailandx`) et `hailandx-flotte` (`apps/flotte`), production = `main`, variables publiques Supabase posées, accès public. Voir `ECOSYSTEME_HAILAND.md` §14 (révision 65 : projet renommé `hailandx-scorpion`) pour les adresses et le reste à faire. |
| 2026-10-13 | Script `supabase/tests/nettoyage-test.sql` corrigé : il oubliait les litiges, paiements et écritures du grand livre qui référencent les colis et commandes de test (erreur 23503 sur `disputes_parcel_id_fkey`, annulée en bloc, rien n'avait été supprimé). |
| 2026-10-13 | Interface : écran d'ouverture, barre de navigation (dont « Vendre »), bandeau vendeur sur l'accueil, parcours vendeur en 4 étapes (§20). |
| 2026-10-13 | Audit des maquettes et du plan : tableau écran par écran des écarts restants (§21). |
| 2026-10-13 | Blocs 1 à 6 : « Où livrer ? », Suivre / WhatsApp / rayons, filtres de recherche, avertissement navigateur intégré, variantes, étiquette, carte de suivi, ventes par période et par source, adresse en en-tête (§22). Trois migrations appliquées (`boutique`, `variantes`, `suivi_ventes`). |
| 2026-10-13 | Compléments (§23) : certification prioritaire vers HailandMap, favoris, modération des avis, messages de litige, notifications (centre dans l'application), guidage dans Flotte, boutiques triées par distance, page Compte. Migration `complements` appliquée. |
| 2026-10-13 | Détection du bâtiment dans « Où livrer ? » (Scorpion : `osmDetection`, `certifiedBuildings`, `addressDecision`) et photo de remise exigée dans Flotte (§24). Migrations `preuves` et `preuves_stockage` appliquées ; retrait de l'ancienne fonction de remise à appliquer après déploiement. |
| 2026-10-13 | Retrait de l'ancienne fonction de remise appliqué en production après déploiement (migration `hailandx_preuves_retrait_ancienne_remise`) ; vérifié par les droits d'exécution. |
| 2026-10-13 | Parcours vendeur recentré (produits seulement tableau de bord, boutique ouverte, adresse d'abord) et suppression de compte dans Paramètres (§25). Migration `compte` appliquée ; fonction de suppression à exécuter par le fondateur. |
| 2026-10-14 | **Interface v2** validée par le fondateur et codée (§26) : 4 onglets (Accueil, Commandes, Vendre / Ma boutique, Compte), recherche ouverte depuis l'accueil, ouverture de boutique en trois étapes, tableau de bord vendeur et six pages rangées, éditeur de produit plein écran, Compte simplifié, aide. 189 tests. |
| 2026-10-14 | **Plan validé** (§27) : séparer HailandX (acheteurs) et HailandX Vendeur, créer Hailand Console (équipe, rôles, journal, circuit des certifications vers HailandMap), Flotte avec navigation Mapbox plein écran ; tout dans ce dépôt. |
| 2026-10-14 | **Étape 1** (§28) : application **HailandX Vendeur** (`apps/vendeur`, Vercel `hailandx-vendeur`, https://hailandx-vendeur-gn.vercel.app) ; HailandX à 3 onglets ; notifications séparées ; paquet commun `@hailandx/kit` ; lien console retiré de Compte. |
| 2026-10-14 | **Étape 2** (§29) : application **Hailand Console** (`apps/console`, Vercel `hailand-console`, https://hailand-console-gn.vercel.app) ; rôles fondateur / opérateur, journal des actions, paramètres réservés au fondateur avec motif ; circuit des certifications vendeur → console → HailandMap ; `/admin` retiré de HailandX. Migration `hailand_console` **appliquée en production**. 202 tests. |
| 2026-10-14 | **Étape 3** (§30) : **Hailand Flotte, navigation plein écran** — carte Mapbox (style Hailand) dès l'acceptation, fiche retrait / dépôt (quartier, commune, code, repère, appel), guidage virage par virage avec voix française et recalcul hors route, écran maintenu allumé, arrivée à moins de 50 m avec contour du bâtiment, carte des missions disponibles ; plus aucun lien Google. Migration `flotte_navigation` appliquée en production. 218 tests. |
| 2026-10-14 | **Étape 4** (technique) : reconstruction sélective ajoutée aux projets Vercel `hailandx-scorpion` et `hailandx-flotte` (déjà en place pour `hailandx-vendeur` et `hailand-console`). Reste : essais en ligne. |
| 2026-10-14 | Correctif Flotte : le déploiement de la PR #24 échouait (`module_not_found`) car `apps/flotte/src/lib/nav.test.ts` importe `vitest`, absent du build Vercel (installation depuis le dossier de l'application). `*.test.ts` exclus du `tsconfig` de Flotte, comme pour HailandX et HailandX Vendeur. Reproduit (build sans `vitest` : erreur TS2307) puis vérifié (build réussi). **Règle : tout `tsconfig` d'application exclut `src/**/*.test.ts`.** |
| 2026-10-14 | **Plan « Compte Hailand unique »** validé (§31). **Phase 1** : déconnexion réelle commune (`signOutHailand`), NavigationX filtré par compte, script de remise à zéro des comptes (vérifié sur le banc, à exécuter par le fondateur). 222 tests. |
| 2026-10-14 | **Compte Hailand, phases 2 et 3** (§31) : maquettes v4 validées ; connexion « Compte Hailand » commune (déjà un compte / compte créé, nom demandé une fois), passage de session par code à usage unique (table `account_passages`, fonctions `fn_passage_creer` / `fn_passage_consommer` / `fn_compte_resume`, fonction serveur `passage`), `LienHailand`, 30 jours d'inactivité, Flotte branchée sur le kit. Migration et fonction serveur **non mises en ligne** (accord du fondateur). 238 tests. |
| 2026-10-14 | Compte Hailand : migration appliquée en production (`compte_hailand_table`, `compte_hailand_fonctions`, droits vérifiés) et fonction serveur `passage` déployée (accord du fondateur) ; ménage automatique des codes retiré de `fn_passage_creer`. |
| 2026-10-14 | **Compte Hailand, phase 4** (§31) : essai réel du passage Vendeur → NavigationX réussi ; adresse profonde vers l'enregistrement de NavigationX (`lienEnregistrement`), retour avec `?adresse=` dans Vendeur (étape 1, « Changer », réglages) et HailandX (commande) ; **enregistrement d'adresse retiré de HailandX** (`AddressPicker`, `lib/address.ts`). 239 tests. |
| 2026-10-14 | **Compte Hailand, phase 5** (§31) : livreurs ajoutés par la console (`fn_console_courier_add`, invitations, `fn_flotte_rejoindre`), candidature publique fermée, écran Flotte « numéro non enregistré », lien Flotte retiré de HailandX, notification « adresse certifiée » (déclencheur sur `declarations`). Migration appliquée en production le même jour (accord du fondateur). 245 tests. ⚠️ Déploiements Vercel de Console, Vendeur et HailandX limités pour 24 h (quota quotidien du forfait gratuit atteint). |
| 2026-10-16 | Seconde remise à zéro des comptes préparée et testée (`2026-10-16_reinitialisation_comptes_2.sql`, sauvegarde `sauvegarde_20261016`) ; constat : phase 5 pas encore déployée sur Console, Flotte et l'accueil de HailandX (limite Vercel). |
| 2026-10-16 | Redéploiement de la phase 5 : commentaire sans effet dans `apps/console` et `apps/hailandx` pour forcer la reconstruction de Hailand Console et de HailandX (le déploiement du 2026-10-14 avait été refusé par la limite Vercel ; un « Redeploy » reconstruit l'ancien commit). Flotte : « Promote to Production » de l'aperçu de la PR #32. |
| 2026-10-16 | **`BASE_DE_DONNEES.md`** (révision 1, identique dans les 3 dépôts) : explication de chaque table de la base partagée, tables inutilisées, recettes SQL. Contrôle automatique `supabase/tests/schema-doc.test.ts` (toute table créée par une migration doit y être décrite). Script de ménage `supabase/maintenance/2026-10-16_menage_tables_inutilisees.sql` (sauvegarde puis suppression de 8 tables d'anciens prototypes ; test `menage-tables.test.ts`) — ⏳ à exécuter par le fondateur. Écosystème révision 86. |
| 2026-10-20 | Flotte : jeton Mapbox corrigé sur Vercel (un caractère faux), carte de nouveau affichée. Plan « Flotte Nuit, écrans d'ouverture, logos » validé (§32), étape 0 (maquettes) en cours. |
| 2026-10-20 | Plan §32, étapes 0 et 1 : maquettes v5 validées (Flotte A, Vendeur devanture sur fond sombre) ; logos `packages/ui/src/marks.ts` + `AppMark`, icônes d'onglet et d'installation des 4 applications (`scripts/icones.ts`), manifeste de la Console, écran d'ouverture commun `Ouverture` (CSS seulement, une fois par onglet). 258 tests. |
| 2026-10-20 | Plan §32, étape 2 : carte « Hailand Nuit » de Flotte écrite dans le code (`lib/hailandNuit.ts`, Mapbox Streets v8), itinéraire vert lumineux, trajet parcouru éteint (`splitAt`), relief sombre des bâtiments. |
| 2026-10-20 | Plan §32, étape 3 : Flotte refaite selon les maquettes v5 (hors service, en service, mission proposée, retrait, remise, fin, menu), panneau à gauche sur ordinateur, pages `/livraisons` et `/aide`. |
| 2026-10-20 | Plan §32, étape 4 : navigation avancée de Flotte (bandeau de manœuvre, caméra inclinée avec zoom selon la vitesse, flèche animée orientée, vue d'ensemble, vitesse, barre de progression). |
| 2026-10-21 | Essai réel de Flotte : message de plafond d'espèces exact + plafond réglable dans la Console, itinéraire par les routes sur la mission proposée, retrait et dépôt au bâtiment certifié exact (plus d'arrondi du dépôt), bâtiments de retrait (ambre) et de dépôt (vert) surlignés. Migration `2026-10-25_flotte_batiments_exacts.sql` à appliquer. |
| 2026-10-21 | Migration `2026-10-25_flotte_batiments_exacts.sql` appliquée en production (accord du fondateur) et vérifiée. |
| 2026-10-21 | Flotte : position du livreur enfin envoyée au serveur (`fn_courier_ping` jamais exécuté, faute de `.then()`), rayon des missions 8 → 20 km, garde-fou de test. |
| 2026-10-22 | Fiche produit détaillée (§33) : fiche type par catégorie (`fiche.ts`), page produit HailandX enrichie (galerie, En bref, points forts, description, caractéristiques, mot du vendeur, livraison et garanties, carte du vendeur), éditeur du vendeur avec indicateur de complétude, migration `2026-10-26_hailandx_fiche_produit.sql` (⚠️ à appliquer). |
| 2026-10-22 | Migration `2026-10-26_hailandx_fiche_produit.sql` appliquée en production (accord du fondateur) ; vérifications faites. |
| 2026-10-22 | §34 : tous les produits en ligne par catégorie (rangées + grille avec tri), « Produits similaires » sur la page produit, photos par adresse web ; catalogue de démonstration de 50 produits dans Djigo Shop (`demo-…`). |
| 2026-10-22 | Migration `2026-10-27_hailandx_questions_achats.sql` appliquée par le fondateur (éditeur SQL) ; vérifications faites. |
| 2026-10-22 | §36 : panier refait (état en direct, mis de côté, récapitulatif), partage d'un produit par lien direct suivi (HailandX Vendeur), correction `/s/<code>` (offre de la boutique qui partage), tableau de bord sans doublon. §37 : plan « HailandX Vendeur niveau Shopify » proposé. |
| 2026-10-22 | §35 : filtres de catégorie (marque, prix, état), « Vus récemment » (sur le téléphone), « Souvent achetés ensemble », questions-réponses (HailandX, Vendeur, Console) ; migration `2026-10-27_hailandx_questions_achats.sql` (⚠️ à appliquer). |
| 2026-10-23 | §37 validé : maquettes v6 ; barre du bas à 5 onglets ; Commandes (recherche, fiche d'une commande, annulation avec motif) ; Marketing (codes promo, promotions à prix barré, visuel prêt à publier, affiche QR) ; HailandX : prix barré, code promo à la commande. Migration `2026-10-28_hailandx_vendeur_commandes_marketing.sql` (⚠️ à appliquer avant fusion) ; BASE_DE_DONNEES révision 7. |

## 14. Phase 1 — état (2026-10-13) ✅ squelette, ✅ migration appliquée à la base de production

**Fait dans ce dépôt** (tests : `npm test` — 96 vérifications ; `npm run lint` ; `npm run build`) :
- **Monorepo** (npm workspaces) : `apps/hailandx` (Next.js 16, React 19, Tailwind 4), `apps/flotte`, `packages/ui` (système de design des maquettes), `packages/commerce` (règles métier), `packages/scorpion` (modules purs repris de NavigationX).
- **HailandX** : accueil « la rue » (fil à un échantillon par boutique et par catégorie, avec rotation), **page d'un produit** (`/p/<produit>`) et **boutique** (`/b/<boutique>`) rendues côté serveur, avec **aperçu riche** (titre, prix, boutique) pour WhatsApp, TikTok et Facebook ✅ vérifié dans le HTML ; manifeste d'application installable. ⚠️ Pas encore d'image d'aperçu (il faudra les vraies photos). Données **d'exemple** (fictives) tant que la base de commerce n'existe pas.
- **Flotte** : écran des missions (thème sombre) avec gains calculés par la règle de frais, niveau d'adresse et précision à la porte.
- **`packages/commerce`** (26 tests) : montants en GNF ; frais de livraison (base 6 000 + 2 100 GNF/km, arrondi à 500, minimum 8 000 — ⚠️ valeurs provisoires) ; cycle de vie d'un colis (8 états, désistement possible) ; code de remise à 4 chiffres avec verrouillage après 5 échecs ; lecture d'un QR de colis ; contrôle de proximité ; **indice de confiance** (35 % avis vérifiés, 30 % fiabilité, 15 % expérience, 10 % qualité, 10 % prix, lissage tant que les avis sont peu nombreux) et badges ; fil « la rue » ; classement des offres ; règles « vendeur niveau 3 » et « acheteur niveau 1 minimum ».
- **`packages/scorpion`** (42 tests) : `gpsAcquisition`, `buildingDetection`, `levels`, `geoDiagnostic` repris **sans changement de logique** de NavigationX. Restent à extraire : `ownBuilding`, `certifiedBuildings`, `osmDetection`, écrans d'enregistrement (§6). ⚠️ Tant que NavigationX garde sa copie, toute correction se fait des deux côtés.
- **Migration SQL de commerce** : `supabase/migrations/2026-10-12_hailandx_commerce.sql` — **APPLIQUÉE à la production le 2026-10-13** (accord explicite du fondateur ; nouvelles tables seulement, aucune table existante modifiée ; vérifié en base : 14 tables avec sécurité par ligne, 22 règles, 14 fonctions, clé de signature des QR générée en base, `anon` sans droit de commander, `authenticated` sans écriture directe sur les commandes ni lecture du code de remise). Une première tentative a été annulée en bloc (pgcrypto vit dans le schéma `extensions` sur Supabase) : correctif dans le chemin de recherche des fonctions de signature ; puis une seconde migration retire les droits d'appel API des trois fonctions de déclencheur. Auparavant : , testée sur un Postgres local embarqué (`supabase/tests/commerce.test.ts`, **28 scénarios**) : boutique (niveau 3 requis pour vendre), catalogue et offres, commande à plusieurs boutiques (un colis par boutique, frais selon la distance, stock décompté, espèces à encaisser), préparation, QR signé, livreur (candidature, validation, mission verrouillée, plafond d'espèces, retrait), remise (scan de l'acheteur ou code, proximité, verrouillage), avis réservés aux remises confirmées, droits de lecture (un acheteur ne voit que ses commandes ; le code de remise n'est lisible que par lui). Le banc d'essai a **trouvé et fait corriger 5 défauts** avant toute exécution réelle.
- **Écarts avec le §8** (proposition initiale) : pas de tables `carts`/`cart_items` (le panier reste dans le navigateur jusqu'à la commande) ; **`deliveries` n'est pas modifiée** (ancienne table, 1 ligne de test, identifiants en texte) : les missions de la Flotte vivent dans `parcels` ; `payments`, `payouts`, `cash_settlements` et `disputes` viendront avec les phases 4 et 6 (le solde d'espèces du livreur est déjà suivi dans `couriers`).

**Ce qui attend le fondateur** (le reste n'est fait qu'avec son accord) :
1. ✅ FAIT le 2026-10-13 — **Appliquer la migration** à la base de production (accord explicite pour cette opération ; la base n'a aucune sauvegarde : je propose un export des tables concernées avant, comme pour les migrations précédentes — la migration ne modifie aucune table existante).
2. **Choisir le fournisseur de SMS** après devis (§7 bis).
3. **Créer le projet Vercel** de HailandX (et de la Flotte) et choisir le domaine (§11, `hx.gn` à vérifier).
4. Valider les **tarifs de livraison** provisoires (base 6 000, 2 100 GNF/km, arrondi 500, minimum 8 000), le **plafond d'espèces** par livreur (500 000 GNF) et la **distance de remise** (150 m).

**Prochaines étapes de code** (après accord) : connexion par téléphone et lecture réelle des boutiques et produits ; Scorpion dans HailandX (adresse à la commande) ; espace vendeur (phase 2).

---

## 15. Phase 2 — état (2026-10-13) ✅ code, ⚠️ connexion réelle à tester avec un vrai SMS

**Fait** (`npm test` : 100 vérifications ; `npm run lint` ; `npm run build`) :
- **Lecture réelle de la vitrine** (`apps/hailandx/src/lib/catalog.ts`) : boutiques **ouvertes** et offres actives lues dans la base avec la clé publique (visiteur) ; si aucune boutique n'est ouverte ou si la base est injoignable, **repli sur les boutiques d'exemple** (mention affichée). Pages d'accueil, boutique (`/b/<slug>`) et produit (`/p/<slug>`) rendues côté serveur, rafraîchies toutes les 60 s ; l'aperçu riche reste servi par le serveur.
- **Connexion par téléphone** (`/connexion`) : numéro guinéen (+224, normalisé et testé) → code à 6 chiffres (`signInWithOtp` / `verifyOtp`) ; session conservée dans le navigateur. Même compte que NavigationX et HailandMap. ⚠️ L'envoi réel du SMS dépend du fournisseur (§7 bis) ; les numéros de test configurés dans Supabase fonctionnent sans SMS.
- **Espace vendeur** (`/vendeur`) : créer sa boutique (nom → lien lisible, catégorie, adresse parmi ses adresses Scorpion), rattacher une adresse, ajouter un produit (fiche + offre + stock), copier le lien ou le partager sur WhatsApp, bouton « Ouvrir la vente » **seulement quand l'adresse est de niveau 3** (la règle est aussi appliquée par la base).
- **Catégories de départ** (10) créées en production (`supabase/migrations/2026-10-13_hailandx_categories.sql`, ajout seulement, accord du fondateur).
- **Vérifié sur la vraie base, sans rien laisser** (transaction annulée) : un compte connecté crée sa boutique (devenue membre propriétaire), un produit, une offre et une variante ; l'ouverture de la vente et le changement de statut sont refusés sans niveau 3 ; l'écriture directe d'une commande est refusée. Base laissée à 0 boutique et 0 produit.
- Écran téléphone (390 px) : accueil, invite de connexion du vendeur, validation du numéro ; aucun défilement horizontal, aucune erreur.

**Pas encore fait (phase 2 suite)** : photos des produits (stockage d'images), modification et suppression de produits, extraction de l'enregistrement d'adresse de NavigationX dans `packages/scorpion` (aujourd'hui l'adresse se crée dans NavigationX), liens suivis (`share_links`, clics par source), certification prioritaire demandée depuis l'espace vendeur.

## 16. Photos et phase 3 (acheteur) — état (2026-10-13) ✅ code et base, ⚠️ pas encore testé avec un vrai compte

**Photos** : bucket public `hx-media` (3 Mo, JPEG/PNG/WebP), écriture seulement dans le dossier de son propre compte (`<compte>/…`, vérifié en base : dossier d'un autre refusé). Le navigateur **réduit la photo** avant l'envoi (côté le plus long ≤ 1 280 px, JPEG 0,8) pour la 3G. Envoi depuis l'espace vendeur ; affichage sur l'accueil, la boutique et la fiche ; la photo sert aussi d'**aperçu riche** (`og:image`) quand elle existe. Migration `2026-10-13_hailandx_media_bucket.sql` (appliquée).

**Acheteur (phase 3)** :
- **Panier** (`/panier`, conservé dans le navigateur) multi-vendeurs : un bloc par boutique = un colis ; quantités ; sous-total.
- **Commande** (`/commande`) : connexion, adresse de livraison parmi ses adresses (niveau 1 au minimum), téléphone prérempli, paiement **espèces à la livraison** (Orange Money « bientôt »). Le serveur (`fn_place_order`) recalcule prix, stock et frais de livraison.
- **Suivi** (`/commandes`, `/commandes/<id>`) : un bloc par colis, étapes Confirmée → Prête → En route → Remise (rafraîchi toutes les 10 s), **code de remise à 4 chiffres** visible seulement une fois le livreur attribué, annulation avant préparation, **avis vérifié** après la remise.
- Fiche produit : barre « Ajouter / Acheter » (inactive sur les produits d'exemple, « Rupture de stock » si plus de stock).

**Vendeur** : `/vendeur/commandes` — commandes à préparer, « Colis prêt » (propose la mission aux livreurs), **QR signé du colis** à faire scanner au retrait, refus / annulation.

**Base** : quatre migrations appliquées le 2026-10-13 en plus de la phase 1 (accord du fondateur) : catégories, bucket d'images, **téléphone de l'acheteur masqué** (plus lisible ni par le vendeur ni par le livreur ; il sera donné au livreur pendant sa mission par une fonction, phase 4), **vitrine lisible par les visiteurs**.
- ⚠️ **Défaut trouvé en rejouant le flux sur la vraie base** : les règles de lecture appelaient `is_admin()`, dont l'exécution est retirée aux visiteurs (durcissement du 2026-10-05) ; un visiteur ne voyait donc aucune boutique et le site retombait sur les exemples. Corrigé (règles séparées pour les visiteurs) et couvert par un test (le banc reproduit désormais ce retrait de droit).

**Vérifié** : `npm test` 101 vérifications (dont 29 scénarios SQL) ; parcours complet rejoué sur la vraie base **en transaction annulée** (niveau 3 du vendeur, boutique ouverte, visible d'un visiteur, commande avec frais 13 000 GNF, stock 5 → 3, colis prêt, QR de 103 caractères, annulation, stock remis à 5) — base laissée à 0 boutique / 0 commande ; 17 contrôles sur écran de téléphone (390 px) avec **session et serveur simulés** (aucun identifiant utilisé) : panier, commande, suivi, code, avis, commandes vendeur, QR ; aucun défilement horizontal.

**Pas encore fait** : indice de confiance mis à jour par les avis (`shop_scores` n'est pas encore recalculé : phase 5), photos des boutiques (logo, bandeau), modification de produit, scan du QR par l'acheteur et par le livreur (phase 4, application Flotte), suivi des clics des liens (`share_links`), Orange Money (phase 6).

## 17. Compléments vendeur et phase 4 (Flotte) — état (2026-10-13) ✅ code et base, ✅ parcours réel vérifié

**Vendeur** : logo et bandeau de la boutique (affichés sur l'accueil, la boutique et la fiche) ; **modifier un produit** (prix, stock, visible / masqué, nouvelle photo) ; **liens suivis** `/s/<code>` par réseau (TikTok, WhatsApp, Facebook, autre), page visée (boutique ou produit), **compteur de clics**, **source conservée jusqu'à la commande** (`orders.source`).
**Indice de confiance** calculé par la base (`fn_refresh_shop_score`, mêmes pondérations que `packages/commerce/src/trust.ts` : avis 35 · fiabilité 30 · expérience 15 · qualité 10 · prix 10) et recalculé à chaque avis, remise, litige, annulation, création de boutique ou changement d'offre. Fiabilité = (remises + 3,5) / (remises + problèmes + 5) (a priori de 0,7 pesant 5 commandes) ; problèmes = litiges et annulations faites par la boutique. Un test compare le résultat SQL au code partagé. La vitrine affiche l'indice de la base.
**Application Flotte** (`apps/flotte`) : connexion par téléphone ; **candidature** (nom, véhicule) ; dossier « en cours de validation » ; **disponibilité** ; position envoyée toutes les 20 s ; **missions proches** (rayon de 8 km autour du vendeur, gain, distance, espèces à encaisser) ; acceptation (un seul livreur obtient la mission) ; **retrait : scan du QR du colis** (caméra arrière, lecture continue ; repli par saisie du code) ; **remise : code à 4 chiffres** de l'acheteur, 5 essais, position contrôlée par le serveur ; solde d'espèces et plafond ; livraisons faites et frais cumulés. Le **téléphone et le point exact de l'acheteur** ne sortent que par `fn_mission_info`, pour le livreur attribué, tant que le colis n'est pas remis.
**Acheteur** : sur le suivi, bouton « Livreur arrivé : scanner le colis » (confirmation de la remise par scan du QR).
**Console équipe** (`/admin`, administrateurs) : valider ou suspendre un livreur, enregistrer un reversement d'espèces (`fn_courier_cash_settle`), suspendre ou réactiver une boutique.
**Base** : migrations `2026-10-13_hailandx_phase4.sql` (indice, `fn_mission_info`, règlement des espèces), `…_liens_suivis.sql` (`fn_open_share_link`), `…_score_init.sql` (indice d'une boutique neuve), toutes appliquées en production.

**Vérifié** : `npm test` 104 vérifications (32 scénarios SQL) ; **parcours réel de bout en bout sur la vraie base avec le numéro de test du fondateur** (identifiants uniquement dans le terminal, jamais écrits) : connexion, boutique de niveau 3 ouverte, logo, bandeau et photos réels dans le stockage, modification de produit, lien TikTok suivi (clic compté, source mémorisée), visiteur voyant la vraie boutique, commande, colis prêt, QR signé, livreur (candidature → validation par SQL → disponible → mission → QR falsifié refusé → QR valide → mauvais code refusé, 4 essais restants → bon code → remise → espèces), avis vérifié, indice recalculé (61), console équipe. 0 erreur de page.
- ⚠️ **Piège du bac à sable** : dans ce bac à sable le proxy remplace le jeton de l'utilisateur par une clé de service pour les requêtes du **navigateur** (droits et sécurité par ligne non testés, `auth.uid()` vide) ; les tests réels font passer les requêtes Supabase par Node (jeton conservé). Voir `CLAUDE.md`.
- ✅ Données de test de la phase 4 nettoyées (par le fondateur, avec `supabase/tests/nettoyage-test.sql`).

**Pas encore fait** : modification du nom ou du lien d'une boutique, suppression d'un produit déjà commandé (on le masque), guidage cartographique dans l'application (aujourd'hui : lien vers l'application de cartes), notifications (SMS / WhatsApp : fournisseur à choisir), paiement Orange Money (phase 6), tarifs et plafond à valider par le fondateur, hébergement (Vercel) et domaine.

## 18. Phase 5 — confiance, classement, litiges, console équipe — état (2026-10-14) ✅ code et base, ✅ parcours réel vérifié

**Plusieurs vendeurs, même produit** : un vendeur qui tape le nom d'un produit voit « Ce produit est déjà vendu ? » et **ajoute son offre à la fiche existante** (une seule offre par produit et par boutique) ; la fiche produit affiche **« Proposé par N vendeurs »**, l'**offre recommandée** (confiance 60 % · prix 25 % · délai 15 %, `rankOffers`) et la liste des autres offres ; un lien reçu (`?b=<boutique>`) ouvre l'offre de ce vendeur.
**Recherche** (`/recherche`) : produits (nom, catégorie, boutique) et boutiques (nom, présentation), sans tenir compte des accents ni des majuscules ; **catégories de l'accueil fonctionnelles** (`/?cat=`). La vitrine est lue avec un cache de 30 s.
**Litiges** : l'acheteur signale un problème (non reçu, abîmé, différent, autre) sur un colis **en route ou remis depuis moins de 72 h** (une fois par colis) ; le colis passe en « litige » ; **l'équipe tranche** (`fn_resolve_dispute`) : en faveur de l'acheteur (colis annulé, remboursement à organiser par l'équipe) ou du vendeur (remise confirmée) ; la décision est visible par l'acheteur ; un litige tranché contre le vendeur **pèse sur sa fiabilité** donc sur son indice. Table `disputes` (lecture : acheteur, vendeur du colis, livreur, équipe ; aucune écriture directe). Migration `2026-10-14_hailandx_litiges.sql` appliquée.
**Console équipe** (`/admin`) : chiffres clés (boutiques ouvertes, commandes, colis remis, livreurs validés, ventes livrées), **litiges ouverts** avec décision en deux boutons, livreurs, reversements d'espèces, boutiques.

**Vérifié** : `npm test` 108 vérifications (36 scénarios SQL dont 4 sur les litiges) ; **parcours réel sur la vraie base avec le numéro de test du fondateur** : recherche (casse, accents, aucun résultat), fiche à 2 vendeurs (recommandée, passage à l'autre offre), filtre de catégorie, signalement d'un problème, décision de l'équipe visible par l'acheteur, proposition de la fiche existante au vendeur, refus d'une seconde offre du même vendeur. Défauts trouvés et corrigés pendant ces essais : chiffres clés vides (une requête `select *` touchait une colonne non lisible), décision invisible après annulation du colis.
- ⚠️ Les `DELETE` et `DROP` ne s'exécutent pas depuis le connecteur Supabase du bac à sable (« timed out » après 60 s, rien n'est supprimé). **Données de test à supprimer par le fondateur** avec `supabase/tests/nettoyage-test.sql` (éditeur SQL de Supabase) : 2 boutiques « Test Claude », 1 commande, 1 litige, 1 livreur de test, 1 fiche produit, l'adresse `TESTX-VENDEUR`. Les images de test ont été supprimées par l'API Storage.
- ⚠️ La limite d'envoi de codes SMS de Supabase empêche plusieurs connexions rapprochées avec le même numéro (les tests se connectent une fois par navigateur).

**Pas encore fait** : modération des avis, remboursement automatique (dépend du paiement numérique, phase 6), historique complet d'un litige (messages), tableau de bord par période, classement des boutiques par catégorie, notifications.

## 19. Phase 6 — paiement numérique : séquestre, règlement, remboursements — état (2026-10-15) ✅ comptabilité et écrans, ⚠️ Orange Money réel NON branché

**Ce qui est décidé et testé par la base** (migrations `2026-10-15_hailandx_paiement.sql` et `…_remboursements.sql`, appliquées en production avec l'accord du fondateur) :
- **Séquestre** : une commande payée par Orange Money ne se prépare pas tant que l'argent n'est pas bloqué (`fn_parcel_ready` refuse) ; `fn_payment_confirm` (réservé à la **clé de service** du serveur de paiement ou à l'**équipe**) vérifie le montant exact, bloque l'argent et ne s'applique qu'une fois.
- **Règlement à la remise** (trigger sur le statut du colis, une seule fois par colis) : le vendeur reçoit les articles **moins la commission**, le livreur sa part des frais de livraison, la plateforme le reste ; l'argent sort du séquestre. Même règlement pour un colis payé en espèces (le livreur garde son solde d'espèces à reverser, `cash_balance_gnf`).
- **Remboursements** : colis payé d'avance annulé avant livraison → l'argent sort du séquestre et revient à l'acheteur ; litige tranché pour l'acheteur après règlement → la part du vendeur et la commission sont reprises et l'acheteur est remboursé des articles (les frais de livraison, déjà dus au livreur, ne sont pas remboursés — ⚠️ à valider).
- **Grand livre** (`ledger_entries`) : chaque mouvement est une ligne ; chacun lit les siens (vendeur, livreur, acheteur), l'équipe lit tout ; aucune écriture directe. **Reversements** : `fn_shop_payout` (l'équipe enregistre ce qui a été versé au vendeur, dans la limite de son solde), `fn_refund_paid` (remboursement versé à l'acheteur), `fn_refunds_due` (liste avec téléphone, équipe seulement).
- **Taux provisoires, modifiables par l'équipe** (table `settings`) : commission **8 %** sur les articles, **80 %** des frais de livraison au livreur. ⚠️ **À valider par le fondateur.**
- Mode de paiement (`settings.payment_mode`) : **`simulation`** (par défaut : Orange Money réservé à l'équipe, bouton « Simuler le paiement ») ou **`orange_money`** (public). Ne passer en `orange_money` qu'une fois le compte marchand ouvert.

**Écrans** : choix « Orange Money » à la commande (grisé « bientôt » pour le public tant que le mode est `simulation`) ; suivi de commande avec « Paiement en attente / bloqué / versé / remboursé » ; vendeur : « en attente du paiement » puis « payé, argent bloqué », **Mon solde** (`/vendeur/solde`) ; console équipe : « À verser aux vendeurs », « Remboursements à effectuer », taux et mode de paiement.

**Vérifié** : `npm test` : 123 vérifications (dont 14 scénarios de paiement SQL, 2 sur la signature de notification) ; **parcours réel sur la vraie base avec le numéro de test du fondateur** (compte administrateur, mode simulation) : commande Orange Money → « paiement en attente » → le vendeur ne peut pas préparer (refus du serveur) → paiement simulé → argent bloqué → colis prêt ; deuxième commande payée puis annulée → remboursement dû ; colis remis → règlement (séquestre à 0, vendeur 110 400 = 120 000 − 8 %, livreur 41 600 = 80 % de 52 000, plateforme 20 000, vérifiés dans le grand livre) ; solde vendeur affiché ; console équipe : versement au vendeur et remboursement enregistrés, solde remis à 0. 0 erreur de page. ⚠️ Le vrai paiement Orange Money n'a PAS été essayé (compte marchand inexistant).

**Notification de paiement** : route `/api/paiement/orange/notify` (signature HMAC-SHA256 vérifiée en temps constant, montant et commande contrôlés par la base, avis rejoué toléré). **Inactive (503) tant que `OM_WEBHOOK_SECRET` et `SUPABASE_SERVICE_ROLE_KEY` ne sont pas configurés côté serveur** (Vercel, jamais dans le dépôt). Le format exact de la notification et l'appel de création de paiement dépendent du contrat Orange : `apps/hailandx/src/lib/orange.ts` les centralise.

**Ce que le fondateur doit obtenir d'Orange Money Guinée** (⚠️ non vérifié pour la Guinée : voir le portail développeur Orange, produit « Orange Money Web Payment », et l'équipe entreprises d'Orange Guinée) : un **compte marchand** (processus d'agrément, pièces de la société), l'accès **API** (identifiants de test puis de production, URL de notification, secret de signature), les **frais** par transaction, les règles de **remboursement** et de **reversement** aux vendeurs, la fenêtre de **règlement** vers le compte de la plateforme. Prévoir aussi une **validation juridique** (monnaie électronique, séquestre pour compte de tiers, conditions générales, fiscalité de la commission).

**Pas encore fait** : appel de création de paiement chez Orange et page de retour (dépendent du contrat), versement automatique aux vendeurs et aux livreurs (aujourd'hui l'équipe verse puis enregistre), rapprochement bancaire, facture / reçu, paiement échoué ou expiré (annulation automatique après délai).

## 26. Interface v2 : navigation, « Ma boutique » et « Compte » (2026-10-14) ✅ code, tests et vérification dans le navigateur (base simulée) ; ⚠️ à essayer en ligne par le fondateur

Retour du fondateur après essai : l'espace vendeur était « une longue page en désordre », l'onglet « Chercher » faisait doublon avec la recherche de l'accueil, « Mon compte » mélangeait tout. Proposition dessinée dans l'artefact des maquettes (page « Proposition v2 — Vendre et Compte », 14 écrans et un plan), **validée telle quelle** le 2026-10-14, puis codée.

- **Barre du bas (4 onglets)** : Accueil · Commandes · **Vendre** (devient **Ma boutique** quand la vente est ouverte) · Compte. Pastilles : colis en cours (acheteur), colis à préparer (vendeur). Masquée sur les écrans plein écran (fiche produit, commande, éditeur de produit, suppression du compte, étiquette).
- **Accueil** : cloche et panier (avec nombre d'articles) en haut, « Livrer à » en une ligne, barre de recherche. L'onglet « Chercher » disparaît : la barre ouvre l'écran de recherche (`/recherche`, rattaché à l'onglet Accueil) avec « Annuler », recherches récentes (dans le navigateur), catégories à parcourir, filtres en puces (prix croissant, livré en moins d'1 h, certifié et fiable) et « Plus de filtres ».
- **Commandes** (acheteur, `/commandes`) : « En cours » (étape du colis le moins avancé, **code de remise** en grand, « Suivre ») et « Terminées » (« Donner mon avis » si un colis remis n'a pas d'avis, « Racheter »). Les boutiques suivies passent dans **Favoris**.
- **Vendre** : sans boutique, écran de découverte (trois étapes). **Ouvrir ma boutique** (`/vendeur/ouvrir`, et `/vendeur` tant que la vente n'est pas ouverte) : un seul écran en trois étapes, seule l'étape en cours ouverte, les étapes faites repliées avec « Modifier », les suivantes verrouillées : 1. adresse (NavigationX ou carte) ; 2. boutique (nom, catégorie, adresse si plusieurs, logo facultatif) ; 3. certification (demande prioritaire → suivi « Visite de l'agent » → « Adresse certifiée » → **Ouvrir la vente**). **Aucun produit** à ce stade (règle déjà imposée par la base, §25).
- **Ma boutique** (`/vendeur`, vente ouverte) — tableau de bord court : ventes (aujourd'hui / 7 jours / 30 jours, tendance, 7 barres), **À faire maintenant** (colis à préparer et attente du plus ancien, problèmes signalés, nouveaux avis, ruptures de stock, premier produit), « Hailand vous doit », indice de confiance, **six pages rangées**, partage (WhatsApp, TikTok, copie) :
  - **Commandes** (`/vendeur/commandes`) : À préparer / En route / Terminées / Problèmes ; un colis reste « à préparer » tant que le livreur ne l'a pas retiré (QR, étiquette, refus, litige, preuve de remise inchangés). Les colis sont maintenant filtrés **par boutique** (un vendeur qui achète ne voit plus ses propres achats ici).
  - **Produits** (`/vendeur/produits`) : recherche, rayons en puces (+ Rayon, suppression), filtre « Rupture », visibilité d'un geste ; **ajout et modification sur un écran plein** (`/vendeur/produits/nouveau`, `/vendeur/produits/[id]`) : jusqu'à 5 photos, nom (fiche commune proposée si le produit existe), prix, variantes avec stock (− / +), rayon, catégorie, visibilité.
  - **Argent** (`/vendeur/argent`, ancien `/vendeur/solde` redirigé) : ce que Hailand doit, argent bloqué en attente de remise, mouvements, commission.
  - **Statistiques** (`/vendeur/statistiques`, ancien `/vendeur/ventes` redirigé) : ventes par jour (7/30/90 j), sources, **liens suivis** (création par réseau et par page), indice de confiance et conseil pour le faire monter.
  - **Avis** : note, répartition, signalement d'un avis abusif. **Réglages** (`/vendeur/reglages`, accessible aussi avant l'ouverture) : bandeau, logo, nom, présentation, catégorie, WhatsApp, adresse (changer d'adresse referme la vente jusqu'à la nouvelle certification : règle de la base).
- **Compte** : profil (numéro masqué, date d'inscription), « Mes achats » (favoris, adresses), « Application » (notifications, **Aide et contact** `/aide`), console de l'équipe pour les administrateurs, « Se déconnecter », « Supprimer mon compte » (`/compte/supprimer` ; `/parametres` redirige). Sans connexion : « Votre numéro suffit ».
- **Code** : briques d'écran communes `components/Screen.tsx`, composants vendeur `components/seller/*`, boutique du compte `lib/useMyShop.ts`, logique pure `lib/seller.ts` (9 tests). `VariantEditor` retiré (remplacé par l'éditeur de produit). Aucune modification de la base.
- **Vérification** : `npm run lint`, build, `npm test` (**189 tests**), et les 25 écrans ouverts dans Chromium en 390×844 avec une base simulée (sans erreur). ⚠️ Pas encore essayé avec un vrai compte en ligne. 💡 Variable facultative `NEXT_PUBLIC_SUPPORT_WHATSAPP` (numéro de l'assistance) : sans elle, la page d'aide n'affiche pas de bouton WhatsApp. ⚠️ « Versé par Hailand sur votre Orange Money » (écran Argent) décrit le principe : le versement reste fait par l'équipe tant qu'Orange Money n'est pas branché (§19).

## 27. Plan validé : une application par métier (2026-10-14) — 📄 plan de travail, à suivre dans l'ordre

Décisions du fondateur (2026-10-14, toutes les propositions acceptées) :
- **Séparer acheteur et vendeur** : deux applications distinctes. **HailandX** (acheteurs) ne garde que l'achat ; elle propose « Vendre sur HailandX », qui ouvre **HailandX Vendeur** (nouvelle application `apps/vendeur`) où se font la création du compte vendeur, l'ouverture, la certification et toute la gestion de la boutique.
- **Une identité par numéro** (un seul compte Supabase), mais **chaque application ne montre que son rôle** ; un vendeur qui veut acheter utilise HailandX comme tout le monde.
- **Hailand Console** (nouvelle application `apps/console`, adresse à part) remplace la page `/admin` de HailandX et gère tout l'écosystème : vue d'ensemble, **certifications** (demande du vendeur → console : vérifier, confirmer ou refuser → **seules les demandes confirmées remontent à HailandMap**), boutiques, livreurs (dossiers, espèces), litiges et avis signalés, argent (versements, remboursements), comptes et administrateurs, **paramètres sensibles réservés au rôle « fondateur »** (commission, part du livreur, frais) avec confirmation et **journal de chaque action**. Rôles : `fondateur`, `operateur`.
- **Hailand Flotte** : la carte Mapbox (style Hailand, plus aucun lien Google) s'ouvre **en plein écran dès l'acceptation** d'une mission ; fiche à deux arrêts (retrait : boutique, quartier, commune, repère, appel ; dépôt : quartier, commune, code Hailand, précision, étage / porte / repère, appel, espèces) ; **navigation guidée** (consignes en français et voix, distance et heure d'arrivée, recalcul hors route, recentrage, écran allumé) ; « Je suis arrivé » à moins de 50 m (scan du QR, puis photo et code) ; contour du bâtiment de destination ; carte des missions disponibles. ⚠️ Web : pas de guidage écran verrouillé (application native plus tard).
- **Dépôts** : tout reste dans `HailandX_Scorpion` (monorepo : code commun, migrations et tests uniques) ; un projet Vercel par application, reconstruit seulement si son code change. NavigationX et HailandMap restent dans leurs dépôts.
- **Base** : migrations autorisées pour les étapes 2 et 3 (ajouts seulement : rôles, journal, statut des demandes de certification, informations de mission enrichies).

| Étape | Contenu | État |
|---|---|---|
| 0 | Maquettes de la Console et de la navigation Flotte (artefact « HailandX — Maquettes », page v3) | ✅ 2026-10-14 (10 écrans) |
| 1 | `apps/vendeur` (espace vendeur v2 déplacé, barre : Tableau de bord, Commandes, Produits, Plus) ; HailandX à 3 onglets (Accueil, Commandes, Compte) + invitation à vendre ; « Voir ma boutique » ouvre la page publique dans HailandX | ✅ 2026-10-14 (§28) |
| 2 | `apps/console` + rôles, journal, circuit des certifications ; retrait de `/admin` ; HailandMap ne voit que les demandes confirmées | ✅ 2026-10-14 (§29) |
| 3 | Flotte : navigation plein écran | ✅ 2026-10-14 (§30) |
| 4 | Mise en ligne : projets Vercel `hailandx-vendeur` et `hailand-console`, variables, documentation, essais | ✅ technique (2026-10-14) : les 4 projets Vercel (`hailandx-scorpion`, `hailandx-vendeur`, `hailand-console`, `hailandx-flotte`) se déploient depuis `main` et **ne se reconstruisent que si leur dossier, `packages/` ou `package-lock.json` changent** ; ⚠️ essais en ligne par le fondateur |

Une PR par étape, testée, documentée, vérifiée à l'écran.

## 28. Étape 1 : HailandX Vendeur séparé de HailandX (2026-10-14) ✅ code, tests, captures (base simulée) ; ⚠️ à essayer en ligne

- **Nouvelle application `apps/vendeur`** (paquet `@hailandx/vendeur`, `npm run dev:vendeur`, port 3002), projet Vercel **`hailandx-vendeur`** (racine `apps/vendeur`, adresse **https://hailandx-vendeur-gn.vercel.app** — `hailandx-vendeur.vercel.app` était déjà pris ; variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_HAILANDX_URL` ; protection Vercel désactivée pour un accès public ; reconstruit seulement si `apps/vendeur`, `packages/` ou `package-lock.json` changent).
  - Tout l'espace vendeur v2 y est déplacé (§26) avec des adresses courtes : `/` (découverte → ouverture en trois étapes → tableau de bord), `/ouvrir`, `/commandes` (+ `/commandes/etiquette`), `/produits` (+ `/produits/nouveau`, `/produits/[id]`), `/argent`, `/statistiques`, `/avis`, `/reglages`, et nouveau : **`/plus`** (pages rangées + compte du vendeur), `/notifications` (celles de la boutique), `/aide` (aide aux vendeurs), `/connexion`, `/compte/supprimer`.
  - **Barre du bas** : Tableau de bord, Commandes (pastille des colis à préparer), Produits, Plus — **affichée seulement une fois la vente ouverte** ; avant, l'application est un seul parcours (découverte puis « Ouvrir ma boutique »), avec « Mon compte » en haut.
  - Étape 1 de l'ouverture : **repérer son bâtiment avec NavigationX** (même numéro), puis « J'ai repéré mon bâtiment : actualiser ». Le repérage sur la carte de HailandX (« Où livrer ? ») reste réservé aux acheteurs.
  - Les pages publiques restent dans HailandX : « Voir ma boutique », partages et liens suivis pointent vers `NEXT_PUBLIC_HAILANDX_URL` (par défaut https://hailandx-hdxk.vercel.app).
- **HailandX (acheteurs)** : barre à **3 onglets** (Accueil, Commandes, Compte) ; carte « **Vendre sur HailandX** » dans Compte, écran d'ouverture et accueil (boutiques d'exemple) renvoient vers HailandX Vendeur ; **lien vers la console de l'équipe retiré de Compte** (la page `/admin` reste jusqu'à la console, étape 2) ; `/vendeur/*` redirige vers HailandX Vendeur.
- **Notifications séparées** : celles dont le lien commence par `/vendeur` (nouvelle commande, avis, litige côté boutique) ne s'affichent que dans HailandX Vendeur (liens réécrits sans `/vendeur`), les autres seulement dans HailandX ; « Tout marquer lu » ne touche que celles de l'application ouverte. Aucune modification de la base.
- **Code partagé** : nouveau paquet **`packages/kit`** (`@hailandx/kit`) : client de la base, session, images, briques d'écran (`Screen`, `BackHeader`, `ListRow`…), connexion par téléphone (`PhoneLogin`), suppression du compte, notifications et cloche, preuve de remise, fil de litige, adresses des applications (`HAILANDX_URL`, `VENDEUR_URL`, `FLOTTE_URL`, `NAVIGATIONX_URL`). La logique pure (ventes, onglets des colis, étapes de commande) passe dans `packages/commerce` (`dashboard.ts`, 9 tests).
- **Vérification** : `npm run lint` (7 projets), `npm test` (**189 tests**), builds HailandX et HailandX Vendeur, 10 écrans ouverts dans Chromium (390×844, base simulée) sans erreur.

## 29. Étape 2 : Hailand Console (2026-10-14) ✅ code, base, tests, captures (base simulée) ; ⚠️ à essayer en ligne

- **Nouvelle application `apps/console`** (paquet `@hailandx/console`, `npm run dev:console`, port 3003), projet Vercel **`hailand-console`** (racine `apps/console`, adresse **https://hailand-console-gn.vercel.app** — `hailand-console.vercel.app` était déjà pris ; variables publiques Supabase et `NEXT_PUBLIC_HAILANDX_URL` ; reconstruit seulement si `apps/console`, `packages/` ou `package-lock.json` changent ; non indexée par les moteurs de recherche). Mise en page large avec barre latérale (barre défilante en haut sur téléphone), pastilles « à traiter » rafraîchies chaque minute.
  - **Accès** : connexion par le numéro (même compte Hailand) ; la console ne s'ouvre qu'aux comptes `agents.role = 'admin'` actifs (`fn_console_role()` ; sinon écran « Réservé à l'équipe Hailand »). La base refuse de toute façon chaque action à un non-administrateur.
  - **Pages** : Vue d'ensemble (`fn_console_overview` : commandes et ventes du jour, commission, livreurs en service, colis bloqués > 45 min, liste « À traiter », journal récent) ; **Certifications** ; Boutiques (chercher, suspendre / réactiver avec confirmation ; réactivée = « en préparation », le vendeur rouvre lui-même la vente) ; Livreurs (valider, refuser, suspendre, espèces reçues `fn_courier_cash_settle`, alerte au-dessus du plafond) ; Litiges et avis (preuve de remise, fil d'échanges, décision confirmée `fn_resolve_dispute` avec note ; avis masqué ou maintenu `fn_moderate_review`) ; Argent (commission cumulée, séquestre, à verser aux boutiques `fn_shop_payout`, à rembourser `fn_refund_paid`, avec confirmation) ; Comptes et équipe ; Paramètres ; Journal (filtre par catégorie, 500 dernières actions).
- **Rôles** (`agents.console_role`) : **fondateur** (tout, plus commission, part du livreur, mode de paiement et équipe) ou **opérateur** (le quotidien). Les deux comptes du fondateur sont `fondateur`, les trois autres administrateurs `opérateur` (✅ vérifié en base). Seul le fondateur ajoute un membre par son numéro (`fn_console_team_set`, compte déjà créé, numéro guinéen `224` + 9 chiffres), change un rôle ou retire un accès ; il ne peut pas se retirer ses propres droits.
- **Paramètres sensibles** : modification réservée au fondateur, **motif obligatoire**, aperçu « avant → après », confirmation (`fn_console_setting_update` ; bornes 0 à 100 %, mode `simulation` / `orange_money`). Un déclencheur sur `settings` refuse toute autre voie depuis les applications (ni opérateur, ni mise à jour directe sans motif) ; l'éditeur SQL (maintenance) reste possible. Frais de livraison et plafond d'espèces : pas encore réglables dans la console (💡).
- **Journal** (`console_journal`, lecture équipe seulement, **aucune écriture ni suppression depuis les applications**) : rempli par la base elle-même (déclencheurs) — statut d'une boutique ou d'un livreur, espèces reçues, litige tranché (avec la note), avis modéré (avec la note), versement et remboursement, paramètre (avec motif), certification confirmée ou refusée, équipe.
- **Circuit des certifications** : `certification_priorities.status` = `a_verifier` → `transmise` ou `refusee` (+ `console_note`, `decided_by`, `decided_at` ; les demandes existantes sont passées `transmise`). La demande du vendeur (`fn_request_priority_certification`) est désormais **à vérifier** et prévient l'équipe ; si le résident l'a déjà demandée dans NavigationX, elle est directement `transmise` (seule la priorité s'ajoute). Dans la console : fiche (vendeur joignable, adresse, code, quartier, commune, niveau, repère, aperçu de l'emplacement), **quatre vérifications à cocher**, puis « Confirmer et transmettre à HailandMap » (`fn_console_certification_decide` : la déclaration passe `certification_status = 'demandee'`, ce que HailandMap lit déjà — **aucune modification de HailandMap**) ou « Refuser » avec motif envoyé au vendeur. Le vendeur est notifié à chaque étape.
- **HailandX Vendeur** : l'étape 3 « Certification en cours » montre « Demande envoyée → **Vérification par l'équipe Hailand** → Visite de l'agent → Adresse certifiée » ; un refus affiche le motif de la console et permet de redemander.
- **HailandX** : page `/admin` supprimée (la console la remplace).
- **Base** : migration `supabase/migrations/2026-10-20_hailand_console.sql` (ajouts seulement, idempotente) **appliquée en production le 2026-10-14** (`hailand_console`, puis `hailand_console_journal_motif` pour inscrire la note des litiges et avis). ⚠️ La note saisie à la confirmation n'est pas encore lue par HailandMap (elle reste dans la console et le journal).
- **Vérification** : `npm run lint` (8 projets), `npm test` (**202 tests**, dont `console.test.ts` 9 et `apps/console/src/lib/format.test.ts` 4 ; `paiement` et `complements` adaptés au nouveau circuit), builds console et vendeur, 15 écrans ouverts dans Chromium (1280×860 et 390×844, base simulée) sans erreur.

## 30. Étape 3 : Hailand Flotte, navigation plein écran (2026-10-14) ✅ code, base, tests, captures (base et Mapbox simulés) ; ⚠️ à essayer en ligne sur un vrai téléphone

- **Carte des missions disponibles** (livreur « En service ») : carte plein écran, montant de chaque mission posé sur la boutique, mission choisie mise en avant (retrait exact, dépôt **à environ 300 m près** tant qu'elle n'est pas acceptée), bandeau « En service · N missions proches · gains du jour · Arrêter », panneau du bas avec « Accepter la mission ». Hors service : tableau simple sans carte ni partage de position.
- **Dès l'acceptation, la carte de la mission s'ouvre en plein écran** (`/mission/[id]`) :
  - **Aperçu** : itinéraire position → **R** (retrait, trait bleu) → **D** (dépôt, pointillés citron) ; fiche **retrait** (boutique, quartier, commune, code, repère, distance et durée, appel de la boutique — WhatsApp de la boutique, sinon numéro du vendeur) et fiche **dépôt** (quartier, commune, code Hailand, niveau de précision, étage, porte, repère, appel de l'acheteur) ; espèces à encaisser en haut ; « Démarrer la navigation vers le retrait / le dépôt ».
  - **Guidage virage par virage** : carte orientée dans le sens de marche et inclinée, bandeau citron (pictogramme, distance, consigne en français), « Puis : … », temps et distance restants, **heure d'arrivée**, **voix française** (annonces de Mapbox, sinon à 400 m, 150 m et 30 m ; voix coupable, choix mémorisé), **recalcul automatique hors route** (écart > 40 m ou précision du GPS + 15 m, au plus toutes les 8 s), « Recentrer » si le livreur déplace la carte, **écran maintenu allumé** (Screen Wake Lock, redemandé au retour dans l'application). Profil d'itinéraire selon le véhicule (moto et voiture : route ; vélo ; à pied).
  - **Arrivée** : déclenchée à **moins de 50 m** du point ou **dans le contour du bâtiment** (bâtiment certifié par HailandMap, sinon contour repéré à la déclaration), **contour surligné**, carte zoomée sur le bâtiment. Retrait : repère, « Scanner le QR du colis », appeler la boutique ; après le scan, **le guidage repart seul vers le dépôt**. Dépôt : code, niveau, étage / porte / repère, espèces, appel, **remise par photo (bouton « Prendre la photo ») puis code** (inchangé côté base : contrôle de proximité 150 m + précision).
  - **Plus aucun lien Google Maps** (« Ouvrir dans l'application de cartes » supprimé) ; sans jeton ou sans réseau, la carte affiche un message et les adresses et appels restent utilisables.
- **Code** : `apps/flotte/src/lib/nav.ts` (calculs purs : position sur l'itinéraire, prochaine manœuvre, hors route, annonces vocales, arrivée, formats ; **10 tests** dans `nav.test.ts`), `lib/device.ts` (écran allumé, voix, hauteur du panneau), `lib/useGeo.ts` (cap calculé d'après le déplacement quand le GPS n'en donne pas), `components/FlotteMap.tsx` (carte plein cadre : repères, tracés, contours, suivi ou cadrage), `components/Icons.tsx`. L'ancien `GuideMap` est supprimé.
- **Style de carte** : celui de NavigationX (`mapbox://styles/hailand/cmqbiiccq000b01qr7ckjeut1`, modifiable par `NEXT_PUBLIC_MAPBOX_STYLE`) ; si Mapbox le refuse (jeton d'un autre compte), bascule automatique sur un style sombre de Mapbox. ⚠️ Non vérifiable depuis la session (le bac à sable altère les réponses de Mapbox) : à confirmer en ligne.
- **Base** (migration `supabase/migrations/2026-10-21_flotte_navigation.sql`, ajouts seulement, **appliquée en production le 2026-10-14**, vérifiée : contours en `Polygon` SRID 4326) :
  - `fn_mission_detail(p_parcel)` → JSON `{status, fee_gnf, distance_km, cod_amount_gnf, handover_failures, pickup{…}, dropoff{…}}` avec quartier, commune, code, repère, étage, porte, téléphone et **contour** de chaque arrêt ; réservé au livreur attribué (colis accepté ou retiré). `fn_mission_info` reste en place (non utilisée par Flotte).
  - `fn_missions_carte(p_lat, p_lng, p_radius_km)` → JSON des missions proposées dans le rayon (≤ 20 km) : retrait exact, dépôt arrondi à 0,003° (≈ 300 m), quartiers et communes, sans téléphone, code ni étage. `fn_missions_proches` reste en place.
  - Fonctions en JSON : de nouveaux champs pourront s'ajouter sans `DROP`.
- ⚠️ Limites du web : pas de guidage écran verrouillé ni en arrière-plan (application native plus tard) ; la voix dépend des voix françaises installées sur le téléphone.
- **Vérification** : `npm run lint` (8 projets), `npm test` (**218 tests**, dont `supabase/tests/flotte.test.ts` 6 et `nav.test.ts` 10), build de Flotte, 6 écrans ouverts dans Chromium (390×844) avec base, Mapbox et GPS simulés, sans erreur.

## 31. Plan « Compte Hailand unique et passerelles » (2026-10-14) — 📄 validé par le fondateur, à suivre dans l'ordre

**Décisions du fondateur (2026-10-14)** : un **Compte Hailand unique** pour tout l'écosystème (le compte créé dans n'importe quelle application sert partout) ; **numéro de téléphone seul** (plus d'e-mail, Google ni Apple dans NavigationX) ; **l'enregistrement d'un emplacement se fait uniquement dans NavigationX** ; NavigationX propose **« Vendre depuis mon emplacement »** ; **Flotte n'est proposée à personne** (livreurs recrutés et ajoutés par l'équipe) ; les demandes de certification des **résidents** (NavigationX) restent directes vers HailandMap, celles des **vendeurs** passent par la console ; **remise à zéro des comptes** pour reprendre les essais proprement. **Pas de nom de domaine pour l'instant** : solution provisoire de passage de session (voir phase 3) ; quand un domaine sera acheté (ex. `hailand.app` : `carte.`, `vendeur.`, `console.`, `flotte.`), la session sera partagée par cookie de domaine (connecté et déconnecté partout sur l'appareil).

| Phase | Contenu | État |
|---|---|---|
| 1. Comptes propres | Toute lecture « mes données » filtre explicitement le compte (un agent ou un administrateur peut LIRE toutes les déclarations : NavigationX lui montrait les adresses de tout le monde comme les siennes) ; déconnexion réelle (révocation côté serveur, puis appareil vidé : session, adresses, favoris, panier, recherches) ; script de remise à zéro (sauvegarde puis purge) **exécuté par le fondateur** | ✅ fait, script exécuté et vérifié (2026-10-14) |
| 2. Maquettes | Page de connexion commune « Compte Hailand », bandeau « vous venez de… » + bouton de retour, carte « Vendre depuis mon emplacement », écran Flotte « livreur non enregistré » | ✅ validées par le fondateur (2026-10-14) : page « v4 » de l'artefact de maquettes (16 écrans K1–K5, P1–P4, N1–N4, F1–F2) |
| 3. Compte Hailand unique | Module de connexion commun (numéro seul ; après le code : « Ce numéro a déjà un compte Hailand : vous êtes connecté » ou « Compte Hailand créé », sans révéler avant le code si un numéro existe ; nom et prénom demandés une fois ; reconnexion après 30 jours d'inactivité). **Passage de session provisoire** : à chaque redirection, l'application de départ crée un code à usage unique (2 min, lié à l'application d'arrivée) ; l'application d'arrivée l'échange contre une session (fonction serveur) ; hors redirection, connexion normale. Déconnexion = révocation de toutes les sessions du compte | ✅ fait et essayé en réel (2026-10-14) |
| 4. Passerelles NavigationX | Adresse profonde vers le **parcours d'enregistrement** de NavigationX avec adresse de retour (liste blanche des applications Hailand) ; à la fin (niveau 1, 2 ou 3) bouton « Revenir à … pour continuer », **seulement après une redirection** ; retour sur la page d'origine avec l'adresse choisie (le panier reste sur l'appareil) ; HailandX (adresse de livraison, commande) et HailandX Vendeur (étape 1) redirigent vers NavigationX ; **l'enregistrement d'adresse de HailandX est retiré** ; « Vendre depuis mon emplacement » ouvre HailandX Vendeur sur la création de boutique, adresse choisie (aucune boutique créée d'office) | ✅ fait ; essai réel (2026-10-14) : Vendeur → enregistrement NavigationX ouvert directement, connecté, bandeau « Demandé par » ; retour non essayé en réel (GPS) |
| 5. Flotte et flux | Liens vers Flotte retirés (accueil de HailandX), candidature publique remplacée par « numéro non enregistré comme livreur », livreurs ajoutés par la console ; **notification « adresse certifiée, vous pouvez ouvrir la vente »** quand HailandMap certifie (absente aujourd'hui) ; tests SQL de chaque aller-retour ; liste d'essais en ligne | ✅ code, tests, captures (base simulée) ; migration appliquée en production (2026-10-14, accord du fondateur) |

**Phase 1 — fait (2026-10-14)** :
- NavigationX (dépôt Lynx) : relecture des adresses filtrée sur le compte (`syncDeclarations`), déconnexion réelle (`signOut` global puis local hors ligne, toutes les données `hx.u.<compte>.*` et la session effacées de l'appareil). Détail : `NAVIGATIONX.md` §9.
- HailandX, HailandX Vendeur, Console : déconnexion commune `signOutHailand` (`packages/kit/src/account.ts`) : révocation de toutes les sessions du compte, puis effacement du panier (`hx.cart`), des recherches récentes (`hx.recherches`) et de la session ; rechargement complet de la page. Flotte : `signOutFlotte`. Les préférences de l'appareil (écran d'ouverture vu, voix, source d'arrivée) restent.
- Audit des lectures : HailandX, HailandX Vendeur et Flotte filtraient déjà explicitement sur le compte ; notifications protégées par la base (`user_id = auth.uid()`).
- **Script de remise à zéro** `supabase/maintenance/2026-10-22_reinitialisation_comptes.sql` (une transaction) : sauvegarde dans le schéma `sauvegarde_20261022`, vidage de toutes les données d'usage (adresses, boutiques, produits, commandes, colis, paiements, avis, litiges, livreurs, notifications, journal, demandes de certification), réclamations de bâtiments retirées, **comptes supprimés sauf ceux de `agents`** (auteurs du cadastre), toutes les sessions fermées ; refuse une seconde exécution. Vérifié sur le banc (`supabase/tests/reinitialisation.test.ts`). ⏳ **À exécuter par le fondateur** dans l'éditeur SQL, puis vider à la main les fichiers des espaces de stockage `hx-media` et `hx-preuves`.
- ⚠️ Pour créer de nouveaux comptes avec un vrai numéro, un fournisseur de SMS est nécessaire ; en attendant, seuls les numéros de test configurés dans Supabase reçoivent un code.

**Phase 3 — fait (2026-10-14)** ✅ code, tests, captures (base simulée), base et fonction serveur en ligne ; ⏳ essai réel après déploiement des applications :
- **Connexion « Compte Hailand » commune** (`packages/kit/src/PhoneLogin.tsx`, maquettes v4 K1–K4), utilisée par HailandX, HailandX Vendeur, la Console et **Flotte** (thème de nuit ; Flotte utilise désormais le kit, son ancienne page de connexion est retirée) : numéro seul → code SMS → **« Ce numéro a déjà un compte Hailand »** (nom, numéro masqué `+224 622 •• •• 33`, application d'origine, « Déjà sur ce compte » : adresses et meilleur niveau, boutique, livreur, équipe — `fn_compte_resume()`) ou **« Compte Hailand créé »** (prénom et nom demandés **une seule fois** pour toutes les applications : `user_metadata.full_name`, `first_name`, `last_name`, `origine`). Un compte est « nouveau » s'il a été créé il y a moins de 10 minutes. On ne dit qu'après le code si un numéro est inscrit.
- **Passage de session** (provisoire, sans domaine) : `LienHailand` (kit) crée un code à usage unique `fn_passage_creer(cible)` (2 min, lié à l'application d'arrivée, au plus 10 en attente par compte, empreinte SHA-256 seulement en base, table `account_passages` sans aucun accès depuis les applications) et l'ajoute à l'adresse (`?passage=…`). À l'arrivée, `sessionPrete()` (lu par `useSession` avant toute lecture de session) retire le code de l'adresse, l'envoie à la **fonction serveur `passage`** (`supabase/functions/passage`, Edge Function, clé de service) qui le consomme (`fn_passage_consommer`, réservée à la clé de service) et renvoie l'empreinte d'un lien de connexion administrateur (jamais envoyé) ; l'application l'échange elle-même contre une **session neuve et indépendante** (`verifyOtp({ token_hash, type: 'magiclink' })`). Aucun jeton de session ne circule dans une adresse ; chaque application garde sa propre session. Les comptes n'ayant qu'un téléphone reçoivent une fois une **adresse e-mail technique non distribuable** `<id>@compte.hailand.invalid` (domaine réservé, jamais affichée : NavigationX la masque). Échec (code expiré ou déjà utilisé) : la page de connexion explique « Le passage depuis l'autre application a expiré… c'est le même compte ».
- Liens passés en `LienHailand` : HailandX → Vendeur (accueil, compte, écran d'ouverture) ; Vendeur → NavigationX (étape 1 « Repérer mon bâtiment », « Modifier » l'adresse, réglages) ; Vendeur → HailandX (« Voir ma boutique »). Le parcours complet avec bouton de retour est la phase 4.
- **Reconnexion après 30 jours d'inactivité** sur l'appareil (`controlerInactivite`, clé d'appareil `hx.activite`) : session de l'appareil fermée, panier et recherches effacés.
- Chaque application déclare son nom dans `next.config.ts` (`NEXT_PUBLIC_HAILAND_APP`).
- Migration **`supabase/migrations/2026-10-23_compte_hailand.sql`** (✅ **appliquée en production le 2026-10-14**, accord du fondateur, en deux migrations `compte_hailand_table` et `compte_hailand_fonctions` ; droits vérifiés : table illisible par `anon`/`authenticated`, `fn_passage_consommer` réservée à `service_role`) : `account_passages`, `fn_passage_creer`, `fn_passage_consommer`, `fn_compte_resume`. Tests : `supabase/tests/compte.test.ts` (8), `packages/kit/src/passage.test.ts` (4), `compte.test.ts` (4) — **238 tests** au total.
- ✅ **Fonction serveur `passage` déployée** le 2026-10-14 (accord du fondateur, `verify_jwt = false`) ; vérifiée : code inconnu → 410 « expire », code mal formé → 400. Le ménage automatique des codes usés a été retiré (le connecteur bloque les migrations qui contiennent une suppression) : seuls les codes encore valides comptent dans la limite de 10. ⏳ Reste : essai réel d'un aller-retour avec le numéro de test une fois les PR fusionnées et déployées ; ⚠️ à vérifier à ce moment-là que Supabase accepte l'adresse technique en `.invalid` (sinon la fonction répond « preparation »).
- ✅ **Essai réel (2026-10-14, applications déployées, numéro de test = compte d'équipe du fondateur)** : connexion à HailandX Vendeur → écran « Ce numéro a déjà un compte Hailand » (« Équipe Hailand ») → lien vers NavigationX → NavigationX ouvert **connecté au même compte**, sans code, adresse nettoyée ; la fonction serveur a répondu 200, l'adresse technique `.invalid` a été acceptée par Supabase, le code a été consommé une seule fois.

**Phase 4 — fait (2026-10-14)** ✅ code, tests, captures (base simulée) ; ⏳ essai réel après déploiement :
- **Adresse profonde** vers le parcours d'enregistrement de NavigationX : `lienEnregistrement(retour, chemin)` (kit) → `<NavigationX>/?enregistrer=1&retour=<vendeur|hailandx>&chemin=<page>`. Retour limité aux applications Hailand connues et à un chemin interne (jamais une adresse libre).
- **HailandX Vendeur** (maquettes P1, P4, N3) : étape 1 « Enregistrer mon emplacement avec NavigationX » (« À la fin, un bouton vous ramène ici ») ; au retour `/ouvrir?adresse=<id>` → bandeau « Adresse reçue de NavigationX : vous continuez ici », adresse présélectionnée (seulement si elle appartient au compte) ; depuis NavigationX (« Vendre depuis mon emplacement ») `/ouvrir?adresse=<id>&depuis=navigationx` → « Point de vente choisi dans NavigationX ». **Aucune boutique créée d'office** : la personne choisit encore le nom. « Changer » l'adresse et les réglages (« Vous déménagez ? ») passent par le même parcours.
- **HailandX : l'enregistrement d'adresse est retiré** (carte Scorpion, `AddressPicker`, `lib/address.ts` supprimés). « Où livrer ? » (`/adresse`) liste les adresses et envoie vers NavigationX ; la commande sans adresse affiche « Enregistrer mon adresse avec NavigationX — votre panier vous attend ici » (maquette N4) et revient sur `/commande?adresse=<id>` avec l'adresse présélectionnée. La commande ne propose plus que les adresses actives (`status = 'active'`).
- Côté NavigationX : voir `NAVIGATIONX.md` §9 (parcours ouvert directement, bandeau « Demandé par … », bouton « Revenir à … » seulement après une redirection, « Vendre depuis mon emplacement »).

**Seconde remise à zéro des comptes (2026-10-16)** — demandée par le fondateur pour retester proprement : `supabase/maintenance/2026-10-16_reinitialisation_comptes_2.sql` (même principe que la première, plus `courier_invitations` et `account_passages` ; sauvegarde dans le schéma `sauvegarde_20261016` ; les comptes de la table `agents` — les 5 comptes de l'équipe — sont gardés avec leur rôle, leurs données d'usage et leurs sessions sont effacées). Testé sur le banc (`supabase/tests/reinitialisation2.test.ts`). ⏳ À exécuter par le fondateur dans l'éditeur SQL (le connecteur expire sur DELETE).
⚠️ Constat du 2026-10-16 : après la limite Vercel du 2026-10-14, **Console, Flotte et l'accueil de HailandX n'ont pas encore reçu la phase 5** (le code en ligne date de la phase 4) ; à redéployer depuis Vercel (le tableau de bord, car l'accès Vercel de la session est refusé).

**Phase 5 — fait (2026-10-14)** ✅ code, tests, captures (base simulée) ; ✅ migration appliquée en production (accord du fondateur, en deux migrations `flotte_recrutement_table` et `flotte_recrutement_fonctions` ; droits vérifiés : invitations sans écriture directe, fonctions fermées aux visiteurs, déclencheur actif, candidature publique fermée) :
- **Flotte n'est proposée à personne** : lien « Je veux livrer avec la Flotte Hailand » retiré de l'écran d'ouverture de HailandX ; la candidature de Flotte est remplacée par l'écran **« Ce numéro n'est pas enregistré comme livreur Hailand »** (maquette F1 : numéro masqué, « Vérifier à nouveau », « Changer de numéro ») ; la base ferme la candidature publique (`alter policy couriers_apply … with check (false)`).
- **Hailand Console → Livreurs → « Ajouter un livreur »** (maquette F2 : numéro, nom, moto / vélo / voiture / à pied) : `fn_console_courier_add` (équipe seulement, journal) — numéro qui a déjà un Compte Hailand → livreur **validé** tout de suite ; sinon **invitation en attente** (`courier_invitations`, lisible par l'équipe seulement), onglet « Invitations en attente ». À la première connexion à Flotte, `fn_flotte_rejoindre()` transforme l'invitation en livreur validé. Les anciennes candidatures restent traitables (onglet affiché seulement s'il en reste).
- **Notification « Adresse certifiée : vous pouvez ouvrir la vente »** : déclencheur `declarations_certified_notify` (après mise à jour de `certified_building_id`, c'est-à-dire quand HailandMap certifie le bâtiment et que la base rattache l'adresse) → notification au propriétaire d'une boutique « en préparation » ou « bientôt » à cette adresse, lien `/vendeur/ouvrir` (centre de notifications de HailandX Vendeur, icône ✅). Les adresses de résidents restent signalées par NavigationX (bandeau de certification existant).
- Migration **`supabase/migrations/2026-10-24_flotte_recrutement_certification.sql`** (✅ appliquée) ; tests `supabase/tests/recrutement.test.ts` (6) ; l'ancien test de candidature adapté. **245 tests**.

## 32. Plan « Flotte Nuit, écrans d'ouverture, logos » (2026-10-20) — 📄 validé par le fondateur, à suivre dans l'ordre

**Constat (2026-10-20, capture du fondateur)** : la carte de Flotte s'affiche (jeton Mapbox corrigé sur Vercel : un caractère faux), mais en grand écran la carte occupe toute la largeur et les panneaux restent une colonne de téléphone collée au centre ; le style de carte est le style clair de NavigationX, sans lien avec l'interface nuit de Flotte. HailandX, HailandX Vendeur, Flotte et Console n'ont **pas d'écran d'ouverture** (HailandX a seulement `/bienvenue`, accueil de première visite) ni d'**icône d'application** (onglet, écran d'accueil du téléphone).

**Décisions du fondateur (2026-10-20)** :
- Logos **gardés tels quels** : HailandMap (carré bleu, maison), HailandX (mot « HailandX », X bleu ; pastille noire), Hailand Console (carré noir, bouclier vert citron), NavigationX (flèche). **À créer** : **Hailand Flotte** et **HailandX Vendeur** (aujourd'hui « HailandX » + étiquette « Vendeur »), dans la même famille.
- **Flotte n'est jamais utilisée sur ordinateur pour une mission** : la version PC doit seulement rester propre si on l'ouvre (panneau à gauche, carte à droite), sans fonction propre.
- **Carte sombre « Hailand Nuit » pour Flotte seulement** (le suivi de colis de HailandX reste en thème clair).

**Plan (chaque étape validée avant la suivante)** :
0. **Maquettes** (artefact « HailandX — Maquettes », page v5) : famille de logos (Flotte, Vendeur ajoutés), écrans d'ouverture des 4 applications, style de carte Hailand Nuit (fond bleu nuit, itinéraire vert citron, trajet parcouru éteint, bâtiments en relief), tous les écrans de Flotte en téléphone et en PC, bandeau de navigation.
1. **Logos et ouverture** : composant d'ouverture commun dans `packages/kit` (logo animé ≈ 1,2 s, une fois par ouverture, animation réduite si demandée, chargement en parallèle) ; icônes d'onglet et d'installation (manifeste, iPhone) dans HailandX, Vendeur, Flotte, Console.
2. **Carte Hailand Nuit** : style sombre de Mapbox recoloré dans le code au chargement (versionné, sans dépendre de Mapbox Studio).
3. **Flotte, parcours et mise en page** : Ouverture → Connexion → (numéro non enregistré) → **Hors service** (gains du jour, espèces à reverser, « Passer en service ») → **En service** (missions proches sur la carte) → **Proposition** (retrait, dépôt, distance, gain) → **Vers le retrait** (navigation) → scan du QR → **Vers le client** → code + photo → **Récapitulatif** → En service ; menu (historique, gains, profil, aide, déconnexion). Téléphone : panneau du bas ; PC : panneau à gauche.
4. **Navigation avancée** : bandeau de manœuvre (flèche, distance, rue, virage suivant), caméra inclinée qui suit le sens de marche avec zoom selon la vitesse, curseur animé, heure d'arrivée, minutes et km restants, trajet parcouru éteint, Recentrer, son, vue d'ensemble.
5. **Fin** : tests, captures, documentation, PR, déploiement ; essai sur un vrai téléphone.

Aucun changement de base de données prévu.

**Étape 0 ✅ (2026-10-20)** : maquettes page v5 validées. Choix du fondateur : **Flotte = A** (carré bleu nuit, itinéraire vert du point bleu à la flèche) ; **Vendeur = devanture à auvent du A sur le fond sombre du B** (sans « X » bleu) ; tout le reste validé tel quel.

**Étape 1 ✅ code (2026-10-20)** — logos, icônes, écrans d'ouverture :
- **Source unique des logos** : `packages/ui/src/marks.ts` (`markSvg(app)`, tracés seulement, `APP_INFO` : nom et phrase). Composant `AppMark` (en-têtes, connexion) ; logo Vendeur devant « HailandX Vendeur », logo Flotte dans la connexion et l'en-tête, logo Console sur la connexion (inchangé visuellement). Flotte a un liseré `#2a3150` pour rester visible sur fond nuit.
- **Icônes** générées par `node --experimental-strip-types scripts/icones.ts` (sharp) : `src/app/icon.svg` (onglet), `src/app/apple-icon.png` (iPhone 180 px), `public/icone-192.png`, `icone-512.png`, `icone-maskable-512.png` (installation) dans les 4 applications ; manifestes complétés ; **la Console a désormais un manifeste**. Test `packages/ui/src/marks.test.ts` : les icônes servies doivent correspondre à la source (sinon relancer le script).
- **Écran d'ouverture** `Ouverture` (`packages/ui`) placé en tête de `<body>` des 4 applications : rendu serveur, animation CSS seulement (`tokens.css` : ≈ 1,35 s, entrée du logo, barre de chargement), aucune attente ajoutée, clics jamais bloqués ; **une fois par onglet** (marque `hx.ouverture.<app>` en `sessionStorage`, classe `hx-sans-ouverture` posée avant React, d'où `suppressHydrationWarning` sur `<html>`) ; animation raccourcie si l'appareil demande moins de mouvement. Vérifié en local (Flotte, Vendeur) : visible au chargement, effacé après 1,35 s, absent au rechargement, 0 erreur. HailandX garde en plus `/bienvenue` (première visite).

**Étape 2 ✅ code (2026-10-20)** — carte « Hailand Nuit » dans Flotte :
- Style écrit dans le code : `apps/flotte/src/lib/hailandNuit.ts` (`HAILAND_NUIT`, palette `NUIT`), sur les données **Mapbox Streets v8** (`mapbox://mapbox.mapbox-streets-v8`) : mer `#070b16`, sol `#10172a`, verdure, rues / secondaires / grands axes de plus en plus clairs, noms des grands axes et des quartiers en capitales, quelques lieux utiles au zoom fort, **bâtiments en relief sombre** à partir du zoom 15 (visibles en navigation inclinée). Aucun réglage Mapbox Studio ; la variable `NEXT_PUBLIC_MAPBOX_STYLE` n'est plus lue par Flotte. Repli inchangé sur `mapbox/dark-v11` si la carte ne se charge pas.
- Tracés (`FlotteMap`) : nouvelle option `glow` (halo flou sous le trait) ; en aperçu de mission, l'étape à faire maintenant est verte et lumineuse, la suivante en pointillé vert ; **en navigation, le trajet déjà parcouru s'éteint** (`splitAt` dans `lib/nav.ts`, gris `#3a4462`) et le reste est vert lumineux ; contour du bâtiment cible en vert à 16 %.
- Vérifié : rendu réel avec les tuiles Mapbox (Coléah, aperçu et navigation inclinée) dans un navigateur de test ; 2 tests ajoutés (`splitAt`) ; build de Flotte OK.

**Étape 3 ✅ code (2026-10-20)** — parcours et mise en page de Flotte (maquettes v5 F1–F8, P) :
- **Cadre commun** `apps/flotte/src/components/Frame.tsx` : téléphone = carte plein écran, barre flottante en haut, panneau qui monte du bas ; **ordinateur (≥ 1024 px) = panneau fixe de 420 px à gauche, carte à droite** (`useWide` adapte le cadrage). Boutons, cartes et avertissements communs (`CTA`, `WARN`, `StopBadge`, `Stat`).
- **Accueil** (`app/page.tsx`) : **hors service** (F1 : gagné aujourd'hui, livraisons, distance, espèces à reverser, plafond, « Passer en service » ; carte assombrie, aucune position demandée) → **en service** (F2 : capsule « En service · n missions · gains », bouton Pause, missions proches en cartes, prix sur la carte) → **mission proposée** (F3 : gain, distance, retrait → dépôt, niveau de l'adresse, espèces à encaisser, « Accepter la mission » ; la mission ouverte reste celle choisie, retour à la liste si elle disparaît) ; **menu** (F8 : nom, moyen de transport, Mes livraisons, Espèces à reverser, Aide, Se déconnecter).
- **Mission** (`app/mission/[id]`) : même cadre ; **retrait** (F5 : « Chez … », repère, scan du QR, appel) ; **remise** (F6 : 1. code, 2. photo, 3. espèces ; bouton qui dit ce qui manque) ; **livraison terminée** (F7 : gain, espèces encaissées, total du jour). Guidage inchangé (étape 4).
- **Nouvelles pages** : `/livraisons` (gains du jour et des 7 jours, espèces à reverser et plafond, historique par jour) et `/aide` (client absent, code, QR, adresse imprécise, espèces, GPS).
- Aucune modification de la base : lectures déjà permises (`parcels` du livreur, `couriers`).
- Vérifié : captures téléphone et ordinateur (base et GPS simulés, vraies tuiles Mapbox) des 11 écrans, 0 erreur ; lint, 257 tests, build de Flotte OK.

**Étape 4 ✅ code (2026-10-20)** — navigation avancée (maquette v5 F4) :
- **Bandeau de manœuvre** : pictogramme sur carré vert, distance en grand, consigne de Mapbox (+ nom de la rue si absent de la consigne, `Progress.nextName`), rangée « Puis » avec le virage suivant ; « Nouvel itinéraire… » pendant un recalcul.
- **Caméra** : inclinée à 60°, orientée dans le sens de marche, **zoom selon la vitesse** (`followZoom` : 17,8 à l'arrêt ou au ralenti → 16,2 à 50 km/h et plus), glissement linéaire d'1 s entre deux points GPS.
- **Curseur du livreur** : flèche bleue bordée de blanc avec halo, posée sur la carte et tournée par Mapbox selon le cap (point bleu si le cap est inconnu), **déplacement animé** (≈ 0,9 s) entre deux positions.
- **Commandes** : voix, **vue d'ensemble** du trajet restant, Recentrer ; **compteur de vitesse** (km/h, masqué si le GPS ne donne pas la vitesse) ; barre du bas avec **barre de progression** (`Progress.fraction`), minutes et distance restantes, heure d'arrivée, « Étape 1 sur 2 : retrait chez … » / « Étape 2 sur 2 : dépôt … », bouton d'arrêt. Sur ordinateur, le panneau de gauche rappelle la mission.
- Vérifié : captures (itinéraire simulé, vraies tuiles Mapbox) téléphone, vue d'ensemble et ordinateur ; 3 tests ajoutés (`followZoom`, `speedKmh`, `nextName`/`fraction`) ; lint, 260 tests, build de Flotte OK. ⚠️ À essayer **sur un vrai téléphone en roulant** (cap, vitesse, voix, écran allumé).

**Étape 5 (fin)** : documentation à jour ; reste l'essai réel sur téléphone par le fondateur, puis les retouches qu'il demandera.

**Retour d'essai réel du fondateur (2026-10-21)** et corrections :
1. **« Reversez vos espèces » alors qu'il n'y avait rien à reverser** : la commande était payable à la livraison pour **865 500 GNF**, au-delà du plafond par défaut de **500 000 GNF** ; le message était trompeur. ✅ Message exact (montant à encaisser, plafond, déjà en main), avertissement **avant** d'accepter dans Flotte (bouton désactivé), et **plafond réglable par le fondateur dans Hailand Console** (Livreurs → Plafond d'espèces → Modifier, motif obligatoire, journalisé : `fn_console_courier_cash_limit`). ⚠️ Décision à prendre : plafond par défaut (500 000 GNF) trop bas pour des commandes de cette taille ?
2. **Itinéraire en ligne droite** sur la mission proposée : ✅ itinéraire Mapbox par les routes (position → retrait en pointillé ambre, retrait → dépôt en vert lumineux), distance et durée réelles.
3. **Point de dépôt décalé** : la carte des missions **arrondissait le dépôt à ≈ 300 m** (règle de confidentialité d'avant l'acceptation). ✅ **Décision du fondateur : plus d'arrondi** — retrait et dépôt sont le **bâtiment certifié lui-même** (`fn_declaration_point` : point intérieur au contour certifié, sinon point d'ancrage, sinon GPS), avant comme après l'acceptation. Restent cachés avant l'acceptation : téléphone, code Hailand, étage, porte, repère. Vérifié en base : les deux adresses de l'essai (niveau 3) ont leur point à 0 m de leur bâtiment certifié.
4. **Bâtiments surlignés** : ✅ **retrait en ambre `#ffb547`**, **dépôt en vert citron `#c8f25a`** (couleurs reprises par les repères R et D) ; l'arrêt vers lequel le livreur va maintenant est plus marqué (halo, remplissage plus dense, volume plus haut en navigation inclinée), l'autre reste visible plus discrètement ; après le retrait, seul le dépôt reste surligné. Contours renvoyés par `fn_missions_carte` (`from_outline`, `to_outline`) et `fn_mission_detail` (`fn_declaration_outline` : bâtiment certifié, sinon contour repéré).
5. **Mission non remontée au livreur (2026-10-21, second essai)** : la commande « Djigo Shop » (`mission_proposee`) était bien proposée par la base, mais seulement à moins de **8 km** de la boutique (rayon demandé par Flotte) ; et **la position du livreur n'était jamais envoyée au serveur** : `void sb.rpc('fn_courier_ping', …)` sans `.then()` — une requête Supabase n'est envoyée que lorsqu'on l'attend (journaux : des centaines d'appels à `fn_missions_carte`, aucun à `fn_courier_ping` ; `couriers.last_seen_at` toujours vide). ✅ Envoi corrigé (Flotte, accueil et mission ; la Console voit désormais qui est en service) ; rayon porté à **20 km** (plafond du serveur) ; garde-fou `apps/flotte/src/lib/requetes.test.ts` (aucune requête lancée sans être attendue).
- Migration **`supabase/migrations/2026-10-25_flotte_batiments_exacts.sql`** (remplacements de fonctions + 4 fonctions ajoutées, aucune donnée modifiée) — ✅ **appliquée en production le 2026-10-21** (accord du fondateur ; vérifié sur la mission en attente : retrait et dépôt à 0 m de leurs bâtiments certifiés, deux contours renvoyés). Tests `flotte.test.ts` (8) ; 262 tests au total.

## 33. Fiche produit détaillée (2026-10-22) ✅ code, tests, migration appliquée ; ⚠️ à essayer en ligne

**Demande du fondateur** : la page d'un produit n'avait que la grande photo et le bouton d'achat ; il faut « toutes les infos essentielles à connaître pour chaque type et catégorie de produit », comme les meilleures plateformes (Amazon, Shopify).

- **Fiche type par catégorie** (`packages/commerce/src/fiche.ts`, testée) : pour chacune des 10 catégories (mode, beauté, téléphones, électronique, maison, alimentation, enfants, santé, auto-moto, autres), la liste des caractéristiques utiles (ex. téléphones : marque, modèle, stockage, mémoire vive, écran en pouces, batterie en mAh, appareil photo, réseau, double SIM, couleur, garantie, contenu de la boîte ; mode : marque, type d’article, pour qui, matière, coupe / taille, longueur, couleur, entretien, origine ; alimentation : produit, marque, poids ou volume net, origine, ingrédients, conservation, allergènes ; santé : utilisation et précautions…). Types de champ : texte, choix (liste proposée + saisie libre), nombre avec unité, oui/non, texte long. `cleanAttributes` ne garde que les clés de la fiche, normalise nombres et oui/non, retire les vides, limite les points forts à 5.
- **Page produit HailandX** (`/p/[slug]`) dans l'ordre : galerie à glisser (compteur, vignettes) → marque, nom, prix → badges (état neuf/occasion, stock « Plus que N en stock » à 5 ou moins, catégorie, boutique) → **« En bref »** (4 caractéristiques clés) → **Points forts** → **Description** (« Lire la suite ») → **Caractéristiques** (tableau) → **Le mot du vendeur** (propre à l'offre) → **Livraison, paiement et garanties** (livraison Flotte à l'adresse certifiée, paiement à la remise ou Orange Money en séquestre, code de remise, 72 h pour signaler un problème) → **carte du vendeur** (indice de confiance, note, ventes) → autres vendeurs, autres produits. Une fiche encore vide affiche un avis neutre au lieu d'un trou. Le début de la description sert aussi d'aperçu sur les réseaux sociaux.
- **HailandX Vendeur** (éditeur de produit) : état (neuf / occasion), **fiche détaillée** (description ≤ 4 000 caractères, 3 à 5 points forts, caractéristiques de la catégorie) avec un **indicateur « Complète à N % »** (photos, description, points forts, caractéristiques), et **« Le mot du vendeur »** (`offers.description`). Règle de la fiche commune (§ « plusieurs vendeurs, même produit ») : **seul le créateur de la fiche (ou l'équipe) la modifie** ; un vendeur qui ajoute son offre à une fiche existante la voit en lecture seule et écrit dans son mot du vendeur.
- **Base** : migration `supabase/migrations/2026-10-26_hailandx_fiche_produit.sql` (ajouts seulement) — limites de taille (`catalog_products.description` ≤ 4 000, `attributes` objet ≤ 16 Ko, `offers.description` ≤ 1 000) et `fn_product_update_details` (créateur ou équipe). Tests `supabase/tests/fiche.test.ts`. ✅ **Appliquée en production le 2026-10-22** avec l'accord du fondateur (données vérifiées avant : aucune hors limite ; après : 3 contraintes présentes, fonction réservée aux comptes connectés, refus vérifié pour un vendeur qui n'a pas créé la fiche, dans une transaction annulée).
- 💡 Ensuite : filtres de recherche par caractéristique (marque, stockage…), questions-réponses des acheteurs sur la fiche, fusion de fiches en double par l'équipe.

## 34. Tous les produits en ligne, par catégorie, et catalogue de démonstration (2026-10-22) ✅ code, tests, données ; ⚠️ à essayer en ligne

**Décision du fondateur** (2026-10-22) : l'ancienne règle « un échantillon par catégorie et par vendeur » (§3.2) n'est pas la bonne. Comme les grandes applications de vente, **tous les produits sont en ligne, rangés par catégorie** ; le nom de la boutique figure sur chaque produit ; en bas d'un produit, on **recommande des produits de même catégorie et de même nature**.

- **Accueil HailandX** (`apps/hailandx/src/app/page.tsx`) :
  - « Tout » : **une rangée par catégorie** (la plus fournie d'abord), 12 produits à faire glisser, avec « Voir tout (N) » ;
  - une catégorie choisie : **tous ses produits en grille**, avec un tri **Pertinence / Prix croissant / Prix décroissant** ; les cartes s'ajoutent au fil du défilement (sans bouton, `components/ProductGrid.tsx`) ;
  - ordre de pertinence inchangé : score du produit, indice de confiance, coup de pouce aux nouvelles boutiques, proximité, boutiques intercalées, rotation horaire (`buildFeed(…, { perGroup: Infinity })`, `packages/commerce/src/feed.ts`).
- **Page produit** : **« Produits similaires »** (`similarProducts`, testé) — même catégorie, toutes boutiques ; d'abord même type d'article, même marque, gamme de prix voisine, puis confiance de la boutique ; lien « Tout <catégorie> ». « Aussi chez <boutique> » reste en dessous (10 produits).
- **Photos par adresse web** : `mediaUrl` rend telle quelle une adresse `https://…` (sinon chemin du stockage `hx-media`).
- **Catalogue de démonstration** (demande du fondateur, accord explicite pour ces écritures) : **50 produits dans Djigo Shop**, 10 catégories, fiches complètes à 100 % (sauf 1), photos de `cdn.dummyjson.com` et de Wikimedia Commons, adresses web en **`demo-…`**. Détail, crédits des photos et requête de retrait : `supabase/maintenance/2026-10-22_catalogue_demo_djigo.md`. ⚠️ À retirer (ou remplacer par de vraies photos) avant l'ouverture au public.
- Essai d'envoi des photos dans le stockage par une fonction temporaire (`demo-photos`, clé de service) **refusé par le garde-fou de sécurité de la session** ; la fonction a été neutralisée (répond 410) — ⚠️ **à supprimer par le fondateur** dans Supabase → Edge Functions.
- 💡 Ensuite : page catégorie dédiée avec filtres (marque, prix, état), « Vus récemment », « Souvent achetés ensemble » quand il y aura des commandes.

## 35. Filtres, « Vus récemment », « Souvent achetés ensemble », questions-réponses (2026-10-22) ✅ code, tests, migration appliquée ; ⚠️ à essayer en ligne

Les 4 suggestions validées par le fondateur après §34.

1. **Filtres d'une catégorie** (accueil, catégorie choisie) : **marque** (liste des marques présentes), **prix minimum et maximum** (GNF), **état** (neuf / occasion). Lus dans l'adresse (`?cat=…&marque=…&min=…&max=…&etat=…`) : une recherche filtrée se partage. Combinables avec le tri. `parseFilters`, `matchesFilters`, `brandsOf` (`packages/commerce/src/fiche.ts`, testés).
2. **« Vus récemment »** : rangée en haut de l'accueil (« Tout »), 20 produits au plus, le dernier vu en premier, bouton « Effacer ». **Gardé sur le téléphone seulement** (stockage du navigateur), jamais envoyé au serveur ; un produit retiré de la vente disparaît de la rangée (`components/RecentlyViewed.tsx`).
3. **« Souvent achetés ensemble »** (page produit, au-dessus de « Produits similaires ») : produits commandés avec celui-ci, les plus fréquents d'abord (« Pris ensemble N fois »). Fonction `fn_bought_together` : uniquement des **nombres agrégés**, et **seulement à partir de 2 commandes distinctes** (aucune commande isolée ne peut être devinée) ; colis annulés exclus. Vide tant qu'il n'y a pas de vraies commandes.
4. **Questions-réponses** :
   - **HailandX** (page produit, avant « Livraison, paiement et garanties ») : questions avec réponse d'abord (4, puis « Voir toutes les questions »), questions en attente ; bouton « Poser une question au vendeur » (connexion requise, 5 questions par jour ; la question est publique **sans le nom ni le numéro** de son auteur).
   - **HailandX Vendeur** : Plus → **Questions des clients** (`/questions`) : questions sur les produits que vend la boutique, sans réponse d'abord ; « Répondre » / « Modifier ma réponse ». Une seule boutique répond à une question (la première) ; les autres boutiques du même produit voient sa réponse.
   - **Notifications** : la boutique est prévenue d'une nouvelle question (❓, lien `/vendeur/questions`), l'acheteur de la réponse (💬, lien vers le produit).
   - **Hailand Console** → **Litiges, avis, questions** : les 50 dernières questions, **Masquer / Rétablir** avec motif (inscrit au journal : « Question masquée sur une fiche produit »).
- **Base** : migration `supabase/migrations/2026-10-27_hailandx_questions_achats.sql` — table `product_questions` (lecture publique sans l'auteur, écriture par fonctions seulement), `fn_ask_question`, `fn_answer_question`, `fn_shop_questions`, `fn_moderate_question`, `fn_bought_together`. Tests `supabase/tests/questions.test.ts` (9). Les scripts de remise à zéro des comptes (`supabase/maintenance/2026-10-16_…_2.sql`, `2026-10-22_….sql`) sauvegardent et vident aussi cette table si elle existe. ✅ **Appliquée en production le 2026-10-22 par le fondateur** (éditeur SQL de Supabase : l'outil de migration du connecteur avait expiré deux fois sans rien écrire). Vérifié ensuite : table et sécurité par ligne en place, 2 règles de lecture, 5 fonctions (seule `fn_bought_together` ouverte aux visiteurs), auteur des questions illisible, aucune écriture directe ; essai dans une transaction annulée (visiteur refusé pour poser une question).

## 36. Panier refait, lien direct vers chaque produit, tableau de bord vendeur sans doublon (2026-10-22) ✅ code ; ⚠️ à essayer en ligne

**Constats du fondateur** : le panier était inutilisable ; HailandX Vendeur n'offrait qu'un lien vers la boutique, alors que le vendeur fait la publicité d'UN produit (lien en bio ou en description) et que le client doit arriver directement dessus, comme avec Shopify ; « Commandes » et « Produits » étaient à la fois dans « Gérer ma boutique » et dans la barre du bas.

- **Panier (HailandX, `/panier`)** — défauts constatés à l'écran : photos en pleine largeur qui poussaient nom, prix et boutons hors de l'écran ; barre du bas posée par-dessus le bouton « Commander ». Nouveau panier, inspiré des grandes applications : en-tête avec retour et nombre d'articles ; un bloc par colis (boutique, « Vendeur certifié », sous-total) ; chaque article avec vignette et nom cliquables, variante, prix (et total pour la quantité), quantité −/+ (croix pour retirer à 1), **Mettre de côté**, Supprimer ; **état en direct** relu dans la base (prix mis à jour et signalé, « Plus que N en stock », « Épuisé », « N’est plus en vente » — la commande est bloquée tant que c'est à corriger) ; **Récapitulatif** (articles, livraison calculée à l'étape suivante, total) ; garanties (payé à la remise ou Orange Money, remise contre code, 72 h) ; section **Mis de côté** ; « Vous avez aussi regardé » ; barre « Total · Commander » qui n'est plus masquée.
- **Lien direct vers un produit (HailandX Vendeur)** : bouton **Partager** sur chaque produit de la liste, dans l'écran « Produit en vente » et en haut de la fiche d'un produit. Feuille de partage (`components/ShareSheet.tsx`) : WhatsApp, TikTok (lien copié pour la bio ou le commentaire épinglé), Facebook, Copier le lien, autres applications ; **un lien suivi par réseau** (`/s/<code>`, table `share_links`, réutilisé s'il existe) → clics et ventes par source dans Statistiques. La boutique se partage de la même façon depuis le tableau de bord.
- **Correction** : un lien suivi de produit ouvrait la fiche sans la boutique : si plusieurs boutiques vendent le même produit, le client pouvait tomber sur l'offre d'un concurrent. `/s/<code>` ajoute désormais `?b=<boutique qui partage>`.
- **Tableau de bord vendeur** : tuiles Commandes et Produits retirées (déjà dans la barre du bas) ; tuiles Argent, Statistiques, Avis, **Questions**, Réglages, Aide ; « À faire » signale les **questions de clients sans réponse**.

## 37. Plan « HailandX Vendeur, niveau Shopify » (2026-10-22) — ✅ validé le 2026-10-23 ; étapes 0, 1 (barre du bas), 3 (Commandes) et 6 (Marketing) codées ; ⚠️ migration à appliquer

Demande : « une appli pour les vendeurs e-commerce, exactement comme Shopify mais pensée pour le contexte guinéen ; professionnelle, esthétique et opérationnelle ». Ce que Shopify apporte et qui manque, adapté (téléphone d'abord, 3G, paiement à la remise, Orange Money, WhatsApp et TikTok comme vitrines, adresse certifiée Hailand) :

0. **Maquettes d'abord** (artefact « HailandX — Maquettes », nouvelle page) : accueil, commandes, détail d'une commande, produits, clients, marketing, boutique en ligne, réglages — validation avant code.
1. **Navigation** : barre du bas Accueil · Commandes · Produits · Marketing · Menu ; recherche globale (commande, produit, client).
2. **Accueil** : guide de démarrage à cocher (logo, 5 produits avec fiche complète, premier partage, première vente), ventes du jour, à faire, conseils du jour.
3. **Commandes** : onglets (à préparer, en livraison, livrées, problèmes), **détail d'une commande** (articles, client, adresse niveau, paiement, chronologie, étiquette), appel ou WhatsApp du client par numéro masqué, motif d'annulation.
4. **Produits** : actions groupées (masquer, changer prix ou stock), **dupliquer un produit**, **prix barré** (prix avant promotion), stock bas configurable, réorganiser les rayons, aperçu « comme le client le voit ».
5. **Clients** (nouveau) : clients de la boutique (prénom, nombre de commandes, total, dernière commande ; jamais l'adresse exacte), clients fidèles, relance WhatsApp — fonction de base agrégée, respect de la vie privée.
6. **Marketing** (nouveau) : **codes promo** (pourcentage ou montant, date de fin, limite d'utilisations), promotions avec prix barré, liens suivis par produit, **visuels prêts à publier** (image carrée produit + prix + lien pour statut WhatsApp / TikTok), **QR code** de la boutique à imprimer.
7. **Boutique en ligne** : bannière, description, horaires et **mode vacances**, produits mis en avant, politique d'échange et de garantie affichée sur chaque produit.
8. **Statistiques** : visites (clics), taux de conversion, produits les plus vus et les plus vendus, sources (TikTok, WhatsApp…), comparaison de périodes.
9. **Équipe** : employés avec droits limités (la table `shop_members` a déjà le rôle `employe`).
Les points 3 (annulation), 4 (prix barré), 5, 6 (codes promo) et 7 (horaires, vacances, politique) demandent des **migrations** (accord du fondateur à chaque fois).

**Avancement (2026-10-23)**
- ✅ **Étape 0** : maquettes v6 (12 écrans) dans l'artefact « HailandX — Maquettes », validées par le fondateur.
- ✅ **Barre du bas** : Accueil · Commandes · Produits · Marketing · Menu (`VendeurNav`) ; « Plus » devient « Menu ».
- ✅ **Commandes** (`apps/vendeur/src/app/commandes`) : recherche (numéro HX-… ou produit), onglets avec compteurs, cartes qui ouvrent la **fiche d'une commande** (`/commandes/<colis>`) : articles avec photo, réduction, commission et « vous recevez », client **pseudonyme** (« Client 7F3A », quartier, niveau d'adresse, nombre de commandes chez vous — jamais le numéro ni l'adresse exacte), suivi en 5 étapes, étiquette, « Colis prêt » puis QR, **annulation avec motif obligatoire** (liste + « autre »), transmis au client dans sa notification et sur sa page de commande.
- ✅ **Marketing** (`apps/vendeur/src/app/marketing`) : ventes venues des partages (30 jours, par réseau) ; **codes promo** (pourcentage ou montant, achat minimum, fin, limite, une fois par client, aperçu client, activer/couper) ; **promotions** (−5 à −30 % en un geste, prix arrondi à 500 GNF, l'ancien prix devient le prix barré ; « Arrêter » le rétablit) ; **visuel prêt à publier** (statut 9:16 ou carré, photo, prix barré, lien suivi du réseau choisi, enregistrer ou partager) ; **affiche QR** de la boutique à imprimer ; partage d'un produit en un geste.
- ✅ **HailandX** : prix barré et « −x % » sur les cartes et la page produit ; champ **code promo** à la commande (vérifié par `fn_promo_check`, revérifié par `fn_place_order`) ; réduction et motif d'annulation affichés dans la commande.
- ✅ Prix barré aussi dans l'éditeur de produit (« Prix avant promotion ») et la liste des produits.
- 🗄️ Migration `2026-10-28_hailandx_vendeur_commandes_marketing.sql` (tests `vendeur-marketing.test.ts`, 10 cas) — **⚠️ à appliquer AVANT de fusionner** : sans elle, la vitrine HailandX (colonne `compare_at_gnf`) retomberait sur les exemples et la fiche de commande du vendeur serait vide.
- ⚠️ **Non fait, décidé** : appel / WhatsApp du client par **numéro masqué** — il faut un fournisseur de téléphonie (relais d'appels) ; en attendant, le livreur reste le seul à recevoir le numéro. À décider : fournisseur, ou messagerie dans l'application.
- 💡 **Restent** : accueil avec guide de démarrage (2), actions groupées et duplication (4), Clients (5), Boutique en ligne : horaires, vacances, politique (7), Statistiques enrichies (8), Équipe (9).
