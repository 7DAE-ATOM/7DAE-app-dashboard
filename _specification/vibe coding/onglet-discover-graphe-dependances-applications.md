# Feature Spec: Onglet Discover — Graphe de Dépendances Applications

## Summary
- Ajouter un nouvel onglet de navigation **"Discover"**, positionné à droite de **Map** dans la barre de navigation principale (au même niveau que `/`, `/map`), pas à confondre avec les onglets de la fiche détail Application (Identity/Accountability/...).
- Cet onglet ouvre une nouvelle page/route affichant un **graphe de dépendances entre Applications**, réutilisant l'essentiel des choix techniques déjà validés sur l'onglet "Dependency Graph" (`/depgraph`) de `C:\projects\airbus\atom\7DAE-ltm-dashboard` : rendu **`@xyflow/react`**, layout initial **elkjs (algorithme radial)** calculé une seule fois puis jamais réappliqué (les déplacements manuels et ajouts ultérieurs sont préservés), un **champ de recherche** (ici sur les Applications au lieu des Lab Test Means), une **liste des éléments sélectionnés** juste à droite du champ de recherche, et une **icône réglages** permettant de choisir les attributs affichés sur les cartes (pour cette itération : *name*, *externalId*, *application manager*).
- Le changement structurel majeur porte sur le **modèle de données représenté** et son **rendu visuel** : contrairement au graphe Lab Test Means (nœuds homogènes reliés directement), ce graphe modélise le **vrai modèle LeanIX** des dépendances applicatives, où le lien entre deux applications passe toujours par une **FactSheet Interface** intermédiaire (1 provider, 0..n consommateurs), porteuse elle-même d'attributs et de liens vers des Data Objects (types de données échangées).
  - Les **Applications** sont représentées par des **rectangles**, visuellement identiques aux cartes de nœud du graphe Lab Test Means.
  - Les **Interfaces** sont représentées par de **petits cercles**, positionnés autour du rectangle de l'application qui en est le **provider**.
  - Des **flèches** partent de chaque application **consommatrice** vers le cercle d'interface qu'elle consomme.
- Les menus contextuels (clic droit) sont **différenciés par type de nœud** (Application vs Interface), avec un vocabulaire d'actions propre à ce nouveau modèle (voir Décisions).
- Les fonctions **sauvegarde et export**, bien que faisant partie du dispositif réutilisé sur `/depgraph`, sont **explicitement reportées à une itération ultérieure** — hors périmètre de cette première version.

## Motivation
- La fiche détail Application expose aujourd'hui un onglet "In Context" qui appelle une API dédiée et affiche une vue **simplifiée** des applications liées (étoile à un niveau, liens directs). Cette vue masque la structure réelle du modèle LeanIX : deux applications ne sont jamais reliées "directement" mais toujours via une Interface, qui elle-même porte des consommateurs multiples et des Data Objects.
- Un onglet dédié et autonome ("Discover"), indépendant d'une fiche application précise, permet d'explorer ce graphe de proche en proche à partir de n'importe quelle sélection d'applications, avec le vrai niveau de détail (interfaces, sens provider/consommateur, données échangées) — un usage d'investigation/cartographie que l'onglet "In Context" (contextualisé à une seule application) ne couvre pas.
- Le dispositif déjà construit et validé sur `7DAE-ltm-dashboard` pour le même besoin (explorer un graphe de dépendances, densité comparable, mêmes contraintes de lisibilité) réduit fortement le risque et l'effort d'implémentation : il ne reste à concevoir que ce qui change réellement (modèle de données Interface, rendu cercle/rectangle, menus contextuels dédiés).

