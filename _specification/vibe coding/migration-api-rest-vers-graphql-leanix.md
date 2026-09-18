# Feature Spec: Migration des lectures Application du REST vers GraphQL LeanIX

## Summary
- Remplacer les deux lectures REST d'applications (`GET /api/infos/applications` et `GET /api/infos/applications/{externalId}`) par un appel **GraphQL** unique, posté sur `api/leanix/graphql/query`.
- **La requête GraphQL vit dans un fichier dédié, hors du code TypeScript**, pour rester lisible et modifiable sans naviguer dans la couche API.
- La **même** requête sert aux deux usages : la variante unitaire ajoute simplement un filtre `externalIds: ["externalId/<externalId>"]` sur `allFactSheets`.
- **Restent en REST** : le graphe de liens (`GET /api/infos/applications/{externalId}/links`, sans équivalent GraphQL connu) et le streaming des photos (`POST /api/infos/resource`).

## Motivation
- Un seul aller-retour rapporte exactement les champs demandés, au lieu d'un DTO figé côté backend : ajouter un attribut à l'écran ne demande plus de modification serveur.
- Le schéma GraphQL expose **beaucoup d'attributs que le DTO REST ne portait pas** : `coreBusinessStatus`, `resourceAdequacy`, `mdcStatus`, `cyberSecurityLevel`, `businessSecurityLevel`, `ecCompliance`, `accessControlCompliance`, `deta06ComplianceStatus`, `docQualityStatus`, `globalQualityLevel`, `compliantProcess`, `kpi_*`. C'est précisément ce qui manque à l'onglet **Compliance**, aujourd'hui réduit à 2 axes sur les 9 prévus par le prototype, et aux badges de la barre latérale.
- Le coût de migration est contenu par l'architecture existante : **deux fichiers seulement** connaissent le format du backend — `lib/atom-api.ts` et `lib/application-adapter.ts`. Tout le reste consomme le type `Application` et ne bouge pas.

## Décisions (arbitrées)
- **Endpoint** : `POST ${NEXT_PUBLIC_ATOM_API_BASE_URL}/api/leanix/graphql/query`. C'est une API REST qui transporte une requête GraphQL ; on la traite comme les autres appels ATOM.
- **Requête hors du code** : un fichier `.graphql` versionné, contenant la requête telle qu'elle est lisible dans un client GraphQL, sans échappement ni concaténation. C'est l'objectif explicite de compréhension.
- **Une seule requête pour les deux usages** : la forme liste et la forme unitaire ne diffèrent que par le filtre `externalIds` sur `allFactSheets`. Pas de duplication du bloc de sélection, qui fait l'essentiel du fichier.
- **Aucune dépendance npm nouvelle** : pas d'Apollo, pas d'urql, pas de client GraphQL. Un `fetch` avec un corps JSON suffit ; le cache est déjà assuré par SWR.
- **Une erreur GraphQL est une erreur**, même en HTTP 200 : GraphQL renvoie classiquement `200` avec un tableau `errors[]`. Sans traitement explicite, une panne backend passerait pour un succès aux données vides.
- **Le contrat de diagnostic est préservé** : les préfixes `ATOM_BACKEND_DOWN:` / `ATOM_UNAUTHORIZED:` / `ATOM_HTTP_ERROR:` et l'objet `AtomErrorDetails` sont lus par `app/error.tsx` pour afficher l'URL réelle, l'origine et le mode d'authentification. La migration ne doit pas les perdre.
- **Le type `Application` ne change pas** dans cette itération : la migration porte sur la façon d'obtenir les données, pas sur ce qui est affiché. Les nouveaux attributs disponibles feront l'objet d'itérations séparées.
- **Les champs plats `lifeCycle_*` du DTO REST disparaissent** : GraphQL renvoie `lifecycle.phases[]`, mappé directement vers le type `ApplicationLifecycle`, dont les clés (`plan`, `phaseIn`, `active`, `phaseOut`, `endOfLife`) correspondent exactement aux valeurs de `phase`.

## Requirements

### Functional Requirements
- Le catalogue (`/`) et la carte (`/map`) sont alimentés par la requête GraphQL en forme liste.
- La fiche détail (`/application?id=<externalId>`) est alimentée par la même requête en forme unitaire, filtrée sur l'`externalId`.
- Un `externalId` inconnu (aucun `edges`) produit le même résultat qu'un 404 aujourd'hui : l'application est absente, la page affiche « non trouvée » sans erreur technique.
- Tous les champs actuellement affichés restent alimentés : identité, statut, catégorie, criticité, cycle de vie, portfolio, operator/provider, personnes, liens documentaires, galerie photo, vidéos et documents Google.
- Une réponse en HTTP 200 contenant `errors[]` est traitée comme un échec et remonte le message d'erreur GraphQL dans les diagnostics.
- La requête GraphQL est lisible dans son propre fichier, sans caractères d'échappement ni découpage en morceaux.
- Le diagramme de liens de l'onglet In Context continue de fonctionner via son appel REST inchangé.

