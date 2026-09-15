# Feature Spec: Relation Business Capabilities — Application

## Summary
- Ajouter la relation `relApplicationToBusinessCapability` à la requête GraphQL LeanIX des Applications (`lib/leanix-application-query.ts`), sur le même modèle que les relations déjà présentes (`relApplicationToPortfolio`, `relApplicationToDataObject`, relations Users) : `id`, `name`, et `externalId.externalId` via le fragment `... on BusinessCapability`.
- Propager ces données jusqu'à l'UI : nouveau type d'edge dans `lib/atom-api.ts`, nouveau type `BusinessCapability` dans `lib/types.ts`, mapping dans `lib/application-adapter.ts`.
- Aucun nouvel appel réseau : la relation est ajoutée à la requête déjà émise aujourd'hui vers `/api/leanix/graphql/query`.

## Motivation
- Les Business Capabilities sont la dimension métier manquante de la fiche Application : aujourd'hui l'application est rattachée à un Portfolio et à des Data Objects, mais rien n'indique quelles capacités métier elle supporte.
- Cette relation avait déjà été identifiée dans `_specification/vibe coding/nouveaux-attributs-rest-application.md` (section Out of Scope : « La relation `relApplicationToBusinessCapability` — non reprise ici ») comme un reste à traiter après la migration REST → GraphQL. Cette spec ferme ce point.
- Le pattern d'intégration est déjà éprouvé dans le code (relations Portfolio / DataObject) : le coût d'ajout est faible et la structure de données retournée est connue.

## Décisions (arbitrées)