## Décisions (arbitrées)
- **Emplacement de l'onglet** : nouvelle entrée de navigation top-level "Discover", positionnée immédiatement après "Map" dans la barre de navigation (`Header` ou équivalent), avec sa propre route.
- **Bibliothèque de rendu** : `@xyflow/react` (successeur actuel du paquet historique `reactflow`, déjà en usage sur `7DAE-ltm-dashboard`) — aucune nouvelle dépendance ne doit être introduite au-delà de celle-ci et d'`elkjs`, toutes deux déjà éprouvées dans l'écosystème des deux dépôts.
- **Layout initial** : `elkjs`, algorithme `radial`, calculé **une seule fois** au montage pour le graphe de la sélection initiale — reprise à l'identique du principe déjà en place sur `/depgraph` (pas de recalcul global lors d'ajouts/dépliages ultérieurs, pour ne jamais perturber un positionnement déjà ajusté manuellement par l'utilisateur). Les nœuds ajoutés après coup (recherche, "show dependencies", "show interfaces") sont positionnés par une heuristique locale relative au nœud d'origine, comme sur `/depgraph`.
- **Champ de recherche** : reprend le composant/pattern de combobox existant, mais interroge la liste des **Applications** (nom / externalId) au lieu des Lab Test Means. Sélectionner un résultat ajoute l'application comme nouveau nœud racine du graphe, sans relancer le layout global.
- **Liste des éléments sélectionnés** : reprend le pattern existant (barre de chips juste à droite du champ de recherche), un chip par application ajoutée comme racine ; retirer un chip retire le nœud (et, comme sur `/depgraph`, les nœuds qui en deviennent inatteignables depuis les racines restantes).
- **Icône réglages** : reprend le pattern existant (popover à bascules), avec pour cette itération 3 attributs configurables sur les cartes Application : **name**, **externalId**, **application manager**. La liste d'attributs configurables est conçue pour être étendue facilement dans une itération ultérieure (autres attributs de la fiche Identity/Accountability), mais seuls ces 3 sont câblés maintenant.
- **Modèle de nœuds** :
  - **Application** = rectangle (même gabarit visuel que la carte de nœud `/depgraph`), affichant les attributs choisis via l'icône réglages.
  - **Interface** = petit cercle, positionné en couronne autour du rectangle de l'application qui en est le **provider** (une interface n'a qu'un seul provider — elle est donc toujours rattachée à un unique rectangle).
  - Une interface peut être partagée par plusieurs consommateurs : plusieurs flèches peuvent converger vers le même cercle, chacune partant d'une application consommatrice différente.
- **Sens des arêtes** : toujours de l'application **consommatrice** vers le cercle **Interface** ; aucune arête directe entre deux rectangles Application (le modèle n'a pas de lien direct application↔application, seulement via une Interface).
- **Menus contextuels** :
  - Sur une **Application** :
    - *Show Interfaces Inbound* — affiche uniquement les cercles des interfaces dont cette application est **provider** (relation `relProviderApplicationToInterface`), positionnés en couronne autour du rectangle. Les applications consommatrices de ces interfaces ne sont **pas** ajoutées au graphe par cette action.
    - *Show Interfaces Outbound* — affiche les cercles des interfaces dont cette application est **consommatrice** (relation `relConsumerApplicationToInterface`) **et**, en plus, les applications **provider** de ces interfaces (les "applications appelées") — cette action ajoute donc à la fois des cercles et des rectangles.
    - *Show dependencies* — affiche les applications liées aux interfaces déjà visibles de ce nœud (les consommateurs pour une interface où l'application est provider, ou le provider pour une interface consommée déjà affichée sans son extrémité opposée).
    - *Hide* — masque l'application et l'ensemble de ses interfaces actuellement affichées (résolu : les interfaces **consommées** par cette application ne sont **pas** masquées par cette action, même si elles ne sont plus reliées à aucun autre nœud visible — seules les interfaces dont l'application est provider, ainsi que le rectangle lui-même, disparaissent).
  - Sur une **Interface** :
    - *Show dependencies* — affiche les applications liées à cette interface (le provider si non affiché, et/ou les consommateurs).
    - *Hide* — masque **uniquement** le cercle de l'interface et ses flèches (résolu : pas de cascade sur le provider ni les consommateurs, contrairement au retrait d'un chip de sélection qui reste une cascade complète).
  - Ces actions étendent le graphe de proche en proche, sans jamais relancer le layout global (cohérent avec le principe "expand"/"hide" déjà en place sur `/depgraph`).
- **Sauvegarde et export** : le mécanisme existant sur `/depgraph` (sauvegardes nommées en `localStorage`, export JSON) n'est **pas porté** dans cette itération. Il est noté comme suite prévue, mais aucune UI de sauvegarde/export ne doit apparaître dans cette version.
- **Récupération des données** : le graphe s'appuie sur un **nouveau modèle de données** (Interfaces, relations provider/consommateur, Data Objects) distinct de l'API `/links` simplifiée utilisée par l'onglet "In Context" de la fiche détail. Deux requêtes GraphQL LeanIX dédiées, distinctes de `lib/leanix-application-query.ts`, alimentent le graphe (échantillons validés : `temp/getLinkForApp.txt`, `temp/getLinkForInterface.txt`) :
  - **Depuis une Application** (au moment où elle est ajoutée comme racine, ou lors d'un *Show Interfaces*) : `allFactSheets(filter: {ids: [<id technique>]})` sur `... on Application`, qui remonte en un seul aller :
    - `relProviderApplicationToInterface` — les interfaces dont l'application est **provider** : chaque edge donne le `factSheet` Interface (`id`, `name`, `externalId`, `protocol`), et **directement dedans** `relInterfaceToConsumerApplication` (les applications consommatrices, avec `interfacetype`/`frequency` portés par la relation) et `relInterfaceToDataObject`.
    - `relConsumerApplicationToInterface` — les interfaces dont l'application est **consommatrice** : chaque edge porte `interfacetype`/`frequency` et le `factSheet` Interface, avec **directement dedans** `relInterfaceToProviderApplication` (l'application provider) et `relInterfaceToDataObject`.
    - Une seule requête sur une Application suffit donc à peupler à la fois *Show Interfaces (Inbound)* et *Show Interfaces (Outbound)* (cf. Open Questions résolues) — pas de second aller-retour nécessaire pour afficher les applications appelées.
  - **Depuis une Interface** (lors d'un *Show dependencies* sur un cercle déjà affiché, si les données n'ont pas déjà été obtenues via la requête Application) : `allFactSheets(filter: {ids: [<id technique de l'Interface>]})` sur `... on Interface`, qui remonte `relInterfaceToConsumerApplication`, `relInterfaceToProviderApplication`, `relInterfaceToDataObject` — même structure que ci-dessus, utile pour compléter une interface découverte incomplètement (ex. côté provider seulement) sans avoir à recharger l'application entière.
  - **Identification par `id` technique, jamais par `externalId`** : une **Interface n'a pas d'`externalId` exploitable pour la recherche** (le filtre GraphQL utilise `filter: {ids: [...]}`, pas `externalIds`, contrairement à la requête Application existante qui utilise `externalIds: ["externalId/7DAE"]`) ; par ailleurs une **Application peut elle aussi ne pas avoir d'`externalId`** (cas déjà rencontré et filtré ailleurs dans le codebase, cf. `fetchAllApplicationNodes`). Pour rester uniforme entre les deux types de nœuds et ne jamais bloquer sur une Application sans `externalId`, **le graphe Discover identifie et interroge systématiquement par `id` technique** (`filter: {ids: [...]}`), y compris pour les Applications — `externalId` reste seulement un **attribut affiché** sur la carte (optionnel via l'icône réglages), jamais la clé de recherche/relation côté graphe.