### Non-Functional Requirements
- **Compatible export statique** : en production `next.config.mjs` produit `output: "export"` et toutes les lectures se font depuis le navigateur. La requête doit donc être **incorporée au bundle à la construction**, et non téléchargée à l'exécution — un fichier servi depuis `public/` ajouterait un aller-retour, un mode de panne supplémentaire, et devrait composer avec `basePath`.
- **Aucune dépendance npm nouvelle.**
- **Aucun changement visible pour les composants** : signatures de `lib/applications.ts` et clés SWR inchangées, donc ni `CatalogueClient`, ni `ApplicationDetailClient`, ni les onglets ne sont touchés.
- **Authentification inchangée** : même mécanisme que les appels actuels (en-tête `Authorization` injecté par la passerelle AFTER en production, `NEXT_PUBLIC_DEV_JWT` en développement).
- **Pas de régression de performance perceptible** sur le catalogue : la requête rapporte beaucoup de champs pour toutes les applications, elle ne doit pas être déclenchée plus souvent qu'aujourd'hui.

## Scope

### In Scope
- Le fichier de requête GraphQL, hors du code, et son mécanisme d'inclusion au build.
- La réécriture des deux fonctions de lecture d'applications dans la couche API, avec gestion des erreurs GraphQL.
- La réécriture de l'adaptateur : nœud GraphQL → `Application`, y compris l'aplatissement des `edges`/`node`, le déballage des `externalId` imbriqués, et le pivot du cycle de vie.
- La suppression du DTO REST devenu inutile.

### Out of Scope
- **L'exploitation des nouveaux attributs** (compliance, sécurité, qualité, KPI, `coreBusinessStatus`, `resourceAdequacy`) : itérations séparées, notamment pour l'onglet Compliance.
- **Le graphe de liens** (`/links`) et **le streaming des photos** (`POST /api/infos/resource`), qui restent en REST.
- Toute modification du type `Application` ou de l'affichage.
- L'introduction d'un client GraphQL, de la génération de types depuis le schéma, ou d'un cache normalisé.
- Le nettoyage des URLs multiples (`"… or …"`) dans `confluenceURL` / `gDrivePath`, défaut préexistant sans rapport avec la migration.

## Affected Areas
- **Créer** : le fichier de requête GraphQL (emplacement et mécanisme de chargement à arbitrer — voir Open Questions).
- **Modifier** : `lib/atom-api.ts` — remplacement de `fetchApplications` / `fetchApplication` par des appels GraphQL, ajout de la détection de `errors[]`, suppression de `ApplicationDto` et `DocumentRef`/`FactsheetRef` dans leur forme REST. `fetchApplicationLinks` est **conservée telle quelle**.
- **Modifier** : `lib/application-adapter.ts` — nouvelle forme d'entrée. `toLinkedResources` et `toPhotos` devraient être réutilisables quasi telles quelles : le nœud `documents.edges[].node` porte exactement les champs attendus (`id`, `documentType`, `name`, `origin`, `url`).
- **Inchangé** : `lib/applications.ts` (mêmes signatures), `lib/useApplications.ts`, `lib/useApplicationLinks.ts`, `lib/usePhoto.ts`, `lib/application-links-adapter.ts`, `lib/types.ts`, tous les composants, `app/error.tsx`.

## Edge Cases
- **Aucun résultat** (`edges: []`) sur la forme unitaire → équivalent d'un 404, l'appelant reçoit `null`.
- **HTTP 200 avec `errors[]`** → échec explicite, message remonté dans les diagnostics.
- **Réponse partielle** (`data` renseigné *et* `errors` présent) : à arbitrer — échouer, ou exploiter les données reçues en journalisant l'erreur.
- **`hasNextPage: true`** : la requête ne passe ni `first` ni `after`. Si le backend pagine, le catalogue serait silencieusement tronqué — c'est le risque le plus sérieux de cette migration.
- **`airbusSite` est un tableau** (`["all"]`) alors que le modèle attend une chaîne.
- **Champs de relation vides** : `relApplicationToPortfolio` / `…BusinessOwnerUsers` / `…SolutionArchitectUsers` sans `edges` → `null`, comme aujourd'hui.
- **Relation à plusieurs entrées** : le modèle n'attend qu'un portfolio et un architecte ; prendre la première entrée et ignorer les suivantes.
- **`BRDURL: "not defined"`** — une chaîne, pas `null`. Déjà géré : `isValidUrl` la rejette et la puce s'affiche désactivée.
- **`documents` vide ou absent** → pas de photo, pas de ressource liée, la couverture générée prend le relais comme aujourd'hui.

