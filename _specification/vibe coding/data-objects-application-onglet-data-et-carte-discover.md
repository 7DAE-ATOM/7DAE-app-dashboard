# Feature Spec: Data Objects d'une Application — onglet DATA et carte Discover

## Summary
- Chaque Application FactSheet est reliée à des FactSheets de type **Data Object** via la relation LeanIX `relApplicationToDataObject` (relation non encore interrogée par l'application).
- Sur la fiche détail d'une application (ex. `/application?id=7DAE`), ajouter un **nouvel onglet "DATA"** (à côté de Identity / Accountability / Compliance / Documentation / In Context) listant ces Data Objects.
- Afficher également ces Data Objects sur la **carte d'identité Application du graphe Discover** (`ApplicationInfoCard`, ouverte via l'icône Info d'un rectangle Application).

## Motivation
- Les Data Objects consommés/produits par une application sont une information de gouvernance des données importante (quelles données transitent par cette application), aujourd'hui invisible dans le dashboard alors que la relation existe côté LeanIX.
- La fiche détail a déjà une structure à onglets extensible (`Tabs.tsx`) ; ajouter un onglet dédié est cohérent avec Identity/Accountability/Compliance/Documentation.
- La carte d'identité Discover (spec `icone-info-carte-identite-application-discover.md`) donne déjà un résumé rapide d'une application explorée sur le graphe — y ajouter les Data Objects complète ce rappel d'identité sans obliger à ouvrir la fiche détail complète.

## Décisions (arbitrées)
- **Nom de la relation GraphQL** : `relApplicationToDataObject`, à ajouter aux requêtes GraphQL LeanIX existantes (fiche détail et/ou graphe Discover, selon ce qui alimente chaque écran).
- **Nom de l'onglet fiche détail** : "DATA" (tel que demandé), positionné parmi les onglets existants.
- **Portée** : affichage en lecture seule des Data Objects liés — pas de création, édition, ou suppression de la relation depuis le dashboard.

## Requirements

### Functional Requirements
- La fiche détail d'une application expose un onglet "DATA" listant les FactSheets Data Object reliés via `relApplicationToDataObject` (au minimum le nom de chaque Data Object).
- La carte d'identité Application affichée sur le graphe Discover affiche également la liste de ces Data Objects, en plus des champs déjà présents (Nom, External Ref, Description, Category, Portfolio, Operator).
- Une application sans Data Object associé affiche un état vide explicite (ex. "—" ou message dédié), jamais une section qui plante ou reste indéfiniment en chargement.

### Non-Functional Requirements
- Cohérence visuelle avec les tokens `--color-*` existants, lisible en thème clair et sombre.
- Pas de régression sur les onglets/fonctionnalités existants de la fiche détail ni sur le reste du graphe Discover.

## Scope

### In Scope
- Ajout de la relation `relApplicationToDataObject` aux requêtes GraphQL nécessaires.
- Nouvel onglet "DATA" sur la fiche détail Application.
- Affichage des Data Objects dans la carte d'identité Discover.

### Out of Scope
- Navigation depuis un Data Object listé vers une fiche détail dédiée (pas de page Data Object dans cette itération).
- Édition/gestion de la relation Application ↔ Data Object.
- Affichage des Data Objects ailleurs que la fiche détail et la carte Discover (ex. catalogue, export PDF) — non demandé.

## Affected Areas
- **Fiche détail Application** : nouvel onglet "DATA", requête(s) GraphQL alimentant la fiche détail (déjà migrées vers LeanIX GraphQL, cf. `migration-api-rest-vers-graphql-leanix.md`).
- **Graphe Discover** : `ApplicationInfoCard` (carte d'identité) et la donnée qui l'alimente (`Application` résolu via le catalogue, ou requête dédiée si le catalogue ne porte pas déjà cette relation).
- **Non touché a priori** : le reste du graphe Discover (rectangles, cercles Interface, arêtes, menus contextuels) — les Data Objects ne deviennent pas de nouveaux nœuds du graphe dans cette itération (cf. Open Questions).

## Edge Cases
- **Application sans Data Object associé** → onglet DATA et section de la carte Discover affichent un état vide explicite.
- **Data Object sans nom renseigné côté LeanIX** → repli explicite (ex. "—" ou identifiant technique), jamais une valeur brute vide.
- **Grand nombre de Data Objects liés à une même application** → l'affichage (onglet et carte) doit rester lisible (à trancher au plan : liste simple, scroll, pagination…).
- **Carte Discover à taille fixe** (contrainte déjà actée dans `icone-info-carte-identite-application-discover.md`) → ajouter les Data Objects sans casser la contrainte de taille constante de la carte (pagination/slide à envisager, comme pour la Description).

## Open Questions
- **Contenu affiché par Data Object** : uniquement le nom, ou aussi d'autres attributs (externalId, description, type) ?
=> uniquement le nom

- **Les Data Objects doivent-ils apparaître comme des nœuds cliquables/navigables dans le graphe Discover** (ex. nouveau type de nœud, au même titre qu'Interface), ou seulement comme une liste texte dans la carte d'identité, sans impact sur la structure du graphe ?
=> uniquement dans une liste texte dans la carte d'identité, sans impact sur la structure du graphe.

- **Affichage en cas de grand nombre de Data Objects** (fiche détail et carte Discover) : liste simple avec scroll, pagination, ou une limite avec "+N autres" ?
=> liste simple avec scroll

- **Source de données pour la carte Discover** : la carte doit-elle réutiliser une requête déjà déclenchée ailleurs sur le graphe (ex. celle utilisée par "Show API"/"Show providers"), ou déclencher son propre appel dédié à l'ouverture de la carte ?
=> reutiliser la requete deja déclenchée

## Acceptance Criteria
- [ ] La requête GraphQL applicable interroge bien `relApplicationToDataObject` et récupère au moins le nom de chaque Data Object.
- [ ] La fiche détail d'une application affiche un onglet "DATA" listant ses Data Objects (nom), avec un état vide explicite si aucun.
- [ ] La carte d'identité Application du graphe Discover affiche la même liste de Data Objects, avec le même repli en cas d'absence.
- [ ] Aucune régression sur les autres onglets de la fiche détail ni sur les fonctionnalités existantes du graphe Discover (interactions, menus, redimensionnement, carte d'identité déjà en place).
- [ ] Build Next OK (`npm run build`).