## Requirements

### Functional Requirements
- Une nouvelle entrée "Discover" apparaît dans la navigation principale, à droite de "Map".
- La page Discover affiche un canevas de graphe avec, en toolbar : champ de recherche d'Applications, liste des applications sélectionnées (chips), icône de réglages d'affichage.
- Rechercher et sélectionner une application l'ajoute comme nœud racine (rectangle) du graphe, sans réinitialiser le graphe existant.
- Retirer un chip de la liste des sélectionnés retire le nœud Application correspondant et, en cascade, les nœuds devenus inatteignables depuis les racines restantes.
- L'icône réglages permet d'activer/désactiver l'affichage de *name*, *externalId*, *application manager* sur les cartes Application.
- Chaque application affichée peut, via clic droit, déclencher *Show Interfaces Inbound*, *Show Interfaces Outbound*, *Show dependencies*, ou *Hide*, avec le comportement décrit dans les Décisions.
- Chaque interface affichée (cercle) peut, via clic droit, déclencher *Show dependencies* ou *Hide*.
- Une interface est toujours positionnée en couronne autour du rectangle de son application provider.
- Une flèche relie chaque application consommatrice affichée au cercle de l'interface qu'elle consomme.
- Le layout initial de la sélection de départ est calculé automatiquement (algorithme radial) ; les positions ne sont pas recalculées lors des actions d'expansion/masquage ultérieures, sauf déplacement manuel de l'utilisateur (drag, comme sur `/depgraph`).

