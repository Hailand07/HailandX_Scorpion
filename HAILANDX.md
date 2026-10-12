# HAILANDX.md — HailandX, Flotte Hailand et Scorpion (Hailand07/HailandX_Scorpion)

> Fiche du projet HailandX. À lire avec [`ECOSYSTEME_HAILAND.md`](./ECOSYSTEME_HAILAND.md) (vision, base partagée, règles) et [`CLAUDE.md`](./CLAUDE.md) (règles de travail).
> **État (2026-10-12) : maquettes validées par le fondateur ; phase 1 (fondations) commencée — squelette du dépôt, paquets partagés et migration SQL de commerce **proposée et testée en local, NON appliquée**. Aucune table de commerce n'existe en base (§14).**
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
- **Règle de base** (celle du fondateur) : pour chaque vendeur, **un échantillon par catégorie**. L'échantillon est le meilleur produit de la catégorie (ventes, avis, nouveauté) et **tourne** régulièrement pour que le fil vive.
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

## 13. Journal des mises à jour

| Date | Changement |
|---|---|
| 2026-10-12 | Maquettes validées par le fondateur. Phase 1 : squelette du dépôt (monorepo, HailandX, Flotte, paquets ui / commerce / scorpion), comparaison des fournisseurs de SMS (§7 bis), migration SQL de commerce proposée et testée en local (non appliquée), état au §14. |
| 2026-10-12 | Décisions du fondateur (§11) : tout accepté ; nom et domaine laissés à Claude (HailandX, Hailand Flotte, Scorpion, liens `hx.gn`) ; zone pilote plus tard. Phase 0 : canevas de maquettes (14 écrans téléphone + architecture, flux, design) à valider avant d'exécuter (§11.1). |
| 2026-10-12 | Rectification du fondateur : le modèle de référence est **Shopify** (boutique en ligne propre à chaque vendeur, diffusée sur ses réseaux), et non Spotify. |
| 2026-10-12 | Création : vision détaillée du fondateur (vitrine globale « la rue », liens sociaux, Flotte Hailand avec QR, Scorpion, niveaux requis), propositions (fiche commune et offres, indice de confiance, avis vérifiés par la flotte, double preuve de remise, paiement bloqué, panier multi-vendeurs), parcours, place de la flotte, architecture, schéma proposé, design, plan en 8 phases, décisions à prendre. Rien n'est codé. |

## 14. Phase 1 — état (2026-10-12) ✅ squelette, 📄 migration à valider

**Fait dans ce dépôt** (tests : `npm test` — 96 vérifications ; `npm run lint` ; `npm run build`) :
- **Monorepo** (npm workspaces) : `apps/hailandx` (Next.js 16, React 19, Tailwind 4), `apps/flotte`, `packages/ui` (système de design des maquettes), `packages/commerce` (règles métier), `packages/scorpion` (modules purs repris de NavigationX).
- **HailandX** : accueil « la rue » (fil à un échantillon par boutique et par catégorie, avec rotation), **page d'un produit** (`/p/<produit>`) et **boutique** (`/b/<boutique>`) rendues côté serveur, avec **aperçu riche** (titre, prix, boutique) pour WhatsApp, TikTok et Facebook ✅ vérifié dans le HTML ; manifeste d'application installable. ⚠️ Pas encore d'image d'aperçu (il faudra les vraies photos). Données **d'exemple** (fictives) tant que la base de commerce n'existe pas.
- **Flotte** : écran des missions (thème sombre) avec gains calculés par la règle de frais, niveau d'adresse et précision à la porte.
- **`packages/commerce`** (26 tests) : montants en GNF ; frais de livraison (base 6 000 + 2 100 GNF/km, arrondi à 500, minimum 8 000 — ⚠️ valeurs provisoires) ; cycle de vie d'un colis (8 états, désistement possible) ; code de remise à 4 chiffres avec verrouillage après 5 échecs ; lecture d'un QR de colis ; contrôle de proximité ; **indice de confiance** (35 % avis vérifiés, 30 % fiabilité, 15 % expérience, 10 % qualité, 10 % prix, lissage tant que les avis sont peu nombreux) et badges ; fil « la rue » ; classement des offres ; règles « vendeur niveau 3 » et « acheteur niveau 1 minimum ».
- **`packages/scorpion`** (42 tests) : `gpsAcquisition`, `buildingDetection`, `levels`, `geoDiagnostic` repris **sans changement de logique** de NavigationX. Restent à extraire : `ownBuilding`, `certifiedBuildings`, `osmDetection`, écrans d'enregistrement (§6). ⚠️ Tant que NavigationX garde sa copie, toute correction se fait des deux côtés.
- **Migration SQL de commerce** : `supabase/proposed/2026-10-12_hailandx_commerce.sql` — **proposée, NON appliquée**, testée sur un Postgres local embarqué (`supabase/tests/commerce.test.ts`, **28 scénarios**) : boutique (niveau 3 requis pour vendre), catalogue et offres, commande à plusieurs boutiques (un colis par boutique, frais selon la distance, stock décompté, espèces à encaisser), préparation, QR signé, livreur (candidature, validation, mission verrouillée, plafond d'espèces, retrait), remise (scan de l'acheteur ou code, proximité, verrouillage), avis réservés aux remises confirmées, droits de lecture (un acheteur ne voit que ses commandes ; le code de remise n'est lisible que par lui). Le banc d'essai a **trouvé et fait corriger 5 défauts** avant toute exécution réelle.
- **Écarts avec le §8** (proposition initiale) : pas de tables `carts`/`cart_items` (le panier reste dans le navigateur jusqu'à la commande) ; **`deliveries` n'est pas modifiée** (ancienne table, 1 ligne de test, identifiants en texte) : les missions de la Flotte vivent dans `parcels` ; `payments`, `payouts`, `cash_settlements` et `disputes` viendront avec les phases 4 et 6 (le solde d'espèces du livreur est déjà suivi dans `couriers`).

**Ce qui attend le fondateur** (rien n'est fait sans son accord) :
1. **Appliquer la migration** à la base de production (accord explicite pour cette opération ; la base n'a aucune sauvegarde : je propose un export des tables concernées avant, comme pour les migrations précédentes — la migration ne modifie aucune table existante).
2. **Choisir le fournisseur de SMS** après devis (§7 bis).
3. **Créer le projet Vercel** de HailandX (et de la Flotte) et choisir le domaine (§11, `hx.gn` à vérifier).
4. Valider les **tarifs de livraison** provisoires (base 6 000, 2 100 GNF/km, arrondi 500, minimum 8 000), le **plafond d'espèces** par livreur (500 000 GNF) et la **distance de remise** (150 m).

**Prochaines étapes de code** (après accord) : connexion par téléphone et lecture réelle des boutiques et produits ; Scorpion dans HailandX (adresse à la commande) ; espace vendeur (phase 2).

---