## Open Questions

### Sur le fichier de requête
- **Emplacement et chargement** : un `.graphql` importé comme chaîne au build demande une règle de chargement Turbopack/webpack dans `next.config.mjs` — c'est la solution la plus fidèle à « hors du code », mais elle ajoute de la configuration de build. Les alternatives sont un module TypeScript ne contenant *que* la requête en littéral gabarit (aucune configuration, lisibilité quasi identique, mais techniquement dans le code) ou un fichier servi depuis `public/` et récupéré à l'exécution (écarté par les contraintes d'export statique). Laquelle retient-on ?
=> un module typescript ne contenant quasiment que la requete


- **Forme unitaire** : passer le filtre par une **variable GraphQL** (un seul fichier, aucune manipulation de chaîne) suppose que l'endpoint accepte `variables` dans le corps de la requête. Sinon il faut substituer la ligne `allFactSheets(...)` par du texte, ce qui est plus fragile. L'endpoint accepte-t-il `{ query, variables }` ? => utilise la substution par texte.

### Sur le contrat de l'API
- **Pagination** : le backend renvoie-t-il toutes les applications en une fois, ou faut-il boucler sur les curseurs (`pageInfo.hasNextPage` / `cursor`) ? À vérifier avant toute mise en production du catalogue. => oui il faut boucler sur ces curseurs car la limite du nombre d'applications pouvant etre récupéres en un seul appel n'est pas connu

- **Erreurs d'authentification** : l'endpoint conserve-t-il des codes HTTP 401/403, ou signale-t-il ces cas dans `errors[]` en HTTP 200 ? L'écran « non autorisé » de `app/error.tsx` en dépend. => oui il les conserve

### Sur le mapping des attributs
- **`version` ← `release` ?** Le modèle a `version` ; GraphQL expose `release: "1.0"` et le prototype affichait « Version 1.0 ». Probable, mais c'est un renommage : à confirmer.=> oui c'est bien ça

- **`manager` ← `relApplicationToBusinessOwnerUsers` ?** Le REST fournissait `manager`, affiché comme « Application Manager » ; GraphQL parle de *Business Owner*. Même relation, ou existe-t-il un `relApplicationToManagerUsers` absent de la requête ?  => oui c'est bien ça, manager = Application Manager 

- **`managerDelegates`** n'est pas dans la requête et n'a pas de relation identifiée. Il est utilisé par l'export PDF. Relation à ajouter, ou champ abandonné ? => à supprimer de l'expor pdf

- **`airbusSite`** multi-valué : concaténer les valeurs ou ne garder que la première ? => les concaténer

- D'autres champs scalaires dans l'échantillon (`programCategory`, `partIS`) peuvent-ils aussi être des tableaux sur d'autres applications ? => non

- **Photos** : la galerie repose sur des entrées `documentType: "photo"` **et** `origin: "LX_STORAGE_SERVICE"` dans `documents`. L'échantillon ne contient que du `CUSTOM_LINK`. À vérifier sur une application qui possède des photos : si `documents` ne les renvoie pas, toute la galerie tombe. => si on aura bien ce éléments attendus

## Acceptance Criteria
- [ ] Le catalogue, la carte et la fiche détail s'affichent avec les mêmes données qu'avant, sans aucun appel à `/api/infos/applications`.
- [ ] La fiche détail est obtenue par la requête filtrée sur `externalIds`, et un identifiant inconnu affiche l'écran « non trouvée ».
- [ ] La requête GraphQL est lisible dans un fichier dédié, telle qu'on la collerait dans un client GraphQL.
- [ ] Une réponse HTTP 200 contenant `errors[]` déclenche l'écran d'erreur avec un message exploitable, et non une page vide.
- [ ] Les diagnostics (URL réelle, base configurée, origine, mode d'authentification) restent affichés par `app/error.tsx`.
- [ ] Galerie photo, vidéos, documents Google, cycle de vie, portfolio et personnes sont identiques à l'existant sur une application de référence.
- [ ] L'onglet In Context et son appel `/links` fonctionnent inchangés.
- [ ] Aucune dépendance npm ajoutée.
- [ ] Build Next OK (`npm run build`), y compris l'export statique de production.