### Non-Functional Requirements
- **Aucune dépendance npm nouvelle** au-delà de `@xyflow/react` et `elkjs` (déjà en usage dans l'écosystème des deux dépôts) — pas de bibliothèque de graphe supplémentaire.
- **Thème** : couleurs exclusivement issues des tokens `--color-*` existants, lisible en clair comme en sombre.
- **Cohérence visuelle** : le rectangle Application reprend le même gabarit visuel que les cartes de nœud du graphe Lab Test Means (cohérence inter-applications).
- **Pas de recalcul de layout intempestif** : toute action d'expansion (*Show Interfaces*, *Show dependencies*) ou de masquage (*Hide*) doit préserver la position des nœuds déjà affichés.
- **Isolation des pannes** : une erreur de chargement des dépendances d'une application ne doit pas casser l'ensemble du graphe déjà affiché.

## Scope

### In Scope
- Nouvelle route/page "Discover" et son entrée de navigation.
- Réutilisation du socle technique `/depgraph` : rendu `@xyflow/react`, layout `elkjs` radial calculé une fois, pattern de champ de recherche + liste de sélection + icône réglages (popover à bascules).
- Nouveau modèle de nœuds à deux types : Application (rectangle) et Interface (cercle), avec positionnement de l'Interface en couronne autour de son application provider.
- Flèches de consommateur vers interface consommée.
- Menus contextuels différenciés Application / Interface, avec les actions *Show Interfaces*, *Show dependencies*, *Hide* selon le type.
- Récupération des données de dépendances (Interfaces, providers, consommateurs) nécessaire à l'alimentation du graphe — la source précise (requête GraphQL dédiée ou étendue) sera précisée au plan.
- Icône réglages avec les 3 attributs configurables listés (name, externalId, application manager).

### Out of Scope
- **Sauvegarde et export** du graphe (nommage, `localStorage`, export JSON) — prévu pour une itération ultérieure explicitement annoncée par l'utilisateur.
- Affichage ou exploration des **Data Objects** portés par une Interface (types de données échangées) — la spec mentionne leur existence dans le modèle réel mais ne les rend pas visuellement dans cette itération.
- Affichage des **attributs propres à une Interface** (au-delà de son existence en tant que nœud) — non demandé pour cette itération.
- Attributs configurables au-delà des 3 listés (name, externalId, application manager).
- Toute écriture vers le backend.
- Filtrage du graphe par type, criticité, ou autre attribut d'application.
- Panneau de détail latéral au clic simple sur un nœud (non demandé).

## Affected Areas
- **Créer** : nouvelle route/page "Discover" (nom de fichier/segment à définir au plan, cohérent avec le routing existant du repo).
- **Modifier** : composant de navigation principale (ajout de l'entrée "Discover" à droite de "Map").
- **Créer** : composant(s) de graphe (canevas `@xyflow/react`, hook de layout `elkjs`, nœud custom "Application" en rectangle, nœud custom "Interface" en cercle, arête custom fléchée), inspirés directement de `components/interaction/DependencyGraph.tsx` et `components/interaction/useElkLayout.ts` de `7DAE-ltm-dashboard`.
- **Créer** : composant de recherche d'Applications et composant de liste des sélectionnés, adaptés de `BenchCombobox.tsx` / `SelectedBenchesBar.tsx`.
- **Créer** : composant de réglages d'affichage (icône + popover à bascules), adapté de `DisplaySettingsControl.tsx` / `lib/interactionDisplaySettings.ts`, restreint aux 3 attributs applicables.
- **Créer** : composants de menu contextuel Application et Interface, adaptés de `NodeContextMenu.tsx` mais avec un vocabulaire d'actions propre à ce modèle.
- **Créer** : nouveau module de requêtes GraphQL LeanIX dédié au graphe (à côté de `lib/leanix-application-query.ts`, sans le modifier) : une requête paramétrée par `id` technique côté Application (`relProviderApplicationToInterface`, `relConsumerApplicationToInterface`) et une requête paramétrée par `id` technique côté Interface (`relInterfaceToConsumerApplication`, `relInterfaceToProviderApplication`, `relInterfaceToDataObject`), calquées sur `temp/getLinkForApp.txt` / `temp/getLinkForInterface.txt`.
- **Créer** : adaptateur front-end dédié (nœuds Application/Interface + arêtes du modèle de graphe générique), distinct de `lib/application-adapter.ts`.
- **Non touché** : onglet "In Context" de la fiche détail Application (reste la vue simplifiée existante, non remplacée par cette spec), catalogue `/`, `/map`, export PDF, `7DAE-ltm-dashboard` (dépôt source de référence, non modifié).

## Edge Cases
- **Application sans aucune interface** (ni provider, ni consommatrice) → *Show Interfaces* n'affiche rien, message ou état neutre attendu (pas d'erreur).
- **Interface sans consommateur** (0 consommateur, cas valide selon le modèle "0 ou n consommateurs") → *Show dependencies* depuis cette interface n'affiche que le provider s'il n'est pas déjà visible ; aucune flèche entrante si aucun consommateur.
- **Application à la fois provider et consommatrice de la même interface** (cas théoriquement anormal) → à traiter sans boucle infinie ni doublon de flèche (cf. Open Questions).
- **Beaucoup d'interfaces autour d'une même application** → risque de chevauchement des cercles en couronne ; le rendu doit rester lisible ou indiquer visuellement la densité (cf. Open Questions pour le seuil).
- **Hide sur une application dont une interface est encore consommée par une autre application affichée** → comportement à clarifier (l'interface disparaît-elle malgré tout, ou reste-t-elle affichée sans son provider ?) — cf. Open Questions.
- **Deux applications sélectionnées comme racines partageant une interface commune** → l'interface ne doit apparaître qu'une seule fois (pas de doublon de cercle), reliée aux deux applications concernées.
- **Erreur réseau lors du chargement des interfaces/dépendances d'une application** → message d'erreur localisé sans casser le reste du graphe déjà affiché.
- **Application recherchée déjà présente dans le graphe (comme racine ou révélée via une expansion)** → la resélectionner ne doit pas créer de nœud dupliqué.

## Open Questions
_Toutes les questions ouvertes ont été tranchées et intégrées ci-dessus :_
- **Sens de "Show Interfaces" sur une Application** → scindé en deux actions : *Show Interfaces Inbound* (cercles des interfaces provider uniquement) et *Show Interfaces Outbound* (cercles des interfaces consommées **et** applications provider correspondantes).
- **Portée de "Hide" sur une Application** → ne masque pas les interfaces consommées par l'application, seulement l'application et ses interfaces provider.
- **Portée de "Hide" sur une Interface** → masque uniquement le cercle et ses flèches, jamais le provider ni les consommateurs.
- **Source des données** → deux requêtes GraphQL dédiées (échantillons `temp/getLinkForApp.txt` / `temp/getLinkForInterface.txt`), identification par `id` technique pour Application et Interface (jamais `externalId`, absent sur Interface et parfois sur Application) — détaillé dans la Décision "Récupération des données" ci-dessus.
- **Seuil de densité des cercles en couronne** → aucune limite dans cette première version.
- **Repli "application manager" absent** → affichage `"—"`.

## Acceptance Criteria
- [ ] Une entrée "Discover" est visible dans la navigation principale, immédiatement après "Map", et ouvre une page dédiée.
- [ ] La page affiche un champ de recherche d'Applications, une liste des applications sélectionnées à sa droite, et une icône de réglages d'affichage.
- [ ] Sélectionner une application dans la recherche l'ajoute comme rectangle racine dans le graphe.
- [ ] Retirer un chip de la liste des sélectionnés retire le nœud correspondant et les nœuds devenus inatteignables.
- [ ] L'icône réglages permet d'activer/désactiver l'affichage de *name*, *externalId*, *application manager* sur les cartes Application.
- [ ] Clic droit sur une Application propose *Show Interfaces Inbound*, *Show Interfaces Outbound*, *Show dependencies*, *Hide* ; clic droit sur une Interface propose *Show dependencies*, *Hide*.
- [ ] *Show Interfaces Inbound* affiche uniquement les cercles des interfaces dont l'application est provider, sans ajouter d'application consommatrice.
- [ ] *Show Interfaces Outbound* affiche les cercles des interfaces consommées par l'application et les applications provider correspondantes.
- [ ] *Show dependencies* affiche les applications liées aux interfaces déjà visibles, avec une flèche du consommateur vers le cercle d'interface.
- [ ] *Hide* sur une application masque l'application et ses interfaces provider (pas les interfaces qu'elle consomme) ; *Hide* sur une interface masque uniquement le cercle et ses flèches (pas le provider ni les consommateurs).
- [ ] Les Applications et Interfaces sont recherchées/identifiées dans le graphe par leur `id` technique, jamais par `externalId`.
- [ ] Le layout initial est calculé une seule fois (algorithme radial) et n'est jamais recalculé globalement lors des actions d'expansion/masquage ultérieures.
- [ ] Aucune UI de sauvegarde/export n'est présente dans cette itération.
- [ ] Le graphe est lisible en thème clair et en thème sombre, sans couleur codée en dur.
- [ ] Aucune dépendance npm ajoutée au-delà de `@xyflow/react` et `elkjs`.
- [ ] Build Next OK (`npm run build`).