### Source de données
- La relation est ajoutée au bloc `... on Application` de `APPLICATION_QUERY`, entre les relations existantes. Aucune requête séparée, aucun endpoint supplémentaire.
- La substitution de texte réalisée par `buildApplicationsQuery` (remplacement de l'argument de `allFactSheets`) n'est pas affectée : la relation vit dans le corps de la requête, pas dans sa liste d'arguments. Le filtre par `externalIds` (fiche détail) et la pagination `after` continuent de fonctionner à l'identique.

### Forme des données
- Chaque Business Capability liée est exposée avec les trois champs demandés : `id` (id technique LeanIX), `name`, `externalId` (aplati depuis `externalId.externalId`, comme pour les Portfolios / Data Objects).
- Une application sans relation renvoie une liste vide, jamais `null` côté `Application` — cohérent avec le traitement actuel de `dataObjects`.

### Affichage
- Cette itération se limite à la **récupération et à la mise à disposition** de la donnée dans le modèle `Application`. Le choix de la surface d'affichage (onglet de la fiche détail, carte Discover, filtre catalogue) est traité séparément — voir Open Questions et Out of Scope.

## Requirements

### Functional Requirements
- `APPLICATION_QUERY` (`lib/leanix-application-query.ts`) demande `relApplicationToBusinessCapability { edges { node { factSheet { id name ... on BusinessCapability { externalId { externalId } } } } } }`.
- `lib/atom-api.ts` déclare un type d'edge pour cette relation (réutilisant la forme des edges de relation existants) et l'ajoute au DTO du nœud Application, typé `{ edges: … } | null`.
- `lib/types.ts` expose un type `BusinessCapability` (`id`, `name`, `externalId`) et un champ `businessCapabilities: BusinessCapability[]` sur `Application`.
- `lib/application-adapter.ts` mappe la relation vers ce champ, en tolérant `null` et les edges incomplets, comme le fait `mapDataObjects`.

### Non-Functional Requirements
- **Pas de nouvel appel réseau** : la relation enrichit une requête déjà émise ; aucune confirmation supplémentaire n'est requise au sens de la règle CLAUDE.md « Network calls — ask first » (endpoint et méthode inchangés).
- **Pas de régression** sur les champs et relations déjà consommés (portfolio, data objects, owners, architectes, documents, lifecycle).
- **Charge utile maîtrisée** : seuls les trois champs demandés sont récupérés, conformément au principe « payload lean » documenté en tête du fichier de requête.
- **Tolérance au backend** : si LeanIX ne retourne pas la relation (droits, schéma, application non rattachée), la fiche et le catalogue restent fonctionnels.

## Scope

### In Scope
- Ajout de la relation dans la requête GraphQL Application.
- Types DTO + type applicatif + mapping dans l'adapter.
- Vérification que la fiche détail et le catalogue continuent de se charger sans erreur avec le champ supplémentaire.

### Out of Scope
- Affichage des Business Capabilities dans l'UI (onglet fiche détail, carte Discover, catalogue) — itération suivante une fois la surface arbitrée.
- Filtre catalogue par Business Capability.
- Export PDF des Business Capabilities.
- Requête GraphQL dédiée aux FactSheets `BusinessCapability` (hiérarchie, description, parents/enfants) — hors sujet ici, seule la relation depuis l'Application est concernée.
- Relation symétrique côté Interfaces (`lib/leanix-interface-query.ts`) — non concernée.

## Affected Areas
- **Modifier** : `lib/leanix-application-query.ts` (bloc `... on Application` de `APPLICATION_QUERY`).
- **Modifier** : `lib/atom-api.ts` (type d'edge + champ sur le DTO du nœud Application).
- **Modifier** : `lib/types.ts` (type `BusinessCapability`, champ sur `Application`).
- **Modifier** : `lib/application-adapter.ts` (fonction de mapping + assignation du champ).
- **Non touché** : composants d'affichage (`components/detail/*`, `components/discover/*`), filtres, export PDF, `lib/leanix-interface-query.ts`.
- **À réconcilier** : `_specification/vibe coding/nouveaux-attributs-rest-application.md` — le point « relation `relApplicationToBusinessCapability` non reprise » est couvert par la présente spec.

## Edge Cases
- Application sans Business Capability rattachée → `businessCapabilities: []`, aucune erreur.
- Relation absente de la réponse (`null`) → traitée comme liste vide.
- Edge sans `factSheet`, ou `factSheet` sans `externalId` (fragment non applicable) → l'entrée est ignorée ou son `externalId` laissé vide, sans faire échouer le mapping de l'application entière.
- Le champ `relApplicationToBusinessCapability` n'existe pas dans le schéma LeanIX de l'espace ciblé → la requête entière échoue côté serveur ; ce cas doit être détecté au premier test contre l'API réelle (cf. Open Questions) avant de considérer la feature livrée.
- Même Business Capability liée plusieurs fois → doublons possibles dans la liste ; acceptable tant qu'il n'y a pas d'affichage, à traiter lors de l'itération UI.

## Open Questions
- **Surface d'affichage** : où exposer les Business Capabilities une fois la donnée disponible — nouvel onglet de la fiche détail (à côté de `DataTab`), section d'un onglet existant, ou carte d'information Discover ? => dans l'onglet DATA de la fiche détail.

- **Nom exact de la relation** : `relApplicationToBusinessCapability` est-il bien le nom du champ dans le schéma LeanIX ciblé (certains espaces exposent `relApplicationToBusinessCapabilities` au pluriel) ? À confirmer au premier appel réel. => oui c'est le bon

- **Champs complémentaires** : faut-il à terme récupérer aussi la hiérarchie (`parent`) ou la description des Business Capabilities, ou `id`/`name`/`externalId` suffisent-ils durablement ? => à ce niveau suffit pour l'instant

## Acceptance Criteria
- [ ] `APPLICATION_QUERY` contient la relation `relApplicationToBusinessCapability` avec `id`, `name` et `externalId.externalId`.
- [ ] Le DTO (`lib/atom-api.ts`) et le type applicatif (`lib/types.ts`) déclarent la relation et le champ `businessCapabilities`.
- [ ] `lib/application-adapter.ts` peuple `businessCapabilities`, liste vide en l'absence de relation.
- [ ] Le filtre par `externalId` (fiche détail) et la pagination continuent de fonctionner après modification de la requête.
- [ ] Aucun nouvel appel réseau introduit.
- [ ] Build Next OK, pas de régression sur le catalogue, la fiche détail, ni l'onglet Discover.
